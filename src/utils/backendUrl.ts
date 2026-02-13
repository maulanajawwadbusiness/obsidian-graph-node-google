export function resolveBackendUrl(base: string, path: string): string {
  const trimmedBase = base.trim().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseEndsWithApi = /\/api$/i.test(trimmedBase);
  const pathStartsWithApi = /^\/api(?:\/|$)/i.test(normalizedPath);

  if (baseEndsWithApi && pathStartsWithApi) {
    const dedupedPath = normalizedPath.replace(/^\/api(?=\/|$)/i, "");
    const finalPath = dedupedPath.length > 0 ? dedupedPath : "/";
    return `${trimmedBase}${finalPath}`;
  }

  return `${trimmedBase}${normalizedPath}`;
}
