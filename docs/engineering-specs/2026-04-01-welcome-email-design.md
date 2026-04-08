# Welcome Email Design Spec

**Date:** April 1, 2026
**Status:** Approved

---

## Overview

Send a branded welcome email when a new user creates an account. The email uses the Lichtenstein pop-art aesthetic consistent with the rest of the site — bold colors, comic speech bubbles, ben-day dots, thick borders.

## Trigger

- **Event:** `user.created` Clerk webhook
- **Recipient:** The new user's primary email address (from Clerk webhook payload)
- **Send via:** Resend (existing email infrastructure)

## Email Content

### Header (blue #0066FF background with ben-day dot overlay)
1. **COLLECTORS CHEST** badge — yellow (#FFF200) background, black border, slight rotation
2. **POW!** speech bubble — green (#00CC66) background, rounded rectangle with tail, black border + shadow
3. **WELCOME TO THE CHEST!** — yellow text, black text-shadow
4. **"Your collection journey starts now."** — white subtitle text

### Body
5. **Greeting:** "Hey there, Collector! You're officially part of the crew. Here's what you can do with Collectors Chest:"

6. **Feature highlights** (4 items, each with a colored circle icon):
   - Scan Any Cover (red circle, camera emoji) — "Snap a photo and our AI identifies your comic instantly."
   - Track Your Value (blue circle, chart emoji) — "See real eBay pricing for every book in your collection."
   - Discover Key Issues (yellow circle, key emoji) — "Find out if your books are first appearances, rare variants, or hidden gems."
   - Organize Everything (green circle, box emoji) — "Custom lists, CSV import, stats, and more — your collection, your way."

7. **Scan allowance callout** — cream (#FFF8E7) background, black border, centered:
   - "You get **10 FREE scans** every month!" (10 FREE scans in red)
   - "Start scanning your collection today."

8. **CTA button** — blue (#0066FF), white text, black border, pop-art shadow:
   - Text: "START SCANNING →"
   - Links to: `{APP_URL}/collection`

9. **Tagline** — italic, gray: "Scan comics. Track value. Collect smarter."

### Footer (light gray background)
10. **Business info:** "Twisted Jester LLC · collectors-chest.com"
11. **Links:** Privacy Policy | Terms of Service | Unsubscribe

## Technical Implementation

### Files to modify
- **`src/app/api/webhooks/clerk/route.ts`** — Add `user.created` event handler that extracts email + name and sends welcome email
- **`src/lib/email.ts`** — Add `WelcomeEmailData` interface, `welcomeTemplate()` function, and `"welcome"` type to `sendNotificationEmail`

### Data from Clerk webhook payload
```typescript
interface ClerkUserCreatedData {
  id: string;
  email_addresses: Array<{ email_address: string; id: string }>;
  first_name: string | null;
  last_name: string | null;
  primary_email_address_id: string;
}
```

### Template structure
- Full inline CSS (email clients don't support external stylesheets)
- HTML + plain text versions (existing pattern in email.ts)
- Ben-day dots via CSS radial-gradient (works in Gmail, Apple Mail, Outlook web)

### Colors reference
| Element | Color |
|---------|-------|
| Header background | #0066FF |
| Brand badge | #FFF200 (yellow) |
| POW! bubble | #00CC66 (green) |
| Welcome text | #FFF200 (yellow) |
| CTA button | #0066FF (blue) |
| Scan callout bg | #FFF8E7 (cream) |
| "10 FREE scans" | #ED1C24 (red) |
| Footer bg | #f5f5f5 |

## What's NOT included
- Premium upsell — don't hit new users with an upgrade ask on day one
- Onboarding wizard link — keep it simple, one CTA

## Testing
- Unit test for `welcomeTemplate()` function (subject, html contains key strings, text version exists)
- Manual test: create a test account via Clerk, verify email arrives with correct formatting
- Verify plain text fallback renders cleanly
