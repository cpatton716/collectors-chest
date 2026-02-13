/**
 * Filter custom key info for public display.
 * Only approved custom key info should be shown to other users.
 */
export function filterCustomKeyInfoForPublic(
  customKeyInfo: string[],
  status: "pending" | "approved" | "rejected" | null
): string[] {
  if (status !== "approved") return [];
  return customKeyInfo;
}
