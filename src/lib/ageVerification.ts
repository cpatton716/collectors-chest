/** Number of active listings free-tier users are allowed */
export const FREE_LISTING_LIMIT = 3;

/** Check if a profile has completed age verification */
export function isAgeVerified(
  profile: { age_confirmed_at?: string | null } | null | undefined
): boolean {
  return !!profile?.age_confirmed_at;
}

/** Check if an API error response indicates age verification is required */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isAgeVerificationError(response: any): boolean {
  return response?.error === "AGE_VERIFICATION_REQUIRED";
}
