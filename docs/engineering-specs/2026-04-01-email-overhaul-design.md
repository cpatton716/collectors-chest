# Email System Overhaul Design Spec

**Date:** April 1, 2026
**Status:** Approved

> **Apr 23, 2026 update:** Two production additions layered on top of this design:
> - **Per-category preference gating** — `sendNotificationEmail()` now consults the recipient's email-preference settings before dispatching. Each email type maps to a category (e.g., offer emails, listing emails, trade emails, marketing) and is suppressed if the user has that category disabled. Transactional-critical emails (payment confirmations, etc.) still send regardless.
> - **Batch send via Resend `batch.send()`** — Fan-out sends (e.g., new-listing-from-followed to all followers, payment reminders across many auctions) now use Resend's `batch.send()` API instead of looping individual `emails.send()` calls, reducing API calls and improving throughput.
>
> Template content / header / footer / sound-effect map below remains accurate.

---

## Overview

Four changes to the email system:
1. New trial expiration reminder email (3 days before expiry)
2. Wire 5 existing offer email templates to actually send
3. Wire 2 existing listing expiration email templates to actually send
4. Apply pop-art branded header/footer to all 11 email templates

## 1. Shared Email Header (All Templates)

Every email gets a consistent branded header:

- **Blue background** (#0066FF) with ben-day dot radial gradient overlay
- **COLLECTORS CHEST badge** — yellow (#FFF200), black border, slight rotation
- **Comic sound effect speech bubble** — green (#00CC66), rounded rectangle with tail, unique per email type:

| Email Type | Sound Effect |
|------------|-------------|
| welcome | POW! |
| trial_expiring | TICK TOCK! |
| offer_received | KA-CHING! |
| offer_accepted | WHAM! |
| offer_rejected | HEY! |
| offer_countered | ZAP! |
| offer_expired | POOF! |
| listing_expiring | HEADS UP! |
| listing_expired | TIME'S UP! |
| message_received | BAM! |
| feedback_reminder | PSST! |
| new_listing_from_followed | HOT! |

### CSS Rendering Risk

> **Outlook compatibility warning:** Outlook desktop uses the Word rendering engine, which does not support `transform`, `position: absolute`, or `z-index`. The following elements are at risk:
> - Ben-day dots overlay with absolute positioning may not render
> - Speech bubble tail CSS triangles are fragile across email clients
> - Badge rotation via `transform: rotate()` will be ignored
>
> **Requirement:** Test in Gmail (web + mobile), Apple Mail, Outlook (desktop + web), and Yahoo Mail before shipping.
>
> **Recommended:** Use progressive enhancement — provide a simpler fallback header for Outlook using `<!--[if mso]>` conditional comments that omits dots, rotation, and the speech bubble tail.

### Shared Header HTML Structure

```html
<!-- Blue header with ben-day dots -->
<div style="background: #0066FF; padding: 32px 24px 28px; text-align: center; position: relative; overflow: hidden;">
  <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle, rgba(255,255,255,0.15) 1.5px, transparent 1.5px); background-size: 12px 12px;"></div>
  <div style="position: relative; z-index: 1;">
    <div style="display: inline-block; background: #FFF200; color: #000; font-weight: 900; font-size: 14px; padding: 6px 16px; border: 3px solid #000; border-radius: 4px; transform: rotate(-2deg); margin-bottom: 12px; letter-spacing: 1px;">COLLECTORS CHEST</div>
  </div>
  <div style="position: relative; z-index: 1; margin: 12px auto; display: inline-block;">
    <div style="position: relative; display: inline-block; background: #00CC66; color: #000; font-weight: 900; font-size: 24px; padding: 10px 28px; border: 4px solid #000; border-radius: 20px; transform: rotate(-3deg); box-shadow: 4px 4px 0 #000;">
      {SOUND_EFFECT}
      <div style="position: absolute; bottom: -16px; left: 28px; width: 0; height: 0; border-left: 14px solid transparent; border-right: 6px solid transparent; border-top: 18px solid #000; transform: rotate(10deg);"></div>
      <div style="position: absolute; bottom: -11px; left: 30px; width: 0; height: 0; border-left: 11px solid transparent; border-right: 4px solid transparent; border-top: 15px solid #00CC66; transform: rotate(10deg);"></div>
    </div>
  </div>
</div>
```

## 2. Shared Email Footer (All Templates)

```html
<div style="background: #f5f5f5; border-top: 2px solid #e5e5e5; padding: 24px 24px 28px; text-align: center;">
  <p style="text-align: center; font-size: 14px; color: #999; font-style: italic; margin: 0 0 16px;">Scan comics. Track value. Collect smarter.</p>
  <p style="font-size: 12px; color: #999; margin: 0 0 8px; line-height: 1.5;">Twisted Jester LLC · collectors-chest.com</p>
  <p style="font-size: 11px; color: #bbb; margin: 0; line-height: 1.5;">
    <a href="{APP_URL}/privacy" style="color: #999; text-decoration: underline;">Privacy Policy</a> ·
    <a href="{APP_URL}/terms" style="color: #999; text-decoration: underline;">Terms of Service</a>
  </p>
</div>
```

## 3. Trial Expiration Reminder Email (New)

### Trigger
- **Cron job** running daily
- Queries profiles where `trial_ends_at` is within 3 days AND `subscription_status = 'trialing'`
- **Deduplication:** Only send if `trial_reminder_sent_at IS NULL` (new column on profiles table)
- After sending, set `trial_reminder_sent_at = NOW()`

### Email Content
- **Subject:** "Your Collectors Chest trial ends in 3 days"
- **Sound effect:** TICK TOCK!
- **Preheader/preview text:** "Unlimited scans, Key Hunt, and more — don't lose access"
- **Body:**
  - Greeting: "Hey Collector, your free trial ends on {formatted_date}."
  - "What you'll lose" section:
    - Unlimited scans → 10/month
    - Key Hunt access
    - CSV export
    - Advanced stats
    - Marketplace access
  - Pricing line: "Plans start at $4.99/month — less than a single comic."
  - Annual plan nudge: "Save 17% with the annual plan."
  - Blue CTA button: "STAY PREMIUM →" → links to `{APP_URL}/choose-plan`

### Trial Type Handling

- **Standard 7-day trials:** `trial_ends_at` is set by `startTrial()` in subscription.ts
- **Promo 30-day trials:** `trial_ends_at` may be set by Stripe webhook handler
- The cron query uses `trial_ends_at` as the source of truth, filtered to app-managed trials only (excludes Stripe-managed promo trials via `stripe_subscription_id IS NULL`). Promo trial users who go through Stripe checkout receive Stripe's own trial expiration emails.
- **Note:** Verify in Stripe webhook handler that `trial_ends_at` is consistently set for both trial paths

### Changes Required in email.ts

All of the following changes are needed in `src/lib/email.ts` to support the new template:

1. Add `"trial_expiring"` to the `NotificationEmailType` union type
2. Add `TrialExpiringEmailData` to the `SendNotificationEmailParams.data` union type
3. Add `case "trial_expiring"` in the template switch statement
4. Export `TrialExpiringEmailData` interface

### Data Interface
```typescript
interface TrialExpiringEmailData {
  trialEndsAt: string; // formatted date like "April 4, 2026"
}
```

The template should hardcode the choose-plan URL from `process.env.NEXT_PUBLIC_APP_URL` (e.g., `${process.env.NEXT_PUBLIC_APP_URL}/choose-plan`), consistent with how `listingExpiredTemplate` handles its URLs.

### Plain Text Version
```
Your Collectors Chest trial ends in 3 days

Hey Collector, your free trial ends on {trialEndsAt}.

When your trial ends, you'll lose:
- Unlimited scans (drops to 10/month)
- Key Hunt access
- CSV export
- Advanced stats
- Marketplace access

Plans start at $4.99/month — less than a single comic. Save 17% with the annual plan.

Stay Premium: {APP_URL}/choose-plan

Scan comics. Track value. Collect smarter.

Twisted Jester LLC · collectors-chest.com
```

### Database Migration

**File path:** `supabase/migrations/20260401_add_trial_reminder_sent_at.sql`

**Note:** Run manually in Supabase dashboard SQL editor (no `supabase db push` workflow in this project).

```sql
ALTER TABLE profiles ADD COLUMN trial_reminder_sent_at TIMESTAMPTZ;
```

### Cron Route
- Path: `src/app/api/cron/send-trial-reminders/route.ts`
- Auth: `CRON_SECRET` bearer token (same pattern as send-feedback-reminders)
- Query: profiles where trial expires within 3 days, not yet reminded
- Additional filter: `AND stripe_subscription_id IS NULL` — excludes users on Stripe-managed trials (they receive Stripe's own trial-ending emails, so we avoid duplicate notifications)
- **Idempotency guard:** To prevent duplicates on double cron runs: (1) SELECT eligible users, (2) immediately UPDATE `trial_reminder_sent_at = NOW()` for ALL selected users before sending any emails, (3) then send emails. This ensures a second cron run within the same window won't re-select the same users.
- **Trade-off:** If the cron process crashes mid-send, some users will be marked as reminded without receiving the email. This is acceptable — duplicate reminders are worse than missed ones. A future improvement could separate the dedup flag from delivery confirmation.

### Cron Configuration
- **Route:** `POST /api/cron/send-trial-reminders`
- **Auth:** `Authorization: Bearer ${CRON_SECRET}` (same as feedback reminders)
- **Schedule:** Daily at 9:00 AM Eastern
- **Trigger:** Configure in the same external cron service used for send-feedback-reminders (EasyCron or equivalent)
- Add the new endpoint URL to the external cron service after deployment

## Email & Profile Data Helpers

These helpers are used at every offer/listing email call site to look up the recipient's email, display name, and comic data. Add them to `src/lib/email.ts` or a shared db helper.

### getProfileForEmail

```typescript
async function getProfileForEmail(userId: string): Promise<{ email: string | null; displayName: string } | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email, display_name, username")
    .eq("id", userId)
    .single();
  if (!data) return null;
  return {
    email: data.email ?? null,
    displayName: data.display_name || data.username || "Collector",
  };
}
```

This helper is used at every offer/listing email call site to look up the recipient's email and display name.

### getListingComicData

```typescript
async function getListingComicData(listingId: string): Promise<{ comicTitle: string; issueNumber: string; price: number } | null> {
  const { data } = await supabaseAdmin
    .from("auctions")
    .select("starting_price, comics!inner(title, issue_number)")
    .eq("id", listingId)
    .single();
  if (!data) return null;
  const comic = (data as any).comics;
  return {
    comicTitle: comic?.title || "Unknown",
    issueNumber: comic?.issue_number || "",
    price: data.starting_price || 0,
  };
}
```

This avoids modifying existing query shapes in auctionDb.ts. Each email call site calls this helper separately to get comic title, issue number, and price for email content.

## 4. Wire Offer Emails (5 Existing Templates)

Templates already exist in `src/lib/email.ts`. Need to add `sendNotificationEmail()` calls in `src/lib/auctionDb.ts` alongside each `createNotification()` call.

**Always send** — transactional emails, no opt-out check.

Need to look up the recipient's email address from the profiles table (join with Clerk or store email on profile).

| Notification | Location in auctionDb.ts | Email Type |
|-------------|-------------------------|------------|
| Offer received | `createNotification()` for seller | `offer_received` |
| Offer accepted | `createNotification()` for buyer | `offer_accepted` |
| Offer rejected | `createNotification()` for buyer | `offer_rejected` |
| Offer countered | `createNotification()` for buyer | `offer_countered` |
| Offer expired | `createNotification()` for buyer | `offer_expired` |
| Counter-offer accepted (buyer accepts seller's counter) | `createNotification()` for seller | `offer_accepted` |
| Counter-offer rejected (buyer rejects seller's counter) | `createNotification()` for seller | `offer_rejected` |

> **Note:** The `respondToCounterOffer()` function (auctionDb.ts ~lines 1190-1226) handles buyer responses to seller counter-offers. These create the same email types (offer_accepted, offer_rejected) but with the seller as recipient instead of the buyer. The implementer must wire both flows.

### Email Address Lookup
Use existing `profiles.email` field. The codebase already reads email from the profiles table in messagingDb.ts, auctionDb.ts, and the feedback reminder cron. This is consistent, faster, and doesn't add external API dependency. The Clerk webhook keeps `profiles.email` in sync.

### Wiring Notes
- At each call site, call `getProfileForEmail()` for BOTH buyer and seller to get their display names and emails. This solves the buyerName/sellerName availability problem.
- Construct listing URLs as `${process.env.NEXT_PUBLIC_APP_URL || 'https://collectors-chest.com'}/shop/${listingId}`. This matches the existing pattern in `notifyFollowersOfNewListing`.

### Error Handling

All email sends in offer/listing wiring MUST be fire-and-forget:
- **Pattern:** `sendNotificationEmail(...).catch(err => console.error("[Email] Failed:", err))`
- **NEVER** `await` the email send inline — a Resend outage must not block the business operation
- This matches the existing pattern in `notifyFollowersOfNewListing` (auctionDb.ts)

All email sends MUST null-check the email before calling sendNotificationEmail:
- **Pattern:** `const profile = await getProfileForEmail(userId); if (!profile?.email) return;`
- **Backlog item:** Ensure Clerk `user.created` and `user.updated` webhooks sync email to profiles table for reliable email delivery

## 5. Wire Listing Expiration Emails (2 Existing Templates)

At each listing expiration call site, use the same helper pattern as offers: call `getProfileForEmail(listing.seller_id)` for the seller's email/name, and `getListingComicData(listing.id)` for the comic details. Construct the `ListingEmailData` object from these results. Templates exist, need `sendNotificationEmail()` calls.

| Notification | Location in auctionDb.ts | Email Type |
|-------------|-------------------------|------------|
| Listing expiring (24hr) | Existing notification creation | `listing_expiring` |
| Listing expired | Existing notification creation | `listing_expired` |

**Always send** — transactional.

## 6. Update All Email Templates with Pop-Art Header/Footer

Refactor `src/lib/email.ts` to extract shared header and footer into helper functions:

```typescript
function emailHeader(soundEffect: string): string { ... }
function emailFooter(): string { ... }
```

`emailHeader(soundEffect)` returns ONLY the blue header with badge + speech bubble. Each template adds its own title/subtitle/content below the shared header. For example, the welcome template keeps its `<h1>WELCOME TO THE CHEST!</h1>` and subtitle BELOW the shared header, not inside it. This way the shared header is truly shared and templates customize their own content area.

**Welcome template note:** The welcome template currently has a custom inline header. During the refactoring pass, replace it with `emailHeader('POW!')` followed by the welcome-specific `<h1>WELCOME TO THE CHEST!</h1>` title, subtitle, and body content. Accept the minor size/padding changes for consistency across all emails.

Then update all 12 templates (11 existing + 1 new trial_expiring) to use these helpers instead of inline HTML. This DRYs up the templates and ensures consistent branding.

### Sound Effect Mapping

**Implementation note:** Update `NotificationEmailType` union FIRST, then add `EMAIL_SOUND_EFFECTS` record. TypeScript will enforce completeness.

```typescript
const EMAIL_SOUND_EFFECTS: Record<NotificationEmailType, string> = {
  welcome: "POW!",
  trial_expiring: "TICK TOCK!",
  offer_received: "KA-CHING!",
  offer_accepted: "WHAM!",
  offer_rejected: "HEY!",
  offer_countered: "ZAP!",
  offer_expired: "POOF!",
  listing_expiring: "HEADS UP!",
  listing_expired: "TIME'S UP!",
  message_received: "BAM!",
  feedback_reminder: "PSST!",
  new_listing_from_followed: "HOT!",
};
```

## Colors Reference

| Element | Color |
|---------|-------|
| Header background | #0066FF |
| Brand badge | #FFF200 (yellow) |
| Sound effect bubble | #00CC66 (green) |
| CTA buttons | #0066FF (blue) — NEVER red. During the pop-art formatting pass, standardize ALL CTA buttons across all templates to #0066FF (blue). Replace existing green (#16a34a), alternate blue (#2563eb), amber (#f59e0b), and gray (#6b7280) buttons with the standard blue. Exception: gray buttons may remain for low-priority/secondary actions. |
| Loss/warning callouts | #FFF8E7 (cream) |
| Footer background | #f5f5f5 |

## Testing

- Unit tests for `emailHeader()` and `emailFooter()` helpers
- Unit test for `trialExpiringTemplate()` — subject, HTML content, plain text
- Unit tests verifying each template uses the correct sound effect
- Verify all existing email tests still pass after refactor
- Manual: trigger cron job with a test user whose trial expires in 3 days

## What's NOT Included
- Multiple reminder cadence (only 3-day for now)
- Unsubscribe mechanism for transactional emails
- Email preference settings beyond existing `msg_email_enabled`

## Backlog — Recommended Future Additions

- **Post-trial-expiry email** ("You've been downgraded — here's what you're missing") — high priority next iteration
- **Email rate/digest awareness** for marketplace scenarios (avoid spamming users with rapid-fire offer notifications)
- **Emblem image in header** instead of text badge, with text badge as alt text fallback for clients that block images
