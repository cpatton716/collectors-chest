# Feedback - January 28, 2026

## Status Summary

| # | Issue | Status |
|---|-------|--------|
| 1 | Homepage redirect for logged-in users | ✅ Complete |
| 2 | CSV functionality on mobile | ⚠️ Needs Testing |
| 3 | Mark as Sold button prominence | ✅ Complete |
| 4 | Custom key info admin approval | ✅ Complete |
| 5 | Reward users for contributions | ✅ Complete |
| 6 | Ended auctions on live page | ✅ Complete |
| 7 | Financial data caching | ⚠️ Needs Verification |
| 8 | Stats page "No Statistics Available" | ⚠️ Needs Testing |
| 9 | Mobile barcode scanning | ⚠️ Needs Testing |
| 10 | Public share link not working | ⚠️ Needs Testing |
| 11 | Key Hunt in navigation | ✅ Complete |
| 12 | Navigation bloat | ✅ Complete |
| 13 | Key icon consistency | ✅ Complete |
| 14 | Key Hunt raw vs slabbed pricing | ✅ Complete |
| 15 | Key Hunt volumes in predictive text | ✅ Complete |
| 16 | CSV import enrichment data | ✅ Complete |
| 17 | CSV forSale creates shop listing | ✅ Complete |
| 18 | Multi-select bulk actions | ❌ Not Implemented |
| 19 | Key Hunt "Add to Hunt List" button | ✅ Complete |
| 20 | Trades feature | ✅ Complete |
| 21 | Admin search input styling | ✅ Complete |
| 22 | Payment error after trial reset | ⚠️ Needs Testing |
| 23 | Follow/friend system | ✅ Complete |

---

## 1. Logged-in user homepage should be their collection

**Status:** ✅ Complete (Jan 30, 2026)

**Implementation:** `src/app/page.tsx` lines 137-140 - useEffect redirects signed-in users to `/collection`.

**Issue:** When a logged-in user visits the homepage, they see the marketing/landing page instead of their collection.

**Desired behavior:** For both mobile and web, logged-in users should be redirected directly to their collection. There is no need to show them the marketing homepage.

**Affected routes:**
- `/` (homepage) → should redirect to `/collection` for authenticated users

---

## 2. Add CSV functionality missing on mobile

**Status:** ⚠️ Needs Testing

**Issue:** The "Add CSV" functionality doesn't appear to exist on mobile.

**Action needed:** Verify whether CSV import is available on mobile, and if not, determine if it should be added or if this is intentional.

---

## 3. "Mark as Sold" button too prominent for unlisted items

**Status:** ✅ Complete (Jan 30, 2026)

**Implementation:** `src/components/ComicDetailModal.tsx` lines 967-975 - Now a small text link: "Sold elsewhere? Record sale" with `text-xs text-gray-500` styling.

**Issue:** When viewing the details of a book that is NOT listed in the shop, the "Mark as Sold" button is too large/prominent.

**Desired behavior:** Make the "Mark as Sold" button much smaller for unlisted items. The goal is to encourage users to sell through our shop rather than marking items as sold externally.

**UX rationale:** We want to drive sales through the platform, so the shop listing flow should be the primary CTA, not external sale tracking.

---

## 4. Custom key info requires admin approval before public visibility

**Status:** ✅ Complete (Jan 30, 2026)

**Implementation:**
- Admin moderation page: `src/app/admin/key-info/page.tsx`
- API routes: `src/app/api/admin/custom-key-info/route.ts` and `[id]/route.ts`
- Status field: `customKeyInfoStatus` (pending/approved/rejected)
- Contribution tracking integrated with reputation system

**Issue:** When a user adds custom key info to a comic, it currently shows to the general public without any review.

**Desired behavior:**
- Custom key info added by users should be validated by an admin before appearing publicly
- The key info should still appear on the user's own view of the book in their collection immediately
- Public visibility (other users, shop listings, etc.) should only occur after admin approval

**Implementation notes:**
- Needs an approval status field (pending/approved/rejected)
- Admin dashboard needs a queue to review submitted key info
- Users should see their own pending submissions but others should not

**Additional issues discovered (Jan 28):**
1. **Admin links hard to find** - The "Service Usage Monitor" and "Key Info Moderation" links in the admin portal are small/buried at the bottom. Need to make these more prominent and easier to access.
2. **Flow not working properly** - The key info moderation flow appears broken:
   - A key info entry was approved via admin
   - Cannot find where the approved key info went
   - Need walkthrough of how the full flow is supposed to work
3. **Visibility of approved key info** - Where does approved custom key info appear? On the comic globally? Need to verify the end-to-end flow.

---

## 5. Reward users for approved key info contributions

**Status:** ✅ Complete (Jan 30, 2026)

**Implementation:** Full reputation system implemented:
- Database: `transaction_feedback`, `community_contributions`, `feedback_reminders` tables
- Types: `src/types/reputation.ts`
- Components: `ReputationBadge`, `ContributorBadge`, `FeedbackModal`, `FeedbackList`
- API: `/api/feedback/*`, `/api/reputation/*`
- Auto-tracking: Admin approval of key info increments `community_contribution_count`
- Contributor badges: None → Contributor (1-4) → Verified Contributor (5-9) → Top Contributor (10+)

**Issue:** Users who contribute quality key info should be rewarded.

**Desired behavior:** When a user's custom key info gets approved by an admin, they receive credit towards a "legitimacy score" or similar reputation system.

---

## 6. Ended auctions still appearing on live Auctions page

**Status:** ✅ Complete

**Implementation:** `src/lib/auctionDb.ts` - `getActiveAuctions` filters by `status = "active"` (line 235).

**Issue:** The Infinity Gauntlet #1 is showing on the Shop's Auctions tab even though it displays "Ended" status. Ended auctions should not appear in the live auctions view.

**Desired behavior:** Auctions that have ended should be automatically filtered out of the Auctions tab. They should either:
- Move to a separate "Ended" or "Past Auctions" section, or
- Be removed from the shop entirely once ended

**Screenshot reference:** Shows Infinity Gauntlet with "Ended" badge still visible alongside active auction (Amazing Spider-Man with "3d 23h" remaining).

---

## 7. Confirm caching behavior for financial data

**Status:** ⚠️ Needs Verification

**Question:** How often does the financial data (earnings, ROI, total value, etc.) update on the collection page?

**Options:**
- Does it reload fresh every time the collection page loads?
- Is it cached for a period of time?

**Requirement:** If cached, one day (24 hours) is an acceptable cache duration, but it should NOT be cached longer than that. Users should see reasonably fresh financial data reflecting market changes.

---

## 8. Stats page shows "No Statistics Available" despite having comics with values

**Status:** ⚠️ Needs Testing

**Note:** `CollectionStats.tsx` line 57 checks `collection.length === 0` - if collection prop is empty, shows empty state. May be a data loading issue rather than logic bug.

**Issue:** The Stats page displays "No Statistics Available" and prompts to "Add Your First Comic" even when the user has:
- 16 comics in their collection
- $450 total cost
- $2,792 total value
- Clear profit/loss data (+$2,342)

**Context:** Some comics in the collection don't have reference images (showing ? placeholder), but they DO have values and/or purchase prices associated with them.

**Expected behavior:** Stats page should load and display statistics based on the available financial data, regardless of whether comics have cover images.

**Screenshot reference:**
- Collection shows 16 comics with full financial summary
- Stats page incorrectly shows empty state

**Investigation needed:** Determine why stats aren't calculating - possibly the query requires cover images when it shouldn't.

---

## 9. Mobile barcode scanning not working (regression?)

**Status:** ⚠️ Needs Testing

**Issue:** Scanning a barcode from a mobile device does not work.

**Context:** This was previously investigated and believed to be resolved, but the issue has resurfaced or was never fully fixed.

**Action needed:**
- Investigate what's causing the barcode scan to fail on mobile
- Review previous fix to understand what was changed
- Ensure it works consistently across iOS and Android devices
- Test thoroughly before marking as resolved this time

---

## 10. Public share link returns "Collection Not Found"

**Status:** ⚠️ Needs Testing

**Note:** Code looks correct - `getPublicProfile` checks `is_public = true` and queries by `public_slug`. May be a data issue (slug not saved correctly) rather than code bug.

**Issue:** The public share link feature does not work. When a user enables "Public Collection" and shares their link, visitors see "Collection Not Found" error instead of the collection.

**Testing performed:**
- Multiple users tested
- Multiple browsers tested
- Incognito mode tested
- All attempts return the same error

**Screenshot reference:**
- Share modal shows "Public Collection" toggle ON with link: `https://collectors-chest.com/u/jsnaponte`
- Visiting that URL shows "Collection Not Found - This collection doesn't exist or isn't public"

**Investigation needed:**
- Verify the `is_public` flag is being saved correctly to the database
- Check if the `/u/[username]` route is querying the correct field
- Confirm the username in the URL matches what's stored in the database

---

## 11. Key Hunt missing/inaccessible in navigation

**Status:** ✅ Complete (Jan 30, 2026)

**Implementation:** Navigation reorganized - Key Hunt now in "More" dropdown (`registeredSecondaryLinks` in Navigation.tsx line 164).

**Issue:** The Key Hunt feature is not easily accessible on both desktop and mobile.

**Findings:**
- **Desktop:** Key Hunt is NOT in the top navigation bar. Only accessible via the FloatingUtilitiesTray (floating button) or direct URL (`/key-hunt`)
- **Mobile:** Key Hunt exists in the code for the bottom nav, but the nav has become so bloated that Key Hunt is no longer visible/accessible

**Requirement:** Key Hunt must always be easily accessible on both desktop and mobile views.

**Action needed:**
- Add Key Hunt to the desktop top navigation
- Revisit the mobile bottom navbar - it's bloated and Key Hunt is getting hidden
- Key Hunt is a core premium feature and should not be buried or deprioritized
- Consider this alongside item #12 (nav bar revision) - both navs need streamlining

---

## 12. Top navigation bar has become bloated - needs revision

**Status:** ✅ Complete (Jan 30, 2026)

**Implementation:** Navigation.tsx reorganized:
- Primary nav: Collection, Shop, Stats (3 items)
- "More" dropdown: Messages, Sales, Trades, Lists, My Listings, Hottest Books, Key Hunt

**Issue:** The top navigation bar has grown too large with all the new features added over time. It needs to be streamlined for better UX.

**Action needed:**
- Audit all current nav items and prioritize by usage/importance
- Consider grouping related items under dropdowns
- Determine which items can move to a profile/settings menu
- Ensure mobile nav remains clean and accessible
- Balance between discoverability and clutter

**Consider keeping in primary nav:**
- Core actions (Scan, Collection, Shop)
- Key Hunt (per item #11)

**Consider moving to secondary/dropdown:**
- Stats, Sales, Messages, Trades, My Listings (could group under profile or "More")

---

## 13. Inconsistent key icons across Key Hunt feature

**Status:** ✅ Complete

**Implementation:** All Key Hunt-related icons now use `KeyRound` from lucide-react consistently.

**Issue:** Different key icons are being used in various places for the Key Hunt feature. This creates visual inconsistency.

**Requirement:** All Key Hunt-related icons should use the same key icon throughout the app for visual consistency and brand coherence.

**Action needed:**
- Audit all places where a key icon is used for Key Hunt
- Standardize on a single key icon (likely `KeyRound` from lucide-react based on current usage)
- Update any inconsistent icons to match

---

## 14. Key Hunt should allow users to select raw vs. slabbed pricing

**Status:** ✅ Complete (Jan 30, 2026)

**Implementation:** `KeyHuntPriceResult.tsx` has Raw/Slabbed toggle UI (lines 215-241) with clear labeling.

**Issue:** When using Key Hunt (especially manual entry), users cannot specify whether they're looking up a raw book or a slabbed/graded book. The price shown is currently the raw price, but this isn't communicated to the user.

**Current behavior:**
- Backend requests both `rawValue` and `slabbedValue` from AI
- UI only displays one price labeled "Average Price"
- No indication whether price is for raw or slabbed
- Manual entry has no option to specify raw vs. graded

**Desired behavior:**
- Allow users to select whether they want raw or slabbed pricing
- Clearly label which price type is being displayed
- Consider showing both prices side-by-side for comparison
- Slabbed prices are typically 10-30% higher than raw

**Why this matters:**
- Users at conventions need accurate pricing for negotiation
- A raw 9.4 and a CGC 9.4 slab have very different values
- Current ambiguity could lead to overpaying or underselling

---

## 15. Key Hunt manual entry predictive text not showing volumes

**Status:** ✅ Complete

**Implementation:** `TitleAutocomplete.tsx` includes `years` field in suggestions and `KeyHuntManualEntry.tsx` displays selected volume.

**Issue:** The predictive text/autocomplete in Key Hunt's manual entry feature doesn't appear to be pulling up volumes like it does in the "My Collection" add flow. It also may have regressed from previous functionality.

**Action needed:**
- Evaluate how predictive text works in Key Hunt manual entry vs. Collection add
- Ensure Key Hunt autocomplete shows volume options (e.g., "Amazing Spider-Man (1963)", "Amazing Spider-Man (2018)")
- Compare behavior to ensure consistency between features
- Investigate if this is a regression from previous working state

**Why this matters:**
- Volume distinction is critical for accurate pricing (ASM #1 from 1963 vs 2018 are vastly different values)
- Users need to quickly select the correct series at conventions
- Inconsistent behavior between features creates confusion

---

## 16. CSV import not using enrichment data from API lookup

**Status:** ✅ Complete (Jan 30, 2026)

**Implementation:** `CSVImport.tsx` now uses all enrichment data (lines 250-303): `writer`, `coverArtist`, `interiorArtist`, `coverImageUrl`.

**Issue:** The import-lookup API correctly fetches enrichment data (creators, publisher, year, prices), but the CSVImport component only uses `priceData` and `keyInfo`. The rest of the enrichment data is ignored. Additionally, cover images are not looked up at all.

**What the API returns but import ignores:**
- `writer` - looked up but not applied
- `coverArtist` - looked up but not applied
- `interiorArtist` - looked up but not applied
- `publisher` - looked up but not applied (if missing from CSV)
- `releaseYear` - looked up but not applied (if missing from CSV)

**What's completely missing:**
- Cover images - not looked up at all (hardcoded to empty string)

**Code locations:**
- `src/components/CSVImport.tsx` lines 251-255: Only extracts priceData and keyInfo
- `src/components/CSVImport.tsx` line 290: `coverImageUrl: ""` hardcoded
- `src/app/api/import-lookup/route.ts`: Returns enrichment data that goes unused

**Action needed:**
1. Update CSVImport to use all enrichment data from the API response
2. Add cover image lookup to the import-lookup API (Comic Vine or similar)
3. Apply cover images when books are added to collection
4. Fall back to CSV-provided data only if API lookup fails or returns null

---

## 17. CSV import "for sale" flag doesn't create actual shop listings

**Status:** ✅ Complete (Jan 30, 2026)

**Fix:** The listing creation code already existed in `scan/page.tsx` but wasn't working due to a bug in `db.ts`:
- `addComic()` wasn't preserving the client-generated `item.id`, so Supabase generated a new ID
- When the listing API tried to find the comic by `item.id`, it failed
- Fixed by adding `id: item.id` to the insert in `addComic()`
- Also improved error handling to log failures and inform users

**Issue:** When importing comics via CSV with `forSale: true` and an `askingPrice`, the collection view correctly shows the "For Sale" badge, but:
- The book detail/listing does not show it's for sale
- The book does NOT appear in the shop
- No actual listing is created

**Current behavior:**
- CSV sets `forSale: true` → badge appears in collection grid ✅
- No shop listing created ❌
- Book doesn't appear in shop browse ❌

**Expected behavior:**
If a user marks a book as for sale in their CSV import (with asking price), the system should:
1. Create an actual shop listing (Buy Now or Auction based on CSV field)
2. Book should appear in the shop for other users to browse/purchase
3. All listing details should be populated from CSV data

**Action needed:**
- When `forSale: true` in CSV, trigger the same listing creation flow as manual "List for Sale"
- Consider adding `listingType` field to CSV (auction vs buy-now)
- Consider adding auction-specific fields (startingBid, duration, etc.) if supporting auction imports
- Ensure asking price from CSV becomes the listing price

---

## 18. Add multi-select tool for bulk collection actions

**Status:** ❌ Not Implemented

**Issue:** Users with more than one book in their collection have no way to perform bulk operations. Every action (delete, mark as sold, list for sale, etc.) must be done one book at a time.

**Desired behavior:**
- Add a multi-select mode to the collection view
- Allow users to select multiple books at once (checkboxes, shift-click range select, "select all")
- Provide bulk action toolbar when items are selected

**Bulk actions to support:**
- Mass delete
- Mass mark as sold
- Mass list for sale (with shared price or individual prices)
- Mass add to list/remove from list
- Mass mark for trade
- Mass export (selected items only)

**UX considerations:**
- Clear visual indication of selected items
- "X items selected" counter
- Easy way to enter/exit multi-select mode
- Confirmation dialog for destructive actions (delete, sold)
- Works on both mobile and desktop

---

## 19. Key Hunt results missing "Add to Key Hunt List" option

**Status:** ✅ Complete

**Implementation:** `KeyHuntPriceResult.tsx` has "Add to Hunt List" button (lines 362-405).

**Issue:** After performing a Key Hunt lookup (manual entry or scan), the results screen only shows:
- "Add to Collection" button
- "Refresh" button
- "New Grade" button

There is no option to add the book to the Key Hunt tracking list.

**Screenshot reference:** Amazing Spider-Man #20 lookup shows price ($2,800) but only offers "Add to Collection" - no way to save to Key Hunt list for tracking.

**Desired behavior:**
- Add an "Add to Key Hunt List" button on the results screen
- Allow users to save books they're hunting for without adding to collection
- This is the core purpose of Key Hunt - tracking books you WANT to find, not books you already own

**Note:** Also observed wrong cover image being returned - will address separately.

---

## 20. Trades feature not working - listings not appearing, no matching

**Status:** ✅ Complete (Jan 28, 2026)

**Implementation:** Full trading system implemented:
- Database tables: `trades`, `trade_items`, `trade_matches`
- Pages: `/trades` with Active, History, and Matches tabs
- Components: `TradeCard`, `TradeMatchCard`, `TradeProposalModal`, `TradeableComicCard`
- Shop integration: "For Trade" tab in Shop
- Matching: Automatic match finding against Key Hunt lists
- Notifications: Match notifications when trades align

**Issue:** The trades functionality appears to be broken. Tested with two users:

**Test scenario:**
- User A has a book in their collection that User B has on their Key Hunt list
- User A marked a book "For Trade" that User B has listed as a want in their Key Hunt list

**Results:**
- ❌ Neither book appears in the "For Trade" section of the shop
- ❌ No match notification was triggered between users
- ❌ Trade matching system not functioning

**Expected behavior:**
1. Books marked "For Trade" should appear in the Shop's "For Trade" tab
2. When User A lists a book for trade that matches User B's Key Hunt want list, both users should be notified of the potential match
3. Users should be able to browse and discover trade opportunities

**Action needed:**
- Investigate why "For Trade" items aren't appearing in shop
- Verify the trade matching logic against Key Hunt lists
- Check if notifications are being triggered for matches
- End-to-end test the full trade flow

---

## 21. Admin view: Search input placeholder overlaps magnifying glass icon

**Status:** ✅ Complete

**Implementation:** `src/app/admin/users/page.tsx` line 375 - Input has `pl-12` padding class.

**Issue:** In the Admin User Management view, the search input field has a styling issue where the "Search by email..." placeholder text overlaps with the magnifying glass icon on the left side of the input.

**Screenshot reference:** The "S" in "Search by email..." is partially hidden behind/overlapping with the magnifying glass icon.

**Fix needed:** Add left padding to the input field to account for the icon, so the placeholder text starts after the magnifying glass.

---

## 22. "Payment system not configured" error after admin resets user's free trial

**Status:** ⚠️ Needs Testing

**Issue:** When an admin resets a user's free trial, and that user then attempts to start a new trial, they receive a 503 error.

**Error details:**
```
POST https://collectors-chest.com/api/billing/checkout
503 (Service Unavailable)

Checkout error: Error: Payment system not configured
```

**Expected behavior:** After an admin resets a user's free trial, the user should be able to successfully start a new trial without errors.

**Investigation needed:**
- Check `/api/billing/checkout` route for trial reset handling
- Verify Stripe configuration is being loaded correctly for reset trial scenarios
- May be a missing environment variable or conditional logic issue
- Test the full flow: admin reset → user starts new trial

---

## 23. Allow users to "friend" or follow trusted sellers/buyers

**Status:** ✅ Complete (Jan 30, 2026)

**Implementation:** Full one-way follow system (similar to eBay/Etsy):

**Database:**
- `user_follows` table with follower_id, following_id, unique constraint
- Denormalized `follower_count` and `following_count` on profiles
- Triggers to auto-update counts on follow/unfollow
- RLS policies for secure access

**API Endpoints:**
- `POST/DELETE /api/follows/[userId]` - Follow/unfollow
- `GET /api/follows/[userId]` - Check follow status with counts
- `GET /api/follows/[userId]/followers` - Paginated followers list
- `GET /api/follows/[userId]/following` - Paginated following list

**UI Components:**
- `FollowButton` - Optimistic updates, "Follow" / "Following" / "Unfollow" states
- `FollowerCount` - Clickable count display
- `FollowListModal` - Paginated list with avatars and follow buttons
- `useFollow` hook for managing follow state

**Integration:**
- FollowButton added to SellerBadge component
- FollowerCount added to CustomProfilePage
- Shop page "From people I follow" filter toggle
- Auctions API supports `followingOnly=true` param

**Notifications:**
- In-app notifications when followed sellers list new items
- Email notifications (respects user preferences)
- Type: `new_listing_from_followed`

**Design document:** `docs/plans/2026-01-30-follow-system-design.md`
