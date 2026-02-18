import crypto from "crypto";
import type express from "express";
import { buildAuditState } from "../llm/auditState";
import { checkCaps, computeWordCount, recordUsage } from "../llm/betaCaps";
import {
  applyFreepoolLedger,
  chargeUsage,
  estimateWithFx,
  getBypassChargeStatus,
  precheckBalance
} from "../llm/billingFlow";
import { type LlmError } from "../llm/llmClient";
import { upsertAuditRecord } from "../llm/audit/llmAudit";
import { pickProviderForRequest, type ProviderPolicyMeta } from "../llm/providerRouter";
import { validateChat } from "../llm/validate";
import { mapModel } from "../llm/models/modelMap";
import { initUsageTracker, type UsageRecord } from "../llm/usage/usageTracker";
import { type ProviderUsage } from "../llm/usage/providerUsage";
import { MARKUP_MULTIPLIER } from "../pricing/pricingConfig";
import { estimateIdrCost } from "../pricing/pricingCalculator";
import type { ApiErrorCode, AuthContext, LlmChatRouteDeps } from "./llmRouteDeps";
export function registerLlmChatRoute(app: express.Express, deps: LlmChatRouteDeps) {
app.post("/api/llm/chat", deps.requireAuth, async (req, res) => {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  deps.incRequestsTotal();
  deps.incRequestsInflight();
  deps.incRequestsStreaming();
  const user = res.locals.user as AuthContext;
  const userId = deps.getUserId(user);
  let rupiahCost: number | null = null;
  let rupiahBefore: number | null = null;
  let rupiahAfter: number | null = null;
  let fxRate = 0;
  let providerName: "openai" | "openrouter" | null = null;
  let providerModelId = "";
  let usageRecord: UsageRecord | null = null;
  let freepoolDecrement: number | null = null;
  let freepoolApplied: boolean | null = null;
  let freepoolReason: string | null = null;
  let providerUsage: ProviderUsage | null = null;
  let policyMeta: ProviderPolicyMeta | null = null;
  let auditWritten = false;
  let {
    auditSelectedProvider,
    auditActualProvider,
    auditLogicalModel,
    auditProviderModelId,
    auditUsageSource,
    auditInputTokens,
    auditOutputTokens,
    auditTotalTokens,
    auditTokenizerEncoding,
    auditTokenizerFallback,
    auditProviderUsagePresent,
    auditFxRate,
    auditPriceUsdPerM,
    auditCostIdr,
    auditBalanceBefore,
    auditBalanceAfter,
    auditChargeStatus,
    auditChargeError,
    auditFreepoolApplied,
    auditFreepoolDecrement,
    auditFreepoolReason,
    auditHttpStatus,
    auditTerminationReason
  } = buildAuditState(
    typeof req.body?.model === "string" ? req.body.model : "unknown",
    deps.getPriceUsdPerM
  );

  async function writeAudit() {
    if (auditWritten) return;
    auditWritten = true;
    try {
      await upsertAuditRecord({
        request_id: requestId,
        user_id: userId,
        endpoint_kind: "chat",
        selected_provider: auditSelectedProvider,
        actual_provider_used: auditActualProvider,
        logical_model: auditLogicalModel,
        provider_model_id: auditProviderModelId,
        usage_source: auditUsageSource,
        input_tokens: auditInputTokens,
        output_tokens: auditOutputTokens,
        total_tokens: auditTotalTokens,
        tokenizer_encoding_used: auditTokenizerEncoding,
        tokenizer_fallback_reason: auditTokenizerFallback,
        provider_usage_present: auditProviderUsagePresent,
        fx_usd_idr: auditFxRate,
        price_usd_per_mtoken: auditPriceUsdPerM,
        markup_multiplier: MARKUP_MULTIPLIER,
        cost_idr: auditCostIdr,
        balance_before_idr: auditBalanceBefore,
        balance_after_idr: auditBalanceAfter,
        charge_status: auditChargeStatus,
        charge_error_code: auditChargeError,
        freepool_applied: auditFreepoolApplied,
        freepool_decrement_tokens: auditFreepoolDecrement,
        freepool_reason: auditFreepoolReason,
        http_status: auditHttpStatus,
        termination_reason: auditTerminationReason
      });
    } catch {
      // Ignore audit write failures.
    }
  }

  const validationResult = validateChat(req.body);
  if (deps.isValidationError(validationResult)) {
    auditHttpStatus = validationResult.status;
    auditTerminationReason = "validation_error";
    auditChargeStatus = "skipped";
    await writeAudit();
    deps.sendApiError(res, validationResult.status, {
      ok: false,
      request_id: requestId,
      code: validationResult.code,
      error: validationResult.error
    });
    deps.logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/chat",
      user_id: userId,
      model: req.body?.model || "unknown",
      input_chars: typeof req.body?.userPrompt === "string" ? req.body.userPrompt.length : 0,
      output_chars: 0,
      duration_ms: Date.now() - startedAt,
      status_code: validationResult.status,
      termination_reason: "validation_error",
      rupiah_cost: null,
      rupiah_balance_before: null,
      rupiah_balance_after: null
    });
    deps.decRequestsInflight();
    deps.decRequestsStreaming();
    return;
  }
  const validation = validationResult;

  if (!deps.acquireLlmSlot(userId)) {
    auditHttpStatus = 429;
    auditTerminationReason = "rate_limited";
    auditChargeStatus = "skipped";
    await writeAudit();
    deps.sendApiError(res, 429, {
      ok: false,
      request_id: requestId,
      code: "rate_limited",
      error: "too many concurrent requests"
    }, {
      headers: { "Retry-After": "5" }
    });
    deps.logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/chat",
      user_id: userId,
      model: validation.model,
      input_chars: validation.userPrompt.length,
      output_chars: 0,
      duration_ms: Date.now() - startedAt,
      status_code: 429,
      termination_reason: "rate_limited",
      rupiah_cost: null,
      rupiah_balance_before: null,
      rupiah_balance_after: null
    });
    deps.decRequestsInflight();
    deps.decRequestsStreaming();
    return;
  }

  let statusCode = 200;
  let streamStarted = false;
  let cancelled = false;
  let outputChars = 0;
  let firstTokenAt: number | null = null;
  let terminationReason = "success";
  let chatInput = "";
  let capsDateKey = "";
  let capsSubmittedWordCount = 0;
  let capsCheckPassed = false;
  const devBypassEnabled = deps.isDevBalanceBypassEnabled();
  const betaFreeModeEnabled = deps.isBetaFreeModeEnabled();
  const bypassReason = betaFreeModeEnabled ? "beta" : devBypassEnabled ? "dev" : null;
  let bypassBalance = bypassReason !== null;
  let usageTracker: ReturnType<typeof initUsageTracker> | null = null;
  let stream: { providerUsagePromise?: Promise<ProviderUsage | null> } | null = null;
  req.on("close", () => {
    cancelled = true;
  });

  try {
    auditLogicalModel = validation.model;
    auditPriceUsdPerM = deps.getPriceUsdPerM(validation.model);
    capsSubmittedWordCount =
      typeof validation.submitted_word_count === "number"
        ? validation.submitted_word_count
        : computeWordCount(validation.userPrompt);
    const capsCheck = await checkCaps({
      db: await deps.getPool(),
      userId,
      submittedWordCount: capsSubmittedWordCount,
      requestId,
      capsEnabled: deps.isBetaCapsModeEnabled()
    });
    capsDateKey = capsCheck.dateKey;
    if (!capsCheck.ok) {
      const failedCheck = capsCheck as Extract<typeof capsCheck, { ok: false }>;
      auditHttpStatus = 429;
      auditTerminationReason = "rate_limited";
      auditChargeStatus = "skipped";
      await writeAudit();
      deps.sendApiError(res, 429, {
        ok: false,
        request_id: requestId,
        code: failedCheck.code,
        error:
          failedCheck.code === "beta_cap_exceeded"
            ? "document exceeds beta per-doc word limit"
            : "beta daily word limit reached",
        per_doc_limit: failedCheck.perDocLimit,
        daily_limit: failedCheck.dailyLimit,
        submitted_word_count: failedCheck.submittedWordCount,
        daily_used: failedCheck.dailyUsed,
        daily_remaining: failedCheck.dailyRemaining,
        date_key: failedCheck.dateKey,
        reset_note: failedCheck.resetNote
      });
      deps.logLlmRequest({
        request_id: requestId,
        endpoint: "/api/llm/chat",
        user_id: userId,
        model: validation.model,
        input_chars: validation.userPrompt.length,
        output_chars: 0,
        duration_ms: Date.now() - startedAt,
        status_code: 429,
        termination_reason: "rate_limited",
        rupiah_cost: null,
        rupiah_balance_before: null,
        rupiah_balance_after: null
      });
      statusCode = 429;
      terminationReason = "rate_limited";
      return;
    }
    capsCheckPassed = true;
    const router = await pickProviderForRequest({ userId, endpointKind: "chat" });
    const provider = router.provider;
    providerName = provider.name;
    policyMeta = router.policyMeta;
    providerModelId = mapModel(provider.name, validation.model);
    auditSelectedProvider = router.selectedProviderName;
    auditActualProvider = provider.name;
    auditProviderModelId = providerModelId;
    console.log(`[llm] provider_policy selected=${router.selectedProviderName} actual_provider=${provider.name} logical_model=${validation.model} provider_model_id=${providerModelId} cohort=${router.policyMeta.cohort_selected} used_tokens=${router.policyMeta.user_used_tokens_today} pool_remaining=${router.policyMeta.pool_remaining_tokens} cap=${router.policyMeta.user_free_cap} reason=${router.policyMeta.reason} date_key=${router.policyMeta.date_key}`);

    const systemPrompt = validation.systemPrompt || "";
    chatInput = `${systemPrompt}\n\nUSER PROMPT:\n${validation.userPrompt}`;
    usageTracker = initUsageTracker({
      provider: provider.name,
      logical_model: validation.model,
      provider_model_id: providerModelId,
      request_id: requestId
    });
    const chatMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: validation.userPrompt }
    ];
    usageTracker.recordInputMessages(chatMessages);
    const inputTokensEstimate = usageTracker.getInputTokensEstimate();
    const estimate = await estimateWithFx({
      model: validation.model,
      inputTokens: inputTokensEstimate,
      outputTokens: 0
    });
    fxRate = estimate.fxRate;
    const estimated = estimate.pricing;
    if (!bypassBalance) {
      const precheck = await precheckBalance({
        userId,
        neededIdr: estimated.idrCostRounded,
        bypassBalance
      });
      if (!precheck.ok) {
        const shortfall = precheck.shortfall_idr;
        auditInputTokens = inputTokensEstimate;
        auditOutputTokens = 0;
        auditTotalTokens = inputTokensEstimate;
        auditUsageSource = "estimate_wordcount";
        auditProviderUsagePresent = false;
        auditCostIdr = 0;
        auditBalanceBefore = precheck.balance_idr;
        auditBalanceAfter = precheck.balance_idr;
        auditChargeStatus = "failed";
        auditChargeError = "insufficient_rupiah";
        auditHttpStatus = 402;
        auditTerminationReason = "insufficient_rupiah";
        await writeAudit();
        res.status(402).json({
          ok: false,
          code: "insufficient_rupiah",
          request_id: requestId,
          needed_idr: estimated.idrCostRounded,
          balance_idr: precheck.balance_idr,
          shortfall_idr: shortfall
        });
        deps.logLlmRequest({
          request_id: requestId,
          endpoint: "/api/llm/chat",
          user_id: userId,
          model: validation.model,
          provider_model_id: providerModelId,
          input_chars: validation.userPrompt.length,
          output_chars: 0,
          duration_ms: Date.now() - startedAt,
          status_code: 402,
          termination_reason: "insufficient_rupiah",
          rupiah_cost: estimated.idrCostRounded,
          rupiah_balance_before: precheck.balance_idr,
          rupiah_balance_after: precheck.balance_idr
        });
        statusCode = 402;
        terminationReason = "insufficient_rupiah";
        return;
      }
    } else {
      auditChargeStatus = getBypassChargeStatus(bypassReason);
      auditChargeError = null;
      auditCostIdr = 0;
      auditBalanceBefore = null;
      auditBalanceAfter = null;
    }

    stream = provider.generateTextStream({
      model: validation.model,
      input: chatInput
    });

    res.setHeader("X-Request-Id", requestId);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");

    for await (const chunk of stream as any) {
      if (cancelled) break;
      if (!streamStarted) {
        streamStarted = true;
        firstTokenAt = Date.now();
      }
      outputChars += chunk.length;
      usageTracker.recordOutputChunk(chunk);
      res.write(chunk);
    }

    res.end();
    statusCode = 200;
    if (cancelled) {
      terminationReason = "client_abort";
      statusCode = 499;
    }
  } catch (err: any) {
    const info = err?.info as LlmError | undefined;
    if (!streamStarted) {
      if (info) {
        statusCode = deps.mapLlmErrorToStatus(info);
        deps.sendApiError(res, statusCode, {
          ok: false,
          request_id: requestId,
          code: info.code as ApiErrorCode,
          error: info.error
        });
        terminationReason = deps.mapTerminationReason(statusCode, info.code);
      } else {
        statusCode = 502;
        deps.sendApiError(res, statusCode, {
          ok: false,
          request_id: requestId,
          code: "upstream_error",
          error: "stream failed"
        });
        terminationReason = "upstream_error";
      }
    } else {
      statusCode = 502;
      res.end();
      terminationReason = "upstream_error";
    }
  } finally {
    if (!usageTracker) {
      usageTracker = initUsageTracker({
        provider: providerName ?? "openai",
        logical_model: validation.model,
        provider_model_id: providerModelId || "unknown",
        request_id: requestId
      });
      const chatMessages = [
        { role: "system", content: validation.systemPrompt || "" },
        { role: "user", content: validation.userPrompt }
      ];
      usageTracker.recordInputMessages(chatMessages);
    }
    if (providerUsage === null) {
      const streamUsage = stream?.providerUsagePromise;
      if (streamUsage) {
        try {
          providerUsage = await streamUsage;
        } catch {
          providerUsage = null;
        }
      }
    }
    usageRecord = await usageTracker.finalize({ providerUsage });
    auditUsageSource = usageRecord.source;
    auditInputTokens = usageRecord.input_tokens;
    auditOutputTokens = usageRecord.output_tokens;
    auditTotalTokens = usageRecord.total_tokens;
    auditTokenizerEncoding = usageRecord.tokenizer_encoding_used ?? null;
    auditTokenizerFallback = usageRecord.tokenizer_fallback_reason ?? null;
    auditProviderUsagePresent = providerUsage ? true : false;
    const pricing = estimateIdrCost({
      model: validation.model,
      inputTokens: usageRecord.input_tokens,
      outputTokens: usageRecord.output_tokens,
      fxRate
    });
    const charge = await chargeUsage({
      userId,
      requestId,
      model: validation.model,
      totalTokens: pricing.totalTokens,
      amountIdr: pricing.idrCostRounded,
      bypassBalance,
      bypassReason
    });
    if (charge.ok) {
      rupiahCost = charge.rupiahCost;
      rupiahBefore = charge.rupiahBefore;
      rupiahAfter = charge.rupiahAfter;
      auditCostIdr = charge.rupiahCost;
      auditBalanceBefore = charge.rupiahBefore;
      auditBalanceAfter = charge.rupiahAfter;
      auditChargeStatus = charge.chargeStatus;
      auditChargeError = null;
      if (statusCode === 200 && capsCheckPassed) {
        try {
          await recordUsage({
            db: await deps.getPool(),
            userId,
            dateKey: capsDateKey,
            deltaWords: capsSubmittedWordCount,
            requestId,
            capsEnabled: deps.isBetaCapsModeEnabled()
          });
        } catch (error) {
          console.warn(`[caps] record_failed request_id=${requestId} endpoint=/api/llm/chat error=${String(error)}`);
        }
      }
    } else {
      terminationReason = "insufficient_rupiah";
      auditCostIdr = 0;
      auditBalanceBefore = charge.balance_idr;
      auditBalanceAfter = charge.balance_idr;
      auditChargeStatus = "failed";
      auditChargeError = "insufficient_rupiah";
    }

    const freepool = await applyFreepoolLedger({
      providerName,
      policyMeta,
      requestId,
      userId,
      tokensUsed: usageRecord.total_tokens
    });
    freepoolApplied = freepool.applied;
    freepoolDecrement = freepool.decrement;
    freepoolReason = freepool.reason;
    auditFreepoolApplied = freepoolApplied ?? false;
    auditFreepoolDecrement = freepoolDecrement ?? 0;
    auditFreepoolReason = freepoolReason;

    deps.releaseLlmSlot(userId);
    deps.decRequestsInflight();
    deps.decRequestsStreaming();
    auditHttpStatus = statusCode;
    auditTerminationReason = terminationReason;
    await writeAudit();
    deps.logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/chat",
      user_id: userId,
      model: validation.model,
      provider_model_id: providerModelId || null,
      input_chars: validation.userPrompt.length,
      output_chars: outputChars,
      duration_ms: Date.now() - startedAt,
      time_to_first_token_ms: firstTokenAt ? firstTokenAt - startedAt : null,
      status_code: statusCode,
      termination_reason: terminationReason,
      provider: providerName,
      rupiah_cost: rupiahCost,
      rupiah_balance_before: rupiahBefore,
      rupiah_balance_after: rupiahAfter,
      usage_input_tokens: usageRecord?.input_tokens ?? null,
      usage_output_tokens: usageRecord?.output_tokens ?? null,
      usage_total_tokens: usageRecord?.total_tokens ?? null,
      usage_source: usageRecord?.source ?? null,
      provider_usage_present: providerUsage ? true : false,
      provider_usage_source: providerUsage ? providerName : null,
      provider_usage_fields_present: deps.getUsageFieldList(providerUsage),
      tokenizer_encoding_used: usageRecord?.tokenizer_encoding_used ?? null,
      tokenizer_fallback_reason: usageRecord?.tokenizer_fallback_reason ?? null,
      freepool_decrement_tokens: freepoolDecrement,
      freepool_decrement_applied: freepoolApplied,
      freepool_decrement_reason: freepoolReason
    });
  }
});
}
