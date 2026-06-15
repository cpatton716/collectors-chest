import { buildUnsubscribeUrl } from "@/lib/unsubscribeToken";
import { SUPPORT_EMAIL } from "./constants";
import type { NotificationEmailType } from "./types";

/**
 * Escape HTML-significant characters so user-controlled strings can be safely
 * interpolated into email HTML templates. Without this, values like comic
 * titles, display names, message previews, or failure reasons could inject
 * markup/script into the rendered email (stored-XSS-style payloads that some
 * webmail clients still execute, or layout-breaking tags).
 *
 * Order matters: ampersand must be replaced first so we don't double-encode
 * the entities introduced by the later replacements.
 */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function firstJoined<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// ============================================================================
// EMAIL SHARED HELPERS
// ============================================================================

export function emailHeader(_soundEffect: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
  return `
    <div style="background: #0066FF; padding: 32px 24px 28px; text-align: center; position: relative; overflow: hidden;">
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle, rgba(255,255,255,0.15) 1.5px, transparent 1.5px); background-size: 12px 12px; pointer-events: none;"></div>
      <div style="position: relative; z-index: 1;">
        <img src="${appUrl}/icons/emblem.png" alt="Collectors Chest" width="180" height="180" style="display: block; margin: 0 auto;" />
      </div>
    </div>
  `;
}

export function emailFooter(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
  return `
    <div style="background: #f5f5f5; border-top: 2px solid #e5e5e5; padding: 24px 24px 28px; text-align: center;">
      <p style="font-size: 13px; color: #666; font-style: italic; margin: 0 0 8px;">Scan comics. Track value. Collect smarter.</p>
      <p style="font-size: 12px; color: #999; margin: 0 0 8px; line-height: 1.5;">Twisted Jester LLC · collectors-chest.com</p>
      <p style="font-size: 11px; color: #bbb; margin: 0 0 8px; line-height: 1.5;"><a href="${appUrl}/privacy" style="color: #999; text-decoration: underline;">Privacy Policy</a> · <a href="${appUrl}/terms" style="color: #999; text-decoration: underline;">Terms of Service</a></p>
      <p style="font-size: 11px; color: #bbb; margin: 0; line-height: 1.5;"><a href="${appUrl}/settings/notifications" style="color: #999; text-decoration: underline;">Manage email preferences</a></p>
    </div>
  `;
}

/**
 * Build RFC 8058 List-Unsubscribe headers for a NON-transactional send.
 *
 * Returns `{}` (no headers) for transactional types or when there's no
 * profile to scope the unsubscribe to — transactional mail must never carry an
 * unsubscribe affordance. Non-transactional mail gets both the one-click HTTP
 * URL and the owner-supplied mailto, plus `List-Unsubscribe-Post` so Gmail/
 * Yahoo can offer native one-click unsubscribe.
 *
 * The signed unsubscribe URL is minted via the shared `@/lib/unsubscribeToken`
 * helper so a token stamped here always verifies in the unsubscribe route.
 */
export function buildUnsubscribeHeaders(
  type: NotificationEmailType,
  profileId: string | null | undefined,
  getCategory: (t: string) => string
): Record<string, string> {
  const category = getCategory(type);
  if (category === "transactional") return {};
  if (!profileId) return {};
  const url = buildUnsubscribeUrl(profileId, category);
  return {
    "List-Unsubscribe": `<${url}>, <mailto:${SUPPORT_EMAIL}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
