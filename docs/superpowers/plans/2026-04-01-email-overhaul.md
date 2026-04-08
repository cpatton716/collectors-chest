# Email System Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trial expiration reminder email, wire 7 offer + 2 listing email sends, and apply pop-art branded header/footer to all 12 email templates.

**Architecture:** Extract shared `emailHeader()`/`emailFooter()` helpers in email.ts, add trial_expiring template + cron route, add `getProfileForEmail()`/`getListingComicData()` helpers for data lookup, wire `sendNotificationEmail()` at 9 call sites in auctionDb.ts, then reformat all templates to use the shared helpers.

**Tech Stack:** Resend (email), Supabase (DB), Clerk (auth), Jest (tests), Next.js API routes (cron)

**Spec:** `docs/engineering-specs/2026-04-01-email-overhaul-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/email.ts` | Modify | Add helpers, trial template, sound effects map, reformat all templates |
| `src/lib/__tests__/emailHelpers.test.ts` | Create | Tests for emailHeader, emailFooter, sound effects, trial template |
| `src/lib/auctionDb.ts` | Modify | Wire sendNotificationEmail at 9 call sites |
| `src/app/api/cron/send-trial-reminders/route.ts` | Create | Daily cron to send trial expiration emails |
| `supabase/migrations/20260401_add_trial_reminder_sent_at.sql` | Create | Add trial_reminder_sent_at column |

---

### Task 1: Extract shared emailHeader() and emailFooter() helpers

**Files:**
- Modify: `src/lib/email.ts`
- Create: `src/lib/__tests__/emailHelpers.test.ts`

- [ ] **Step 1: Write failing tests for emailHeader and emailFooter**

Create `src/lib/__tests__/emailHelpers.test.ts`:

```typescript
/**
 * @jest-environment node
 */

// emailHeader and emailFooter are not exported, so we test them indirectly
// through sendNotificationEmail. But first, let's test the sound effects map.

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    },
  })),
}));

process.env.RESEND_API_KEY = "test-key";
process.env.NEXT_PUBLIC_APP_URL = "https://collectors-chest.com";

import { sendNotificationEmail } from "../email";

describe("emailHeader", () => {
  it("welcome email contains POW! sound effect", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "welcome",
      data: { collectionUrl: "https://collectors-chest.com/collection" },
    });

    const html = mockSend.mock.calls[0][0].html;
    expect(html).toContain("POW!");
    expect(html).toContain("COLLECTORS CHEST");
    expect(html).toContain("#0066FF");
  });

  it("feedback_reminder email contains PSST! sound effect", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "feedback_reminder",
      data: {
        recipientName: "Chris",
        otherPartyName: "Jason",
        transactionType: "sale" as const,
        comicTitle: "Spider-Man",
        issueNumber: "1",
        feedbackUrl: "https://collectors-chest.com/feedback/123",
      },
    });

    const html = mockSend.mock.calls[0][0].html;
    expect(html).toContain("PSST!");
    expect(html).toContain("COLLECTORS CHEST");
  });
});

describe("emailFooter", () => {
  it("all emails contain shared footer with tagline and legal links", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "welcome",
      data: { collectionUrl: "https://collectors-chest.com/collection" },
    });

    const html = mockSend.mock.calls[0][0].html;
    expect(html).toContain("Scan comics. Track value. Collect smarter.");
    expect(html).toContain("Twisted Jester LLC");
    expect(html).toContain("collectors-chest.com/privacy");
    expect(html).toContain("collectors-chest.com/terms");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest emailHelpers -v`
Expected: Some tests may pass (welcome already has these elements), some may fail (feedback_reminder doesn't have PSST! yet)

- [ ] **Step 3: Add EMAIL_SOUND_EFFECTS map and emailHeader/emailFooter helpers to email.ts**

In `src/lib/email.ts`, add after the `formatPrice` function (around line 59), before the template functions:

```typescript
// ============================================================================
// SHARED EMAIL HEADER / FOOTER
// ============================================================================

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

function emailHeader(soundEffect: string): string {
  return `
    <div style="background: #0066FF; padding: 32px 24px 28px; text-align: center; position: relative; overflow: hidden;">
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle, rgba(255,255,255,0.15) 1.5px, transparent 1.5px); background-size: 12px 12px; pointer-events: none;"></div>
      <div style="position: relative; z-index: 1;">
        <div style="display: inline-block; background: #FFF200; color: #000; font-weight: 900; font-size: 14px; padding: 6px 16px; border: 3px solid #000; border-radius: 4px; transform: rotate(-2deg); margin-bottom: 12px; letter-spacing: 1px;">COLLECTORS CHEST</div>
      </div>
      <div style="position: relative; z-index: 1; margin: 12px auto; display: inline-block;">
        <div style="position: relative; display: inline-block; background: #00CC66; color: #000; font-weight: 900; font-size: 24px; padding: 10px 28px; border: 4px solid #000; border-radius: 20px; transform: rotate(-3deg); box-shadow: 4px 4px 0 #000;">
          ${soundEffect}
          <div style="position: absolute; bottom: -16px; left: 28px; width: 0; height: 0; border-left: 14px solid transparent; border-right: 6px solid transparent; border-top: 18px solid #000; transform: rotate(10deg);"></div>
          <div style="position: absolute; bottom: -11px; left: 30px; width: 0; height: 0; border-left: 11px solid transparent; border-right: 4px solid transparent; border-top: 15px solid #00CC66; transform: rotate(10deg);"></div>
        </div>
      </div>
    </div>`;
}

function emailFooter(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
  return `
    <div style="background: #f5f5f5; border-top: 2px solid #e5e5e5; padding: 24px 24px 28px; text-align: center;">
      <p style="text-align: center; font-size: 14px; color: #999; font-style: italic; margin: 0 0 16px;">Scan comics. Track value. Collect smarter.</p>
      <p style="font-size: 12px; color: #999; margin: 0 0 8px; line-height: 1.5;">Twisted Jester LLC · collectors-chest.com</p>
      <p style="font-size: 11px; color: #bbb; margin: 0; line-height: 1.5;"><a href="${appUrl}/privacy" style="color: #999; text-decoration: underline;">Privacy Policy</a> · <a href="${appUrl}/terms" style="color: #999; text-decoration: underline;">Terms of Service</a></p>
    </div>`;
}
```

**IMPORTANT:** The `EMAIL_SOUND_EFFECTS` map references `NotificationEmailType` which doesn't include `"trial_expiring"` yet. Add `| "trial_expiring"` to the `NotificationEmailType` union (around line 309) NOW so the map compiles. Also add `| TrialExpiringEmailData` to the data union in `SendNotificationEmailParams`. Add a placeholder interface above the map:

```typescript
interface TrialExpiringEmailData {
  trialEndsAt: string;
}
```

And add a placeholder case in the switch:
```typescript
    case "trial_expiring":
      template = { subject: "", html: "", text: "" }; // Placeholder — implemented in Task 2
      break;
```

- [ ] **Step 4: Update the welcome template to use emailHeader/emailFooter**

Replace the welcome template's inline header (the `<!-- Header -->` div through the closing `</div>` of the header section) with `${emailHeader(EMAIL_SOUND_EFFECTS.welcome)}`, then add the welcome-specific title below it. Replace the inline footer with `${emailFooter()}`.

The welcome template body should become:
```typescript
function welcomeTemplate(data: WelcomeEmailData): EmailTemplate {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";

  return {
    subject: "Welcome to Collectors Chest!",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.welcome)}
        <!-- Welcome title -->
        <div style="background: #0066FF; padding: 0 24px 24px; text-align: center; position: relative;">
          <h1 style="position: relative; z-index: 1; color: #FFF200; font-size: 26px; font-weight: 900; margin: 0 0 4px; text-shadow: 2px 2px 0 #000; letter-spacing: 1px;">WELCOME TO THE CHEST!</h1>
          <p style="position: relative; z-index: 1; color: #ffffff; font-size: 15px; margin: 0; opacity: 0.9;">Your collection journey starts now.</p>
        </div>
        <!-- Body -->
        <div style="padding: 32px 24px;">
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">Hey there, Collector! You're officially part of the crew. Here's what you can do with Collectors Chest:</p>
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;"><tr>
            <td style="width: 36px; height: 36px; background: #ED1C24; border: 2.5px solid #000; border-radius: 50%; text-align: center; vertical-align: middle;"><span style="font-size: 18px;">📸</span></td>
            <td style="vertical-align: top; padding-left: 14px;"><div style="font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">Scan Any Cover</div><div style="font-size: 14px; color: #666; line-height: 1.4;">Snap a photo and our AI identifies your comic instantly.</div></td>
          </tr></table>
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;"><tr>
            <td style="width: 36px; height: 36px; background: #0066FF; border: 2.5px solid #000; border-radius: 50%; text-align: center; vertical-align: middle;"><span style="font-size: 18px;">📊</span></td>
            <td style="vertical-align: top; padding-left: 14px;"><div style="font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">Track Your Value</div><div style="font-size: 14px; color: #666; line-height: 1.4;">See real eBay pricing for every book in your collection.</div></td>
          </tr></table>
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;"><tr>
            <td style="width: 36px; height: 36px; background: #FFF200; border: 2.5px solid #000; border-radius: 50%; text-align: center; vertical-align: middle;"><span style="font-size: 18px;">🔑</span></td>
            <td style="vertical-align: top; padding-left: 14px;"><div style="font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">Discover Key Issues</div><div style="font-size: 14px; color: #666; line-height: 1.4;">Find out if your books are first appearances, rare variants, or hidden gems.</div></td>
          </tr></table>
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 0;"><tr>
            <td style="width: 36px; height: 36px; background: #00CC66; border: 2.5px solid #000; border-radius: 50%; text-align: center; vertical-align: middle;"><span style="font-size: 18px;">📦</span></td>
            <td style="vertical-align: top; padding-left: 14px;"><div style="font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">Organize Everything</div><div style="font-size: 14px; color: #666; line-height: 1.4;">Custom lists, CSV import, stats, and more — your collection, your way.</div></td>
          </tr></table>
          <div style="background: #FFF8E7; border: 3px solid #000; border-radius: 8px; padding: 16px 20px; margin: 24px 0 28px; text-align: center;">
            <div style="font-weight: 900; font-size: 18px; color: #000; margin-bottom: 4px;">🎯 You get <span style="color: #ED1C24;">10 FREE scans</span> every month!</div>
            <div style="font-size: 13px; color: #666;">Start scanning your collection today.</div>
          </div>
          <div style="text-align: center; margin: 0 0 32px;">
            <a href="${data.collectionUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; font-size: 18px; padding: 16px 48px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">START SCANNING →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Welcome to Collectors Chest!\n\nHey there, Collector! You're officially part of the crew.\n\nHere's what you can do:\n\n📸 Scan Any Cover — Snap a photo and our AI identifies your comic instantly.\n📊 Track Your Value — See real eBay pricing for every book in your collection.\n🔑 Discover Key Issues — Find out if your books are first appearances, rare variants, or hidden gems.\n📦 Organize Everything — Custom lists, CSV import, stats, and more.\n\n🎯 You get 10 free scans every month!\n\nStart scanning: ${data.collectionUrl}\n\nScan comics. Track value. Collect smarter.\n\nTwisted Jester LLC · collectors-chest.com`,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npx jest emailHelpers welcomeEmail -v`
Expected: All tests pass

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/email.ts src/lib/__tests__/emailHelpers.test.ts
git commit -m "feat: extract shared emailHeader/emailFooter helpers with sound effects map"
```

---

### Task 2: Add trial expiration email template + tests

**Files:**
- Modify: `src/lib/email.ts`
- Modify: `src/lib/__tests__/emailHelpers.test.ts`

- [ ] **Step 1: Write failing tests for trial_expiring template**

Add to `src/lib/__tests__/emailHelpers.test.ts`:

```typescript
describe("trialExpiringTemplate", () => {
  it("sends trial expiring email with correct subject", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: { trialEndsAt: "April 4, 2026" },
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toBe("Your Collectors Chest trial ends in 3 days");
  });

  it("includes what you'll lose section and pricing", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: { trialEndsAt: "April 4, 2026" },
    });

    const html = mockSend.mock.calls[0][0].html;
    expect(html).toContain("TICK TOCK!");
    expect(html).toContain("April 4, 2026");
    expect(html).toContain("Unlimited scans");
    expect(html).toContain("Key Hunt");
    expect(html).toContain("CSV export");
    expect(html).toContain("$4.99/month");
    expect(html).toContain("Save 17%");
    expect(html).toContain("STAY PREMIUM");
    expect(html).toContain("/choose-plan");
  });

  it("uses blue CTA button", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: { trialEndsAt: "April 4, 2026" },
    });

    const html = mockSend.mock.calls[0][0].html;
    expect(html).toContain("background: #0066FF");
    expect(html).not.toMatch(/STAY PREMIUM[\s\S]{0,200}#ED1C24/);
  });

  it("includes plain text version", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: { trialEndsAt: "April 4, 2026" },
    });

    const text = mockSend.mock.calls[0][0].text;
    expect(text).toContain("trial ends in 3 days");
    expect(text).toContain("April 4, 2026");
    expect(text).toContain("10/month");
    expect(text).toContain("$4.99/month");
    expect(text).toContain("/choose-plan");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest emailHelpers -v`
Expected: FAIL — trial_expiring case returns placeholder empty template

- [ ] **Step 3: Replace placeholder trial_expiring template with real implementation**

In `src/lib/email.ts`, replace the placeholder `case "trial_expiring"` template with the real function. Add this before the `// SEND EMAIL FUNCTION` section:

```typescript
function trialExpiringTemplate(data: TrialExpiringEmailData): EmailTemplate {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";

  return {
    subject: "Your Collectors Chest trial ends in 3 days",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.trial_expiring)}
        <div style="padding: 32px 24px;">
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">Hey Collector, your free trial ends on <strong>${data.trialEndsAt}</strong>.</p>
          <div style="background: #FFF8E7; border: 3px solid #000; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
            <div style="font-weight: 900; font-size: 16px; color: #000; margin-bottom: 12px;">When your trial ends, you'll lose:</div>
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
              <tr><td style="padding: 4px 0; font-size: 14px; color: #666;">❌ Unlimited scans → 10/month</td></tr>
              <tr><td style="padding: 4px 0; font-size: 14px; color: #666;">❌ Key Hunt access</td></tr>
              <tr><td style="padding: 4px 0; font-size: 14px; color: #666;">❌ CSV export</td></tr>
              <tr><td style="padding: 4px 0; font-size: 14px; color: #666;">❌ Advanced stats</td></tr>
              <tr><td style="padding: 4px 0; font-size: 14px; color: #666;">❌ Marketplace access</td></tr>
            </table>
          </div>
          <p style="font-size: 15px; color: #333; text-align: center; margin: 0 0 4px;"><strong>Plans start at $4.99/month</strong> — less than a single comic.</p>
          <p style="font-size: 13px; color: #666; text-align: center; margin: 0 0 28px;">Save 17% with the annual plan.</p>
          <div style="text-align: center; margin: 0 0 32px;">
            <a href="${appUrl}/choose-plan" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; font-size: 18px; padding: 16px 48px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">STAY PREMIUM →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your Collectors Chest trial ends in 3 days\n\nHey Collector, your free trial ends on ${data.trialEndsAt}.\n\nWhen your trial ends, you'll lose:\n- Unlimited scans (drops to 10/month)\n- Key Hunt access\n- CSV export\n- Advanced stats\n- Marketplace access\n\nPlans start at $4.99/month — less than a single comic. Save 17% with the annual plan.\n\nStay Premium: ${appUrl}/choose-plan\n\nScan comics. Track value. Collect smarter.\n\nTwisted Jester LLC · collectors-chest.com`,
  };
}
```

Update the switch case to use the real function:
```typescript
    case "trial_expiring":
      template = trialExpiringTemplate(data as TrialExpiringEmailData);
      break;
```

Add to exports:
```typescript
export type { FeedbackEmailData, NewListingEmailData, WelcomeEmailData, TrialExpiringEmailData };
```

- [ ] **Step 4: Run tests**

Run: `npx jest emailHelpers -v`
Expected: All tests pass

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/email.ts src/lib/__tests__/emailHelpers.test.ts
git commit -m "feat: add trial expiration reminder email template"
```

---

### Task 3: Database migration + trial reminder cron route

**Files:**
- Create: `supabase/migrations/20260401_add_trial_reminder_sent_at.sql`
- Create: `src/app/api/cron/send-trial-reminders/route.ts`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260401_add_trial_reminder_sent_at.sql`:

```sql
-- Add column to track when trial expiration reminder was sent
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_reminder_sent_at TIMESTAMPTZ;
```

- [ ] **Step 2: Create the cron route**

Create `src/app/api/cron/send-trial-reminders/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import { sendNotificationEmail } from "@/lib/email";

export async function POST(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find users with trials expiring within 3 days who haven't been reminded
    // Filter: app-managed trials only (no Stripe subscription ID)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const now = new Date();

    const { data: users, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, trial_ends_at")
      .eq("subscription_status", "trialing")
      .is("trial_reminder_sent_at", null)
      .is("stripe_subscription_id", null)
      .gt("trial_ends_at", now.toISOString())
      .lte("trial_ends_at", threeDaysFromNow.toISOString())
      .limit(100);

    if (fetchError) {
      console.error("[Trial Reminders] Query error:", fetchError);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: "No reminders to send", sent: 0 });
    }

    // Idempotency guard: mark ALL users as reminded BEFORE sending
    const userIds = users.map((u) => u.id);
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ trial_reminder_sent_at: new Date().toISOString() })
      .in("id", userIds);

    if (updateError) {
      console.error("[Trial Reminders] Update error:", updateError);
      return NextResponse.json({ error: "Failed to mark users" }, { status: 500 });
    }

    // Send emails (fire and forget per user)
    let sent = 0;
    let skipped = 0;

    for (const user of users) {
      if (!user.email) {
        skipped++;
        continue;
      }

      const trialEndsAt = new Date(user.trial_ends_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      sendNotificationEmail({
        to: user.email,
        type: "trial_expiring",
        data: { trialEndsAt },
      }).catch((err) => {
        console.error(`[Trial Reminders] Failed to send to ${user.email}:`, err);
      });

      sent++;
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${sent} trial reminders, skipped ${skipped} (no email)`,
      sent,
      skipped,
    });
  } catch (err) {
    console.error("[Trial Reminders] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260401_add_trial_reminder_sent_at.sql src/app/api/cron/send-trial-reminders/route.ts
git commit -m "feat: add trial reminder cron route and DB migration"
```

**Note:** Migration must be run manually in Supabase dashboard SQL editor before deploying.

---

### Task 4: Add getProfileForEmail and getListingComicData helpers

**Files:**
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Add helper functions to email.ts**

Add after the `emailFooter` function, before the template functions:

```typescript
// ============================================================================
// DATA LOOKUP HELPERS (for offer/listing email wiring)
// ============================================================================

import { supabaseAdmin } from "@/lib/supabase";

export async function getProfileForEmail(
  userId: string
): Promise<{ email: string | null; displayName: string } | null> {
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

export async function getListingComicData(
  listingId: string
): Promise<{ comicTitle: string; issueNumber: string; price: number } | null> {
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

**Note:** Check if `supabaseAdmin` is already imported at the top of email.ts. If not, add the import. If it causes a circular dependency, move these helpers to a new file `src/lib/emailHelpers.ts` and import from there in auctionDb.ts.

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat: add getProfileForEmail and getListingComicData helpers for email wiring"
```

---

### Task 5: Wire offer emails (7 call sites in auctionDb.ts)

**Files:**
- Modify: `src/lib/auctionDb.ts`

- [ ] **Step 1: Add imports to auctionDb.ts**

At the top of `src/lib/auctionDb.ts`, add:

```typescript
import { sendNotificationEmail, getProfileForEmail, getListingComicData } from "@/lib/email";
```

If `sendNotificationEmail` is already imported, just add the two new helpers.

- [ ] **Step 2: Wire offer_received email in makeOffer() — line ~1049**

After the `createNotification()` call at line 1049, add:

```typescript
      // Send offer received email (fire and forget)
      (async () => {
        const [sellerProfile, buyerProfile, comicData] = await Promise.all([
          getProfileForEmail(listing.seller_id),
          getProfileForEmail(input.buyerId),
          getListingComicData(listing.id),
        ]);
        if (sellerProfile?.email && comicData) {
          sendNotificationEmail({
            to: sellerProfile.email,
            type: "offer_received",
            data: {
              buyerName: buyerProfile?.displayName || "A collector",
              sellerName: sellerProfile.displayName,
              comicTitle: comicData.comicTitle,
              issueNumber: comicData.issueNumber,
              amount: input.amount,
              listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${listing.id}`,
            },
          }).catch((err) => console.error("[Email] offer_received failed:", err));
        }
      })();
```

- [ ] **Step 3: Wire offer_accepted email in respondToOffer() accept path — line ~1103**

After the `createNotification()` call at line 1103, add:

```typescript
      // Send offer accepted email (fire and forget)
      (async () => {
        const [buyerProfile, sellerProfile, comicData] = await Promise.all([
          getProfileForEmail(offer.buyer_id),
          getProfileForEmail(input.sellerId),
          getListingComicData(offer.listing_id),
        ]);
        if (buyerProfile?.email && comicData) {
          sendNotificationEmail({
            to: buyerProfile.email,
            type: "offer_accepted",
            data: {
              buyerName: buyerProfile.displayName,
              sellerName: sellerProfile?.displayName || "The seller",
              comicTitle: comicData.comicTitle,
              issueNumber: comicData.issueNumber,
              amount: offer.amount,
              listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
            },
          }).catch((err) => console.error("[Email] offer_accepted failed:", err));
        }
      })();
```

- [ ] **Step 4: Wire offer_rejected email in respondToOffer() reject path — line ~1118**

After the `createNotification()` call at line 1118, add:

```typescript
      // Send offer rejected email (fire and forget)
      (async () => {
        const [buyerProfile, sellerProfile, comicData] = await Promise.all([
          getProfileForEmail(offer.buyer_id),
          getProfileForEmail(input.sellerId),
          getListingComicData(offer.listing_id),
        ]);
        if (buyerProfile?.email && comicData) {
          sendNotificationEmail({
            to: buyerProfile.email,
            type: "offer_rejected",
            data: {
              buyerName: buyerProfile.displayName,
              sellerName: sellerProfile?.displayName || "The seller",
              comicTitle: comicData.comicTitle,
              issueNumber: comicData.issueNumber,
              amount: offer.amount,
              listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
            },
          }).catch((err) => console.error("[Email] offer_rejected failed:", err));
        }
      })();
```

- [ ] **Step 5: Wire offer_countered email in respondToOffer() counter path — line ~1154**

After the `createNotification()` call at line 1154, add:

```typescript
      // Send offer countered email (fire and forget)
      (async () => {
        const [buyerProfile, sellerProfile, comicData] = await Promise.all([
          getProfileForEmail(offer.buyer_id),
          getProfileForEmail(input.sellerId),
          getListingComicData(offer.listing_id),
        ]);
        if (buyerProfile?.email && comicData) {
          sendNotificationEmail({
            to: buyerProfile.email,
            type: "offer_countered",
            data: {
              buyerName: buyerProfile.displayName,
              sellerName: sellerProfile?.displayName || "The seller",
              comicTitle: comicData.comicTitle,
              issueNumber: comicData.issueNumber,
              amount: offer.amount,
              counterAmount: input.counterAmount,
              listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
            },
          }).catch((err) => console.error("[Email] offer_countered failed:", err));
        }
      })();
```

- [ ] **Step 6: Wire counter-offer accepted in respondToCounterOffer() accept path — line ~1208**

After the `createNotification()` call at line 1208, add:

```typescript
      // Send offer accepted email to seller (fire and forget)
      (async () => {
        const [sellerProfile, buyerProfile, comicData] = await Promise.all([
          getProfileForEmail(offer.seller_id),
          getProfileForEmail(input.buyerId),
          getListingComicData(offer.listing_id),
        ]);
        if (sellerProfile?.email && comicData) {
          sendNotificationEmail({
            to: sellerProfile.email,
            type: "offer_accepted",
            data: {
              buyerName: buyerProfile?.displayName || "The buyer",
              sellerName: sellerProfile.displayName,
              comicTitle: comicData.comicTitle,
              issueNumber: comicData.issueNumber,
              amount: offer.counter_amount || offer.amount,
              listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
            },
          }).catch((err) => console.error("[Email] counter_accepted failed:", err));
        }
      })();
```

- [ ] **Step 7: Wire counter-offer rejected in respondToCounterOffer() reject path — line ~1223**

After the `createNotification()` call at line 1223, add:

```typescript
      // Send offer rejected email to seller (fire and forget)
      (async () => {
        const [sellerProfile, buyerProfile, comicData] = await Promise.all([
          getProfileForEmail(offer.seller_id),
          getProfileForEmail(input.buyerId),
          getListingComicData(offer.listing_id),
        ]);
        if (sellerProfile?.email && comicData) {
          sendNotificationEmail({
            to: sellerProfile.email,
            type: "offer_rejected",
            data: {
              buyerName: buyerProfile?.displayName || "The buyer",
              sellerName: sellerProfile.displayName,
              comicTitle: comicData.comicTitle,
              issueNumber: comicData.issueNumber,
              amount: offer.counter_amount || offer.amount,
              listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
            },
          }).catch((err) => console.error("[Email] counter_rejected failed:", err));
        }
      })();
```

- [ ] **Step 8: Wire offer_expired in expireOffers() — line ~1936**

After the `createNotification()` call at line 1936, add:

```typescript
        // Send offer expired email to buyer (fire and forget)
        (async () => {
          const [buyerProfile, sellerProfile, comicData] = await Promise.all([
            getProfileForEmail(offer.buyer_id),
            getProfileForEmail(offer.seller_id),
            getListingComicData(offer.listing_id),
          ]);
          if (buyerProfile?.email && comicData) {
            sendNotificationEmail({
              to: buyerProfile.email,
              type: "offer_expired",
              data: {
                buyerName: buyerProfile.displayName,
                sellerName: sellerProfile?.displayName || "The seller",
                comicTitle: comicData.comicTitle,
                issueNumber: comicData.issueNumber,
                amount: offer.amount,
                listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${offer.listing_id}`,
              },
            }).catch((err) => console.error("[Email] offer_expired failed:", err));
          }
        })();
```

- [ ] **Step 9: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 10: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 11: Commit**

```bash
git add src/lib/auctionDb.ts
git commit -m "feat: wire offer email notifications at all 7 call sites"
```

---

### Task 6: Wire listing expiration emails (2 call sites in auctionDb.ts)

**Files:**
- Modify: `src/lib/auctionDb.ts`

- [ ] **Step 1: Wire listing_expiring email in expireListings() — line ~1980**

After the `createNotification()` call at line 1980 (listing expiring within 24 hours), add:

```typescript
        // Send listing expiring email to seller (fire and forget)
        (async () => {
          const [sellerProfile, comicData] = await Promise.all([
            getProfileForEmail(listing.seller_id),
            getListingComicData(listing.id),
          ]);
          if (sellerProfile?.email && comicData) {
            sendNotificationEmail({
              to: sellerProfile.email,
              type: "listing_expiring",
              data: {
                sellerName: sellerProfile.displayName,
                comicTitle: comicData.comicTitle,
                issueNumber: comicData.issueNumber,
                price: comicData.price,
                expiresIn: "within 24 hours",
                listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${listing.id}`,
              },
            }).catch((err) => console.error("[Email] listing_expiring failed:", err));
          }
        })();
```

- [ ] **Step 2: Wire listing_expired email in expireListings() — line ~2023**

After the `createNotification()` call at line 2023 (listing has expired), add:

```typescript
        // Send listing expired email to seller (fire and forget)
        (async () => {
          const [sellerProfile, comicData] = await Promise.all([
            getProfileForEmail(listing.seller_id),
            getListingComicData(listing.id),
          ]);
          if (sellerProfile?.email && comicData) {
            sendNotificationEmail({
              to: sellerProfile.email,
              type: "listing_expired",
              data: {
                sellerName: sellerProfile.displayName,
                comicTitle: comicData.comicTitle,
                issueNumber: comicData.issueNumber,
                price: comicData.price,
                listingUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/shop/${listing.id}`,
              },
            }).catch((err) => console.error("[Email] listing_expired failed:", err));
          }
        })();
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/auctionDb.ts
git commit -m "feat: wire listing expiration email notifications at 2 call sites"
```

---

### Task 7: Reformat all existing templates with shared header/footer + standardize CTA colors

**Files:**
- Modify: `src/lib/email.ts`

This task updates all 10 remaining templates (welcome was done in Task 1, trial_expiring in Task 2) to use `emailHeader()`/`emailFooter()` and standardize CTA button colors to #0066FF.

- [ ] **Step 1: Update offerReceivedTemplate**

Replace the entire `offerReceivedTemplate` function with:

```typescript
function offerReceivedTemplate(data: OfferEmailData): EmailTemplate {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";
  return {
    subject: `New offer on ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_received)}
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 16px; color: #000;">You've received a new offer!</h2>
          <p><strong>${data.buyerName}</strong> has offered <strong>${formatPrice(data.amount)}</strong> for your listing:</p>
          <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
          <p>You have 48 hours to respond to this offer.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW OFFER →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `You've received a new offer!\n\n${data.buyerName} has offered ${formatPrice(data.amount)} for ${data.comicTitle} #${data.issueNumber}.\n\nYou have 48 hours to respond.\n\nView offer: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}
```

- [ ] **Step 2: Update offerAcceptedTemplate**

Replace the function body following the same pattern — `emailHeader(EMAIL_SOUND_EFFECTS.offer_accepted)` + content + `emailFooter()`. CTA button: `background: #0066FF`, text: "COMPLETE PAYMENT →".

```typescript
function offerAcceptedTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Your offer on ${data.comicTitle} #${data.issueNumber} was accepted!`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_accepted)}
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 16px; color: #000;">Great news! Your offer was accepted!</h2>
          <p><strong>${data.sellerName}</strong> has accepted your offer of <strong>${formatPrice(data.amount)}</strong> for:</p>
          <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
          <p>Please complete your payment within 48 hours to secure this purchase.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">COMPLETE PAYMENT →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Great news! Your offer was accepted!\n\n${data.sellerName} accepted your offer of ${formatPrice(data.amount)} for ${data.comicTitle} #${data.issueNumber}.\n\nComplete payment: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}
```

- [ ] **Step 3: Update offerRejectedTemplate**

```typescript
function offerRejectedTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Update on your offer for ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_rejected)}
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 16px; color: #000;">Your offer was declined</h2>
          <p>Unfortunately, <strong>${data.sellerName}</strong> has declined your offer of <strong>${formatPrice(data.amount)}</strong> for:</p>
          <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
          <p>You can submit a new offer or browse other listings in the shop.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW LISTING →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your offer was declined.\n\n${data.sellerName} declined your offer of ${formatPrice(data.amount)} for ${data.comicTitle} #${data.issueNumber}.\n\nView listing: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}
```

- [ ] **Step 4: Update offerCounteredTemplate**

```typescript
function offerCounteredTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Counter-offer on ${data.comicTitle} #${data.issueNumber}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_countered)}
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 16px; color: #000;">You've received a counter-offer!</h2>
          <p><strong>${data.sellerName}</strong> has countered your offer on:</p>
          <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
          <p>Your offer: ${formatPrice(data.amount)}</p>
          <p><strong>Counter-offer: ${formatPrice(data.counterAmount || 0)}</strong></p>
          <p>You have 48 hours to respond to this counter-offer.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">RESPOND TO OFFER →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `You've received a counter-offer!\n\n${data.sellerName} countered your offer on ${data.comicTitle} #${data.issueNumber}.\n\nYour offer: ${formatPrice(data.amount)}\nCounter-offer: ${formatPrice(data.counterAmount || 0)}\n\nRespond: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}
```

- [ ] **Step 5: Update offerExpiredTemplate**

```typescript
function offerExpiredTemplate(data: OfferEmailData): EmailTemplate {
  return {
    subject: `Your offer on ${data.comicTitle} #${data.issueNumber} has expired`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.offer_expired)}
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 16px; color: #000;">Offer Expired</h2>
          <p>Your offer of <strong>${formatPrice(data.amount)}</strong> for the following item has expired:</p>
          <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
          <p>The seller did not respond within 48 hours. You can submit a new offer if the listing is still active.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #6b7280; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW LISTING →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your offer has expired.\n\nYour offer of ${formatPrice(data.amount)} for ${data.comicTitle} #${data.issueNumber} expired.\n\nView listing: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}
```

Note: offerExpired CTA is gray (#6b7280) — secondary action exception per spec.

- [ ] **Step 6: Update listingExpiringTemplate**

```typescript
function listingExpiringTemplate(data: ListingEmailData): EmailTemplate {
  return {
    subject: `Your listing for ${data.comicTitle} #${data.issueNumber} expires soon`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.listing_expiring)}
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 16px; color: #000;">Listing Expiring Soon</h2>
          <p>Your listing will expire ${data.expiresIn || "within 24 hours"}:</p>
          <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
          <p>Price: ${formatPrice(data.price)}</p>
          <p>If you'd like to keep this listing active, you can relist it before it expires.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW LISTING →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your listing is expiring soon!\n\n${data.comicTitle} #${data.issueNumber} (${formatPrice(data.price)}) will expire ${data.expiresIn || "within 24 hours"}.\n\nView listing: ${data.listingUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}
```

- [ ] **Step 7: Update listingExpiredTemplate**

```typescript
function listingExpiredTemplate(data: ListingEmailData): EmailTemplate {
  return {
    subject: `Your listing for ${data.comicTitle} #${data.issueNumber} has expired`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.listing_expired)}
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 16px; color: #000;">Listing Expired</h2>
          <p>Your listing has expired and is no longer visible in the shop:</p>
          <p style="font-size: 18px; font-weight: bold;">${data.comicTitle} #${data.issueNumber}</p>
          <p>Price: ${formatPrice(data.price)}</p>
          <p>You can relist this item from your collection if you'd like to sell it.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/collection" style="display: inline-block; background: #6b7280; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW COLLECTION →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Your listing has expired.\n\n${data.comicTitle} #${data.issueNumber} (${formatPrice(data.price)}) is no longer visible.\n\nView collection: ${process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com"}/collection\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}
```

Note: listingExpired CTA is gray (#6b7280) — secondary action exception.

- [ ] **Step 8: Update messageReceivedTemplate**

```typescript
function messageReceivedTemplate(data: MessageEmailData): EmailTemplate {
  return {
    subject: `New message from ${data.senderName}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.message_received)}
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 16px; color: #000;">You have a new message</h2>
          <p><strong>${data.senderName}</strong> sent you a message:</p>
          <blockquote style="border-left: 4px solid #e5e7eb; padding-left: 16px; margin: 16px 0; color: #4b5563;">${data.messagePreview}</blockquote>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.messagesUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW MESSAGE →</a>
          </div>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `New message from ${data.senderName}\n\n"${data.messagePreview}"\n\nView message: ${data.messagesUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}
```

- [ ] **Step 9: Update feedbackReminderTemplate**

```typescript
function feedbackReminderTemplate(data: FeedbackEmailData): EmailTemplate {
  const transactionLabel = {
    sale: "purchase",
    auction: "auction",
    trade: "trade",
  }[data.transactionType];

  return {
    subject: `How was your ${transactionLabel}? Leave feedback for ${data.otherPartyName}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.feedback_reminder)}
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 16px; color: #000;">Share Your Experience</h2>
          <p>Hi ${data.recipientName},</p>
          <p>Your ${transactionLabel} of <strong>${data.comicTitle} #${data.issueNumber}</strong> with <strong>${data.otherPartyName}</strong> was completed.</p>
          <p>Your feedback helps build trust in our community. It only takes a moment!</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.feedbackUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">LEAVE FEEDBACK →</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">If you've already left feedback, you can ignore this email.</p>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `Hi ${data.recipientName},\n\nYour ${transactionLabel} of ${data.comicTitle} #${data.issueNumber} with ${data.otherPartyName} was completed.\n\nYour feedback helps build trust in our community.\n\nLeave feedback: ${data.feedbackUrl}\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}
```

- [ ] **Step 10: Update newListingFromFollowedTemplate**

```typescript
function newListingFromFollowedTemplate(data: NewListingEmailData): EmailTemplate {
  const coverImageHtml = data.coverImageUrl
    ? `<img src="${data.coverImageUrl}" alt="${data.comicTitle}" style="max-width: 150px; border-radius: 8px; margin: 16px 0;" />`
    : "";

  return {
    subject: `New listing from @${data.sellerUsername} on Collectors Chest`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        ${emailHeader(EMAIL_SOUND_EFFECTS.new_listing_from_followed)}
        <div style="padding: 32px 24px;">
          <h2 style="margin: 0 0 16px; color: #000;">New Listing Alert!</h2>
          <p><strong>${data.sellerName}</strong> just listed a new comic:</p>
          ${coverImageHtml}
          <p style="font-size: 18px; font-weight: bold;">${data.comicTitle}</p>
          <p style="font-size: 16px; color: #16a34a; font-weight: bold;">${formatPrice(data.price)}</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${data.listingUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; padding: 14px 36px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">VIEW LISTING →</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">You're receiving this because you follow @${data.sellerUsername}.</p>
        </div>
        ${emailFooter()}
      </div>
    `,
    text: `New Listing Alert!\n\n${data.sellerName} just listed a new comic:\n\n${data.comicTitle}\n${formatPrice(data.price)}\n\nView listing: ${data.listingUrl}\n\nYou're receiving this because you follow @${data.sellerUsername}.\n\nScan comics. Track value. Collect smarter.\nTwisted Jester LLC · collectors-chest.com`,
  };
}
```

- [ ] **Step 11: Run all email tests**

Run: `npx jest emailHelpers welcomeEmail -v`
Expected: All tests pass

- [ ] **Step 12: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 13: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat: apply pop-art header/footer to all email templates, standardize CTA colors"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full quality check**

Run: `npm run check`
Expected: typecheck + lint + test all pass

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Review all commits**

Run: `git log --oneline -8`
Expected: 7 clean commits from this plan
