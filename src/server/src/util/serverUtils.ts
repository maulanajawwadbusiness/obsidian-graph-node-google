export function parseGrossAmount(value: unknown, fallbackAmount: number): number | null {
  if (value === undefined || value === null) return fallbackAmount;
  const amount = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.trunc(amount);
  if (rounded <= 0) return null;
  return rounded;
}

export function isPaidStatus(status: string | undefined): boolean {
  return status === "settlement" || status === "capture";
}

export function verifyMidtransSignature(body: any): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
  if (!serverKey) return false;
  const orderId = String(body?.order_id || "");
  const statusCode = String(body?.status_code || "");
  const grossAmount = String(body?.gross_amount || "");
  const crypto = require("crypto");
  const computed = crypto.createHash("sha512").update(`${orderId}${statusCode}${grossAmount}${serverKey}`).digest("hex");
  return computed === String(body?.signature_key || "");
}

export function isDevBalanceBypassEnabled(isProd: () => boolean) {
  return !isProd() && process.env.DEV_BYPASS_BALANCE === "1";
}
