// src/lib/asset-tag.ts
/** Derive a 3-letter fallback code from an outlet name (alphanumerics, uppercased). */
function fallbackCode(outletName: string): string {
  const letters = outletName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return letters.slice(0, 3) || "AST";
}

/**
 * Human-readable asset tag: `‹outlet code›-‹numId padded to 4›` (e.g. "CHD-0042").
 * Falls back to a 3-letter code derived from the outlet name when `code` is unset.
 */
export function assetTag(
  code: string | null | undefined,
  numId: number,
  outletName: string
): string {
  const prefix = code && code.trim() ? code.trim().toUpperCase() : fallbackCode(outletName);
  return `${prefix}-${String(numId).padStart(4, "0")}`;
}
