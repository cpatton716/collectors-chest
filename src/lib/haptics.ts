/**
 * Web Vibration API wrapper with semantic event names.
 *
 * Progressive enhancement: works on Android Chrome / Firefox / Edge; silently
 * no-ops on iOS Safari (Apple does not implement the Vibration API) and on
 * desktop browsers. The user's device settings (silent mode, system haptics
 * preference) are honored automatically by the API — we don't need to gate.
 *
 * SSR-safe: every call checks `typeof navigator` before reaching for vibrate.
 *
 * Native Capacitor haptics (iOS + Android proper tactile feedback) will land
 * later via the @capacitor/haptics plugin once native shells ship — see
 * BACKLOG "iOS Native App" + "Android Native App". This module is the
 * web-only Option A.
 */

function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers throw on certain patterns / when in low-power mode.
    // Vibration is purely cosmetic, so swallow.
  }
}

/** Brief tap for taps, button presses, toggles. ~10ms. */
export function hapticTap(): void {
  vibrate(10);
}

/** Slightly more distinct than a tap — for "added to X" / "saved" confirmations. ~30ms. */
export function hapticSuccess(): void {
  vibrate(30);
}

/** Heavy negative buzz for failures (network error, payment declined). */
export function hapticError(): void {
  vibrate([60, 40, 60]);
}
