import crypto from "crypto";
import type express from "express";
import { getUsdToIdr } from "../fx/fxService";
import { recordTokenSpend } from "../llm/freePoolAccounting";
import { upsertAuditRecord } from "../llm/audit/llmAudit";
import { pickProviderForRequest } from "../llm/providerRouter";
import { validatePrefill } from "../llm/validate";
import { mapModel } from "../llm/models/modelMap";
import { initUsageTracker, type UsageRecord } from "../llm/usage/usageTracker";
import { normalizeUsage, type ProviderUsage } from "../llm/usage/providerUsage";
import { MARKUP_MULTIPLIER } from "../pricing/pricingConfig";
import { estimateIdrCost } from "../pricing/pricingCalculator";
import { chargeForLlm, getBalance } from "../rupiah/rupiahService";
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
    });
    res.setHeader("Retry-After", "5");
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
    const fx = await getUsdToIdr();
    fxRate = fx.rate;
    const estimated = estimateIdrCost({
      model: validation.model,
      inputTokens: inputTokensEstimate,
      outputTokens: 0,
      fxRate
    });
    const bypassBalance = deps.isDevBalanceBypassEnabled();
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
          rupiah_balance_before: balanceSnapshot.balance_idr,
          rupiah_balance_after: balanceSnapshot.balance_idr
        });
        return;
      }
    } else {
      auditChargeStatus = "bypassed_dev";
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
      if (chargeResult.ok === false) {
        const chargeError = chargeResult;
        const shortfall = pricing.idrCostRounded - chargeError.balance_idr;
        auditCostIdr = 0;
        auditBalanceBefore = chargeError.balance_idr;
        auditBalanceAfter = chargeError.balance_idr;
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
          balance_idr: chargeError.balance_idr,
          shortfall_idr: shortfall
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
          rupiah_balance_before: chargeError.balance_idr,
          rupiah_balance_after: chargeError.balance_idr
        });
        return;
      }

      rupiahCost = pricing.idrCostRounded;
      rupiahBefore = chargeResult.balance_before;
      rupiahAfter = chargeResult.balance_after;
    }

    if (provider.name === "openai") {
      const eligible = router.policyMeta.cohort_selected && router.policyMeta.reason === "free_ok";
      if (eligible) {
        try {
          const applied = await recordTokenSpend({
            requestId,
            userId,
            dateKey: router.policyMeta.date_key,
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
        freepoolReason = router.policyMeta.cohort_selected ? "cap_exhausted" : "not_in_cohort";
      }
    } else {
      freepoolApplied = false;
      freepoolReason = "provider_not_openai";
    }
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
