# Feedback - March 18, 2026

**Tester:** Chris Patton (cpatton716@gmail.com - new test account)
**Platform:** Android mobile (production)
**Account Types:** Free, Premium

---

## Bugs - High Priority

| # | Issue | Type | Status |
|---|-------|------|--------|
| 1 | **Key Hunt empty state links to "Browse Hot Books"** — Hottest Books was hidden last session but Key Hunt still shows "Browse Hot Books" button | UI Bug | ✅ Done |
| 2 | **Avengers #54 wrong cover image** — Correctly identified the book but displayed a different volume's cover art instead of the user's scanned image | Scan/Data Bug | ⏳ Needs retest |
| 3 | **Scan limit error shows raw code** — After hitting free 10-scan limit, error displays `scan_limit_reached` instead of a user-friendly message | UX Bug | ⏳ Needs retest |
| 4 | **Show Financial Fields toggle snaps back** — Toggle responds to tap but immediately reverts to enabled | State Bug | ❌ Still broken — toggle shows no change |
| 5 | **Chamber of Chills #13 fallback default** — AI scan always returns Chamber of Chills #13 regardless of book scanned, as if it's a hardcoded fallback | Scan Bug | ⏳ Needs retest |
| 6 | **"Verified" key info is incorrect** — Dark Days: The Forge #1 shows "First appearance of Batman Who Laughs" as Verified, but this is wrong. Multiple other books also show incorrect Verified key info | Data Integrity | ⏳ Needs retest |
| 7 | **Self-follow allowed** — User can follow themselves on their own public profile | Logic Bug | ✅ Done |
| 8 | **Estimated values showing without real eBay data** — AI estimates displayed even when no actual eBay sales data returns | Data Bug | ⏳ Needs retest |

## Bugs - Medium Priority

| # | Issue | Type | Status |
|---|-------|------|--------|
| 9 | **"Collectors Chest" logo turns red** — After tapping logo to go to dashboard, font color turns red until navigating via bottom nav | CSS Bug | ✅ Done |
| 10 | **Notifications menu doesn't fit screen** — Dropdown overflows mobile viewport | UI Bug | ❌ Still broken — no change on mobile |
| 11 | **Key Hunt scan doesn't autofocus to camera** — Page loads scrolled to bottom instead of top with camera area | UX Bug | ✅ Done |
| 12 | **Key Hunt scan results need cleanup on Android** — issue is dark background color scheme vs regular upload screens, not layout | Design Consistency | ❌ Misunderstood — Key Hunt results should match other upload screen color scheme, not dark background |
| 13 | **"Scan Another" doesn't scroll to top** — After scanning and tapping "Scan Another", page doesn't reposition to top | UX Bug | ✅ Done |
| 14 | **Public page pricing doesn't match design standards** — Pricing display on public collection differs from My Collection styling | Design Consistency | ✅ Done |
| 15 | **Action buttons cut off on left (free user)** — Bottom action buttons after scanning, far-left button clipped on mobile | UI Bug | ⏳ Needs retest |
| 16 | **Browser URL bar showing on public collection** — Mobile app shows website URL bar when viewing public collection | UI/PWA Bug | Deferred — native app |
| 17 | **Scan limit count off** — Supposed to be 10 free scans/month but user got ~13 before hitting limit | Logic Bug | ⏳ Needs retest |

## Enhancements

| # | Issue | Type | Status |
|---|-------|------|--------|
| 18 | **Select button needs label** — Checkbox-only not intuitive; add "Select" text copy | UX Enhancement | ✅ Done |
| 19 | **Variant info not pulling in** — Variant details not populated on scanned books | Feature Gap | ⏳ Needs retest |
| 20 | **No way to add signatures to raw books** — Missing signature field for non-slabbed books | Feature Gap | ✅ Done |
| 21 | **eBay price lookup missing newer books** — Some newer basic books not returning results despite being findable on eBay | Data/API Issue | Deferred — scanning conversation |

## Investigation Items

| # | Question | Status |
|---|----------|--------|
| A | **eBay API: sold vs active listings?** — Confirm "Check eBay Listings" in Key Hunt directs to SOLD listings only (purpose: help collectors see recent sales at conventions) | ✅ Done |
| B | **Where does "Verified" badge come from?** — Track down source of Verified badge on key info; it's showing on incorrect data | ✅ Done |
| C | **Chamber of Chills #13 as fallback** — Why does the AI default to this specific book? Is it hardcoded? | ✅ Done |
| D | **Scan limit enforcement** — Why did 13 scans go through when limit is 10? Race condition? Key Hunt vs Collection scan counted differently? | ✅ Done |
