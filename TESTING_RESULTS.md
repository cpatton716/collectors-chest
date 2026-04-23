# Testing Results Log

This document tracks testing sessions with platform and account context.

---

## April 22, 2026 - Session Start
- **Platform:** Both (Web + Mobile)
- **Account Type:** Guest, Free, Premium
- **Device(s):** iPhone, Android, Mac Chrome
- **Focus:** Address bugs from yesterday's session + new bug identified last night

---

## April 21, 2026 - Session Start
- **Platform:** Both (Web + Mobile)
- **Account Type:** Guest, Free, Premium
- **Device(s):** iPhone, Android, Mac Chrome
- **Focus:** To be filled as session progresses

---

## April 20, 2026 - Session Start
- **Platform:** Both (Web + Mobile)
- **Account Type:** Free, Premium
- **Device(s):** Android, Mac Chrome
- **Focus:** To be filled as session progresses

---

## April 16, 2026 - Session Start
- **Platform:** Both (Web + Mobile)
- **Account Type:** Free, Premium
- **Device(s):** iPhone, Android, Mac Chrome
- **Focus:** To be filled as session progresses

---

## March 1, 2026 - Session Start
- **Platform:** Mobile
- **Account Type:** Free, Premium
- **Device(s):** Android, Mac Chrome
- **Focus:** To be filled as session progresses

---

## February 10, 2026 - Session Start
- **Platform:** Mobile
- **Account Type:** Free (Registered)
- **Device(s):** Android
- **Focus:** TBD - user feedback from mobile testing

---

## February 8, 2026 - Session Start
- **Platform:** Both (Mobile + Web)
- **Account Type:** Free
- **Device(s):** Android, Mac Chrome
- **Focus:** Real-time messaging (#17), Key Hunt trial fix (#12), UX improvements
- **Results:**
  - Fixed: Following button pink → blue on Shop page
  - Fixed: Message container scroll overflow
  - Fixed: "Back to conversations" link refreshing current thread
  - Fixed: Real-time messaging (Supabase subscription)
  - Fixed: Nav unread badge (Clerk vs Supabase ID mismatch)
  - Fixed: Key Hunt access for trial users (MobileNav isPremium)
  - Added: Tappable @username in MessageThread and SellerBadge
  - Added: Missing POST /api/messages/{id}/read endpoint
  - Added: 6 unit tests for markMessagesAsRead
  - Deployed to production (commit 06faa08)

---

## February 6, 2026 - Session Start
- **Platform:** Both (Mobile + Web)
- **Account Type:** Premium, Guest
- **Device(s):** Android, Mac Chrome
- **Focus:** TBD

---

## February 5, 2026 - Session Start
- **Platform:** Both (Mobile + Web)
- **Account Type:** Free & Premium
- **Device(s):** MacBook Chrome, Android Chrome
- **Focus:** Public share link bug fix
- **Result:** FIXED - Root cause was `.or()` query with UUID type mismatch in `getPublicProfile()`

---

## February 4, 2026 - Session 2

- **Platform:** Mobile
- **Account Type:** Free (registered, not premium)
- **Device(s):** Android phone (Chrome)
- **Focus:** Barcode scanner testing
- **Issues Found:**
  - Barcode scanner fails with "NotReadableError: Could not start video source"
  - Chrome requires HTTPS for camera getUserMedia on non-localhost IPs
  - Chrome flags workaround (`chrome://flags` insecure origins) already configured but still failing
  - Scanner shows "active" state but video feed is black
- **Fixes Attempted:**
  - Added camera release logic before starting scanner
  - Removed problematic releaseCamera function
  - Added explicit videoConstraints for mobile
  - Added CSS overrides for html5-qrcode video element
- **Status:** Testing in progress

---

## February 4, 2026 - Session 1 (from DEV_LOG)

- **Platform:** Mobile (inferred from CSV import mobile testing)
- **Account Type:** Unknown
- **Focus:** CSV Import improvements
- **Issues Found:**
  - Barcode scanner broken - mobile Chrome caching old JS bundle referencing removed jsqr package
  - Error: "Module jsqr was instantiated but module factory is not available"
- **Completed:**
  - CSV Import: Quick Import toggle
  - CSV Import: Cover tip callout
  - CSV Import: Modal stays until Done clicked
  - Navigation: Fixed "More" button active state

---

## February 2, 2026 (from DEV_LOG)

- **Platform:** Unknown
- **Account Type:** Unknown
- **Focus:** Bulk actions, trades API, pricing page
- **Completed:**
  - Bulk Actions feature completed
  - Fixed /api/trades/available 500 error
  - Pricing page color improvements
  - Navigation click-outside fix
- **Issues Found:**
  - Trades API was using non-existent `seller_rating` column

---

## January 30, 2026 (from DEV_LOG)

- **Platform:** Unknown
- **Account Type:** Unknown
- **Focus:** Follow system implementation
- **Completed:**
  - Full follow system (16 tasks)
  - CSV import listing fix
- **Issues Found:**
  - CSV listing creation failing silently due to ID mismatch

---

## January 29, 2026 (from DEV_LOG)

- **Platform:** Mobile + Web (inferred from mobile responsiveness testing)
- **Account Type:** Unknown
- **Focus:** Production bug fixes, messaging
- **Issues Found:**
  - Production 500 error from Next.js route conflict (`/api/messages/[messageId]` vs `/api/messages/[conversationId]`)
  - Multiple messaging bugs (RLS blocking queries, column name mismatches)
- **Completed:**
  - Route conflict fix
  - Prevention scripts (check-routes.js, smoke-test.sh)
  - Seller location badges
  - Message seller buttons

---

## January 28, 2026 (from DEV_LOG)

- **Platform:** Unknown
- **Account Type:** Unknown
- **Focus:** User location feature, backlog audit
- **Issues Found:**
  - Import error: `createClient` not exported from supabase
- **Completed:**
  - User profile location feature
  - Backlog audit (8 items marked complete)

---

## January 27, 2026 (from DEV_LOG)

- **Platform:** Unknown
- **Account Type:** Unknown
- **Focus:** Messaging Phase 1, sales tracking
- **Issues Found:**
  - API error in parallel session required restart
- **Completed:**
  - Peer-to-peer messaging Phase 1
  - Sales tracking page
  - Auction cancellation policy

---

## January 14, 2026 (from DEV_LOG)

- **Platform:** Mobile (inferred from PWA icon testing, iOS Chrome detection)
- **Account Type:** Unknown
- **Focus:** PWA fixes, waitlist API
- **Issues Found:**
  - Waitlist API "Failed to join" - Resend API key was send-only
  - PWA icons 404 - PNG files were gitignored
  - iOS Chrome doesn't support PWA install
- **Completed:**
  - New Resend API key with full access
  - PWA icons committed
  - iOS Chrome detection with Safari redirect

---

## January 8-9, 2026 (from DEV_LOG)

- **Platform:** Mobile (Key Hunt feature is mobile-focused)
- **Account Type:** Unknown
- **Focus:** Key Hunt, mobile camera, grade pricing
- **Issues Found:**
  - Camera permission black screen - solved with Permissions API checks
  - Hottest Books API failed - Anthropic credits exhausted
- **Completed:**
  - Key Hunt quick lookup feature
  - LiveCameraCapture component
  - Grade-aware pricing
  - Sign-up milestone prompts
  - Barcode scanner rewrite with better error handling

---

## Notes

- Platform/Account tracking was added February 4, 2026
- Earlier entries are reconstructed from DEV_LOG context clues
- Future sessions will capture this info at session start

## Feb 8, 2026 - Session Start
- **Platform:** Both (Mobile + Desktop)
- **Account Type:** Free
- **Device(s):** Android, Mac Chrome
- **Focus:** To be filled as session progresses

## Feb 19, 2026 - Session Start
- **Platform:** Web
- **Account Type:** Free & Premium
- **Device(s):** N/A (desktop only)
- **Browser(s):** Mac Chrome
- **Focus:** To be filled as session progresses

## 2026-03-03 - Session Start
- **Platform:** Both (Mobile + Web)
- **Account Type:** Free, Premium
- **Device(s):** Android, Mac Chrome
- **Focus:** TBD

## Mar 10, 2026 - Session Start
- **Platform:** Mobile
- **Account Type:** Free, Premium
- **Device(s):** Android
- **Focus:** To be filled as session progresses

## Mar 11, 2026 - Session Start
- **Platform:** Both (Mobile + Web)
- **Account Type:** Free, Premium
- **Device(s):** iPhone, Android, Mac Chrome
- **Focus:** TBD

## Mar 13, 2026 - Session 20 Start
- **Platform:** Both (Mobile + Web)
- **Account Type:** Free, Premium
- **Device(s):** Android (mobile), Mac Chrome (desktop)
- **Focus:** To be determined

## Mar 18, 2026 - Session 21 Start
- **Platform:** Mobile (Android)
- **Account Type:** Free, Premium
- **Device(s):** Android
- **Desktop Backup:** Mac Chrome
- **Focus:** To be filled as session progresses

## Mar 18, 2026 - Session 22 Start
- **Platform:** Mobile (Android)
- **Account Type:** Free, Premium
- **Device(s):** Android
- **Browsers:** Mac Chrome (reference)
- **Focus:** TBD

## Mar 19, 2026 - Session 23 Start
- **Platform:** Both (Mobile + Web)
- **Account Type:** Free, Premium
- **Device(s):** Android, Mac Chrome
- **Focus:** TBD

## April 1, 2026 - Session Start
- **Platform:** Both (Mobile + Web)
- **Account Type:** Free, Premium
- **Device(s):** Android, Mac Chrome
- **Focus:** To be filled as session progresses

## April 2, 2026 - Session Start
- **Platform:** Both (Mobile + Web)
- **Account Type:** TBD
- **Device(s):** TBD
- **Sounds:** No
- **Focus:** To be filled as session progresses

## Apr 5, 2026 - Session Start
- **Platform:** Mobile (Android)
- **Account Type:** Free, Premium
- **Device(s):** Android
- **Focus:** TBD

## Apr 7, 2026 - Session 33 Start
- **Platform:** Both (Mobile + Web)
- **Account Type:** Free, Premium
- **Device(s):** Android, Mac Chrome, Mac Safari
- **Focus:** TBD
