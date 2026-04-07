# Email Test Cases

Manual test cases for all email notifications in Collectors Chest.

**How to test:** For each test case, follow the steps, check your inbox (cpatton716@gmail.com), and verify the expected result. Mark each as Pass/Fail.

**Email sender:** `Collectors Chest <notifications@collectors-chest.com>`

---

## 1. Welcome Email

**Trigger:** New user signs up via Clerk

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 1.1 | Welcome email sent on signup | Sign up with a new account | Email received with subject "Welcome to Collectors Chest!" | |
| 1.2 | Logo header | Open email | Collectors Chest emblem logo displayed in blue header | |
| 1.3 | Feature list | Check email body | 4 features listed: Scan Any Cover, Track Your Value, Discover Key Issues, Organize Everything | |
| 1.4 | Free scan callout | Check email body | "You get 10 FREE scans every month!" callout box | |
| 1.5 | CTA button | Click "START SCANNING" | Redirects to /collection page | |
| 1.6 | Emoji icons centered | Check feature icons | Camera, chart, key, package emojis centered in colored circles | |
| 1.7 | Footer content | Scroll to bottom | Tagline, Twisted Jester LLC, Privacy Policy & Terms links | |


PASS

---

## 2. Verification Code (Clerk-managed)

**Trigger:** Clerk sends verification codes for sign-up, password reset, etc.

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 2.1 | Sign-up verification | Sign up with email/password | Clerk sends verification code email | |
| 2.2 | Password reset | Sign In → "Forgot password?" → Enter email | "Check your email" message, reset email arrives | |
| 2.3 | Reset link works | Click link in reset email | Redirected to password reset page | |
| 2.4 | Invalid email for reset | Enter non-existent email | Generic success message (no user enumeration) | |
| 2.5 | New device sign-in | Sign in from a new device or browser | Clerk sends "new device" notification email | |
| 2.6 | New device email content | Open new device email | Shows device/browser info, location, and timestamp | |

PASS

---

## 3. Trial Expiring

**Trigger:** Cron job (`/api/cron/send-trial-reminders`) — runs daily, sends 3 days before trial ends

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 3.1 | Trial reminder sent | Have an active trial ending within 3 days | Email received: "Your Collectors Chest trial ends in 3 days" | |
| 3.2 | Logo header | Open email | Collectors Chest emblem logo displayed in blue header | |
| 3.3 | Loss list | Check email body | Lists: unlimited scans, Key Hunt, CSV export, advanced stats, priority scan queue | |
| 3.4 | Pricing info | Check email body | "$4.99/month" and "Save 17% with the annual plan" shown | |
| 3.5 | CTA button | Click "STAY PREMIUM" | Redirects to /choose-plan | |
| 3.6 | Idempotency | Trigger cron twice for same user | Only one email sent (trial_reminder_sent_at prevents duplicates) | |
| 3.7 | Stripe-managed excluded | User with stripe_subscription_id (Stripe trial) | No email sent (only app-managed trials get reminder) | |

---

## 4. Offer Received

**Trigger:** Buyer submits an offer on a fixed-price listing

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 4.1 | Seller notified | As Buyer, submit offer on a listing | Seller receives email: "New offer on [Comic] #[Issue]" | |
| 4.2 | Logo header | Open email | Collectors Chest emblem logo displayed in blue header | |
| 4.3 | Offer details | Check email body | Shows buyer name, offer amount, comic title/issue | |
| 4.4 | Response deadline | Check email body | "You have 48 hours to respond to this offer." | |
| 4.5 | CTA button | Click "VIEW OFFER" | Redirects to /shop/[listingId] | |

---

## 5. Offer Accepted

**Trigger:** Seller accepts buyer's offer OR buyer accepts seller's counter-offer

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 5.1 | Buyer notified (seller accepts) | As Seller, accept a pending offer | Buyer receives: "Your offer on [Comic] #[Issue] was accepted!" | |
| 5.2 | Seller notified (buyer accepts counter) | As Buyer, accept a counter-offer | Seller receives: "Your offer on [Comic] #[Issue] was accepted!" | |
| 5.3 | Logo header | Open email | Collectors Chest emblem logo displayed in blue header | |
| 5.4 | Payment reminder | Check email body | "Please complete your payment within 48 hours" | |
| 5.5 | CTA button | Click "COMPLETE PAYMENT" | Redirects to /shop/[listingId] | |
| 5.6 | Correct amount (counter) | Accept a counter-offer | Email shows counter amount, not original offer amount | |

---

## 6. Offer Rejected

**Trigger:** Seller rejects buyer's offer OR buyer rejects seller's counter-offer

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 6.1 | Buyer notified (seller rejects) | As Seller, reject a pending offer | Buyer receives: "Update on your offer for [Comic] #[Issue]" | |
| 6.2 | Seller notified (buyer rejects counter) | As Buyer, reject a counter-offer | Seller receives: "Update on your offer for [Comic] #[Issue]" | |
| 6.3 | Logo header | Open email | Collectors Chest emblem logo displayed in blue header | |
| 6.4 | Rejection message | Check email body | "[Name] has declined your offer of [amount]" | |
| 6.5 | Next steps | Check email body | "You can submit a new offer or browse other listings" | |
| 6.6 | CTA button | Click "VIEW LISTING" | Redirects to /shop/[listingId] | |

---

## 7. Offer Countered

**Trigger:** Seller counters buyer's offer with a different amount

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 7.1 | Buyer notified | As Seller, counter an offer | Buyer receives: "Counter-offer on [Comic] #[Issue]" | |
| 7.2 | Logo header | Open email | Collectors Chest emblem logo displayed in blue header | |
| 7.3 | Both amounts shown | Check email body | "Your offer: [original]" and "Counter-offer: [counter amount]" | |
| 7.4 | Response deadline | Check email body | "You have 48 hours to respond to this counter-offer." | |
| 7.5 | CTA button | Click "RESPOND TO OFFER" | Redirects to /shop/[listingId] | |

---

## 8. Offer Expired

**Trigger:** Cron job (`/api/cron/process-auctions`) — offers pending/countered for 48+ hours

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 8.1 | Buyer notified | Let an offer go 48 hours without response | Buyer receives: "Your offer on [Comic] #[Issue] has expired" | |
| 8.2 | Logo header | Open email | Collectors Chest emblem logo displayed in blue header | |
| 8.3 | Expiration reason | Check email body | "The seller did not respond within 48 hours" | |
| 8.4 | Re-offer option | Check email body | "You can submit a new offer if the listing is still active" | |
| 8.5 | CTA button style | Check CTA button | Gray button (not blue) — "VIEW LISTING" | |

---

## 9. Listing Expiring

**Trigger:** Cron job (`/api/cron/process-auctions`) — listing expires within 24 hours

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 9.1 | Seller notified | Have a listing expiring within 24 hours | Seller receives: "Your listing for [Comic] #[Issue] expires soon" | |
| 9.2 | Logo header | Open email | Collectors Chest emblem logo displayed in blue header | |
| 9.3 | Listing details | Check email body | Shows comic title, issue number, and price | |
| 9.4 | Relist suggestion | Check email body | "You can relist it before it expires" | |
| 9.5 | CTA button | Click "VIEW LISTING" | Redirects to /shop/[listingId] | |
| 9.6 | No duplicate reminders | Trigger cron twice for same listing | Only one expiring notification sent | |

---

## 10. Listing Expired

**Trigger:** Cron job (`/api/cron/process-auctions`) — listing past its expiration date

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 10.1 | Seller notified | Let a listing expire | Seller receives: "Your listing for [Comic] #[Issue] has expired" | |
| 10.2 | Logo header | Open email | Collectors Chest emblem logo displayed in blue header | |
| 10.3 | Expired message | Check email body | "Your listing has expired and is no longer visible in the shop" | |
| 10.4 | Relist suggestion | Check email body | "You can relist this item from your collection" | |
| 10.5 | CTA button | Click "VIEW COLLECTION" | Redirects to /collection (gray button) | |

---

## 11. Message Received

**Trigger:** Another user sends you a message

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 11.1 | Recipient notified | As User A, send message to User B | User B receives: "New message from [User A name]" | |
| 11.2 | Logo header | Open email | Collectors Chest emblem logo displayed in blue header | |
| 11.3 | Message preview | Check email body | Blockquote with message text (truncated to 100 chars) | |
| 11.4 | Image-only message | Send a message with only an image | Email preview shows "[Image]" | |
| 11.5 | CTA button | Click "VIEW MESSAGE" | Redirects to /messages | |
| 11.6 | Email preference off | Disable email notifications in settings, receive message | No email sent | |
| 11.7 | Email preference on | Enable email notifications, receive message | Email sent | |

---

## 12. Feedback Reminder

**Trigger:** Cron job (`/api/cron/send-feedback-reminders`) — 14 days after completed transaction

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 12.1 | First reminder sent | Complete a sale, wait 14+ days | Both buyer and seller receive: "How was your purchase? Leave feedback for [Name]" | |
| 12.2 | Logo header | Open email | Collectors Chest emblem logo displayed in blue header | |
| 12.3 | Transaction details | Check email body | Shows comic title, issue number, other party's name, transaction type | |
| 12.4 | CTA button | Click "Leave Feedback" | Redirects to /feedback?txn=[id]&type=[type] | |
| 12.5 | Ignore notice | Check email body | "If you've already left feedback, you can ignore this email." | |
| 12.6 | Final reminder | Wait 21+ days (7+ days after first reminder) | Second and final reminder sent | |
| 12.7 | No reminder after feedback | Leave feedback before reminder triggers | No email sent (feedback_left_at is set) | |
| 12.8 | Max 2 reminders | After 2 reminders sent | No additional reminders sent | |

---

## 13. New Listing from Followed User

**Trigger:** A user you follow creates a new listing

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 13.1 | Follower notified | Follow User A, User A creates a listing | Receive: "New listing from @[username] on Collectors Chest" | |
| 13.2 | Logo header | Open email | Collectors Chest emblem logo displayed in blue header | |
| 13.3 | Listing details | Check email body | Shows seller name, comic title, price | |
| 13.4 | Cover image (if available) | Listing has a cover image | Cover image displayed in email | |
| 13.5 | CTA button | Click "VIEW LISTING" | Redirects to /shop/[listingId] | |
| 13.6 | Follow attribution | Check email footer area | "You're receiving this because you follow @[username]" | |
| 13.7 | Email preference off | Disable email notifications, followed user creates listing | No email sent | |
| 13.8 | Multiple followers | 3 users follow a seller, seller creates listing | All 3 followers receive the email | |

---

## General Email Quality Checks

Run these for any email received during testing:

| # | Check | Expected Result | Status |
|---|-------|-----------------|--------|
| G.1 | Sender address | From: `Collectors Chest <notifications@collectors-chest.com>` | |
| G.2 | Pop-art header | Blue header with halftone dots and Collectors Chest emblem logo | |
| G.3 | Logo renders | Check header image | Logo displays correctly, no broken image icon | |
| G.4 | Footer tagline | "Scan comics. Track value. Collect smarter." | |
| G.5 | Footer company | "Twisted Jester LLC · collectors-chest.com" | |
| G.6 | Footer links | Privacy Policy and Terms of Service links work | |
| G.7 | Mobile rendering | Open email on phone | Layout is readable, buttons are tappable | |
| G.8 | Dark mode | View email in dark mode | Text remains readable, images display correctly | |
| G.9 | Gmail rendering | View in Gmail | No clipping, styles render properly | |
| G.10 | No broken images | Check all emails | No broken image icons | |
