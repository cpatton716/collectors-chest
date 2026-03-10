# Feedback - March 6, 2026

## Testing Context
- **Platform:** Both (Mobile + Desktop)
- **Account Types:** Guest, Free, Premium
- **Mobile Device:** Android
- **Desktop Browser:** Mac Chrome

---

## Issues Found

### #1 - Start Free Trial button non-responsive (Stats page)
- **Page:** /stats
- **Account:** Free (patton+test1@rovertown.com)
- **Platform:** Mobile + Desktop
- **Severity:** High
- **Description:** Clicking "Start 7-Day Free Trial" button on stats page did nothing. No loading indicator, no error message, no feedback at all.
- **Root Cause:** FeatureGate component had no loading state or error handling. If `startFreeTrial()` failed (trial already used) and `startCheckout()` also failed (Stripe not configured), the button silently did nothing.
- **Fix:** Extracted UpgradePrompt component with `isStarting` loading state and error message display. Button now shows "Starting..." while processing and displays error if both paths fail.
- **Status:** Fixed (commit f921e1a)

### #2 - Cover lightbox not showing image on mobile
- **Page:** /collection (Comic Detail Modal)
- **Account:** Any
- **Platform:** Mobile (Android)
- **Severity:** Medium
- **Description:** Tapping the cover thumbnail in comic details expands to a gray/dark overlay but no image is visible. Screen just grays out.
- **Root Cause:** Lightbox used Next.js `Image` with `fill` mode, which requires the parent to have explicit dimensions. On mobile, the parent div only had `aspect-[2/3]` constraints with no concrete width/height, so the image rendered at 0x0.
- **Fix:** Switched to plain `<img>` tag with `max-w-full max-h-[90vh] object-contain` which sizes itself naturally.
- **Status:** Fixed (commit f921e1a)

### #3 - Mobile dev server not accessible from phone
- **Page:** N/A (dev environment)
- **Severity:** Low (dev-only)
- **Description:** Dev server was not reachable from Android device on same Wi-Fi. `next dev` defaults to localhost only.
- **Fix:** Restarted with `next dev --hostname 0.0.0.0` to bind to all network interfaces. (Note: user's Wi-Fi was also off initially.)
- **Status:** Resolved (dev environment only)

### #4 - Rework wording on non-logged-in user blurb
- **Page:** Homepage (guest/non-logged-in view)
- **Account:** Guest (not signed in)
- **Platform:** Both
- **Severity:** Low
- **Description:** The speech bubble blurb says "Scan covers with technopathic recognition, track your collection's value, discover key issues, and connect with fellow collectors to buy and sell." Wording needs to be reworked.
- **Status:** Pending

### #5 - Allow users to hide Cost/Sales/Profit-Loss fields on collection page
- **Page:** /collection
- **Account:** Any (signed in)
- **Platform:** Both
- **Severity:** Medium
- **Description:** The collection page shows Cost, Sales, and Profit/Loss fields. Users who are not using the platform to sell books don't need these fields and should be able to disable/hide them. Add a user preference toggle to show/hide these financial tracking fields.
- **Status:** Pending

### #6 - Add photo best practices to Professor's FAQ
- **Page:** FAQ / Ask the Professor
- **Account:** Any
- **Platform:** Both
- **Severity:** Low
- **Description:** Add a FAQ entry with best practices for taking a photo of a book cover for scanning (e.g., lighting, angle, full cover visible, avoid glare on slabbed books, etc.). Helps users get better scan results.
- **Status:** Pending

### #7 - Add "Sort by Grade" option to collection page
- **Page:** /collection
- **Account:** Any (signed in)
- **Platform:** Both
- **Severity:** Medium
- **Description:** Add a new sort option to the collection page sorting dropdown to sort comics by grade (e.g., 9.8 first, then 9.6, etc.).
- **Status:** Pending

### #8 - Grade pills on stats page should link to collection filtered by grade
- **Page:** /stats (Grading Breakdown section)
- **Account:** Premium
- **Platform:** Both
- **Severity:** Medium
- **Description:** In the "Grade Distribution (Slabbed Comics)" section, the grade pills (e.g., "9.8: 1", "9.4: 3") should be clickable. Clicking a grade pill should redirect to the collection page sorted/filtered by that grade using the new sort-by-grade feature from #7.
- **Status:** Pending (depends on #7)

### #9 - Add "Grading Company" filter to collection page
- **Page:** /collection
- **Account:** Any (signed in)
- **Platform:** Both
- **Severity:** Medium
- **Description:** Add a filter option to the collection page to filter comics by grading company (CGC, CBCS, PGX, etc.).
- **Status:** Pending

### #10 - Grading company counts on stats page should link to filtered collection
- **Page:** /stats (Grading Breakdown section)
- **Account:** Premium
- **Platform:** Both
- **Severity:** Medium
- **Description:** In the "Grading Companies" section where it shows counts per company (e.g., CGC: 6, CBCS: 3, PGX: 2), clicking on a company name/count should redirect to the collection page auto-filtered by that grading company using the new filter from #9.
- **Status:** Pending (depends on #9)

---

## Notes
- Admin panel already has "Reset Trial" button at Admin > Users (was not previously known to user)
- Stripe environment variables are not configured yet, so trial start falls back to direct trial, and checkout fails with 503. Error message now surfaces this clearly.
