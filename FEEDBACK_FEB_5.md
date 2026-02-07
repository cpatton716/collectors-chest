# Feedback - February 5, 2026

## Status Summary

| # | Issue | Status |
|---|-------|--------|
| 1 | CSV import: accept flexible boolean values (yes/no, Y/N, etc.) | ✅ Complete |
| 2 | Cover images being returned incorrectly | 📌 Pinned — needs specific examples |
| 3 | Book details missing cover uses old Riddler style, not pop-art | ✅ Complete |
| 4 | Edit mode publisher dropdown doesn't match stored publisher value | ✅ Complete — needs testing |
| 5 | CSV import: dollar signs in price fields cause values to be dropped | ✅ Complete — needs testing |
| 6 | Notify key info submitter on admin approval/rejection | ✅ Complete — needs testing |
| 7 | Approving key info doesn't update submitter's reputation/feedback | ✅ Complete — needs testing |
| 8 | Public share page missing covers use old Riddler style, not pop-art | ✅ Complete (same fix as #3) |
| 9 | Public view book details should show user profile info | ✅ Tested |
| 10 | Admin user search: magnifying glass overlaps placeholder text | ✅ Tested |
| 11 | Admin user search: no message when no results found | ✅ Complete — needs testing |
| 12 | Premium user lost Key Hunt access after trial reset + reactivation | 📌 Pinned — needs DB investigation |
| 13 | Admin portal needs better navigation to all admin tools | ✅ Tested |
| 14 | Key Hunt list not showing up for guest/free user | ✅ Complete — needs testing |
| 15 | "Start 7-day Trial" button on Key Hunt page not working | ✅ Closed — believed working, revisit if needed |
| 16 | Key Hunt page not in pop-art style and not scrollable | ✅ Tested |
| 17 | Messages need real-time updates without page refresh | 📌 Pinned — future "Messaging v2" session |
| 18 | Changing raw↔slabbed should re-evaluate book value | ✅ Complete — already reactive, no change needed |
| 19 | Sort by value not sorting correctly | ✅ Tested |
| 20 | Message notification icon behavior is sporadic/broken | 📌 Pinned — future "Messaging v2" session |
| 21 | No visible way to follow another user | ✅ Tested |

---

## 1. CSV import should accept flexible boolean values

**Status:** ✅ Complete

**Issue:** CSV import only accepts `true`/`false` for boolean fields (e.g., `forSale`, `isSlabbed`). Users naturally type "yes", "no", "Y", "N", etc. which get ignored.

**Desired behavior:** Accept common boolean representations: `true/false`, `yes/no`, `y/n`, `1/0` (case-insensitive).

---

## 2. Cover images being returned incorrectly

**Status:** 📌 Pinned

**Issue:** Some cover images returned during scans or lookups are wrong. User to provide specific examples for investigation.

**Next steps:** Need 2-3 specific title/issue examples with wrong covers to trace the bug.

---

## 3. Book details missing cover uses old Riddler style, not pop-art

**Status:** ✅ Complete

---

## 4. Edit mode publisher dropdown doesn't match stored publisher value

**Status:** ✅ Complete — needs testing

**Issue:** Book details view shows "DC" as the publisher, but when entering Edit mode, the Publisher dropdown shows "Select publisher..." instead of the stored value. Likely a mismatch between the stored value ("DC") and the dropdown options (which may use "DC Comics"). Noticed on imports.

**Fix applied:**
- Created `PUBLISHER_ALIASES` map and `normalizePublisher()` function in `src/types/comic.ts`
- Maps common shorthand to canonical names (DC → DC Comics, Marvel → Marvel Comics, etc.)
- Applied normalization in CSV import, API responses, and form state initialization
- If a publisher can't be mapped, dropdown shows "Other" with a "Suggest Publisher" button
- Publisher suggestions go to admin for review (reuses key_info_submissions table)

**Test cases:**
- [ ] Import CSV with publisher "DC" → should map to "DC Comics" in edit mode dropdown
- [ ] Import CSV with publisher "Marvel" → should map to "Marvel Comics"
- [ ] Import CSV with publisher "Image" → should map to "Image Comics"
- [ ] Import CSV with publisher "BOOM" (any case) → should map to "Boom! Studios"
- [ ] Import CSV with unknown publisher (e.g., "Fake Press") → dropdown shows "Other", "Suggest Publisher" button appears
- [ ] Click "Suggest Publisher" → should show confirmation toast
- [ ] Scan a book → publisher in edit mode matches dropdown option
- [ ] Edit existing book with "DC Comics" → dropdown correctly selects "DC Comics"

---

## 5. CSV import should strip dollar signs from price fields

**Status:** ✅ Complete — needs testing

**Issue:** When importing via CSV with dollar signs in price fields (e.g., `$8.00` instead of `8.00`), the purchase price doesn't show up in the edit details view. `parseFloat("$8.00")` returns `NaN`. Need to strip `$`, commas, and other currency formatting before parsing. Applies to `purchasePrice` and `askingPrice`.

**Fix applied:** Created `parseCurrencyValue()` helper in `src/lib/csvHelpers.ts` that strips `$` and `,` before parsing. Applied to both `purchasePrice` and `askingPrice` fields in CSV import.

**Test cases:**
- [ ] Import CSV with `purchasePrice: $8.00` → should show $8.00 in edit details
- [ ] Import CSV with `purchasePrice: $1,000.00` → should show $1,000 in edit details
- [ ] Import CSV with `askingPrice: $25` → should show $25 in edit details
- [ ] Import CSV with `purchasePrice: 8.00` (no dollar sign) → still works
- [ ] Import CSV with `purchasePrice: abc` → field should be empty (not crash)

---

## 6. Notify key info submitter on admin approval/rejection

**Status:** ✅ Complete — needs testing

**Issue:** When an admin approves or rejects a user's key info submission, the submitter receives no notification.

**Fix applied:**
- Added `key_info_approved` and `key_info_rejected` notification types
- `approveSubmission()` in `keyComicsDb.ts` now calls `createNotification()` for the submitter
- `rejectSubmission()` fetches the submitter's user_id and sends a rejection notification

**Test cases:**
- [ ] Submit key info for a comic as a regular user
- [ ] Admin approves the submission → submitter sees "Key info approved!" notification in NotificationBell
- [ ] Submit another key info as a regular user
- [ ] Admin rejects the submission → submitter sees "Key info not accepted" notification
- [ ] Notifications link to the correct context (notification bell shows them)

---

## 7. Approving key info doesn't update submitter's reputation/feedback

**Status:** ✅ Complete — needs testing

**Issue:** When an admin approves a user's key info submission, the submitter's reputation score and contributor badge are not updated.

**Fix applied:** `approveSubmission()` now calls `recordContribution()` from `reputationDb.ts` after approval, which increments `community_contribution_count` and creates a contribution record.

**Test cases:**
- [ ] Check user's `community_contribution_count` before approval (should be 0 or current count)
- [ ] Admin approves a key info submission from that user
- [ ] Check user's `community_contribution_count` → should increment by 1
- [ ] If user has 1+ contributions, contributor badge should appear on their profile
- [ ] Approving same submission twice should NOT double-count (duplicate prevention)

---

## 8. Public share page missing covers use old Riddler style, not pop-art

**Status:** ✅ Complete (same fix as #3)

---

## 9. Public view book details should show user profile info

**Status:** ✅ Tested (Feb 6)

**Issue:** The public collection page header says "A Collector's Collection" instead of using the owner's actual profile name.

**Fix applied:** Updated the displayName fallback chain in both `page.tsx` and `PublicCollectionView.tsx` to: `publicDisplayName || displayName || username || slug || "A Collector"`. The username from the profile is now used before falling back to the generic text.

**Test cases:**
- [ ] Visit `collectors-chest.com/u/patton-test1` → header should show "patton-test1's Collection" (or their display name if set)
- [ ] User with a display name set → shows display name instead of username
- [ ] Page title in browser tab should also show the correct name
- [ ] Open Graph metadata should use the correct name (check with a link preview tool)

---

## 10. Admin user search: magnifying glass overlaps placeholder text

**Status:** ✅ Tested (Feb 6)

**Issue:** The magnifying glass icon visually overlaps the "Search by email..." placeholder text.

**Fix applied:** Used inline `paddingLeft: 2.75rem` to override `input-pop` shorthand padding. Tailwind `pl-*` was being overridden by the CSS class's shorthand `padding` property.

**Test cases:**
- [ ] Go to Admin → Users → search input placeholder text should not overlap with the magnifying glass icon
- [ ] Type in the search field → text should start after the icon with proper spacing

---

## 11. Admin user search: no message when no results found

**Status:** ✅ Complete — needs testing

**Issue:** No feedback when search returns no results — shows same prompt as initial state.

**Fix applied:** Added `hasSearched` state tracking. After a search completes with no results, shows "No users found matching '[query]'" instead of the default prompt.

**Test cases:**
- [ ] Go to Admin → Users → initial state shows "Search for users by email"
- [ ] Search for a non-existent email (e.g., "zzzzz@fake.com") → should show "No users found matching 'zzzzz@fake.com'"
- [ ] Search for a real user email → should show results normally
- [ ] Clear search and search again for non-existent → message updates with new query

---

## 12. Premium user lost Key Hunt access after trial reset + reactivation

**Status:** 📌 Pinned

**Issue:** User `jsnaponte@yahoo.com` was on a Premium trial, admin reset their trial, then user reactivated Premium. After reactivation, Key Hunt is no longer accessible despite having Premium status.

**Root cause identified:** Trial reset clears `trial_ends_at` to null, and the `isTrialing` check requires `trial_ends_at > now`. If reactivation doesn't fully restore the subscription state, feature gates fail.

**Next steps:** Need to inspect actual DB state for the affected user in Supabase to confirm which fields are inconsistent.

---

## 13. Admin portal needs better navigation to all admin tools

**Status:** ✅ Tested (Feb 6)

**Issue:** Admin tools are scattered across 5 pages with no shared navigation.

**Fix applied:** Created `src/app/admin/layout.tsx` with a shared navigation bar across all admin pages. Yellow pop-art styled bar with links to Users, Usage, Key Info, Barcodes, and Moderation. Active page is highlighted. Includes "Back to App" link. Removed old manual links from the bottom of the users page.

**Test cases:**
- [ ] Go to Admin → Users → nav bar visible at top with all 5 sections
- [ ] Click "Usage" → navigates to Usage page, "Usage" is highlighted
- [ ] Click "Key Info" → navigates to Key Info page, "Key Info" is highlighted
- [ ] Click "Barcodes" → navigates to Barcode Reviews page
- [ ] Click "Moderation" → navigates to Moderation page
- [ ] Click "Back to App" → returns to collection page
- [ ] Nav bar scrolls horizontally on small screens
- [ ] Previous admin links at bottom of Users page are removed (no duplicates)

---

## 14. Key Hunt list not showing up for guest/free user

**Status:** ✅ Complete — needs testing

**Issue:** Key Hunt is intentionally gated to Premium/Trial users. However, the "Add to Hunt List" button appeared for all users without indicating it requires premium.

**Fix applied:** Modified `AddToKeyHuntButton` to check `features.keyHunt` from the subscription hook. When a signed-in user doesn't have premium access:
- Button shows in a muted/locked state with a "Premium" badge (lock icon + indigo badge)
- Clicking triggers the upgrade flow (start free trial → Stripe checkout)
- Matches the `FeatureButton` / `PremiumBadge` pattern used by CSV Export
- Also fixed bonus bug: guest user features object was missing `unlimitedScans` key in `/api/billing/status`

**Test cases:**
- [ ] As a free user (no trial), view a book with "Add to Key Hunt" button → button shows with "Premium" lock badge
- [ ] Click the locked button → should trigger free trial or redirect to Stripe
- [ ] As a premium/trial user → button works normally (no lock badge)
- [ ] As a guest (not signed in) → button shows "Sign in to add to Key Hunt" (unchanged)
- [ ] Icon variant (compact) → shows target icon with small lock overlay
- [ ] After upgrading to premium → button becomes fully functional

---

## 15. "Start 7-day Trial" button on Key Hunt page not working

**Status:** ✅ Closed

**Issue:** The "Start 7-day Trial" button on the Key Hunt page does not respond when clicked.

**Resolution:** Believed to be working. Code logic is correct. Will revisit if the issue recurs.

---

## 16. Key Hunt page not in pop-art style and not scrollable

**Status:** ✅ Tested (Feb 6)

**Issue:** The Key Hunt page does not follow the Lichtenstein pop-art design language. Content below the fold isn't scrollable on mobile.

**Fix applied:**
- Desktop: Replaced gradient background with `--pop-cream`, added pop-art borders/shadows to icon and badge, applied `comic-panel` class to feature cards, added `font-bangers` to title
- Mobile: Added `overflow-y-auto` to fix scrolling, replaced gradient header with flat `--pop-yellow` + black border, updated text colors for readability on yellow

**Test cases:**
- [ ] Desktop: Key Hunt page has cream background, pop-art styled header icon with black border + shadow
- [ ] Desktop: "Mobile Exclusive Feature" badge is yellow with black border
- [ ] Desktop: Feature grid cards use pop-art panel styling (black border, shadow)
- [ ] Desktop: Title uses Bangers comic font
- [ ] Mobile: Page scrolls all the way to bottom (How to Use section visible)
- [ ] Mobile: Header is yellow with black border (not gradient)
- [ ] Mobile: Text is black on yellow background (readable)

---

## 17. Messages need real-time updates without page refresh

**Status:** 📌 Pinned — future session

**Issue:** New messages do not appear in real-time. Users must refresh the page to see incoming messages.

**Root cause:** ConversationList has no real-time subscriptions or polling. MessagesPage only reloads conversations when the user sends a message. Missing `/api/messages/{id}/read` endpoint causes mark-as-read to fail silently.

**Next steps:** Tackle as part of a "Messaging v2" session alongside #20.

---

## 18. Changing raw↔slabbed should re-evaluate book value

**Status:** ✅ Complete — no change needed

**Issue:** When toggling between raw and slabbed, the displayed value should update.

**Resolution:** The existing code already handles this correctly. The `isGraded` state variable is referenced directly in the render IIFE, and `calculateValueAtGrade()` uses the `isSlabbed` parameter to return raw vs slabbed values. React re-renders the value when the toggle changes. The label also updates to show "(slabbed X.X)" or "(raw X.X)".

**Test cases:**
- [ ] Open a book with grade estimates in edit mode
- [ ] Set a grade (e.g., 9.4) → estimated value shows
- [ ] Toggle "Professionally Graded (Slabbed)" ON → value should change (slabbed is typically higher)
- [ ] Label should say "(slabbed 9.4)"
- [ ] Toggle back OFF → value returns to raw price, label says "(raw 9.4)"

---

## 19. Sort by value not sorting correctly

**Status:** ✅ Tested (Feb 6)

**Issue:** Collection sort-by-value was using `averagePrice || purchasePrice || 0` instead of the grade-aware `getComicValue()` function that the UI displays.

**Fix applied:** Changed sort comparator to use `getComicValue()` which considers grade estimates, slabbed status, and falls back to estimated value.

**Test cases:**
- [ ] Go to Collection → sort by "Value"
- [ ] Books should sort highest value first
- [ ] Books with no value should sort to the bottom
- [ ] Sort order should match the values displayed on each card
- [ ] Toggle sort direction if available → should reverse order

---

## 20. Message notification icon behavior is sporadic/broken

**Status:** 📌 Pinned — future session

**Issue:** Multiple problems with the message notification icon: appears on navigate-away only, doesn't clear on open, recipient never sees it.

**Root cause:** Messages and notifications are completely separate systems. `NotificationType` has no message type. `messagingDb.ts` sends email notifications but never creates database notification records. NotificationBell and message unread count use different APIs with different polling intervals.

**Next steps:** Tackle as part of a "Messaging v2" session alongside #17.

---

## 21. No visible way to follow another user

**Status:** ✅ Tested (Feb 6)

**Issue:** The FollowButton component exists but was only rendered inside SellerBadge (shop listings), not discoverable from public collection pages.

**Fix applied:** Added `FollowButton` to the profile header in `PublicCollectionView.tsx`. Shows when the viewer is logged in and not viewing their own profile.

**Test cases:**
- [ ] Visit another user's public collection page (e.g., `/u/patton-test1`) while logged in → Follow button visible in profile header
- [ ] Click Follow → button changes to "Following" state
- [ ] Click again → unfollows
- [ ] Visit your own public page → Follow button should NOT appear
- [ ] Visit as a guest (not logged in) → Follow button should NOT appear
