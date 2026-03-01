export function formatCents(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

export function getScanStatus(
  current: number,
  limit: number
): "ok" | "warning" | "critical" {
  const pct = current / limit;
  if (pct >= 0.9) return "critical";
  if (pct >= 0.7) return "warning";
  return "ok";
}
