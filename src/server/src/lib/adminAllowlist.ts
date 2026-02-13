export function readAdminAllowlistRaw(env: NodeJS.ProcessEnv): string {
  const primary = env.ADMIN_EMAIL_ALLOWLIST;
  if (typeof primary === "string" && primary.trim().length > 0) {
    return primary;
  }
  const fallback = env.ADMIN_EMAILS;
  if (typeof fallback === "string" && fallback.trim().length > 0) {
    return fallback;
  }
  return "";
}

export function parseAdminAllowlist(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
  );
}

export function isAdminEmail(allowlist: Set<string>, email: string | null | undefined): boolean {
  if (typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return allowlist.has(normalized);
}
