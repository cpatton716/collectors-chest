/**
 * Parse a currency string into a number, stripping $ and , characters.
 * Returns undefined for empty/invalid values.
 */
export function parseCurrencyValue(value: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[$,]/g, "").trim();
  if (!cleaned) return undefined;
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}
