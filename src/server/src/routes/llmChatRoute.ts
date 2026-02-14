import crypto from "crypto";
import type express from "express";
import { getUsdToIdr } from "../fx/fxService";
import { recordTokenSpend } from "../llm/freePoolAccounting";
import { type LlmError } from "../llm/llmClient";
import { upsertAuditRecord } from "../llm/audit/llmAudit";
import { pickProviderForRequest, type ProviderPolicyMeta } from "../llm/providerRouter";
import { validateChat } from "../llm/validate";
import { mapModel } from "../llm/models/modelMap";
import { initUsageTracker, type UsageRecord } from "../llm/usage/usageTracker";
import { type ProviderUsage } from "../llm/usage/providerUsage";
import { MARKUP_MULTIPLIER } from "../pricing/pricingConfig";
import { estimateIdrCost } from "../pricing/pricingCalculator";
import { chargeForLlm, getBalance } from "../rupiah/rupiahService";
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
  let auditSelectedProvider = "unknown";
  let auditActualProvider = "unknown";
  let auditLogicalModel = typeof req.body?.model === "string" ? req.body.model : "unknown";
  let auditProviderModelId = "unknown";
  let auditUsageSource = "estimate_wordcount";
  let auditInputTokens = 0;
  let auditOutputTokens = 0;
  let auditTotalTokens = 0;
  let auditTokenizerEncoding: string | null = null;
  let auditTokenizerFallback: string | null = null;
  let auditProviderUsagePresent = false;
  let auditFxRate: number | null = null;
  let auditPriceUsdPerM = deps.getPriceUsdPerM(auditLogicalModel);
  let auditCostIdr = 0;
  let auditBalanceBefore: number | null = null;
  let auditBalanceAfter: number | null = null;
  let auditChargeStatus = "unknown";
  let auditChargeError: string | null = null;
  let auditFreepoolApplied = false;
  let auditFreepoolDecrement = 0;
  let auditFreepoolReason: string | null = null;
  let auditHttpStatus: number | null = null;
  let auditTerminationReason: string | null = null;

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
    });
    res.setHeader("Retry-After", "5");
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
  let bypassBalance = deps.isDevBalanceBypassEnabled();
  let usageTracker: ReturnType<typeof initUsageTracker> | null = null;
  let stream: { providerUsagePromise?: Promise<ProviderUsage | null> } | null = null;
  req.on("close", () => {
    cancelled = true;
  });

  try {
    auditLogicalModel = validation.model;
    auditPriceUsdPerM = deps.getPriceUsdPerM(validation.model);
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
    const fx = await getUsdToIdr();
    fxRate = fx.rate;
    const estimated = estimateIdrCost({
      model: validation.model,
      inputTokens: inputTokensEstimate,
      outputTokens: 0,
      fxRate
    });
    if (!bypassBalance) {
      const balanceSnapshot = await getBalance(userId);
      if (balanceSnapshot.balance_idr < estimated.idrCostRounded) {
        const shortfall = estimated.idrCostRounded - balanceSnapshot.balance_idr;
        auditInputTokens = inputTokensEstimate;
        auditOutputTokens = 0;
        auditTotalTokens = inputTokensEstimate;
        auditUsageSource = "estimate_wordcount";
        auditProviderUsagePresent = false;
        auditCostIdr = 0;
        auditBalanceBefore = balanceSnapshot.balance_idr;
        auditBalanceAfter = balanceSnapshot.balance_idr;
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
          balance_idr: balanceSnapshot.balance_idr,
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
          rupiah_balance_before: balanceSnapshot.balance_idr,
          rupiah_balance_after: balanceSnapshot.balance_idr
        });
        statusCode = 402;
        terminationReason = "insufficient_rupiah";
        return;
      }
    } else {
      auditChargeStatus = "bypassed_dev";
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
    if (bypassBalance) {
      rupiahCost = 0;
      rupiahBefore = null;
      rupiahAfter = null;
      auditCostIdr = 0;
      auditBalanceBefore = null;
      auditBalanceAfter = null;
      auditChargeStatus = "bypassed_dev";
      auditChargeError = null;
    } else {
      const chargeResult = await chargeForLlm({
        userId,
        requestId,
        amountIdr: pricing.idrCostRounded,
        meta: { model: validation.model, totalTokens: pricing.totalTokens }
      });
      if (chargeResult.ok === true) {
        rupiahCost = pricing.idrCostRounded;
        rupiahBefore = chargeResult.balance_before;
        rupiahAfter = chargeResult.balance_after;
        auditCostIdr = pricing.idrCostRounded;
        auditBalanceBefore = chargeResult.balance_before;
        auditBalanceAfter = chargeResult.balance_after;
        auditChargeStatus = "charged";
      } else {
        const chargeError = chargeResult;
        terminationReason = "insufficient_rupiah";
        auditCostIdr = 0;
        auditBalanceBefore = chargeError.balance_idr;
        auditBalanceAfter = chargeError.balance_idr;
        auditChargeStatus = "failed";
        auditChargeError = "insufficient_rupiah";
      }
    }

    if (providerName === "openai" && policyMeta) {
      const eligible = policyMeta.cohort_selected && policyMeta.reason === "free_ok";
      if (eligible) {
        try {
          const applied = await recordTokenSpend({
            requestId,
            userId,
            dateKey: policyMeta.date_key,
            tokensUsed: usageRecord.total_tokens
          });
          freepoolApplied = applied.applied;
          freepoolDecrement = applied.applied ? usageRecord.total_tokens : 0;
          freepoolReason = applied.applied ? "applied" : "already_ledgered";
        } catch {
          freepoolApplied = false;
          freepoolReason = "error";
        }
      } else {
        freepoolApplied = false;
        freepoolReason = policyMeta.cohort_selected ? "cap_exhausted" : "not_in_cohort";
      }
    } else {
      freepoolApplied = false;
      freepoolReason = policyMeta ? "provider_not_openai" : "policy_missing";
    }
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
