import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { EMAIL_BATCH_SIZE, FROM_EMAIL } from "./constants";
import { buildUnsubscribeHeaders } from "./helpers";
import { resolveProfileIdByEmail } from "./profiles";
import {
  auctionEndingSoonBidderTemplate,
  auctionPaymentExpiredBuyerTemplate,
  auctionPaymentExpiredSellerTemplate,
  auctionSoldTemplate,
  auctionWonTemplate,
  bonusScanGrantedTemplate,
  bonusScanVerifyTemplate,
  feedbackReminderTemplate,
  itemSoldTemplate,
  listingExpiredTemplate,
  listingExpiringTemplate,
  messageReceivedTemplate,
  newListingFromFollowedTemplate,
  offerAcceptedTemplate,
  offerCounteredTemplate,
  offerExpiredTemplate,
  offerReceivedTemplate,
  offerRejectedTemplate,
  outbidTemplate,
  paymentMissedFlaggedTemplate,
  paymentMissedWarningTemplate,
  paymentReminderTemplate,
  purchaseConfirmationTemplate,
  secondChanceAcceptedTemplate,
  secondChanceAvailableTemplate,
  secondChanceDeclinedTemplate,
  secondChanceExpiredTemplate,
  secondChanceOfferedTemplate,
  subscriptionPaymentFailedTemplate,
  trialExpiringTemplate,
  welcomeTemplate,
} from "./templates";
import type {
  AuctionEndEmailData,
  AuctionEndingSoonEmailData,
  BidActivityEmailData,
  BonusScanGrantedEmailData,
  BonusScanVerifyEmailData,
  EmailTemplate,
  FeedbackEmailData,
  ListingEmailData,
  MarketplaceTransactionEmailData,
  MessageEmailData,
  NewListingEmailData,
  NotificationEmailType,
  OfferEmailData,
  PaymentExpiredBuyerEmailData,
  PaymentExpiredSellerEmailData,
  PaymentMissedFlaggedEmailData,
  PaymentMissedWarningEmailData,
  PaymentReminderEmailData,
  SecondChanceRunnerUpEmailData,
  SecondChanceSellerAvailableEmailData,
  SecondChanceSellerResultEmailData,
  SendNotificationEmailParams,
  SubscriptionPaymentFailedEmailData,
  TrialExpiringEmailData,
  WelcomeEmailData,
} from "./types";

const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================================================
// SEND EMAIL FUNCTION
// ============================================================================

/**
 * Resolve an email template from a notification type + its data payload.
 * Returns null when `type` is unknown.
 *
 * Extracted so both `sendNotificationEmail` (single) and
 * `sendNotificationEmailsBatch` (Resend batch API) can reuse the same
 * switch.
 */
function resolveNotificationTemplate(
  type: NotificationEmailType,
  data: SendNotificationEmailParams["data"]
): EmailTemplate | null {
  switch (type) {
    case "offer_received":
      return offerReceivedTemplate(data as OfferEmailData);
    case "offer_accepted":
      return offerAcceptedTemplate(data as OfferEmailData);
    case "offer_rejected":
      return offerRejectedTemplate(data as OfferEmailData);
    case "offer_countered":
      return offerCounteredTemplate(data as OfferEmailData);
    case "offer_expired":
      return offerExpiredTemplate(data as OfferEmailData);
    case "listing_expiring":
      return listingExpiringTemplate(data as ListingEmailData);
    case "listing_expired":
      return listingExpiredTemplate(data as ListingEmailData);
    case "message_received":
      return messageReceivedTemplate(data as MessageEmailData);
    case "feedback_reminder":
      return feedbackReminderTemplate(data as FeedbackEmailData);
    case "new_listing_from_followed":
      return newListingFromFollowedTemplate(data as NewListingEmailData);
    case "welcome":
      return welcomeTemplate(data as WelcomeEmailData);
    case "trial_expiring":
      return trialExpiringTemplate(data as TrialExpiringEmailData);
    case "purchase_confirmation":
      return purchaseConfirmationTemplate(
        data as MarketplaceTransactionEmailData
      );
    case "item_sold":
      return itemSoldTemplate(data as MarketplaceTransactionEmailData);
    case "outbid":
      return outbidTemplate(data as BidActivityEmailData);
    case "auction_won":
      return auctionWonTemplate(data as AuctionEndEmailData);
    case "auction_sold":
      return auctionSoldTemplate(data as AuctionEndEmailData);
    case "payment_reminder":
      return paymentReminderTemplate(data as PaymentReminderEmailData);
    case "auction_payment_expired":
      return auctionPaymentExpiredBuyerTemplate(
        data as PaymentExpiredBuyerEmailData
      );
    case "auction_payment_expired_seller":
      return auctionPaymentExpiredSellerTemplate(
        data as PaymentExpiredSellerEmailData
      );
    // Second Chance Offer + Strike System - see templates module.
    case "second_chance_available":
      return secondChanceAvailableTemplate(
        data as SecondChanceSellerAvailableEmailData
      );
    case "second_chance_offered":
      return secondChanceOfferedTemplate(
        data as SecondChanceRunnerUpEmailData
      );
    case "second_chance_accepted":
      return secondChanceAcceptedTemplate(
        data as SecondChanceSellerResultEmailData
      );
    case "second_chance_declined":
      return secondChanceDeclinedTemplate(
        data as SecondChanceSellerResultEmailData
      );
    case "second_chance_expired":
      return secondChanceExpiredTemplate(
        data as SecondChanceSellerResultEmailData
      );
    case "payment_missed_warning":
      return paymentMissedWarningTemplate(
        data as PaymentMissedWarningEmailData
      );
    case "payment_missed_flagged":
      return paymentMissedFlaggedTemplate(
        data as PaymentMissedFlaggedEmailData
      );
    case "subscription_payment_failed":
      return subscriptionPaymentFailedTemplate(
        data as SubscriptionPaymentFailedEmailData
      );
    case "auction_ending_soon_bidder":
      return auctionEndingSoonBidderTemplate(
        data as AuctionEndingSoonEmailData
      );
    case "bonus_scan_verify":
      return bonusScanVerifyTemplate(data as BonusScanVerifyEmailData);
    case "bonus_scan_granted":
      return bonusScanGrantedTemplate(data as BonusScanGrantedEmailData);
    default:
      return null;
  }
}

export async function sendNotificationEmail({
  to,
  type,
  data,
  profileId,
}: SendNotificationEmailParams): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  // Skip if no API key configured
  if (!process.env.RESEND_API_KEY) {
    return { success: true };
  }

  // Preference gating - skip if the recipient has opted out of this category.
  // Transactional types and unknown profiles always pass through (handled
  // inside `shouldSendEmailForUser`). We also hold onto the resolved profile id
  // + category resolver so the same context can build List-Unsubscribe headers.
  let resolvedProfileId: string | null = profileId ?? null;
  // Fallback mirrors notificationPreferences' own default (unknown → marketplace,
  // i.e. non-transactional) so a failed import still attaches unsubscribe headers.
  let getCategory: (t: string) => string = () => "marketplace";
  try {
    const prefs = await import("../notificationPreferences");
    getCategory = prefs.getNotificationCategory;
    if (resolvedProfileId === null && getCategory(type) !== "transactional") {
      // Only do the email->profile lookup when the category could be gated.
      resolvedProfileId = await resolveProfileIdByEmail(to);
    }
    const allowed = await prefs.shouldSendEmailForUser(resolvedProfileId, type, supabaseAdmin);
    if (!allowed) {
      const category = getCategory(type);
      console.log(`[email] skipped - user opted out of ${category} (${type} to ${to})`);
      return { success: true, skipped: true };
    }
  } catch (err) {
    // Preference check failing should never block a send - log and continue.
    console.error("[email] preference check failed, sending anyway:", err);
  }

  const template = resolveNotificationTemplate(type, data);
  if (!template) {
    return { success: false, error: `Unknown email type: ${type}` };
  }

  // Non-transactional mail carries one-click unsubscribe headers (M-EM4).
  const unsubscribeHeaders = buildUnsubscribeHeaders(type, resolvedProfileId, getCategory);

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      ...(Object.keys(unsubscribeHeaders).length > 0 ? { headers: unsubscribeHeaders } : {}),
    });

    if (error) {
      console.error(`[Email] Failed to send ${type} to ${to}:`, error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error(`[Email] Error sending ${type} to ${to}:`, err);
    return { success: false, error: String(err) };
  }
}

/**
 * Fan-in multiple notification emails via Resend's `batch.send()` API.
 *
 * Use this from cron jobs or any fan-out where a loop of
 * `sendNotificationEmail()` calls would hit Resend's 10 req/sec rate limit
 * or risk a Netlify function timeout.
 *
 * Behavior:
 *   - Skips cleanly when RESEND_API_KEY is not configured (dev/preview).
 *   - Chunks into EMAIL_BATCH_SIZE calls.
 *   - Never throws: failures are logged and returned in `errors`.
 *   - Skips any entries whose template fails to resolve (unknown type).
 *
 * Returns aggregate stats so callers can log how many batches were used.
 */
export async function sendNotificationEmailsBatch(
  emails: SendNotificationEmailParams[]
): Promise<{ sent: number; batches: number; errors: string[]; skipped?: number }> {
  const errors: string[] = [];

  if (emails.length === 0) {
    return { sent: 0, batches: 0, errors };
  }

  // Skip if no API key configured (dev/preview envs)
  if (!process.env.RESEND_API_KEY) {
    return { sent: emails.length, batches: 0, errors };
  }

  // Preference gating - drop opted-out recipients before building payloads.
  // Transactional types and no-profile-context entries pass through.
  let filteredEmails = emails;
  let skippedCount = 0;
  // Fallback mirrors notificationPreferences' default (unknown → marketplace).
  let getCategory: (t: string) => string = () => "marketplace";
  try {
    const prefs = await import("../notificationPreferences");
    getCategory = prefs.getNotificationCategory;
    const normalized = emails.map((e) => ({
      ...e,
      emailType: e.type,
      profileId: e.profileId ?? null,
    }));
    const kept = await prefs.filterEmailsByPreference(normalized, supabaseAdmin);
    skippedCount = emails.length - kept.length;
    if (skippedCount > 0) {
      console.log(`[email] batch: ${skippedCount} opted-out recipient(s) filtered`);
    }
    filteredEmails = kept;
  } catch (err) {
    console.error("[email] batch preference check failed, sending all:", err);
  }

  // Resolve templates first. Drop any entries with unknown types so Resend
  // doesn't see a malformed payload.
  const payloads: Array<{
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    headers?: Record<string, string>;
  }> = [];

  for (const { to, type, data, profileId } of filteredEmails) {
    const template = resolveNotificationTemplate(type, data);
    if (!template) {
      errors.push(`Unknown email type: ${type} (to=${to})`);
      continue;
    }
    // Non-transactional mail carries one-click unsubscribe headers (M-EM4).
    const unsubscribeHeaders = buildUnsubscribeHeaders(type, profileId, getCategory);
    payloads.push({
      from: FROM_EMAIL,
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      ...(Object.keys(unsubscribeHeaders).length > 0 ? { headers: unsubscribeHeaders } : {}),
    });
  }

  if (payloads.length === 0) {
    return { sent: 0, batches: 0, errors, skipped: skippedCount };
  }

  // Chunk into Resend-sized batches.
  const batches: typeof payloads[] = [];
  for (let i = 0; i < payloads.length; i += EMAIL_BATCH_SIZE) {
    batches.push(payloads.slice(i, i + EMAIL_BATCH_SIZE));
  }

  let sent = 0;

  for (const batch of batches) {
    const result = await sendBatchWithRetry(batch);
    if (result.ok) {
      sent += batch.length;
    } else if (result.errorMsg) {
      errors.push(result.errorMsg);
    }
  }

  return { sent, batches: batches.length, errors, skipped: skippedCount };
}

// Per-batch retry budget. Resend's edge can return 429 (rate limit) or 5xx
// during traffic spikes. Total worst-case wait: 500ms + 1000ms + 2000ms = 3.5s
// per failing batch, comfortably inside the 30s cron function cap.
const RESEND_RETRY_ATTEMPTS = 2; // 1 initial + 2 retries = 3 total
const RESEND_RETRY_BASE_MS = 500;

async function sendBatchWithRetry(
  batch: Array<{
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    headers?: Record<string, string>;
  }>,
): Promise<{ ok: boolean; errorMsg?: string }> {
  for (let attempt = 0; attempt <= RESEND_RETRY_ATTEMPTS; attempt++) {
    try {
      const { error } = await resend.batch.send(batch);
      if (!error) return { ok: true };

      // Resend SDK errors carry statusCode + name. 429 = rate limit (transient),
      // 5xx = server-side issue (transient). 4xx other than 429 = permanent
      // (malformed payload, auth failure) — don't retry.
      const errAny = error as { statusCode?: number; name?: string; message?: string };
      const isTransient =
        errAny.statusCode === 429 ||
        (typeof errAny.statusCode === "number" && errAny.statusCode >= 500);

      if (isTransient && attempt < RESEND_RETRY_ATTEMPTS) {
        const delay = RESEND_RETRY_BASE_MS * Math.pow(2, attempt); // 500, 1000, 2000
        console.warn(
          `[email] batch retry ${attempt + 1}/${RESEND_RETRY_ATTEMPTS} after ${delay}ms (status=${errAny.statusCode}): ${errAny.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      console.error("[Email] batch.send error (no retry):", error);
      return { ok: false, errorMsg: `Resend batch error: ${error.message}` };
    } catch (err) {
      // fetch-level throw (network blip, DNS fail, etc.) — treat as transient.
      if (attempt < RESEND_RETRY_ATTEMPTS) {
        const delay = RESEND_RETRY_BASE_MS * Math.pow(2, attempt);
        console.warn(
          `[email] batch retry ${attempt + 1}/${RESEND_RETRY_ATTEMPTS} after ${delay}ms (threw): ${String(err)}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      console.error("[Email] batch.send threw (retry budget exhausted):", err);
      return { ok: false, errorMsg: `Resend batch threw: ${String(err)}` };
    }
  }
  return { ok: false, errorMsg: "Resend batch retry budget exhausted" };
}
