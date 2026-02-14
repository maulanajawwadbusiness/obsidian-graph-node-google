export function buildAuditState(logicalModel: string, getPriceUsdPerM: (model: string) => number | null) {
  return {
    auditSelectedProvider: "unknown",
    auditActualProvider: "unknown",
    auditLogicalModel: logicalModel,
    auditProviderModelId: "unknown",
    auditUsageSource: "estimate_wordcount",
    auditInputTokens: 0,
    auditOutputTokens: 0,
    auditTotalTokens: 0,
    auditTokenizerEncoding: null as string | null,
    auditTokenizerFallback: null as string | null,
    auditProviderUsagePresent: false,
    auditFxRate: null as number | null,
    auditPriceUsdPerM: getPriceUsdPerM(logicalModel),
    auditCostIdr: 0,
    auditBalanceBefore: null as number | null,
    auditBalanceAfter: null as number | null,
    auditChargeStatus: "unknown",
    auditChargeError: null as string | null,
    auditFreepoolApplied: false,
    auditFreepoolDecrement: 0,
    auditFreepoolReason: null as string | null,
    auditHttpStatus: null as number | null,
    auditTerminationReason: null as string | null
  };
}

