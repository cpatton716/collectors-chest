/** Number of free trial days for the QR code promo */
export const PROMO_TRIAL_DAYS = 30;

/** localStorage key for the promo trial flag */
export const PROMO_TRIAL_STORAGE_KEY = "cc_promo_trial";

/** Set the promo trial flag with timestamp (called from /join/trial page) */
export function setPromoTrialFlag(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PROMO_TRIAL_STORAGE_KEY, Date.now().toString());
  }
}

/** Check if the promo trial flag is set and not expired (7-day expiration) */
export function getPromoTrialFlag(): boolean {
  if (typeof window !== "undefined") {
    const value = localStorage.getItem(PROMO_TRIAL_STORAGE_KEY);
    if (!value) return false;
    const timestamp = parseInt(value, 10);
    if (isNaN(timestamp)) return false;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - timestamp < sevenDays;
  }
  return false;
}

/** Clear the promo trial flag (called after checkout is initiated) */
export function clearPromoTrialFlag(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(PROMO_TRIAL_STORAGE_KEY);
  }
}
