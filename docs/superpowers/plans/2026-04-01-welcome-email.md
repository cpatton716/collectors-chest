# Welcome Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a branded pop-art welcome email via Resend when a new user creates an account through Clerk.

**Architecture:** Add a `welcomeTemplate()` to the existing email module (`src/lib/email.ts`), export it through the existing `sendNotificationEmail()` switch. Hook it into the Clerk webhook handler (`src/app/api/webhooks/clerk/route.ts`) on the `user.created` event. The webhook already verifies signatures via svix — we just add a new event branch.

**Tech Stack:** Resend (email), Clerk webhooks (trigger), svix (signature verification), Jest (tests)

**Spec:** `docs/engineering-specs/2026-04-01-welcome-email-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/email.ts` | Modify | Add `WelcomeEmailData` interface, `welcomeTemplate()`, wire into `sendNotificationEmail` |
| `src/lib/__tests__/welcomeEmail.test.ts` | Create | Unit tests for template output |
| `src/app/api/webhooks/clerk/route.ts` | Modify | Add `user.created` handler that extracts email and sends welcome email |

---

### Task 1: Add welcome email template and tests

**Files:**
- Modify: `src/lib/email.ts`
- Create: `src/lib/__tests__/welcomeEmail.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/welcomeEmail.test.ts`:

```typescript
/**
 * @jest-environment node
 */

// We need to test the template function directly, but it's not exported.
// We'll test via sendNotificationEmail with a mocked Resend client.

// Mock Resend before importing
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    },
  })),
}));

// Set required env var before importing
process.env.RESEND_API_KEY = "test-key";
process.env.NEXT_PUBLIC_APP_URL = "https://collectors-chest.com";

import { sendNotificationEmail } from "../email";

describe("welcomeTemplate", () => {
  it("sends welcome email with correct subject", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "welcome",
      data: { collectionUrl: "https://collectors-chest.com/collection" },
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toBe("Welcome to Collectors Chest!");
    expect(call.to).toBe("test@example.com");
  });

  it("includes key content in HTML", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "welcome",
      data: { collectionUrl: "https://collectors-chest.com/collection" },
    });

    const html = mockSend.mock.calls[0][0].html;
    expect(html).toContain("WELCOME TO THE CHEST!");
    expect(html).toContain("POW!");
    expect(html).toContain("Hey there, Collector!");
    expect(html).toContain("Scan Any Cover");
    expect(html).toContain("Track Your Value");
    expect(html).toContain("Discover Key Issues");
    expect(html).toContain("Organize Everything");
    expect(html).toContain("10 FREE scans");
    expect(html).toContain("START SCANNING");
    expect(html).toContain("https://collectors-chest.com/collection");
    expect(html).toContain("Twisted Jester LLC");
  });

  it("includes plain text version", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "welcome",
      data: { collectionUrl: "https://collectors-chest.com/collection" },
    });

    const text = mockSend.mock.calls[0][0].text;
    expect(text).toContain("Welcome to Collectors Chest!");
    expect(text).toContain("10 free scans");
    expect(text).toContain("https://collectors-chest.com/collection");
  });

  it("uses blue CTA button, not red", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "welcome",
      data: { collectionUrl: "https://collectors-chest.com/collection" },
    });

    const html = mockSend.mock.calls[0][0].html;
    // CTA button should be blue (#0066FF), never red
    expect(html).toContain("background: #0066FF");
    // The START SCANNING link should not use red
    expect(html).not.toMatch(/START SCANNING[\s\S]{0,200}#ED1C24/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest welcomeEmail -v`
Expected: FAIL — `sendNotificationEmail` doesn't recognize type `"welcome"` yet

- [ ] **Step 3: Add WelcomeEmailData interface and welcomeTemplate to email.ts**

In `src/lib/email.ts`, add after the `NewListingEmailData` interface (around line 55):

```typescript
interface WelcomeEmailData {
  collectionUrl: string;
}
```

Add the template function after `newListingFromFollowedTemplate` (before the `// SEND EMAIL FUNCTION` section):

```typescript
function welcomeTemplate(data: WelcomeEmailData): EmailTemplate {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";

  return {
    subject: "Welcome to Collectors Chest!",
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff;">
        <!-- Header -->
        <div style="background: #0066FF; padding: 40px 24px 36px; text-align: center; position: relative; overflow: hidden;">
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: radial-gradient(circle, rgba(255,255,255,0.15) 1.5px, transparent 1.5px); background-size: 12px 12px; pointer-events: none;"></div>
          <div style="position: relative; z-index: 1;">
            <div style="display: inline-block; background: #FFF200; color: #000; font-weight: 900; font-size: 14px; padding: 6px 16px; border: 3px solid #000; border-radius: 4px; transform: rotate(-2deg); margin-bottom: 12px; letter-spacing: 1px;">COLLECTORS CHEST</div>
          </div>
          <div style="position: relative; z-index: 1; margin: 16px auto; display: inline-block;">
            <div style="position: relative; display: inline-block; background: #00CC66; color: #000; font-weight: 900; font-size: 28px; padding: 14px 36px; border: 4px solid #000; border-radius: 20px; transform: rotate(-3deg); box-shadow: 4px 4px 0 #000;">
              POW!
              <div style="position: absolute; bottom: -16px; left: 28px; width: 0; height: 0; border-left: 14px solid transparent; border-right: 6px solid transparent; border-top: 18px solid #000; transform: rotate(10deg);"></div>
              <div style="position: absolute; bottom: -11px; left: 30px; width: 0; height: 0; border-left: 11px solid transparent; border-right: 4px solid transparent; border-top: 15px solid #00CC66; transform: rotate(10deg);"></div>
            </div>
          </div>
          <h1 style="position: relative; z-index: 1; color: #FFF200; font-size: 26px; font-weight: 900; margin: 24px 0 4px; text-shadow: 2px 2px 0 #000; letter-spacing: 1px;">WELCOME TO THE CHEST!</h1>
          <p style="position: relative; z-index: 1; color: #ffffff; font-size: 15px; margin: 0; opacity: 0.9;">Your collection journey starts now.</p>
        </div>
        <!-- Body -->
        <div style="padding: 32px 24px;">
          <p style="font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px;">Hey there, Collector! You're officially part of the crew. Here's what you can do with Collectors Chest:</p>
          <!-- Feature: Scan -->
          <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
            <div style="flex-shrink: 0; width: 36px; height: 36px; background: #ED1C24; border: 2.5px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 14px;"><span style="font-size: 18px;">📸</span></div>
            <div><div style="font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">Scan Any Cover</div><div style="font-size: 14px; color: #666; line-height: 1.4;">Snap a photo and our AI identifies your comic instantly.</div></div>
          </div>
          <!-- Feature: Track -->
          <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
            <div style="flex-shrink: 0; width: 36px; height: 36px; background: #0066FF; border: 2.5px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 14px;"><span style="font-size: 18px;">📊</span></div>
            <div><div style="font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">Track Your Value</div><div style="font-size: 14px; color: #666; line-height: 1.4;">See real eBay pricing for every book in your collection.</div></div>
          </div>
          <!-- Feature: Key Issues -->
          <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
            <div style="flex-shrink: 0; width: 36px; height: 36px; background: #FFF200; border: 2.5px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 14px;"><span style="font-size: 18px;">🔑</span></div>
            <div><div style="font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">Discover Key Issues</div><div style="font-size: 14px; color: #666; line-height: 1.4;">Find out if your books are first appearances, rare variants, or hidden gems.</div></div>
          </div>
          <!-- Feature: Organize -->
          <div style="display: flex; align-items: flex-start; margin-bottom: 0;">
            <div style="flex-shrink: 0; width: 36px; height: 36px; background: #00CC66; border: 2.5px solid #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 14px;"><span style="font-size: 18px;">📦</span></div>
            <div><div style="font-weight: 700; font-size: 15px; color: #000; margin-bottom: 2px;">Organize Everything</div><div style="font-size: 14px; color: #666; line-height: 1.4;">Custom lists, CSV import, stats, and more — your collection, your way.</div></div>
          </div>
          <!-- Scan allowance -->
          <div style="background: #FFF8E7; border: 3px solid #000; border-radius: 8px; padding: 16px 20px; margin: 24px 0 28px; text-align: center;">
            <div style="font-weight: 900; font-size: 18px; color: #000; margin-bottom: 4px;">🎯 You get <span style="color: #ED1C24;">10 FREE scans</span> every month!</div>
            <div style="font-size: 13px; color: #666;">Start scanning your collection today.</div>
          </div>
          <!-- CTA -->
          <div style="text-align: center; margin: 0 0 32px;">
            <a href="${data.collectionUrl}" style="display: inline-block; background: #0066FF; color: #ffffff; font-weight: 900; font-size: 18px; padding: 16px 48px; border: 3px solid #000; border-radius: 8px; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; box-shadow: 4px 4px 0 #000;">START SCANNING →</a>
          </div>
          <p style="text-align: center; font-size: 14px; color: #999; font-style: italic; margin: 0;">Scan comics. Track value. Collect smarter.</p>
        </div>
        <!-- Footer -->
        <div style="background: #f5f5f5; border-top: 2px solid #e5e5e5; padding: 24px 24px 28px; text-align: center;">
          <p style="font-size: 12px; color: #999; margin: 0 0 8px; line-height: 1.5;">Twisted Jester LLC · collectors-chest.com</p>
          <p style="font-size: 11px; color: #bbb; margin: 0; line-height: 1.5;"><a href="${appUrl}/privacy" style="color: #999; text-decoration: underline;">Privacy Policy</a> · <a href="${appUrl}/terms" style="color: #999; text-decoration: underline;">Terms of Service</a></p>
        </div>
      </div>
    `,
    text: `Welcome to Collectors Chest!\n\nHey there, Collector! You're officially part of the crew.\n\nHere's what you can do:\n\n📸 Scan Any Cover — Snap a photo and our AI identifies your comic instantly.\n📊 Track Your Value — See real eBay pricing for every book in your collection.\n🔑 Discover Key Issues — Find out if your books are first appearances, rare variants, or hidden gems.\n📦 Organize Everything — Custom lists, CSV import, stats, and more.\n\n🎯 You get 10 free scans every month!\n\nStart scanning: ${data.collectionUrl}\n\nScan comics. Track value. Collect smarter.\n\nTwisted Jester LLC · collectors-chest.com`,
  };
}
```

- [ ] **Step 4: Wire welcomeTemplate into sendNotificationEmail**

In `src/lib/email.ts`, update the `NotificationEmailType` union (around line 227):

```typescript
export type NotificationEmailType =
  | "offer_received"
  | "offer_accepted"
  | "offer_rejected"
  | "offer_countered"
  | "offer_expired"
  | "listing_expiring"
  | "listing_expired"
  | "message_received"
  | "feedback_reminder"
  | "new_listing_from_followed"
  | "welcome";
```

Update the `SendNotificationEmailParams` data union (around line 242):

```typescript
interface SendNotificationEmailParams {
  to: string;
  type: NotificationEmailType;
  data:
    | OfferEmailData
    | ListingEmailData
    | MessageEmailData
    | FeedbackEmailData
    | NewListingEmailData
    | WelcomeEmailData;
}
```

Add the case to the switch statement in `sendNotificationEmail` (before the `default` case):

```typescript
    case "welcome":
      template = welcomeTemplate(data as WelcomeEmailData);
      break;
```

Add `WelcomeEmailData` to the export at the bottom of the file:

```typescript
export type { FeedbackEmailData, NewListingEmailData, WelcomeEmailData };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest welcomeEmail -v`
Expected: 4 tests PASS

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass (no regressions)

- [ ] **Step 7: Commit**

```bash
git add src/lib/email.ts src/lib/__tests__/welcomeEmail.test.ts
git commit -m "feat: add welcome email template with pop-art design"
```

---

### Task 2: Wire Clerk webhook to send welcome email on user.created

**Files:**
- Modify: `src/app/api/webhooks/clerk/route.ts`

- [ ] **Step 1: Update ClerkWebhookEvent interface**

In `src/app/api/webhooks/clerk/route.ts`, replace the existing `ClerkWebhookEvent` interface (lines 9-15):

```typescript
interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    deleted?: boolean;
    email_addresses?: Array<{ email_address: string; id: string }>;
    primary_email_address_id?: string;
    first_name?: string | null;
    last_name?: string | null;
  };
}
```

- [ ] **Step 2: Add import for sendNotificationEmail**

Add at the top of the file, after the existing imports:

```typescript
import { sendNotificationEmail } from "@/lib/email";
```

- [ ] **Step 3: Add user.created handler**

In the webhook POST handler, add this block **before** the existing `user.deleted` check (before line 55):

```typescript
  // Handle the user.created event — send welcome email
  if (event.type === "user.created") {
    const { email_addresses, primary_email_address_id } = event.data;

    // Find the primary email address
    const primaryEmail = email_addresses?.find(
      (e) => e.id === primary_email_address_id
    )?.email_address;

    if (primaryEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://collectors-chest.com";

      // Fire and forget — don't block webhook response
      sendNotificationEmail({
        to: primaryEmail,
        type: "welcome",
        data: { collectionUrl: `${appUrl}/collection` },
      }).catch((err) => {
        console.error("[Webhook] Failed to send welcome email:", err);
      });
    }

    return NextResponse.json({ received: true });
  }
```

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/app/api/webhooks/clerk/route.ts
git commit -m "feat: send welcome email on Clerk user.created webhook"
```

---

### Task 3: Manual verification

- [ ] **Step 1: Verify dev server runs**

Run: `npm run dev` (if not already running)
Open: http://localhost:3000

- [ ] **Step 2: Test welcome email via Clerk test event**

Option A — Create a test account via the app's sign-up flow in dev mode.

Option B — Use Clerk dashboard → Webhooks → Send test event → Select `user.created`.

Check terminal for any error logs from the webhook handler.

- [ ] **Step 3: Verify email received**

Check the recipient inbox (or Resend dashboard → Logs) for the welcome email. Verify:
- Subject: "Welcome to Collectors Chest!"
- POW! speech bubble renders (green background)
- Feature highlights show with colored circles
- "10 FREE scans" callout visible
- "START SCANNING" button is blue, links to /collection
- Footer shows Twisted Jester LLC + legal links
- Plain text version renders if viewing in a text-only client

- [ ] **Step 4: Run quality check**

Run: `npm run check`
Expected: typecheck + lint + test all pass
