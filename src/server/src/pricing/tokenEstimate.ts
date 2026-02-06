export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  const tokens = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((part) => part.length > 0);
  return tokens.length;
}
