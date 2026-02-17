import crypto from "crypto";
import type express from "express";
import { buildAuditState } from "../llm/auditState";
import {
  applyFreepoolLedger,
  chargeUsage,
  estimateWithFx,
  getBypassChargeStatus,
  precheckBalance
} from "../llm/billingFlow";
import { upsertAuditRecord } from "../llm/audit/llmAudit";
import { pickProviderForRequest } from "../llm/providerRouter";
import { validatePrefill } from "../llm/validate";
import { mapModel } from "../llm/models/modelMap";
import { initUsageTracker, type UsageRecord } from "../llm/usage/usageTracker";
import { normalizeUsage, type ProviderUsage } from "../llm/usage/providerUsage";
import { MARKUP_MULTIPLIER } from "../pricing/pricingConfig";
import { estimateIdrCost } from "../pricing/pricingCalculator";
import type { ApiErrorCode, AuthContext, LlmPrefillRouteDeps } from "./llmRouteDeps";
export function registerLlmPrefillRoute(app: express.Express, deps: LlmPrefillRouteDeps) {
app.post("/api/llm/prefill", deps.requireAuth, async (req, res) => {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID();
  deps.incRequestsTotal();
  deps.incRequestsInflight();
  const user = res.locals.user as AuthContext;
  const userId = deps.getUserId(user);
  let rupiahCost: number | null = null;
  let rupiahBefore: number | null = null;
  let rupiahAfter: number | null = null;
  let fxRate = 0;
  let providerName: "openai" | "openrouter" | null = null;
  let usageRecord: UsageRecord | null = null;
  let freepoolDecrement: number | null = null;
  let freepoolApplied: boolean | null = null;
  let freepoolReason: string | null = null;
  let providerUsage: ProviderUsage | null = null;
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
        endpoint_kind: "prefill",
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

  const validationResult = validatePrefill(req.body);
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
      endpoint: "/api/llm/prefill",
      user_id: userId,
      model: req.body?.model || "unknown",
      input_chars: typeof req.body?.nodeLabel === "string" ? req.body.nodeLabel.length : 0,
      output_chars: 0,
      duration_ms: Date.now() - startedAt,
      status_code: validationResult.status,
      termination_reason: "validation_error",
      rupiah_cost: null,
      rupiah_balance_before: null,
      rupiah_balance_after: null
    });
    deps.decRequestsInflight();
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
      endpoint: "/api/llm/prefill",
      user_id: userId,
      model: validation.model,
      input_chars: validation.nodeLabel.length,
      output_chars: 0,
      duration_ms: Date.now() - startedAt,
      status_code: 429,
      termination_reason: "rate_limited",
      rupiah_cost: null,
      rupiah_balance_before: null,
      rupiah_balance_after: null
    });
    deps.decRequestsInflight();
    return;
  }

  try {
    auditLogicalModel = validation.model;
    auditPriceUsdPerM = deps.getPriceUsdPerM(validation.model);
    const router = await pickProviderForRequest({ userId, endpointKind: "prefill" });
    const provider = router.provider;
    providerName = provider.name;
    auditSelectedProvider = router.selectedProviderName;
    auditActualProvider = provider.name;
    const providerModelId = mapModel(provider.name, validation.model);
    auditProviderModelId = providerModelId;
    console.log(`[llm] provider_policy selected=${router.selectedProviderName} actual_provider=${provider.name} logical_model=${validation.model} provider_model_id=${providerModelId} cohort=${router.policyMeta.cohort_selected} used_tokens=${router.policyMeta.user_used_tokens_today} pool_remaining=${router.policyMeta.pool_remaining_tokens} cap=${router.policyMeta.user_free_cap} reason=${router.policyMeta.reason} date_key=${router.policyMeta.date_key}`);

    const promptParts: string[] = [];
    promptParts.push(`Target Node: ${validation.nodeLabel}`);
    if (validation.content) {
      promptParts.push(`Node Knowledge: \"${validation.content.title}\" - ${validation.content.summary.slice(0, 150)}...`);
    }
    if (validation.miniChatMessages && validation.miniChatMessages.length > 0) {
      const recent = validation.miniChatMessages.slice(-4);
      promptParts.push("Recent Chat History:");
      for (const msg of recent) {
        const text = msg.text.length > 300 ? `${msg.text.slice(0, 300)}...` : msg.text;
        promptParts.push(`${msg.role.toUpperCase()}: ${text}`);
      }
    } else {
      promptParts.push("(No previous chat history)");
    }

    const systemPrompt = [
      "You are generating ONE suggested prompt to prefill a chat input.",
      "Rules:",
      "- One line only.",
      "- Actionable and specific to the node.",
      "- No prefixes like \"suggested prompt:\".",
      "- No quotes.",
      "- Max 160 characters.",
      "- Tone: calm, analytical, dark-elegant.",
      "- Return ONLY the prompt text."
    ].join("\n");

    const input = `${systemPrompt}\n\nCONTEXT:\n${promptParts.join("\n")}`;

    const usageTracker = initUsageTracker({
      provider: provider.name,
      logical_model: validation.model,
      provider_model_id: providerModelId,
      request_id: requestId
    });
    usageTracker.recordInputText(input);
    const inputTokensEstimate = usageTracker.getInputTokensEstimate();
    const estimate = await estimateWithFx({
      model: validation.model,
      inputTokens: inputTokensEstimate,
      outputTokens: 0
    });
    fxRate = estimate.fxRate;
    const estimated = estimate.pricing;
    const devBypassEnabled = deps.isDevBalanceBypassEnabled();
    const betaFreeModeEnabled = deps.isBetaFreeModeEnabled();
    const bypassReason = betaFreeModeEnabled ? "beta" : devBypassEnabled ? "dev" : null;
    const bypassBalance = bypassReason !== null;
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
          endpoint: "/api/llm/prefill",
          user_id: userId,
          model: validation.model,
          provider_model_id: providerModelId,
          input_chars: validation.nodeLabel.length,
          output_chars: 0,
          duration_ms: Date.now() - startedAt,
          status_code: 402,
          termination_reason: "insufficient_rupiah",
          rupiah_cost: estimated.idrCostRounded,
          rupiah_balance_before: precheck.balance_idr,
          rupiah_balance_after: precheck.balance_idr
        });
        return;
    } else if (bypassBalance) {
      auditChargeStatus = getBypassChargeStatus(bypassReason);
      auditChargeError = null;
      auditCostIdr = 0;
      auditBalanceBefore = null;
      auditBalanceAfter = null;
    }

    const result = await provider.generateText({
      model: validation.model,
      input
    });

    if (result.ok === false) {
      const llmError = result;
      const status = deps.mapLlmErrorToStatus(llmError);
      auditInputTokens = inputTokensEstimate;
      auditOutputTokens = 0;
      auditTotalTokens = inputTokensEstimate;
      auditUsageSource = "estimate_wordcount";
      auditProviderUsagePresent = false;
      auditCostIdr = 0;
      auditChargeStatus = "skipped";
      auditHttpStatus = status;
      auditTerminationReason = deps.mapTerminationReason(status, llmError.code);
      await writeAudit();
      deps.sendApiError(res, status, {
        ok: false,
        request_id: requestId,
        code: llmError.code as ApiErrorCode,
        error: llmError.error
      });
      deps.logLlmRequest({
        request_id: requestId,
        endpoint: "/api/llm/prefill",
        user_id: userId,
        model: validation.model,
        provider_model_id: providerModelId,
        input_chars: validation.nodeLabel.length,
        output_chars: 0,
        duration_ms: Date.now() - startedAt,
        status_code: status,
        termination_reason: deps.mapTerminationReason(status, llmError.code),
        rupiah_cost: null,
        rupiah_balance_before: null,
        rupiah_balance_after: null
      });
      return;
    }

    usageTracker.recordOutputText(result.text);
    providerUsage = normalizeUsage(result.usage) || null;
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
    if (!charge.ok) {
      auditCostIdr = 0;
      auditBalanceBefore = charge.balance_idr;
      auditBalanceAfter = charge.balance_idr;
      auditChargeStatus = "failed";
      auditChargeError = "insufficient_rupiah";
      auditHttpStatus = 402;
      auditTerminationReason = "insufficient_rupiah";
      await writeAudit();
      res.status(402).json({
        ok: false,
        code: "insufficient_rupiah",
        request_id: requestId,
        needed_idr: pricing.idrCostRounded,
        balance_idr: charge.balance_idr,
        shortfall_idr: charge.shortfall_idr
      });
      deps.logLlmRequest({
        request_id: requestId,
        endpoint: "/api/llm/prefill",
        user_id: userId,
        model: validation.model,
        provider_model_id: providerModelId,
        input_chars: validation.nodeLabel.length,
        output_chars: result.text.length,
        duration_ms: Date.now() - startedAt,
        status_code: 402,
        termination_reason: "insufficient_rupiah",
        rupiah_cost: pricing.idrCostRounded,
        rupiah_balance_before: charge.balance_idr,
        rupiah_balance_after: charge.balance_idr
      });
      return;
    }

    rupiahCost = charge.rupiahCost;
    rupiahBefore = charge.rupiahBefore;
    rupiahAfter = charge.rupiahAfter;
    auditCostIdr = charge.rupiahCost;
    auditBalanceBefore = charge.rupiahBefore;
    auditBalanceAfter = charge.rupiahAfter;
    auditChargeStatus = charge.chargeStatus;
    auditChargeError = null;

    const freepool = await applyFreepoolLedger({
      providerName: provider.name,
      policyMeta: router.policyMeta,
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

    res.setHeader("X-Request-Id", requestId);
    res.json({ ok: true, request_id: requestId, prompt: result.text });
    auditHttpStatus = 200;
    auditTerminationReason = "success";
    await writeAudit();
    deps.logLlmRequest({
      request_id: requestId,
      endpoint: "/api/llm/prefill",
      user_id: userId,
      model: validation.model,
      provider_model_id: providerModelId,
      input_chars: validation.nodeLabel.length,
      output_chars: result.text.length,
      duration_ms: Date.now() - startedAt,
      status_code: 200,
      termination_reason: "success",
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
  } finally {
    deps.releaseLlmSlot(userId);
    deps.decRequestsInflight();
  }
});
}
