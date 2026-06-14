# Development Log

This log tracks session-by-session progress on Collectors Chest.

---

## May 27, 2026 (Wednesday) — Session 47: Cover Persistence PROD-Validated + 5 Collection-UI Fixes (Deployed May 27, 2026)

### Summary
Opened by validating the Session 46 cover-persistence fix in production — never user-confirmed before, because an Android camera "low memory" crash had blocked the test. Confirmed working on both iPhone (`patton@collectors-chest.com`, Premium) and Android (`cpatten716@gmail.com`, Premium): scanned covers now persist into the collection grid AND the detail view, and survive reload. The earlier Android camera crash did not recur. Then fixed 5 collection-UI issues surfaced during that same testing pass and deployed them for device verification.

### Cover Persistence — VALIDATED ✅
Session 46's Supabase Storage upload pipeline (commit `aaa3fac`) confirmed end-to-end in production for the first time, on both platforms.

### Collection UI Fixes
1. **Detail-modal cover squished (iOS + Android).** Mobile cover thumbnail used `w-20 h-30` — `h-30` is not a defined Tailwind class, so the box had no height and flex `stretch` collapsed it into a short, wide crop. Fixed to `w-20 aspect-[2/3] self-start` (proper 80×120 box). Desktop variant was already correct. File: `ComicDetailModal.tsx`.
2. **"Add Book" button too tall (iOS).** Text wrapped to two lines; added `whitespace-nowrap`. File: `collection/page.tsx`.
3. **Grid thumbnail cut off on first loads, self-corrected on reload (iOS).** Plain `<img>` with `w-full h-full` mis-sized before image load on iOS Safari. Changed to `absolute inset-0 w-full h-full object-cover` so the box sizes from the `aspect-[2/3]` container, not the image. Deliberately avoided switching to `next/image` to not route every grid thumbnail through Netlify's image CDN (cost). File: `ComicCard.tsx`.
4. **Multi-select header overlap.** `justify-between` with an unconstrained count caused "N SELECTED" to wrap and overlap Cancel. Reflowed: count gets its own centered row on mobile (`order-last w-full`), inline on sm+; all labels `whitespace-nowrap`. File: `SelectionHeader.tsx`.
5. **Multi-select action bar hidden behind floating nav.** Action toolbar was `z-40`, MobileNav `z-50`. Now the bottom nav hides while in select mode via a `cc:selection-mode` window event (dispatched from collection page, listened in MobileNav), and the action bar raised to `z-50`. Grid bottom padding bumped `pb-20 → pb-28`. Files: `MobileNav.tsx`, `collection/page.tsx`, `SelectionToolbar.tsx`.

### Quality Gates (pre-deploy)
`check:routes` ✓ · `build` ✓ · `smoke-test` ✓ (homepage 200) · `npm test` ✓ 850/850 · lint 0 errors on changed files. No new env vars (UI/CSS + client-side event only).

### Follow-up iOS Fixes (second testing round, May 27)
A second round of new single-cover scans (same two books on both devices) confirmed Android clean; iOS surfaced two more iOS-Safari-only issues, both fixed and re-deployed:

6. **Grid cover blank until selected (iOS).** A freshly-scanned cover (Batman #423) rendered as a blank cream card with only a red sliver at top, then painted fully once multi-select mode re-rendered the card. Classic iOS Safari "image loaded but not painted until a reflow" bug — the earlier `absolute inset-0` fix corrected layout but provided no repaint trigger on load. Fix: `ComicCard.tsx` now fades the `<img>` in on `onLoad` (opacity 0→100, same mechanism `ComicImage` uses), with a `ref.complete`/`naturalWidth` check so cached images don't stay hidden. Kept the plain `<img>` (not `next/image`) deliberately — `next.config` doesn't set `unoptimized`, so converting the grid would route every thumbnail through Netlify's Image CDN.
7. **Checkbox needed two taps (iOS).** Selecting a card's checkbox took two taps on iOS, one on Android. Cause: iOS Safari "sticky hover" — elements with `:hover` styles (checkbox `hover:bg-pop-cream`, card `group-hover`) consume the first tap as hover and the second as click. Fix: enabled `future.hoverOnlyWhenSupported` in `tailwind.config.ts`, which gates all `hover:`/`group-hover:` styles behind `@media (hover: hover)` so they don't apply on touch devices. Global fix — resolves the same double-tap pattern app-wide. (Checkbox already `stopPropagation`s, so it was not a double-toggle.)

### Close-Up-Shop Checks
- typecheck ✓ · lint ✓ (0 errors, 116 pre-existing warnings) · tests 850/850 ✓ · circular deps ✓ none · build ✓
- `npm audit`: 15 vulnerabilities (7 high, 8 moderate) in transitive deps (`ws`, `resend → svix → uuid`, `@sentry` chains) — pre-existing, `npm audit fix` available; backlogged (Low-Med).
- Dead code (knip): pre-existing unused exports/types only (`email.ts`, `imageOptimization.ts`, `offlineCache.ts`, `validation.ts`, `variantResolver.ts`) — none from this session; warn-only, retained.
- Code cleanup: no `console.log` / TODO / unused imports in session-changed files.
- Costs: **no changes this session** — UI/CSS + one client-side event only; no new services, tiers, or dependencies. Plain `<img>` kept in the grid specifically to avoid Netlify Image CDN cost. COST_PROJECTIONS.md ↔ CLAUDE.md still in agreement.
- Docs updated: EVALUATION, BACKLOG (+3: Android FAB→in-app camera [Med], npm audit deps [Low-Med], optional `object-contain` thumbnail [Low]), ARCHITECTURE, TECHNICAL_FEATURES, TEST_CASES (+6 verified cases). Specs swept (`docs/engineering-specs/`, `docs/features/`) — no contradictions.

### Where We Left Off
Deployed May 27, 2026 (two pushes) and **fully device-validated on iPhone + Android**. First deploy (`42bff35`): 5 collection-UI fixes + cover-persistence validation. Second deploy (`9399494`): 2 iOS-Safari follow-ups (blank-cover repaint + single-tap checkbox) — user confirmed both resolved on iOS. Issue #1 (detail-modal thumbnail) kept as cropped-to-fill 2:3; optional switch to `object-contain` (zero-crop, letterboxed) tracked in BACKLOG (Low). Next session: BACKLOG #1 remains Variant Detection — Two-Pass High-Res Barcode OCR.

### Changes Since Last Deploy
_Reset — Session 47 deployed May 27, 2026. No accumulated undeployed changes._

---

## May 9, 2026 (Saturday) — Session 46: Scan Cover Persistence + 3-Tier Variant Resolver (Deployed May 9, 2026 — through commit `300bef4`)

### Summary
Two production bugs reported during the user's testing session got fixed end-to-end and shipped together:

1. **Scan covers were silently dropped on save.** Every signed-in user's FAB-scan saved to the collection with a `?` placeholder instead of their photo. Root cause: the data: URI from `ImageUpload` flowed straight into `cover_image_url`, where the defensive sanitizer at `db.ts:720` (correctly) rejected base64 to prevent CSV/Stripe breakage — but no upload step existed to convert it to a real URL first.
2. **Variant detection on multi-variant scans.** User scanned 4 Dark Knights Metal #1 variants; all saved with `variant=null` and rendered as identical rows. The pipeline was wired but the existing addon-digit heuristic (`firstDigit > 1 → "Cover B"`) was brittle and stopped at generic letters — no enrichment to canonical names like "Greg Capullo Variant Cover".

Both fixes are additive, non-blocking on failure, and cover guests gracefully (guests use localStorage; sanitizer only fires on DB write).

### Features Shipped

#### 1. Scan Cover Persistence — Supabase Storage Upload Pipeline 🖼️

**Bug:** signed-in users' scan photos never reached the database. Confirmed kill chain: `ImageUpload` returns `data:image/jpeg;base64,…` → `scan/page.tsx:264` sets `coverImageUrl: imagePreview` → `db.ts:720` → `sanitizeCoverImageUrl` rejects all `data:` URIs (line 41) → DB stores `null` → "?" placeholder renders.

**Fix architecture:**
- New `comic-covers` Supabase Storage bucket (public, 10MB cap, JPEG/PNG/WebP) — see migration `20260509_comic_covers_bucket.sql`
- New `/api/comics/upload-cover` endpoint, Clerk-auth-guarded, mirrors the `/api/messages/upload-image` pattern (multipart File → bucket upload → public URL response)
- New `src/lib/uploadCoverImage.ts` client helper: data URI → Blob → multipart POST → public URL. Pass-through for already-hosted http(s) URLs and null inputs. Returns null on failure, never throws — caller writes null to cover_image_url and the placeholder renders (graceful degradation, scan save still succeeds).
- `scan/page.tsx` `handleSave()` awaits the upload before constructing `newItem` (signed-in users only — guests keep their data URI in localStorage, sanitizer never fires for them).
- 7 unit tests in `uploadCoverImage.test.ts` covering null/empty input, http(s) pass-through, successful upload, non-OK response, fetch throw, missing url field, malformed data URIs.

**Backfill:** existing books already saved with null covers are unrecoverable — original photos only existed as in-memory data URIs and were never persisted anywhere. User opted to delete-and-rescan affected books to get covers back (see test plan).

**Edit-cover flow gap noted but not fixed:** `ComicDetailsForm.tsx` edit-cover UI is paste-URL only (no file upload button), so the only way to give existing books their photos back is re-scan. Backlog candidate: add "Take/Upload Photo" button to edit modal using the same `uploadCoverImage` helper.

**Files:**
- NEW: `supabase/migrations/20260509_comic_covers_bucket.sql`, `src/app/api/comics/upload-cover/route.ts`, `src/lib/uploadCoverImage.ts`, `src/lib/__tests__/uploadCoverImage.test.ts`
- MODIFIED: `src/app/scan/page.tsx`

#### 2. 3-Tier Variant Name Resolver — Catalog → AI → Derived 🔑

**Bug:** front-cover scans of variant comics returned `variant=null` because (a) UPC barcode was often cropped/missing from front-cover-only photos, and (b) when the barcode WAS read, the existing addon-digit heuristic at `analyze/route.ts:733-739` only worked when `firstDigit > 1` (so codes "01", "11", "12" all fell through), and even when it triggered it stopped at generic "Cover A/B/C" with no artist enrichment.

**Resolver architecture (`src/lib/variantResolver.ts`):**
- **Tier 1 — Catalog lookup (free, instant):** queries `barcode_catalog` for `(upc_prefix, addon_issue, addon_variant)` where `variant_name_status='approved'`. Returns the most-frequently-approved variant_name across submissions. Empty at launch — compounds as admin approves entries.
- **Tier 2 — Focused AI enrichment (~$0.0008 with Haiku):** text-only call asking "What's the canonical variant name for [Title] #[Issue] ([Year]), variant code [N]?" with explicit conservatism instructions ("return null rather than fabricate"). Fires only on Tier-1 miss + barcode-confirmed-variant addon (not "00"/"01"/"11") + AI's first-pass cover hint isn't already rich.
- **Tier 3 — Addon-derived fallback:** the legacy `addon[0] → "Cover B/C/D…"` mapping, last resort.
- **Rich AI hints preserved:** if AI's cover analysis already returned something like "Greg Capullo Variant Cover" (matches `/(variant|incentive|edition|foil|sketch|virgin|holofoil|newsstand|direct)/i` or `\d+:\d+` ratio pattern or 3+ words), the resolver keeps it and skips Tier 2. Only generic guesses get enriched.
- All tiers wrapped in try/catch — any failure falls through to the next tier; final fallback keeps AI's hint or returns null.

**Catalog write path (per requirement: user-typed names need admin approval before community use):**
- `db.ts:catalogBarcode` extended to accept `variantName` + `variantSource`
- All variant-name catalog writes land with `variant_name_status='pending'` regardless of barcode confidence — separates the existing barcode→comic mapping approval (which still auto-approves at high confidence) from the variant-name approval (always pending)
- Skips re-submission when source is `'catalog'` — already approved, no need to repollute the queue

**UI hint on review screen (`ComicDetailsForm.tsx`):**
- New `🔍 Detected from…` hint under the variant field when populated by resolver
- Source-aware copy: "Detected from community barcode catalog" / "Detected from barcode + AI lookup — please confirm or edit" / "Derived from barcode digits — confirm or replace with the artist/variant name"
- Field stays fully editable; user override marks the entry as `variantSource='user'`

**Migration `20260509_variant_name_catalog_guard.sql`:**
- Adds `variant_name`, `variant_name_source`, `variant_name_status` columns to `barcode_catalog`
- Two partial indexes: `idx_barcode_catalog_variant_lookup` (Tier-1 fast path) and `idx_barcode_catalog_variant_pending` (admin queue)
- CHECK constraints on enum values; idempotent so it's safe to re-run

**21 unit tests in `variantResolver.test.ts`:**
- Helper coverage: `isRichVariantName`, `isVariantAddon`, `deriveVariantFromAddon`
- Each tier in isolation with mocked deps
- Integration paths: catalog hit → catalog return; rich AI hint → kept untouched; catalog miss + generic AI hint → Tier 2 enrichment; all miss → Tier 3 derived; all miss with no addon → null
- Failure paths: catalog throw → continues to AI; AI throw → falls to derived

**Files:**
- NEW: `supabase/migrations/20260509_variant_name_catalog_guard.sql`, `src/lib/variantResolver.ts`, `src/lib/__tests__/variantResolver.test.ts`
- MODIFIED: `src/app/api/analyze/route.ts` (replaced lines 733-739 with resolver call; extended local `ComicDetails` interface; cached `variantSource`), `src/lib/db.ts` (`catalogBarcode` + `addComic` call site), `src/types/comic.ts` (added `variantSource` field), `src/components/ComicDetailsForm.tsx` (hint UI)

#### 3. BACKLOG — Admin UI for Variant-Name Approval Queue (added)

Added a Pending Enhancements entry: "Admin UI for Community Variant-Name Approval Queue". Required to bootstrap Tier-1 catalog growth (otherwise every variant scan stays in AI-paid mode forever). Schema + write path are in place; UI is the missing piece. Effort estimate ~3-4 hours, follow `admin_barcode_reviews` patterns. Index `idx_barcode_catalog_variant_pending` already added so the queue stays fast.

### Migrations Run on PROD Before Deploy

User confirmed both ran successfully via Supabase SQL Editor mid-session:
1. `20260509_comic_covers_bucket.sql` — creates `comic-covers` storage bucket
2. `20260509_variant_name_catalog_guard.sql` — adds variant_name columns + indexes to `barcode_catalog`

### Test Suite

**853/853 passing** across 56 suites (was 832; +21 from variantResolver, no regressions).

### Quality Gates Run Pre-Deploy

- `npm run check:routes` — ✓ no dynamic route conflicts
- `npm test` — ✓ 853/853
- `npx tsc --noEmit` — ✓ clean
- `npm run lint` — ✓ no new errors (115 pre-existing warnings, none from this session)
- `npm run build` — ✓ compiled successfully, 111 static pages
- `npm run smoke-test` — ✓ homepage 200

### Issues Encountered & Resolved

- **Local Clerk sign-in is broken**, so manual testing of either fix had to wait for production deploy. Both fixes are designed for graceful degradation (cover upload failure → placeholder; resolver failure → null variant), so worst case is no worse than the bug we already had.
- **Local TS shadowing surprise:** `analyze/route.ts:88` declares a LOCAL `interface ComicDetails` that shadows the import from `@/types/comic`. Adding `variantSource` to the global type alone wasn't enough; needed to extend the local one too. Caught by `tsc --noEmit` before commit.
- **Initial scope question on Bug 2 (covers):** considered backfilling existing null-cover books from some other source (community catalog, AI-fetched covers). Concluded not possible — original photos were in-memory data URIs and are gone. User opted to delete-and-rescan affected books rather than build a manual upload flow into the edit modal. Edit-modal upload button noted as a follow-up but deferred.

### Cost Impact

Variant resolver Tier 2 AI cost: ~$0.0008/scan with Haiku, fires only on catalog miss + barcode-confirmed variant. At launch the catalog is empty so it'll fire on most barcode scans of variant books. Estimated $0.02-$0.07/day at current scan volumes. Compounds *down* once admin approves variant_name catalog entries (Tier 1 hits are free).

### Memory updates this session
- (none — both fixes documented in DEV_LOG and BACKLOG, no durable preferences/lessons to capture beyond what's already in the existing memory files)

### Where We Left Off

Deploying May 9, 2026 — both fixes bundled into 3 commits (cover persistence, variant resolver, docs). Netlify auto-deploy will trigger on push. User to verify in production by:
1. Re-scanning a comic on mobile → confirm cover persists in collection (not "?" placeholder)
2. Re-adding the deleted Dark Knights Metal #1 variants → confirm each gets a different variant name (Tier 2 AI enrichment will fire) and the `🔍 Detected from…` hint appears on the review screen

### Changes Since Last Deploy

_Session 46 deployed May 9, 2026 (commits `aaa3fac`, `8d6cdda`, `300bef4`, plus follow-up `e39b4d7` for the barcode-trumps-AI fix). Local-only docs commit `c8a608a` marks deployed. Next deploy starts from `e39b4d7` (or close-up-shop docs commit, whichever is later)._

### Production Testing Findings (May 9, 2026 — post-deploy)

User tested the deployed Session 46 fixes. Two findings:

1. **Cover persistence not yet user-validated** — Android camera-launch-from-PWA failed with "low memory" error on first attempt (Android Low-Memory-Killer reaping the Chrome PWA process while the camera app is in foreground). Workaround documented: use "Choose from Gallery" button instead. Backlogged as a separate issue: switch the FAB scan path to use the in-app `LiveCameraCapture` component (which exists but is currently dead-code-pathed) so the PWA never goes to background. Cover persistence itself was not user-tested but the code path is correct (verified by 7 unit tests + production deploy quality gate).

2. **Variant resolver not firing in production — root cause confirmed.** User scanned Dark Knights Metal #1 (the same DKM #1 photo shared mid-session, addon `00171` clearly visible in the image). Cover-pass returned high confidence, most details identified. Variant field came back **empty**. Root cause: the AI extracted only the 12-digit main UPC (`761941348926`) and missed the 5-digit add-on supplement (`00171`). With no `addonVariant`, the resolver's guard at `analyze/route.ts:734` short-circuits and never runs. No Tier 1 catalog lookup, no Tier 2 AI enrichment, no Tier 3 derived "Cover G" — just null variant.

   Tested mitigation A (zoom in on the barcode for a focused photo): **failed**. The AI lost the cover context entirely and identified a totally different book. So the user cannot be asked to choose between "good cover identification" and "good barcode read" — both must work from a single normal scan.

   **Backlogged as top priority for next session:** "Variant Detection — Two-Pass High-Res Barcode OCR (Option C3)". Recommended approach: spike a client-side JS barcode library (zxing-js or quagga.js) at full camera resolution before any AI call. If accuracy is good, lossless extraction with zero AI cost. Fall back to server-side two-pass OCR using the original full-resolution image via the new `comic-covers` bucket. Includes complementary low-cost addition: show extracted barcode on review screen with manual-edit affordance, so when both AI passes fail the user can paste the correct barcode.

### Mid-session Fix Shipped After Deploy (May 9, 2026)

Mid-session feedback from the user surfaced a flaw in the resolver's logic: a "rich AI cover hint short-circuits Tier 2" rule meant the resolver would trust AI's cover-derived variant name (e.g., "Greg Capullo Cover") and skip the barcode-derived path, even though the barcode is more authoritative. Two physically different books (e.g., a 1st-print Capullo cover vs a 7th-printing reprint of the same cover art) would be labeled identically.

**Fix shipped (`e39b4d7`):**
- Removed `isRichVariantName` and the rich-hint short-circuit logic
- Derive cover letter deterministically BEFORE Tier 2 (Cover G for "71")
- Pass derived label into the enricher prompt so Haiku has a concrete query ("What's Cover G of Dark Knights Metal #1?" instead of decoding raw addon digits)
- AI cover-derived hint now only used as final fallback when there's no parsed barcode at all

Updated tests: removed 3 isRichVariantName tests, added 2 new ones covering "barcode trumps rich AI hint" + derivedLabel plumbing into the enricher. **18 resolver tests, all green.**

### Final test counts (after all session 46 fixes + close-up-shop)

- 850/850 tests passing across 56 suites (was 825 + 21 new resolver tests + 7 new uploadCoverImage tests - 3 removed isRichVariantName tests = 850)
- TypeScript: clean
- ESLint: 0 errors, 116 warnings (all pre-existing)
- Production build: ✓
- npm audit: clean
- Circular deps: ✓ none
- Dead code (knip): 14 unused exports, 1 from session (`VariantSource` from variantResolver.ts — exported for future external consumers, OK to keep)

---

## May 6, 2026 (Wednesday) - Session 45b: PWA Splash Iteration + Hunt List Fix + Notifications Settings 500 + Live Key-Info Coordinated Fixes + Data-Partner Research (Deployed May 6, 2026 — through commit `69c186b`)

### Summary
Post-deploy continuation of Session 45 (deployed at `acb598b` earlier today). Surface area:
1. **PWA splash + maskable icon** — three rounds resolving "splash too small" then Android maskable mismatch. Final architecture: single `Collectors Chest Splash.png` 2732×2732 brand source feeds iPhone splash (cover crop into 5 device sizes) + maskable icons (192/512 straight resize). iOS apple-touch-icon untouched per user feedback.
2. **Hunt List 400** — Add-to-Hunt-List rejected requests because data: URIs failed Zod `.url()` validation. Added `sanitizeCoverImageUrl` before request.
3. **Notifications Settings 500 diagnosis** — `/settings/notifications` returning 500 due to PROD-missing columns from a Jan 27 migration that never ran. Catch-up SQL placed in clipboard for user to run.
4. **Comic data partner research** — `docs/DATA_PARTNERS.md` (~360 lines), `docs/PRICECHARTING_PROPOSAL.md` (Aponte-shareable, ~110 lines, $499/yr Legendary tier brief), `docs/BARCODE_RESEARCH.md` (hybrid UPC mapping recommendation).
5. **Live key-info bug — three coordinated fixes** across `con-mode-lookup` AI fallback, history persistence + cover preservation, and Comic Vine dead-code removal.
6. **Cover-image preservation product rule** established and audited as a durable feedback memory.
7. **27 Notifications Inbox manual tests walked through** earlier in the session — most passed; flash regression fixed; ?focus= deep-link fixed; em-dash purge across 77 source files + `docs/CLZ_COMPARISON_BRIEF.md`.

Three deploys queued (`63fc386`, `6f6aefe`, `69c186b`) — to be triggered after close-up-shop completes.

### Features Shipped

#### 1. PWA Splash + Maskable Icon Iteration 📱

**Three commits across the round:**
- `12c5fa9` — first cut: regenerated splash from a logo source. User feedback: "splash too small."
- `64a9331` — second cut: introduced 2732×2732 brand-blue source with logo + safe zone, but Android still showed black/maskable mismatch.
- `ce9578d` — final: single `Collectors Chest Splash.png` (2732×2732 brand-blue, logo + safe zone) feeds:
  - **iPhone splash** via `fit: cover` center-crop into 5 device sizes (`apple-splash-*.png`)
  - **Maskable icons** (192/512) via straight resize from the same source
  - **iOS apple-touch-icon and other PWA icons left untouched** per user feedback ("you also changed the icon — I did not ask for that")

Final result confirmed by user: "THIS IS PERFECT! App icon changed but for the better. Splash screen, also PERFECT!"

Pattern saved as durable feedback memory `project_pwa_splash_pattern.md` so future splash regenerations don't drift the apple-touch-icon.

#### 2. Hunt List 400 — data: URI Sanitize Before Request 🐛

**Reported:** Add-to-Hunt-List was rejecting requests with a 400.

**Root cause:** Zod validator on the request body used `.url()` on `coverImageUrl`. The Key Hunt result page sometimes carries a data: URI (compressed scan thumbnail) which `.url()` accepts but the downstream Supabase write rejects, OR Zod's `.url()` rejects long data: URIs depending on length. Either way: data: URIs aren't valid for the Hunt List storage path.

**Fix:** Imported `sanitizeCoverImageUrl` from the shared cover-URL helper and applied it to the cover URL before building the request body. Strips data: URIs, returns the cleaned http(s) URL when one exists, else null.

**Diagnostic script kept:** `scripts/debug-key-hunt-flow.ts` — tests 13 AI title variants for UF#4. 10/13 hit, 3 miss (e.g. inline-issue, extra-suffix). Useful for future drift audits.

**Commit:** `4fe71cd`

#### 3. Notifications Settings 500 — PROD Migration Catch-Up 🔧

**Reported:** `/settings/notifications` returned 500 in PROD.

**Diagnosis:** Wrote `scripts/debug-notification-prefs.ts` for per-column existence check against the `profiles` table. Found that `msg_push_enabled` and `msg_email_enabled` columns are missing from PROD — the Jan 27, 2026 messaging Phase 4 migration `20260127_messaging_phase4.sql` never ran on PROD. Local schema has them; PROD doesn't; settings-page query trips on the missing columns and returns 500.

**Resolution:** Catch-up SQL copied to clipboard for user to run in Supabase SQL Editor before the next deploy. No code change needed — this is a migration-not-applied issue, not a code bug.

#### 4. Comic Data Partner Research — Three Docs (Doc-Only) 📚

**No code commits — research docs only.** Created in response to GoCollect (Feb 2026) and Marvel Developer (Feb 2026) API discontinuations leaving us thin on pricing + metadata sources beyond eBay Browse.

**Created:**
- `docs/DATA_PARTNERS.md` (~360 lines) — landscape map: eBay Browse, CovrPrice (2027 roadmap), GoCollect (discontinued), Marvel (deprecated), ZenRows (deferred post-launch), Ximilar, PriceCharting, Apify GoCollect Scraper. Each entry: status, cost, fit, risk, decision.
- `docs/PRICECHARTING_PROPOSAL.md` (~110 lines, Aponte-shareable) — decision brief on the $499/yr Legendary tier. Year-1 ramp ~180 scans/day fits within the tier's quota.
- `docs/BARCODE_RESEARCH.md` — hybrid UPC mapping recommendation (UPC database lookup + curated mapping fallback for older books without UPCs).

**ROI framing course-corrected mid-session.** Initial draft of PriceCharting brief said "breaks even at 90 scans" by comparing to Anthropic AI per-scan cost. User pushed back: that's an apples-to-oranges comparison (PriceCharting replaces sales-data lookups, not cover-recognition AI). Reframed honestly: **"$499 is a quality investment in better pricing data, not cost-savings."** Saved as a lesson for future ROI comparisons.

#### 5. Live Key-Info Bug — Three Coordinated Fixes 🔑

##### 5a. `/api/con-mode-lookup` no-data path — AI keyInfo fallback (commit `63fc386`)

**Root cause:** The eBay-found path called `fetchKeyInfoFromAI()` on a curated DB miss. The no-data path didn't. So slabbed scans of unaliased titles (e.g. "Ultimate Fallout: Spider-Man No More" coming back from a CGC cert as the indicia title) silently dropped the KEY ISSUE chip — the curated DB missed (no alias for that exact spelling) AND the no-data branch had no AI rescue.

**Fix:**
- Mirrored the `fetchKeyInfoFromAI()` rescue from the eBay-found path into the no-data branch
- Bumped `ai_calls_made` so cost tracking stays honest
- Added `[keyinfo-drift]` breadcrumb log when curated misses but AI rescues (mirrors the Session 45 telemetry pattern, now fires in all three result paths instead of two)

##### 5b. `KeyHuntHistoryEntry` keyInfo persistence + cover preservation (commit `6f6aefe`)

**Three problems bundled into one commit:**

(a) **History entries never stored keyInfo.** Tapping a recent scan in the history drawer dropped the KEY ISSUE chip — even when the live result had shown it. The history record was lossy.

(b) **Refresh / New Grade wiped cover image.** Re-lookup on refresh/regrade didn't carry `pendingComic.coverImageUrl` through, so the cover briefly disappeared and could be replaced by an AI-derived URL.

(c) **`handleAddFromHistory` had `keyInfo: []` hardcoded.** When the user added a comic to their collection from a history entry, keyInfo was silently dropped even when present in the source row.

**Fixes:**
- Added `keyInfo` + `keyInfoMeta` to the `KeyHuntHistoryEntry` interface
- Persisted them at the `addToKeyHuntHistory` call site
- Rendered the chip in `KeyHuntHistoryDetail` (mirrors live result styling)
- Added a small "Key" badge in `KeyHuntHistoryList` rows for at-a-glance scan-back
- Preserved `coverImageUrl` on Refresh/New Grade by passing `previousCover` through `setPendingComic`
- Threaded `keyInfo` through Add to Collection from history (`handleAddFromHistory` no longer hardcodes `[]`)
- Aligned `keyInfoMeta.matchedYear` to `number | null` end-to-end across `LookupResult` / `KeyHuntPriceResult` / `KeyHuntHistoryEntry` (was inconsistent; some sites had `number | undefined`)

##### 5c. Comic Vine dead-code removal (commit `69c186b`)

**Audit findings:**
- `/api/quick-lookup` route had no callers anywhere in the codebase
- `COMIC_VINE_API_KEY` env var was never set in any environment
- PWA "Quick Lookup" shortcut in `manifest.json` pointed to a non-existent `/quick-lookup` page (would 404 if a user tapped the home-screen shortcut)
- Service worker pre-cached the dead `/api/quick-lookup` endpoint

**Removed:**
- `src/app/api/quick-lookup/route.ts` (~250 lines)
- `"comicvine"` from the `CoverPipelineResult.coverSource` union
- Dead PWA shortcut from `manifest.json`
- `/api/quick-lookup` from `sw.js` `CACHEABLE_API_ROUTES`

Historical design docs in `docs/plans` and `docs/engineering-specs` left in place for archival.

#### 6. Cover-Image Preservation Product Rule 🖼️

**User stated:** "We should never replace the image of the user's uploaded book unless they manually do it via the book edit details."

**Audit confirmed the rule already holds at the data layer:**
- Only `updateComic` (in `db.ts:235`) writes the user's `comics.cover_image_url`
- That call is reachable only from the collection-edit flow (book details form)
- "Risky" API paths (`quick-lookup` — now removed; `con-mode-lookup`) write to `comic_metadata` (the shared catalog cache), NOT the user's per-instance row

So the rule was already enforced, but not previously articulated. Saved as durable feedback memory so future API-path changes don't accidentally cross the line.

#### 7. Notifications Inbox Manual Test Pass (27 cases) + Em-Dash Purge ✅

**Walked through the 27 manual test cases** added during Session 42d for the Notifications Inbox v1. Most passed on first walk-through. Two regressions surfaced and were fixed:
- **Flash regression on cache banner.** `showCacheBanner` semantics were too loose — it fired on any cache-hit even when the live fetch succeeded. Tightened to only `true` when a fresh fetch fails AND cached data exists.
- **`?focus=` deep-link not highlighting.** UUID gate + `requestAnimationFrame` + `ring-4` + `bg-blue-100` + 2.5s highlight added. Was previously instant-on-instant-off due to scroll-into-view firing before the row paint.

**Em-dash purge across 77 source files + `docs/CLZ_COMPARISON_BRIEF.md`.** Replaced em-dashes (—) and en-dashes (–) with appropriate hyphens or "to" depending on context. Style consistency pass — em-dashes had crept in over the last few sessions.

### Files Modified / Created

**Created:**
- `docs/DATA_PARTNERS.md`
- `docs/PRICECHARTING_PROPOSAL.md`
- `docs/BARCODE_RESEARCH.md`
- `scripts/debug-key-hunt-flow.ts`
- `scripts/debug-notification-prefs.ts`
- `Collectors Chest Splash.png` (2732×2732 brand source)
- 5 × `apple-splash-*.png` device-size variants
- 192px + 512px maskable icon variants

**Modified:**
- `src/app/api/con-mode-lookup/route.ts` — AI keyInfo fallback in no-data branch + `[keyinfo-drift]` breadcrumb across all three paths
- `src/app/key-hunt/page.tsx` — `LookupResult.keyInfoMeta.matchedYear` aligned to `number | null`; `handleAddFromHistory` keyInfo threading; cover preservation on Refresh/New Grade
- `src/components/KeyHuntPriceResult.tsx` — `keyInfoMeta.matchedYear` type alignment
- `src/components/KeyHuntHistoryDetail.tsx` — KEY ISSUE chip render
- `src/components/KeyHuntHistoryList.tsx` — small "Key" badge in row
- `src/types/keyHunt.ts` (or equivalent) — `KeyHuntHistoryEntry` interface gains `keyInfo` + `keyInfoMeta`
- `src/lib/keyHuntHistory.ts` (or equivalent) — `addToKeyHuntHistory` persists keyInfo + keyInfoMeta
- `src/components/HuntListAddButton.tsx` (or equivalent caller) — `sanitizeCoverImageUrl` applied before request
- `public/manifest.json` — Quick Lookup shortcut removed; maskable icons updated
- `public/sw.js` — `/api/quick-lookup` removed from `CACHEABLE_API_ROUTES`
- `src/types/coverPipeline.ts` (or equivalent) — `coverSource` union drops `"comicvine"`
- `src/components/notifications/NotificationsInbox.tsx` — `showCacheBanner` semantics tightened; `?focus=` highlight via UUID gate + RAF + ring-4 + bg-blue-100 + 2.5s
- 77 source files — em-dash → hyphen/word style pass
- `docs/CLZ_COMPARISON_BRIEF.md` — em-dash purge

**Deleted:**
- `src/app/api/quick-lookup/route.ts` (~250 lines)

### Migrations Applied to Supabase Before Deploy

**Outstanding (user must run before deploy):** Catch-up for `20260127_messaging_phase4.sql` to add `msg_push_enabled` + `msg_email_enabled` columns to PROD `profiles` table. Catch-up SQL placed in clipboard.

### Issues Encountered & Resolved

- **Splash regen accidentally changed apple-touch-icon.** Round 1 regenerated all icons from a logo source, including the iOS home-screen icon — user only asked for splash. Resolved in round 3 by isolating the source: brand-blue 2732×2732 feeds splash + maskable, iOS apple-touch-icon left untouched. Memory captured.
- **PriceCharting ROI miscalculation.** Initial draft compared $499/yr to Anthropic AI per-scan cost ("breaks even at 90 scans"). User pushed back — the comparison is bogus because PriceCharting and AI cover-recognition are separate cost lines. Reframed honestly to "quality investment, not cost-savings."
- **PROD-missing migration columns surfaced via 500.** `/settings/notifications` 500 was a non-obvious migration-not-applied issue. Resolved by per-column existence diagnostic script + clipboard catch-up SQL. No code change.
- **Em-dashes had quietly crept into 77 files** over the last several sessions. Style pass before close-up-shop.

### BACKLOG follow-ups
- 1 entry implicit: future PriceCharting integration if Aponte agrees to fund the $499/yr (post-meeting decision).
- Catch-up SQL run on PROD must be confirmed before deploy of 6f6aefe / 69c186b (the deploys themselves are independent of the migration, but the Notifications Settings 500 won't clear until the SQL runs).

### Memory updates this session
- `project_pwa_splash_pattern.md` — single 2732×2732 brand source for splash + maskable; apple-touch-icon untouched.
- Cover-image preservation rule — only collection-edit flow writes `comics.cover_image_url`; API paths write `comic_metadata` (shared cache) only.

### Where We Left Off

Deployed May 6, 2026 — Netlify auto-deployed each fix commit on push:
- `4fe71cd` — Hunt List `data:` URI cover sanitize before Add-to-Hunt-List
- `12c5fa9` / `64a9331` / `ce9578d` — PWA splash + maskable icon iteration (final approved by user)
- `63fc386` — `/api/con-mode-lookup` no-data path AI keyInfo fallback + drift breadcrumb
- `6f6aefe` — `KeyHuntHistoryEntry` keyInfo persistence + cover preservation on Refresh/New Grade + history-add keyInfo threading
- `69c186b` — Comic Vine dead-code removal (`/api/quick-lookup` route + manifest shortcut + sw.js cache entry + coverSource union)

PROD migration catch-up: user ran `msg_push_enabled` + `msg_email_enabled` column adds in Supabase SQL Editor mid-session, restoring `/settings/notifications`.

Doc commit `d297c89` (close-up-shop) intentionally NOT pushed — bundles with next session per the "avoid extra Netlify build for docs" convention.

### Changes Since Last Deploy

_None — Session 45b fully deployed. Next deploy will start from `69c186b` (with `d297c89` doc commit riding along when next session pushes)._

---

## May 6, 2026 (Wednesday) - Session 45: alias mechanism + sniping protection + ending-soon reminders + PWA splash + 14 BACKLOG closures (Deployed May 6, 2026 — commit `acb598b`)

### Summary
Mid-session: post-Aponte-meeting follow-up + show-floor PROD verification of yesterday's Session 44 deploy. Three buckets:
1. **CovrPrice partner status update** — Matt Day (Director of Operations) replied to API/B2B outreach: no public API today, **targeting 2027** for a public API offering, not taking calls on the feature yet but accepting input. Patton replied requesting beta-tester status and surfaced our users' #1 ask (accurate sales pricing data). All Session 44 partner-facing materials reframed to match reality.
2. **PROD verification of Session 44 deploy** — User confirmed on iPhone (collectors-chest.com): cover lightbox tap-to-zoom on Key Hunt ✅ working, Second Chance "Offer to Runner-up" RLS-anon read fix ✅ working (panel now shows correct expired-offer copy), `/admin/clz-comparison` tablet page ✅ accessible. **Found regression:** Ultimate Fallout #4 (Miles Morales first appearance) scanned but did NOT show key-issue chip despite being in curated DB.
3. **Ultimate Fallout #4 fix** — class-of-bug diagnosed and fixed.

### Features Shipped

#### 1. CovrPrice Partner Reply — Doc Reframe 📄

**Background:** Session 44 (May 5) shipped `docs/CLZ_COMPARISON_BRIEF.md` + `/admin/clz-comparison` framing CovrPrice as "active conversations / in discussions." On May 6, Matt Day replied confirming no public API today, **2027 target**, not taking calls yet. Original framing now overstates relationship state.

**Reframe applied across both materials:**
- "Active conversations" → "early in their partner pipeline (API targeting 2027); we've been positioned as an early beta tester"
- Resilience-pitch quote updated to mention 2027 roadmap explicitly + beta-tester position
- Safe-to-say bullets updated: drop "we're in active conversations," add "their public API is on 2027 roadmap; we're queued as a beta tester"
- Don't-say bullets updated: explicitly forbid "active conversations" / "in discussions" (no longer accurate); forbid sharing email contents or contact names

**Strategic pitch unchanged:** still upside-only optionality (we're early in their pipeline) + the resilience story (we don't depend on them either way).

**Files changed:**
- `docs/CLZ_COMPARISON_BRIEF.md` (partnerships section heading, "What we're doing — actively" subsection, resilience-pitch quote, what-NOT-to-say + safe-to-say cheat sheets)
- `src/app/admin/clz-comparison/page.tsx` (indigo "What We're Doing — Actively" card, resilience-pitch box, safe-to-say + don't-say cards)

#### 2. Ultimate Fallout #4 keyInfo Fix + Class-of-Bug Hardening 🔑

**Reported:** Show-floor PROD test on May 6 — scanning Ultimate Fallout #4 (first appearance of Miles Morales as Spider-Man) returned a clean cover ID and grade picker but **no KEY ISSUE chip**. Curated DB has the entry (line 555-560 of `keyComicsDatabase.ts`); the data path is wired in (`con-mode-lookup/route.ts` consults `lookupKeyInfo` at all three result paths since Session 44).

**Root cause — title-format drift:**
- Cover prominently displays "SPIDER-MAN" above the series title
- AI recognition pipeline returns title as `"Ultimate Fallout: Spider-Man"` (or `"Ultimate Fallout - Spider-Man"`, `"Ultimate Fallout Spider-Man"`)
- `lookupKeyInfo()` strict-normalizer strips all non-alphanumerics + lowercases → `"ultimatefalloutspiderman"`
- Curated entry stored as just `"Ultimate Fallout"` → normalizes to `"ultimatefallout"`
- Map lookup misses; resolver returns null; chip never renders

**Audit (1,053 entries scanned):** Surfaced 57 entries with `:` subtitles, 99 entries with 4+ word titles, **82 token-prefix collision pairs** that would create false positives under naive fuzzy matching (Batman alone has 16 collisions). Conclusion: a fuzzy/token-prefix fallback is unsafe at this scale — false-positive keyInfo on a $X book is worse than silent miss. Aliases-as-data is the right approach.

**Fix architecture — `aliases` field on `KeyComic` interface:**

Refactored `keyComicsDatabase.ts` to support an optional `aliases?: string[]` on each entry. Map-build registers each entry under canonical normalized title AND each alias's normalized title, with dedup so multiple author-supplied variants that normalize to the same key (e.g., `"Foo: Bar"` + `"Foo - Bar"` + `"Foo Bar"` → all normalize to `"foobar"`) don't create phantom multi-entry ambiguity in `resolveEntry`.

**Aliases added this session (6 total):**
1. **Ultimate Fallout #4** → `["Ultimate Fallout: Spider-Man", "Ultimate Fallout - Spider-Man", "Ultimate Fallout Spider-Man"]` (PROD-confirmed drift)
2. **Tales of Suspense #39** (first Iron Man) → `["Tales of Suspense: Iron Man"]`
3. **Journey Into Mystery #83** (first Thor) → `["Journey Into Mystery: Thor"]`
4. **Marvel Premiere #15** (first Iron Fist) → `["Marvel Premiere: Iron Fist"]`
5. **Marvel Spotlight #5** (first Ghost Rider) → `["Marvel Spotlight: Ghost Rider"]`
6. **Strange Tales #110** (first Doctor Strange) → `["Strange Tales: Doctor Strange"]`

Pattern: Silver/Bronze Age anthology covers where the feature character logo dominates the masthead — same drift risk as Ultimate Fallout #4. Each alias was verified against the audit's 82 collision pairs to confirm zero ambiguity (no other entry has the same issue+year combination at the same normalized alias key).

**Drift telemetry breadcrumb:** Added `console.warn("[keyinfo-drift] ...")` in `con-mode-lookup/route.ts` when the curated DB misses but the AI fallback returns key info. This surfaces real drift candidates from production logs (Sentry / Netlify build logs) so future alias additions are grounded in scan data rather than speculation. Zero PII captured — only normalized title + issue + AI's keyInfo response.

**Test coverage added:** New `src/lib/__tests__/keyComicsDatabase.test.ts` with 17 tests:
- 5 tests covering the Ultimate Fallout #4 variant scenarios (canonical title + 3 AI variants + `isKeyComic` boolean)
- 3 tests covering normalization invariants (case-insensitive, leading "The" stripping, leading-zero issue numbers)
- 2 tests covering negative cases (unknown title, unknown issue of known title)
- 7 tests covering the alias mechanism: 5 anthology aliases verified, 1 issue-isolation test (alias must not pollute lookups at the wrong issue number), 1 dedup correctness test (multiple variant aliases that normalize-equal mustn't create phantom multi-entry ambiguity).

**Why fuzzy matching was rejected:** The audit identified 82 token-prefix collision pairs (Batman → Batman: White Knight / Batman: Damned / Batman/Catwoman / Batman: Three Jokers, Star Wars → Star Wars: Darth Vader / Doctor Aphra / Bounty Hunters, etc.). A "input contains all tokens of canonical" fallback would falsely attribute Batman #1 keyInfo to dozens of unrelated #1s. False-positive keyInfo is worse than silent miss for a buying-decision tool.

**Files changed:**
- `src/lib/keyComicsDatabase.ts` (KeyComic interface gains `aliases?: string[]`; map-build extracted to `registerEntry()` helper; 6 entries gain alias arrays)
- `src/lib/__tests__/keyComicsDatabase.test.ts` (new file, 17 tests)
- `src/app/api/con-mode-lookup/route.ts` (drift-telemetry breadcrumb on curated miss + AI hit)

#### 3. Volume Verification Safety Net for Multi-Volume Comics ⚠️

**Why:** Key Hunt is a top-priority feature; users make buying decisions on it. The audit surfaced multi-volume #1 collisions in the curated DB (Star Wars 1977 + 2015; Thor 2014 Jane Foster + Cates run; Hulk 1962/1999/2008; etc.). When AI returns a year that doesn't *exactly* match any curated volume's series-start year, the resolver picks the closest preceding volume — a judgment call. If AI's year reading is off by enough to push across a volume boundary, the user could see *wrong* keyInfo on a $X book. False-positive keyInfo is materially worse than silent miss for a buying tool.

**Confidence model (precise):** The resolver's behavior maps to four buckets:
| Resolution path | Risk | Behavior |
|---|---|---|
| Single entry exists at title+issue (~80% of DB) | None | Returns the only candidate — strict match |
| Multi-entry, exact-year match | None | Disambiguator hit the bullseye |
| Multi-entry, no year provided | None | Resolver returns null — refuses to guess; falls back to AI |
| Multi-entry, no exact year — closest preceding series-start year | **REAL RISK** | Judgment call. If AI year is wrong, attribution is wrong |

Only the fourth bucket needs a UX safety net.

**Architecture:**
- New `lookupKeyInfoWithMeta()` returns `{ keyInfo, matchType: 'exact' | 'year-resolved', matchedYear, totalCandidates }`. Existing `lookupKeyInfo()` is now a thin backwards-compat wrapper.
- `con-mode-lookup/route.ts` uses the meta variant at all three result paths (DB-cache early-return, eBay+AI path, no-data fallback) and threads `keyInfoMeta` through the API response payload.
- `KeyHuntPriceResult.tsx` renders two new affordances under the KEY ISSUE chips:
  - **Passive cue (everyone with curated metadata):** small grey subtext "Volume started YYYY" — also shows total volume count when >1. Provides verification context without alarming users on the safe path.
  - **Active warning (only when `matchType === 'year-resolved'`):** amber bordered advisory with `<AlertTriangle>` icon — "Verify volume. N volumes of this title exist. We matched this to the YYYY volume based on the cover year — double-check the indicia if you're unsure." Fires on the actually-ambiguous ~5% of lookups, avoiding alert fatigue.
- `key-hunt/page.tsx` `LookupResult` interface extended with optional `keyInfoMeta`.

**Why two-tier (passive + active) instead of warning everyone:** Most curated lookups (~80%) are single-entry comics — there's nothing to verify, a warning would be noise. A subtle "Vol started 1963" subtext is informational without being alarming. The amber advisory is reserved for the cases where the resolver actually had to make a judgment call, signaling "we're moderately confident; please verify."

**Test coverage added (7 more tests, 17 → 24 total in `keyComicsDatabase.test.ts`):**
- 3 `matchType: 'exact'` cases — single curated entry, multi-entry with exact year (Star Wars #1 2015), multi-entry with the canonical (Star Wars #1 1977)
- 1 `matchType: 'year-resolved'` case — Star Wars #1 with year 2010 (between volumes) → resolves to 1977 with the warning flag
- 2 null-fallback cases — multi-entry without releaseYear (refuses to guess), pre-volume year (predates every volume)
- 1 backwards-compat invariant — `lookupKeyInfo()` and `lookupKeyInfoWithMeta()` return identical keyInfo for the same input

**Files changed (cumulative for Session 45 across both keyInfo work streams):**
- `src/lib/keyComicsDatabase.ts` — `KeyInfoLookupResult` exported type, `resolveEntryWithMeta()` function, `lookupKeyInfoWithMeta()` exported function, `lookupKeyInfo()` re-implemented as backwards-compat wrapper
- `src/app/api/con-mode-lookup/route.ts` — `keyInfoMeta` field on `ConModeLookupResult`; all 3 result paths use the meta variant; unused `lookupKeyInfo` import removed
- `src/components/KeyHuntPriceResult.tsx` — `keyInfoMeta` prop; passive year context + active amber advisory beneath KEY ISSUE chips; `AlertTriangle` icon import
- `src/app/key-hunt/page.tsx` — `LookupResult` interface extended; `keyInfoMeta` propagated from API response into result + passed to `<KeyHuntPriceResult>`
- `src/lib/__tests__/keyComicsDatabase.test.ts` — 7 new confidence-metadata tests

### PROD verification (May 6 show-floor test)

| Test | Status |
|------|--------|
| Cover lightbox tap-to-zoom on Key Hunt result (iPhone) | ✅ Working |
| Ultimate Fallout #4 → Miles Morales keyInfo chip | ❌ FAILED — fixed by alias entry above (deploy pending) |
| Second Chance "Offer to Runner-up" RLS-anon read fix (Giant-Size X-Men #1) | ✅ Working — panel shows "didn't respond in 48 hours" copy |
| `/admin/clz-comparison` tablet page accessible | ✅ Working |

### Tests

**797/797 tests pass across 51 suites** (was 773/773 across 50 — +1 new suite, +24 new tests across alias mechanism + confidence-metadata work).

### Files Modified / Created

**Created:**
- `src/lib/__tests__/keyComicsDatabase.test.ts` (alias-mechanism + variant-title + normalization tests, 17 cases)

**Modified:**
- `src/lib/keyComicsDatabase.ts` (KeyComic interface `aliases` field; `registerEntry` helper with dedup; 6 entries gain alias arrays — Ultimate Fallout #4 + 5 anthology covers)
- `src/app/api/con-mode-lookup/route.ts` (drift-telemetry `[keyinfo-drift]` breadcrumb)
- `docs/CLZ_COMPARISON_BRIEF.md` (CovrPrice reframe — partnerships section, resilience pitch, cheat sheets)
- `src/app/admin/clz-comparison/page.tsx` (CovrPrice reframe — admin tablet page)
- `BACKLOG.md` (⭐ priority list updated — Second Chance verified closed; "Audit Curated Key DB for Title-Format Drift" entry now Partially Complete with telemetry-driven next round)
- `TEST_CASES.md` (new variant-title alias case under Session 44 key-info section; Second Chance RLS-fix marked ✅ Verified May 6)
- `TESTING_RESULTS.md` (Session 45 start entry + findings)

### Migrations Applied to Supabase Before Deploy

None — pure code + content changes.

### Issues Encountered

- **AI title-format drift class-of-bug surfaced** — Session 44 wired the curated DB lookup correctly, but the surface area of "AI returns a different title than what's stored" is broader than initially scoped. Mitigated for Ultimate Fallout #4; broader audit deferred to post-launch tooling (BACKLOG entry added).
- **CovrPrice framing required quick correction before next Aponte conversation** — Session 44 talking points were drafted while outreach was still in-flight. Direct partner reply on May 6 required immediate doc updates so the cheat sheet doesn't lead to false statements at the booth.

### BACKLOG follow-ups
- 1 entry updated: ⭐ Next Session priority list (item #1 Validate Second Chance flow live → ✅ verified, closed)
- 1 entry added then partially closed in same session: "Audit Curated Key DB for AI-vs-DB Title-Format Drift" — alias mechanism shipped + 6 aliases + telemetry hook in place; remaining work (additional aliases) is now telemetry-driven rather than speculative.

### Memory updates this session
- Added `project_covrprice_partnership.md` capturing Matt Day's reply, our beta-tester ask, and the rule for partner-facing materials (no more "active conversations" framing). Indexed in `MEMORY.md`.

### Where We Left Off
Awaiting deploy of Session 45 fix to PROD (Ultimate Fallout #4 alias + CovrPrice reframe). Once deployed, expect:
- Re-scan of Ultimate Fallout #4 to show Miles Morales chip
- `/admin/clz-comparison` reflects 2027 / beta-tester framing in the indigo card + cheat sheets
- `docs/CLZ_COMPARISON_BRIEF.md` reflects same reframe for partner sharing

### Changes Since Last Deploy

*(empty - Session 45 deployed May 6, 2026 - commit `acb598b`. Three Supabase migrations applied beforehand. 117 files / 3,019 insertions / 913 deletions.)*

---

## May 5, 2026 (Tuesday) - Session 44: Show-Floor Feedback Bundle + Curated Key DB Expansion + CLZ Sales Brief (Deployed May 5, 2026)

### Summary
End-of-day post-show wrap-up bundling production bug fixes from the May 3-4 weekend show feedback, a major curated key-issue DB expansion, and partner-shareable competitive sales materials for tomorrow's Aponte meeting:

1. **Production marketplace bug** — Second Chance "Offer to Runner-up" button was still rendering after the offer expired. Root cause: RLS-anon-read pattern. Fixed.
2. **Convention-floor Key Hunt feature gap** — scanned books weren't showing key-issue context (Daredevil #181 didn't show "Death of Elektra"). Two-layer bug: UI prop missing + data layer not consulting curated DB. Both fixed.
3. **Key Hunt cover verification UX** — built a reusable `CoverLightbox` component for full-screen cover viewing (variant verification at the booth).
4. **Curated key-issue DB expansion** — three rounds of upfront seed pass: 404 → 1,130 entries (+726 net-new), spanning Golden Age through 2020s+ canonical keys. Years normalized to series-start convention.
5. **CLZ competitive materials** — verified pricing, authored partner-shareable sales brief, built admin-only tablet "slide" page at `/admin/clz-comparison` for Aponte to use during convention conversations.
6. **Clerk dashboard** — username rules tightened (length 4-20, extended chars off). Residual gap: Clerk's UI doesn't expose full base-allowlist regex.

### Features Shipped

#### 1. Second Chance "Offer to Runner-up" Button RLS Bug 🔒

**Reported:** From PROD listing of Giant-Size X-Men #1 (auction `adbae0f6-1abb-493f-93da-238f748d5f48`). The Apr 27 Second Chance offer to the runner-up expired around Apr 29, but on May 5 the seller still saw the "Offer to Runner-up for $5.00" button when clicking the `second_chance_expired` notification.

**Root cause:** `getAuctionSecondChanceState()` in `src/lib/auctionDb.ts:370` used the anon `supabase` client to read the `second_chance_offers` table. The migration `20260423_second_chance_offers.sql` defines RLS policies gated on `current_setting('request.jwt.claims', true)::json->>'sub'` — a Supabase JWT identity. We use Clerk for auth, so Supabase never sees a matching JWT. RLS silently returned no rows; `secondChanceOfferStatus` was always `null` for the seller; the modal fell through to the "show offer button" branch every time.

**Fix:** 1-line client swap from `supabase` to `supabaseAdmin`. The call site (`getAuction()`) already verifies `auction.isSeller === userId` before reaching the helper, so the service-role read is owner-scoped at the gate.

**Audit confirmation:** Of the 11 `second_chance_offers` callsites in `auctionDb.ts`, the read in `getAuctionSecondChanceState` was the lone outlier — the other 10 already used `supabaseAdmin`. This is the same class of bug as the Session 43 trade_matches IDOR (service-role write scoping); the EVALUATION.md Risk Assessment was updated to capture this as a defensive pattern reference.

**Tests:** 1-line config swap with no logic change, matching Session 43 trade_matches IDOR precedent. Skipped unit test in favor of two manual TEST_CASES.md entries (one for the listing-modal render, one for validating the Apr 27 offer's actual final state in PROD).

**Files changed:**
- `src/lib/auctionDb.ts` (1 line + 4-line comment explaining service-role rationale)

#### 2. Key Hunt Missing Key-Issue Info — Two-Layer Fix 🔑

**Reported:** From May 3-4 weekend show. Scanning Daredevil #181 in Key Hunt returned a clean ID + cover but no notes about "Death of Elektra." Convention-floor regression — Key Hunt's marquee value (recognize the book + tell you why it matters) was broken.

**Root cause analysis (two layers):**

**Layer A — UI wiring gap.** `KeyHuntPriceResult.tsx` didn't define a `keyInfo` prop, didn't destructure it, didn't render it. `key-hunt/page.tsx:877-911` had `result.keyInfo` available but never passed it to the component. Data was reaching the page but never rendered.

**Layer B — Data-path gap.** `con-mode-lookup/route.ts` only checked the Supabase `comic_metadata` cache + AI fallback. It never consulted the curated `keyComicsDatabase.ts` (where Daredevil #181 → "Death of Elektra" has been in source for months). Stale cache rows from earlier silent AI failures returned `keyInfo: []` forever.

**Fix:**

UI side:
- `KeyHuntPriceResult.tsx` — added `keyInfo?: string[]` prop, destructured it, rendered yellow "KEY ISSUE" chips between the grade badge and the price (matching `ComicDetailModal` styling pattern with `KeyRound` icon).
- `key-hunt/page.tsx` — added `keyInfo={result.keyInfo}` to the `<KeyHuntPriceResult>` props.

Data side — `con-mode-lookup/route.ts`:
- Added `import { lookupKeyInfo } from "@/lib/keyComicsDatabase"`.
- Wired `lookupKeyInfo()` into all three result paths:
  - **DB cache early-return** — curated DB beats stale cache (handles the long-tail bug)
  - **eBay+AI path** — curated DB beats AI fallback (skips the AI call entirely for popular keys; cost reduction at scale)
  - **No-data fallback** — still surfaces curated key info when there's no eBay price signal

**Verification:** Hit the dev `/api/con-mode-lookup` endpoint with 5 canonical keys (DD #181, ASM #300, Hulk #181, Batman Adv #12, NYX #3, Walking Dead #1) — all returned correct curated info, no AI fallback noise.

**Files changed:**
- `src/components/KeyHuntPriceResult.tsx` (added KeyRound import, prop, JSX section)
- `src/app/key-hunt/page.tsx` (1-line prop pass)
- `src/app/api/con-mode-lookup/route.ts` (import + 3 lookup integration points)

#### 3. CoverLightbox Component 🖼️

**Reported:** Same May 3-4 show — collectors needed a way to **visually verify** the AI got the right book before trusting the price. The small thumbnail was insufficient for variant verification.

**Built:** New `src/components/CoverLightbox.tsx` — reusable full-screen cover viewer:
- Fixed-positioned modal, `z-[60]`, black/95 backdrop, click-to-close
- iPhone safe-area aware (`env(safe-area-inset-*)` padding on backdrop + button positioning)
- Escape key closes (desktop)
- ARIA `role="dialog"` + `aria-modal="true"` for screen-reader correctness
- 95vw × 90vh `object-contain` Image — fits any aspect ratio cleanly
- Optional caption (we pass `${title} #${issueNumber}`)
- `animate-in fade-in` + `zoom-in-95` matches existing modal motion

**Decision logged in component comments:** No pinch-zoom yet because site `viewport.maximumScale = 1` disables browser-native zoom across the app. Full-screen view is sufficient for cover verification (the user's stated need). If pinch-zoom becomes a need post-launch, drop in `react-zoom-pan-pinch` and lift the viewport restriction inside this overlay.

**Wired into:** `KeyHuntPriceResult.tsx` — the gradient-header cover thumbnail is now a `<button>` with hover ring + active scale-down. Tapping opens the lightbox. Component is generic — future enhancement: extend to `ComicDetailModal`, `ComicDetailsForm`, `AuctionDetailModal` for consistency.

**Files created:**
- `src/components/CoverLightbox.tsx`

**Files modified:**
- `src/components/KeyHuntPriceResult.tsx` (lightbox import + state + button wrap + render)

#### 4. Curated Key-Issue DB Expansion (404 → 1,130) 📚

**Background:** With the curated DB now consulted at scan time (Session 44 fix #2), expanding its coverage directly improves Key Hunt accuracy and reduces AI costs. The user requested an upfront seed pass — three rounds, each targeting progressively deeper canonical keys.

**Rounds:**
- **Round 1 (+283 net-new):** Top canonical seed pass — Golden Age firsts (Marvel Comics #1, Captain America Comics #1, Whiz #2 first Shazam, All-American #16 first Alan Scott GL, More Fun #73 first Aquaman/Green Arrow, Detective #38 first Robin, Action #252 already there, etc.), Silver Age (Showcase #6/8/17/30/37, Brave & Bold #25/34/54/60, FF #4/13/17-21/25/36/44/47/51/53/65/66, Tales to Astonish #13/35/44/59/62/82, Tales of Suspense #40/48/50/58/59/63, Strange Tales #101/115/126/146, JIM #85/86/112/114, X-Men #5/11/15/17/35/50/54/58/60, Avengers #9/11/25/28/32/55/83, DD #1/2/8/10/168, Sgt. Fury #1), Bronze Age (Marvel Premiere #1/28, Marvel Spotlight #2/12/32, Special Marvel Edition #15 first Shang-Chi, Iron Fist #14 first Sabretooth, Captain Marvel #25/27/29 Starlin, Eternals #2/3/5, Star Wars #1, Transformers #1, G.I. Joe #1/21, Saga of Swamp Thing #21/37, etc.), Copper Age (Wolverine LS #1, Marvel Comics Presents #72, Excalibur #1, X-Factor #1, Generation X #1, Uncanny X-Men #168/171/186/201/210/211/221/248/256/267/268, Man of Steel #1, Det #574/608/647, Animal Man #1/5, Doom Patrol #19/35, Sandman #2/6/21, JL International #1/7, Lobo #1, JLA #1, Kingdom Come #1, Marvels #1, Robin #1 1991), Image/Indie launches (WildC.A.T.s #1, Youngblood #1, Cyberforce #1, ShadowHawk #1, Pitt #1, The Maxx #1, Witchblade #1, The Darkness #1, Gen 13 #1, Stormwatch #1, Astro City #1, The Authority #1, Planetary #1, Hellboy: Seed of Destruction #1, Stray Bullets #1, Strangers in Paradise #1, Madman #1, Cerebus #1, Love and Rockets #1), 2000s+ (Ultimate Spider-Man #1, Ultimates #1, All-New X-Men #1, Hawkeye #1 Fraction, Captain Marvel #14/17 first Kamala, Star Wars #1 2015, House of X #1, Powers of X #1, Civil War II #1), DC Modern (Identity Crisis #2, All Star Superman #1, Final Crisis #7, Batman and Robin #1, Batman Inc #8, JL #1 New 52, Forever Evil #1, Convergence #1, DC Universe Rebirth #1, Doomsday Clock #1, Heroes in Crisis #1, Tom King Batman #1/50, Det #1000, Action #1000), Krakoa-era (X-Men #1 2019, Marauders #1, Excalibur #1 2019, X-Force #1 2019, Fallen Angels #1, New Mutants #1 2019, S.W.O.R.D. #1, Strange Academy #1).
- **Round 2 (+257 net-new):** Second-tier deeper run keys — ASM deeper (#15 Kraven, #41 Rhino, #51 Robbie Robertson, #100 4-arms, #134 Tarantula, #149 clone, #210 Madame Web, #248 Roger Stern classic, #256 Puma, #265 Silver Sable, #290-292 engagement+wedding, #294 Kraven's Last Hunt, #312 McFarlane, #315/317 Venom, #345 Carnage prelude), Uncanny X-Men deeper (#95 Thunderbird death, #96 Moira, #100, #102 Storm origin, #104, #107 Starjammers, #108 Byrne begins, #109 Vindicator, #117 Xavier origin, #122-128 Arcade+Proteus, #139 Kitty joins, #150 Magneto origin, #155 Brood, #200 Magneto trial, #205 Lady Deathstrike, #212-213 Wolverine vs Sabretooth, #251 Wolverine crucified), X-Men vol 2 #1 (best-selling comic of all time)/#4/#5/#25/#30, Avengers deeper (#29/31/59/66/71/80/89/93/98/100/137/144/162/211/300/400), Hulk deeper, Iron Man deeper, Thor (JIM #97; Thor #126/129/132/134/154/225/339/340), FF deeper (#6/11/57/112/150/232/236/244/265/347/350/371), Daredevil deeper, Captain America (#112/150/155/180/200/217/337/350/444), Doctor Strange (#169 first solo title; vol 2 #1 1974), Bronze Age titles (Conan #1/23, Savage Sword #1, Defenders #1, Werewolf by Night #1, Tomb of Dracula #1, Iron Fist #1, Power Pack #1, Squadron Supreme #1, What If #1), DC Detective deeper (#156/265/439/466/476/500/569/823/871), Batman deeper (#11/16 Alfred, #47, #100, #121 Mr. Freeze, #139, #156 Robin Dies at Dawn, #200, #300, #366, #407, #442 Tim Drake, #475 Renee Montoya, #492 Knightfall, #500, #680, #700), Action/Superman anniversaries, Adventure (#267/346/352), JLA deeper, Brave & Bold (#79/85/200), Wonder Woman/Flash/Green Lantern deeper, Vertigo/Sandman (Sandman Mystery Theatre #1, Death HCOL #1, Books of Magic #1, Lucifer #1), DC Modern events (Crisis #12, Zero Hour #0, DC One Million #1, Final Night #1, Underworld Unleashed #1, Bloodlines #1, Knightfall #1, Blackest Night #1, Brightest Day #1, Flashpoint #5), Spawn deep cuts (#5/8/10/11/100/200/300), Walking Dead/Saga/Invincible/Chew anniversaries, EC/Mad horror keys (Tales from the Crypt #20, Vault of Horror #12, Weird Fantasy #13, Mad #1).
- **Round 3 (+185 net-new):** Modern hot keys, licensed comics, Charlton heroes, recent Image — Cates Venom (#1-4 + Knull origins, Edge of Venomverse, Symbiote Spider-Man), Cates Thor (#1/5/6/13/19, God of Hammers, Donald Blake revival, Black Winter), modern X-Men (Astonishing #1 Whedon, New X-Men #114 Morrison, Wolverine: Origin #1, Old Man Logan #1, All-New Wolverine #1, X-23 #1, Krakoa-era titles, Death/Return of Wolverine, X of Swords, Hellions #1, Way of X #1), modern Spider-Man (Ultimate Comics #1, Spider-Man #1 2016 Miles Morales main MU, Champions #1, Ghost-Spider #1, Spider-Boy #1, Friendly Neighborhood Spider-Man #1), modern Avengers (Young Avengers #1/12, Mighty Avengers #1, Captain Marvel #1 2014, A-Force #1, Falcon #1, Ironheart #1, World of Wakanda #1, Mockingbird #1, Black Widow #1 2014/2020, Hellcat #1, Squirrel Girl #1, America Chavez #1, Iceman #1), Star Wars Marvel-era (Darth Vader #1/3/5 2015 — Aphra/Triple-Zero/BT-1, Vader #1/3 2017 — Crimson Dawn, Doctor Aphra #1 2016/2020, Bounty Hunters #1, High Republic #1, Star Wars #1 2020), Joker War / Tom King Batman (Snyder Batman #1/5/13/21/92/95/100/125, Curse of White Knight, Batman/Catwoman #1, Damned #1, Three Jokers, Black Label, Strange Adventures, Mister Miracle, Far Sector), modern Justice League (Snyder JL #1, JL Dark v2, Multiversity, Black Adam #1, Wonder Girl #1), Charlton heroes (Captain Atom #78, Blue Beetle #1 1964, Question #1 Vic Sage, Peacemaker #1), Vintage horror/westerns (Jonah Hex via All-Star Western #10, Phantom Stranger #1 1969, Spectre #1 1967, Doom Patrol #86, Strange Adventures #205 Deadman, House of Mystery #175 Cain, House of Secrets #81/90 Abel/Eclipso), Vertigo modern (Preacher #5, Y final #60, 100 Bullets #100, Sandman: Overture #1), recent Image (I Hate Fairyland, Reckless, Gunslinger Spawn, King Spawn, Family Tree, Decorum, Ascender, Once & Future, Stillwater, Newburn, Murder Falcon, Bone Orchard, Public Domain, Kaya, Twig), BOOM/Dark Horse/IDW (Mouse Guard, MMPR, Lumberjanes, Wynd, House of Slaughter, B.P.R.D. #1, Buffy Dark Horse, Sonic Archie+IDW, MLP IDW, IDW TMNT #1+#100), more Marvel 2000s+ (MK Spider-Man #1, World War Hulk #1, Punisher MAX #1, Thor: God of Thunder #1/2 first Gorr, Mighty Thor #1 Jane Foster, Earth X #0/Universe X/Paradise X, 1602 #1, Eternals #1 Gaiman/Gillen), modern DC (Action #1006 Bendis, Superman #1 2018 Bendis, Son of Kal-El #1, Future State titles, I Am Batman, Aquaman/Green Arrow/Green Lantern relaunches, New Frontier, Other History of DCU), Power Girl debut (All Star Comics #58), Marvel's Voices anthology launches.

**Workflow per round:** generate → year-normalize → dedupe → typecheck → tests → API spot-check.

**Year normalization caught a footgun.** Initially used issue-publication years; this caused resolver ambiguity (e.g., new Detective #38 entry with `year: 1940` collided with existing entries using `year: 1937` series-start). Wrote a script to normalize all new entries to the existing series-start convention. 142 entries normalized in Round 1; 45 in Round 2; 29 in Round 3.

**Dedup at every round caught:** R1 dropped 31 (existing dupes); R2 dropped 16; R3 dropped 36 (more title-overlap with existing).

**Final:** 1,130 entries · 2 hard duplicates remaining (both pre-existing — `Marvel Super Heroes Secret Wars` vs `Marvel Super-Heroes Secret Wars` title-spelling variants, normalized at lookup time but raw entries should be merged for hygiene; deferred).

**Files modified:**
- `src/lib/keyComicsDatabase.ts` (~867 line increase)

#### 5. CLZ Competitive Sales Brief + Admin Tablet Page 🎯

**Background:** May 3-4 show feedback was that CLZ Comics came up most often in customer comparisons. User needed materials for tomorrow's partner meeting with Aponte and a tool he can use on the convention floor.

**Verified competitor data** (May 5, 2026, via clz.com + manual + App Store, no credentials used):
- CLZ Comics Mobile alone: $1.99/mo / $19.99/yr (catalog only — NO real-time pricing)
- CovrPrice Premium add-on (REQUIRED for actual comic values inside CLZ): $8.95/mo / $89.95/yr
- **Apples-to-apples (catalog + pricing): $10.94/mo for CLZ vs $4.99/mo for Collectors Chest Premium → ~half the price.**
- Free trial: 7 days (CLZ) vs 30 days (CC) + 5 free guest scans + ongoing free tier (10/mo).

**Critical reframe captured:** original talking point #2 said *"Collectors Chest is roughly half the price of CLZ"* — naively wrong because CLZ Mobile alone is $1.99 (cheaper than us). The brief catches this and reframes to "what it costs to ACTUALLY use it" (catalog + pricing). A savvy collector who only hears "we're cheaper" will check $1.99 vs $4.99 and walk. Brief gives Aponte the right delivery so the line lands.

**Authored:** `docs/CLZ_COMPARISON_BRIEF.md` — TL;DR pitch, verified pricing tables, refined 5 talking points with floor-pitch delivery cues + pitfall warnings, full feature-set comparison (where CC wins / where CLZ wins / both have / strategic gap-closers / what NOT to compete on), 6 common objections with responses, pocket cheat-sheet, **data partnership talking points** (active CovrPrice conversations on pricing API + key issue details, GoCollect API discontinuation context, Marvel API deprecation context, resilience pitch, safe-to-say / don't-say guardrails), source footnotes.

**Built:** `/admin/clz-comparison` — admin-only React page rendering the brief as a tablet-friendly "slide" Aponte can pull up during convention conversations:
- Hero card (yellow framed, 30-second pitch)
- Pricing apples-to-apples cards (red CLZ vs green CC, totals stacked)
- 5 color-coded talking-point cards with floor-pitch quotes + red "Avoid" warning on the cost reframe
- Trophy-icon "Where CC Wins" table (11 rows, check/x icons)
- Shield-icon "Where CLZ Wins" table (9 rows, honest acknowledgment + gap-closing notes)
- Both Have grid (9 ties)
- **Data Partnerships section** — indigo "active conversations" card (CovrPrice API + key data), amber "industry consolidation" card (GoCollect + Marvel APIs), black-bordered resilience pitch, safe-to-say / don't-say cards
- Expandable common-objections cards
- Printable pocket cheat-sheet (comic-style border)

Linked into admin nav as "vs CLZ" tab in `src/app/admin/layout.tsx` (Sparkles icon).

**Decision logged:** declined offer of CLZ login credentials. Used only public CLZ marketing pages, manual, and App Store listing — clean from a ToS perspective.

**Files created:**
- `docs/CLZ_COMPARISON_BRIEF.md`
- `src/app/admin/clz-comparison/page.tsx`

**Files modified:**
- `src/app/admin/layout.tsx` (added "vs CLZ" nav entry)

#### 6. Clerk Username Rules Dashboard ⚙️

User updated Clerk dashboard during session: min length 4, max 20, "Allow extended characters" disabled. **Discovery:** Clerk's "Username requirements" panel only exposes length + extended-chars toggle — doesn't let you restrict the *base* allowlist (`A-Z`, `-`, `.` still allowed despite Supabase rejecting them).

**Mitigation already in place** (Session 43): webhook sanitizer rejects invalid chars before Supabase upsert; sync-on-write path pushes CC usernames back to Clerk. The residual gap is now a UX papercut (user picks `John-Doe.123` at Clerk, gets `johndoe123` in CC profile silently). Acceptable for Beta.

**BACKLOG entry updated** to "Partially closed" status with the residual decision (custom signup validator vs accept the webhook-sanitizer floor).

### Tests

Per-feature reasoning for skipping unit tests:
- **Second Chance RLS fix:** 1-line client-config swap with no logic change. Matches Session 43 trade_matches IDOR precedent. 2 manual TEST_CASES.md cases added (one for the listing-modal render, one for validating the Apr 27 PROD offer state).
- **Key Hunt key-info chips:** pure JSX wiring + integration of an existing helper (`lookupKeyInfo`). Helper already has full test coverage in `keyComicsDatabase.test.ts`. 4 manual TEST_CASES.md cases added.
- **CoverLightbox:** pure presentation component, no business logic. 4 manual TEST_CASES.md cases added (open/close paths, iPhone safe-area, no-cover disabled state).
- **CLZ admin page:** pure presentation, no business logic.
- **Curated DB expansion:** content addition; existing `keyComicsDatabase.ts` test suite still passes.

**773/773 tests pass across 50 suites** (unchanged from Session 43 baseline).

### Files Modified / Created

**Created:**
- `src/components/CoverLightbox.tsx` (lightbox component)
- `src/app/admin/clz-comparison/page.tsx` (admin tablet "slide" page)
- `docs/CLZ_COMPARISON_BRIEF.md` (partner sales brief)

**Modified:**
- `src/lib/auctionDb.ts` — Second Chance RLS fix (1 line + comment)
- `src/components/KeyHuntPriceResult.tsx` — keyInfo prop, KEY ISSUE chips, lightbox wiring
- `src/app/key-hunt/page.tsx` — keyInfo prop pass
- `src/app/api/con-mode-lookup/route.ts` — `lookupKeyInfo` integration at 3 result paths
- `src/lib/keyComicsDatabase.ts` — three-round expansion, +726 entries
- `src/app/admin/layout.tsx` — "vs CLZ" nav entry
- `BACKLOG.md`, `EVALUATION.md`, `ARCHITECTURE.md`, `TEST_CASES.md`, `TESTING_RESULTS.md`, `docs/TECHNICAL_FEATURES.md` — close-up-shop documentation pass

### Migrations Applied to Supabase Before Deploy

None — pure code changes this session.

### Quality Checks (pre-deploy May 5)

- TypeScript: 0 errors
- ESLint: 0 errors / 114 warnings (all pre-existing `no-explicit-any`)
- Tests: 773/773 passing across 50 suites
- npm audit: 7 vulnerabilities (3 moderate, 4 high) — all pre-existing, dependency-tree, non-blocking
- Production build: clean
- Circular deps: none
- Dead code (knip): pre-existing unused exports (offlineCache history aliases, email type re-exports) — not session-introduced

### Issues Encountered

- **Clerk dashboard UI limitation** — discovered mid-session that Clerk's "Username requirements" panel only exposes length + extended-chars toggle, not full allowlist regex. Original BACKLOG entry assumed dashboard could fully match Supabase. Updated entry, captured residual decision.
- **Year-convention footgun in curated DB** — first Round 1 batch used issue-publication years which caused resolver ambiguity with existing series-start-year entries. Caught via post-batch audit; wrote a normalization script. Added a comment to the `KEY_COMICS` array header so future contributors don't repeat the mistake.
- **Pre-existing duplicate title spellings** — `Marvel Super Heroes Secret Wars` vs `Marvel Super-Heroes Secret Wars` (with/without dash) both exist in original DB. Title normalization at lookup time merges them, but raw entries should eventually be unified for hygiene. Captured in BACKLOG cleanup follow-up note.

### BACKLOG follow-ups
- 3 entries removed (completed): Key Hunt missing key info, Second Chance button bug, Tap-to-Enlarge cover lightbox.
- 3 entries updated to reflect partial completion: Align Clerk Username Rules (Low priority now, dashboard portion done), Expand Curated Key Info DB (404→1,130 done; scan-data-driven phase pending), CLZ Talking Points (escalated Medium for partner meeting, brief drafted, admin page built).
- No new BACKLOG entries added this session beyond what was surfaced earlier in the day (CLZ talking points entry was added at session start during weekend feedback intake).

### Memory updates this session
- None this session — patterns captured were already in memory from Sessions 38-43 (RLS-bypass scoping, dev-server mobile testing constraints).

### Where We Left Off
Deployed to PROD May 5, 2026 evening (commit `c8f8f68` pushed to main → Netlify auto-build triggered). Awaiting:
- PROD verification of Second Chance fix on Giant-Size X-Men #1 listing (offer button should be replaced with "didn't respond in 48 hours" copy)
- PROD verification of Key Hunt KEY ISSUE chips on Daredevil #181 + a few canonical keys
- Aponte review of `/admin/clz-comparison` tablet page tomorrow + brief tweaks before public-facing `/compare/clz` page
- Testing of cover lightbox on real iPhone (not LAN-IP dev — Clerk constraint)

### Changes Since Last Deploy
*(empty — Session 44 deployed May 5, 2026.)*

---

## Apr 28, 2026 (Tuesday) - Session 43: Yesterday's Round-3 Follow-ups + Trade IDOR + Comp Premium + My Collection Filter Refactor (Deployed May 1, 2026)

> **Note on dates:** Code work in this entry began Apr 28, 2026. Deploy to production happened May 1, 2026. Several deep-dive review notes from session 42d's Round 3 carry forward into this session.

### Summary
Five-bucket session, all bundled into a single May 1 deploy:
1. Yesterday's screenshot follow-ups — Round-3 deep-dive notes from session 42d (notifications inbox) cleared in one bundle: payment-deadline anchor in `processEndedAuctions`, rate-limit on `GET /api/notifications/:id`, and sign-out cache-clear race tightening on the inbox.
2. **NEW IDOR uncovered during the broader RLS-bypass audit** — `/api/trades/matches/[matchId]` PATCH route + `tradingDb` helpers (`dismissMatch`, `markMatchViewed`, `markMatchTraded`) used `supabaseAdmin` with `.eq("id", matchId)` only — no user scoping on the `trade_matches` table. Same shape as the notifications IDOR closed in 42d. Patched.
3. **Comp Premium for 3 co-founder accounts** — new `subscription_source` column ('stripe' | 'comped' | 'trial') added to `profiles`. The 3 admin Clerk IDs comped to permanent Premium with `source='comped'`, `stripe_customer_id` left NULL so Stripe webhooks never match these rows.
4. **My Collection filter UX refactor — Phase 1 (desktop)** — collapsed redundant List Selector Tabs row, moved CSV to page actions row, "Viewing:" label on list dropdown with counts, dropped "ALL " prefix. Surfaced and fixed two cloud-user list-tagging bugs (sentinel string `"collection"` vs UUID; `isDefault` flag too broad for "show all" detection).
5. **My Collection filter UX refactor — Phase 2 (mobile)** — bottom-sheet drawer for filters + active-filter chips bar with one-tap removal. `md:hidden` / `hidden md:flex` Tailwind toggles; desktop unchanged from Phase 1.

### Features Shipped

#### 1. Payment Deadline Anchor — `processEndedAuctions` 🛡️
Promise to users in emails / Terms / FAQs is "payment due 48 hours from auction close." But `processEndedAuctions` was calling `calculatePaymentDeadline()` with no arg → defaulted to `now()` at cron time. With a slow cron (~3h42m drift observed Apr 24, 2026 PROD test), the marketed window stretched to 51.5h.

Audited the 4 sibling call sites at user direction (Buy Now, offer accept, counter-offer accept, second-chance accept). All four correctly anchor to `new Date()` because those *are* the moment the transaction starts (purchase clicked / offer accepted) — no fix needed. Only the cron path was wrong.

One-line fix in `src/lib/auctionDb.ts:2388`:
```ts
const paymentDeadline = calculatePaymentDeadline(new Date(auction.end_time));
```

#### 2. trade_matches IDOR — closed (NEW find) 🔒
Broader RLS-bypass audit (kicked off as a hygiene scan after the session 42d notifications IDOR) surfaced this:

`src/lib/tradingDb.ts` had three helpers — `dismissMatch`, `markMatchViewed`, `markMatchTraded` — all using `supabaseAdmin` (bypasses RLS) with `.eq("id", matchId)` and **no user predicate**. The `trade_matches` table has `user_a_id` and `user_b_id` ownership columns, so any authenticated user could dismiss or mark-viewed any match by guessing UUIDs. `markMatchTraded` is currently unused in the codebase but carried the same defect.

Fix:
- Helper signatures now require `userId: string`
- Predicate adds `.or("user_a_id.eq.${userId},user_b_id.eq.${userId}")` (matches the existing safe pattern in `getUserMatches` at line 497)
- Helpers return `Promise<boolean>` (was a row affected)
- Route at `src/app/api/trades/matches/[matchId]/route.ts` passes `profile.id` and 404s on `false` (never 403 — no existence leak)
- `markMatchTraded` defensively patched even though it has no callsites

Audit confirmed no other unscoped `supabaseAdmin` mutations exist on user-owned tables. The cross-cutting lesson is now documented in `ARCHITECTURE.md` under "Service-Role Write Scoping" as a defensive pattern reference for future helpers.

#### 3. Rate-Limit GET `/api/notifications/:id` 🚦
30/minute Upstash sliding-window rate limit keyed on Clerk `userId`, using the existing `rateLimiters.api` bucket. Defense against Capacitor push deep-link tap landing on a stale notification id and retry-storming the 404 path once iOS native ships.

#### 4. Sign-Out Cache-Clear Race Tightening 🛡️
Round 3 minor note from session 42d: `NotificationsInbox`'s initial-load effect captured the cacheKey via closure at fetch start. If the user signed out / switched accounts mid-fetch, the old closure could write user A's payload into the (now-stale or now-different) cache slot. Existing `cancelled` flag handled the common case but not exotic microtask ordering edges.

Fix: capture `cacheKey` into `startKey` at effect start, mirror live `cacheKey` into a `currentCacheKeyRef` via a separate effect, and re-check `currentCacheKeyRef.current === startKey` before writing to localStorage. Belt-and-suspenders; defense-in-depth on shared-device fast account switching.

#### 5. Comp Premium for 3 Co-Founder Accounts 🎁
New column on `profiles`: `subscription_source TEXT DEFAULT 'stripe' CHECK (subscription_source IN ('stripe', 'comped', 'trial'))`.

Schema migration `20260428_add_subscription_source.sql`:
- Adds the column + CHECK constraint + index
- Backfills existing rows: `trial_started_at IS NOT NULL` → 'trial'; `stripe_subscription_id IS NOT NULL` → 'stripe'; everyone else stays at default

Comp UPDATE `20260428_comp_cofounder_premium.sql` flips the 3 admin Clerk accounts to `tier='premium' / status='active' / source='comped'`, leaves `stripe_customer_id` NULL so the Stripe webhook handlers (which look up rows via `getProfileByStripeCustomerId`) never match these rows and can't accidentally downgrade them. Trial timestamps cleared to preserve their legitimate-trial eligibility if they ever leave comp.

User verified Premium features unlocked in production after the migrations applied.

#### 6. My Collection Filter Refactor — Phase 1 (Desktop) 📐
Collapsed the heavy filter card from 3 stacked rows + a separate List Selector Tabs row into 3 tight rows in one card. Layout now:
- **Row 1:** Search + view-mode toggle + Select button (desktop only; mobile gets Select on row 2)
- **Row 2:** "Viewing: [List ▼]" with item counts in the dropdown labels
- **Row 3:** Inline filter chips (Starred, For Trade, Publisher, Title, Grader) + Sort + Clear

Other small wins:
- "ALL" prefix dropped from filter labels ("Publishers", not "ALL PUBLISHERS")
- CSV Export button moved out of the filter card and into the page-level actions row alongside Stats / Sales / Share — it's an action, not a filter
- List Selector Tabs row deleted (the dropdown supersedes it and scales naturally to N user-created lists)

**Bug fixes surfaced during user testing of Phase 1:**

- *Bug A:* My Collection list count showed `(0)` for cloud-synced users with N items in the collection. Root cause: `list.id === "collection"` (the localStorage default sentinel) never matched a UUID-id from Supabase, so the count fell through to `item.listIds.includes(uuid)` which returned 0 (items in the default list don't tag themselves with the parent list's UUID).
- *Bug B:* Switching from a non-primary list back to "My Collection" rendered an empty grid. Same root cause — `selectedList !== "collection"` was true (selectedList = UUID) so the filter logic tried to match by that UUID and found nothing.
- *Bug C (introduced by my first fix):* I broadened the detector to `list.isDefault === true`. But ALL auto-seeded lists (Want List, For Sale, Slabbed, Passed-on) carry `isDefault: true` — that flag means "system-seeded, not user-created," not "primary union view." So the count display showed `(N)` for every default list and switching to Want List rendered all comics.

**Final fix:** introduce `isPrimaryList()` helper that returns `true` only for the literal primary list, identified by id-sentinel `"collection"` (guests) OR `name === "My Collection"` (cloud). Other auto-seeded lists fall through to the standard `item.listIds.includes(listId)` member-tag path. The `"collection"` string sentinel survives in setters (initial state, Clear-filters, View-All-Comics fallback) for guest backward compat — the helper accepts both shapes.

#### 7. My Collection Filter Refactor — Phase 2 (Mobile) 📱
Mobile-only additions; desktop layout from Phase 1 unchanged via `md:hidden` / `hidden md:flex` Tailwind prefixes.

- **Trigger row** replaces the inline filter chips on mobile: `[🎚 Filters (N)]                Sort: [Date Added ▼]`. The `(N)` badge appears only when filters are active.
- **Bottom-sheet drawer** opens on tap. Sticky header with `Filters (N)` + close ×. Body has `[★ Starred] [⇄ For Trade]` (split row) then Publisher / Title / Grader dropdowns. Sticky footer with `[Clear All]` (disabled when no filters) + `[Show N Comics]` (live count, blue, dismisses drawer).
- **Active-filter chips bar** renders below the filter card (mobile-only) when any filter is active. Each chip shows its value (e.g. "Marvel ×") and tapping the × clears that one filter without reopening the drawer.
- **Sort lives OUTSIDE the drawer** in the trigger row because users change sort more often than filters.

The drawer is rendered inline in `page.tsx` rather than extracted to a component. With ~12 pieces of state to thread through, the extraction overhead would have been larger than the JSX itself.

Verified locally on Mac Chrome (Phase 1) and via DevTools mobile emulator (Phase 2). True mobile-device verification deferred until prod deploy because Clerk's `<SignIn />` widget silently fails on dev's `http://10.0.0.34:3000` LAN IP — the IP isn't whitelisted as an authorized origin in the Clerk dashboard. (Documented in `DEV_LOG.md:746` from session 36 + new memory file.)

### Tests

No new automated tests added this session. Reasoning per change:
- Payment deadline: pure helper (`calculatePaymentDeadline`) is already tested in `auction.test.ts:225-247`; the fix was a call-site config change. Adding a `processEndedAuctions` integration test would require mocking the entire Supabase chain — disproportionate for a single-line fix.
- trade_matches IDOR: helpers correctness is best validated end-to-end (curl test against the route), captured as manual cases in `TEST_CASES.md`.
- Rate-limit: relies on Upstash; integration validation lives at the deployment level.
- Sign-out race: timing-sensitive; not unit-testable cleanly.
- Filter refactor: pure JSX/CSS reorg; correctness validated by inspection + DevTools emulator.

**773/773 tests pass across 50 suites** (unchanged from session 42d).

### Files Modified / Created

**New:**
- `supabase/migrations/20260428_add_subscription_source.sql`
- `supabase/migrations/20260428_comp_cofounder_premium.sql`
- `~/.claude/projects/-Users-chrispatton-Coding-for-Dummies-Comic-Tracker/memory/feedback_clerk_mobile_dev.md` *(memory file — saves the LAN-IP Clerk widget issue so future sessions don't re-debug)*

**Modified:**
- `src/lib/auctionDb.ts` — payment deadline anchor in `processEndedAuctions` (1 line)
- `src/lib/tradingDb.ts` — `dismissMatch` / `markMatchViewed` / `markMatchTraded` now require `userId`, add `.or()` ownership predicate, return `Promise<boolean>`
- `src/app/api/trades/matches/[matchId]/route.ts` — passes `profile.id`, 404s on owner mismatch
- `src/app/api/notifications/[id]/route.ts` — added Upstash rate-limit on GET
- `src/components/notifications/NotificationsInbox.tsx` — `currentCacheKeyRef` + `startKey` mid-flight check
- `src/app/collection/page.tsx` — Phase 1 + Phase 2 of filter refactor (~340 net line increase)
- `BACKLOG.md`, `EVALUATION.md`, `ARCHITECTURE.md`, `TEST_CASES.md` — close-up-shop documentation pass
- `TESTING_RESULTS.md` — session 43 testing context entry

### Migrations Applied to Supabase Before Deploy
1. `20260428_add_subscription_source.sql` — applied Apr 28, 2026
2. `20260428_comp_cofounder_premium.sql` — applied Apr 28, 2026

### Quality Checks (pre-deploy May 1)
- TypeScript: 0 errors
- ESLint: clean (warnings unchanged from session 42d)
- Tests: 773/773 passing across 50 suites
- Production build: succeeds clean

### Commits
- `0253cc0` — fix(security+marketplace): payment deadline + trade IDOR + inbox hardening
- `7e8ed62` — refactor(collection): Phase 1 filter UX + cloud-user list-tagging bug fixes
- `377d745` — chore(db): subscription_source column + comp Premium for co-founders
- `c51656a` — feat(collection): Phase 2 mobile filter drawer + active chips

### Issues Encountered
- **Clerk widget fails to mount on dev LAN IP** — re-discovery of the issue documented in DEV_LOG.md:746 (session 36, Apr 21). User correctly recalled we'd hit this before. Saved to memory as `feedback_clerk_mobile_dev.md` so future sessions short-circuit to the right testing path (DevTools mobile emulator, prod, or ngrok) instead of re-running this debugging arc.
- **`next dev --experimental-https` fell back to HTTP** — `mkcert -install` requires interactive sudo which `npm run` can't pass through. Reverted my exploratory `dev:https` script addition; the right paths for real-mobile dev testing are documented in the memory file.

### BACKLOG follow-ups
- Three Round-3 minor items from session 42d closed this session (payment deadline, rate-limit, IDOR hygiene scan). The fourth (sign-out race) closed too.
- One new defensive item NOT added per project memory rule (completed items get DEV_LOG entry, not BACKLOG entry): the trade_matches IDOR closure record lives here.

### Memory updates this session
- New: `feedback_clerk_mobile_dev.md` — Clerk widget fails on LAN IP; route mobile testing through prod/DevTools/ngrok, not `http://10.0.0.34:3000`.

### Where We Left Off
Deployed May 1, 2026. Awaiting:
- Validation of the in-flight Apr 27 Second Chance offer expiry path (cron should have flipped the `pattonrt` offer to `expired` around Apr 29; cancellation-email mutex from session 42 should have prevented contradictory emails).
- Manual TEST_CASES.md execution on the new entries (trade_matches IDOR, Phase 1 desktop, Phase 2 mobile — 23 cases pending).
- Any user-reported issues from production after the May 1 deploy.

### Changes Since Last Deploy
*(empty — Session 43 deployed May 1, 2026. All four commits above shipped together.)*

---

## Apr 27, 2026 (Monday) - Session 42d: Notifications Inbox v1 + Truck Icon + IDOR Hotfix (Pending Deploy)

### Summary
User flagged that mobile bell-dropdown notifications truncate mid-sentence with no recourse. Decision: build a full `/notifications` inbox under the More submenu, with auto-cleanup (read → 30d, unread → 90d). Surfaced two adjacent issues during the build: a pre-existing IDOR in `markNotificationRead` (any auth'd user could mark anyone else's notification read), and a lingering "shipped" notification using the `ended` type → wrong icon. Bundled all three into one deploy.

### Three rounds of deep-dive review before code
- **Round 1** found 3 Critical / 8 High / 9 Medium / 6 Low → NO-PASS. Biggest premise bug: plan assumed "every minute" cron based on `vercel.json`, but production runs `*/5 * * * *` on Netlify (`netlify/functions/process-auctions.ts`). Other critical: Capacitor push deep-link contract was undefined.
- **Round 2** found 1 Critical / 2 High / 3 Medium → NEAR-PASS. Surfaced the pre-existing IDOR + cross-user IndexedDB leak risk + cursor SQL idiom mismatch.
- **Round 3** PASSED with 2 minor follow-up notes (audit other `supabaseAdmin.from("notifications").update()` callsites; rate-limit new `GET /api/notifications/:id`). Both captured for post-launch BACKLOG.
- All three rounds logged to `docs/superpowers/deep-dive-learnings.md`.

### Features Shipped

#### 1. Pre-existing IDOR hotfix in `markNotificationRead` 🔒
`src/lib/auctionDb.ts:2030` previously updated by id only (`supabaseAdmin` bypasses RLS, so the update succeeded for any caller). Any auth'd user could mark anyone else's notifications read by guessing UUIDs.
- New signature: `markNotificationRead(notificationId, userId)`. Body adds `.eq("user_id", userId)` so the UPDATE is owner-scoped.
- `markAllNotificationsRead(userId, asOf?)` already scoped to user_id, but now also clamps to `created_at <= asOf` (race-free clearing) + `read_at IS NULL` (idempotent re-runs).
- PATCH route updated to pass `profile.id`.

#### 2. Shipped notification → Truck icon 🚚
`src/app/api/auctions/[id]/mark-shipped/route.ts` was creating notifications with `type: "ended"` and overriding the title — making the bell render a Clock icon for "Your comic has shipped!" Now uses a dedicated `"shipped"` type:
- New migration `20260427_add_shipped_notification_type.sql` extends the `valid_notification_type` CHECK constraint.
- `NotificationType` union in `src/types/auction.ts` adds `"shipped"`.
- `auctionDb.ts` notification title/message defaults extended.
- `NotificationBell.tsx` icon map adds `case "shipped": return <Truck className="w-4 h-4 text-blue-500" />`.

#### 3. Notifications Inbox v1 📥
**Schema** — new migration `20260427_notifications_inbox.sql`:
- Adds `read_at TIMESTAMPTZ NULL` (drives the 30-day prune)
- Backfill: `UPDATE … SET read_at = created_at WHERE is_read = true AND read_at IS NULL` (online-safe at current scale)
- `idx_notifications_user_created (user_id, created_at DESC)` covers the cursor-pagination hot path
- `idx_notifications_cleanup (read_at) WHERE read_at IS NOT NULL` keeps the prune query bounded
- New RLS DELETE policy `notifications_delete_policy USING (user_id = current_profile_id())` — defense-in-depth (the API uses `supabaseAdmin` so it bypasses RLS, but the policy stops anyone who refactors to the anon client)

**Backend** — `src/lib/auctionDb.ts`:
- `getUserNotificationsPaginated(userId, cursor, limit)` with composite cursor `(created_at, id)` ordered DESC. Cursor predicate via PostgREST `.or("created_at.lt.X,and(created_at.eq.X,id.lt.Y)")` — single `.lt()` would lose rows on batch inserts that share `now()` to the microsecond.
- `getNotificationByIdForUser(id, userId)` for `?focus=<id>` 404 handling
- `deleteNotificationForUser(id, userId)` — atomic owner-scoped delete
- `pruneOldNotifications()` — hard-deletes read >30d AND unread >90d, returns `{deletedRead, deletedUnread}` counts for cron logging
- `markNotificationRead` + `markAllNotificationsRead` now write `read_at = NOW()`

**API** — `src/app/api/notifications/`:
- GET extended with `?cursor=<base64>&limit=N` (capped at 100). Legacy bell shape preserved when neither param is supplied.
- New `[id]/route.ts` with GET (404 on owner mismatch — never 403, never leak existence) and DELETE (suspension check, `NON_DELETABLE_TYPES` server-side block on payment-miss + payment-expired notifications, 204 on success)

**Cron** — `src/app/api/cron/process-auctions/route.ts`:
- `pruneOldNotifications()` appended to pipeline, runs every 5 min via Netlify scheduled function. Logs deletion counts via `console.log("[prune] notifications: ...")`.
- Vestigial `vercel.json` deleted (stated `"* * * * *"` but production runs from Netlify; reading `vercel.json` was misleading future devs about cron cadence).

**Helpers** — two new pure modules:
- `src/lib/notificationLinks.ts` — `getNotificationDeepLink()` (universal: `/shop?listing=<id>` for auction-targeted, `/notifications?focus=<id>` for system-only — Capacitor push handler will use this contract), `isNotificationClickableInBell()`, `NON_DELETABLE_NOTIFICATION_TYPES` set + `isNonDeletableNotification()`.
- `src/lib/notificationCursor.ts` — base64 encode/decode of `(createdAt, id)` cursor + `buildCursorFilter()` PostgREST `.or()` builder + `NOTIFICATIONS_PAGE_LIMIT_DEFAULT/MAX`.
- `src/lib/notificationsCache.ts` — localStorage-backed inbox cache, profile-namespaced (`cc_notifications_inbox_<profileId>`), version-tagged (CACHE_VERSION = 1), cleared on sign-out via `useEffect` watching Clerk `userId`.

**Frontend** — `src/app/notifications/page.tsx` + `src/components/notifications/NotificationsInbox.tsx`:
- Server component shell, Clerk-gated (redirects guests to `/sign-in?redirect=/notifications`)
- Inbox component:
  - Reads `?focus=<id>` on mount → if row exists in current page, scroll into view + flash-highlight (1500ms ring); if not in page, fetch directly via `GET /api/notifications/:id`; if 404, toast "Notification not found — it may have been cleared" and `router.replace` to clear `?focus` from URL
  - Infinite scroll via Intersection Observer + cursor (page size 50)
  - Sticky "Mark all as read" only renders when `unreadCount > 0`
  - Per-row 44×44pt X dismiss button (hidden for `NON_DELETABLE_TYPES`); `e.stopPropagation()`; optimistic remove with rollback + toast on network failure
  - Tap-to-navigate preserves bell behavior; uses `getNotificationDeepLink`
  - Long messages clamped at 3 lines, min row height 88px (Lichtenstein border + bg-white card)
  - Empty state: "You're all caught up." with bell-with-zzz icon
  - "Last updated Xm ago — tap to refresh" pill (no custom PTR — defers to Capacitor `@capacitor/pull-to-refresh` post-launch to avoid iOS WKWebView bounce conflict)
  - Cache hydration banner when offline: "Showing cached notifications. Tap to refresh →"
  - Footer hint links to `/settings/notifications` for email preferences

**Bell updates** — `src/components/NotificationBell.tsx`:
- Reverses the "filter system-only" decision from the original plan after Round 1's "liar badge" feedback. Bell now shows ALL notifications. System-only types (`!auctionId`) render with `cursor-default opacity-70` + meta line "· View in inbox for details", non-clickable. Badge count = ALL unread (honest math).
- Click handler delegates to `getNotificationDeepLink` (single source of truth across bell + inbox + email + future Capacitor push).
- Footer adds "View all notifications →" link to `/notifications` next to "Close".

**Navigation** — `src/components/Navigation.tsx`:
- New "Inbox" entry as first item in `registeredSecondaryLinks` (signed-in More menu only — guests don't have notifications). Uses Bell icon to mirror the header.

### Tests Added (20 new)
- `src/lib/__tests__/notificationCursor.test.ts` — 11 tests: encode/decode roundtrip, URL-safety, malformed input tolerance (empty/non-string/garbage base64/missing separator/edge separator positions), `buildCursorFilter` PostgREST output, default + max page limit constants
- `src/lib/__tests__/notificationLinks.test.ts` — 9 tests: deep-link mapping for auction-targeted/rating_request/system-only fallback, clickability predicate, `NON_DELETABLE` membership matrix (payment-miss + payment-expiry vs normal lifecycle types)
- All 773 tests passing across 50 suites (was 753).

### Files Modified / Created
**New:**
- `supabase/migrations/20260427_add_shipped_notification_type.sql`
- `supabase/migrations/20260427_notifications_inbox.sql`
- `src/lib/notificationLinks.ts`
- `src/lib/notificationCursor.ts`
- `src/lib/notificationsCache.ts`
- `src/app/api/notifications/[id]/route.ts`
- `src/app/notifications/page.tsx`
- `src/components/notifications/NotificationsInbox.tsx`
- `src/lib/__tests__/notificationCursor.test.ts`
- `src/lib/__tests__/notificationLinks.test.ts`

**Modified:**
- `src/lib/auctionDb.ts` — IDOR fix + new helpers + transformNotificationRow extracted
- `src/types/auction.ts` — `"shipped"` NotificationType + `readAt` on Notification interface
- `src/app/api/notifications/route.ts` — cursor pagination, scoped helpers, asOf clamp
- `src/app/api/auctions/[id]/mark-shipped/route.ts` — uses `"shipped"` type
- `src/app/api/cron/process-auctions/route.ts` — prune appended + logs
- `src/components/NotificationBell.tsx` — Truck icon, dimmed system-only, footer link, uses shared deep-link helper
- `src/components/Navigation.tsx` — Inbox entry in More

**Deleted:**
- `vercel.json` (vestigial; production cron is Netlify scheduled function)

### Migrations to run in Supabase BEFORE deploy
1. `20260427_add_shipped_notification_type.sql`
2. `20260427_notifications_inbox.sql`

### Quality Checks
- TypeScript: 0 errors
- ESLint: 0 errors, 115 warnings (all pre-existing — none introduced this session)
- Tests: 773/773 passing across 50 suites
- Production build: succeeds clean

### BACKLOG follow-ups captured (post-launch, low priority)
1. Audit other `supabaseAdmin.from("notifications").update()` callsites for the same IDOR pattern (the helper-vs-route audit lesson from Round 2)
2. Rate-limit `GET /api/notifications/:id` — Capacitor retry storms on 404 could amplify cost
3. Sign-out cache-clear race tightening (use `useRef` + check current Clerk userId mid-flight)

### Sub-session 42d deploy
- Migrations `20260427_add_shipped_notification_type.sql` + `20260427_notifications_inbox.sql` applied in Supabase manually before push.
- Pushed to main at commit `c4467ce` → Netlify auto-deploy.

### Sub-session 42d-hotfix (deployed at `c5670fa`)
Three smoke-test issues surfaced immediately post-deploy:
1. **Inbox stuck on infinite Loading spinner** — `NotificationsInbox` was reading `profileId` from `user?.publicMetadata?.profileId` but Clerk's publicMetadata doesn't carry that field by default. Initial-load effect's `if (!profileId) return` meant `isLoading` never flipped. Switched cache namespace to `user.id` (always populated for signed-in users); effects now gate on `userLoaded && user`.
2. **Mobile bottom-nav More menu missing Inbox** — `MobileNav.tsx` has its own `registeredDrawerItems` separate from `Navigation.tsx`'s desktop array; I missed updating the mobile one. Added Bell import + Inbox entry.
3. **Bell dropdown cropped on mobile** — `absolute right-0 w-80 max-w-[calc(100vw-2rem)]` was extending off-screen left on narrow Android viewports. Switched to sheet-on-mobile pattern: `fixed left-2 right-2 top-16 sm:absolute sm:right-0 sm:left-auto sm:top-auto sm:mt-2 sm:w-80`. Mobile gets a viewport-pinned sheet, desktop keeps 320px right-anchored.

### Sub-session 42d-backfill (local commit `bc8416a`, SQL run manually in Supabase)
Truck icon didn't appear retroactively on the existing "Your comic has shipped!" notification — that row was created before the deploy with `type='ended'` (the old mark-shipped route overloaded the auction-ended type). Added one-off backfill migration `20260427_backfill_shipped_notification_type.sql` (idempotent): `UPDATE notifications SET type = 'shipped' WHERE type = 'ended' AND title = 'Your comic has shipped!'`. SQL run by user in Supabase SQL Editor; row flipped to Truck icon on refresh. Migration file committed locally (not pushed standalone — will ride out with next deploy).

### Close-up-shop documentation pass (Apr 27, end of day)
- **ARCHITECTURE.md** — added `/notifications` Pages & Features section, `/api/notifications/[id]` GET+DELETE row to Watchlist & Notifications API table, `/notifications(.*)` to middleware-protected routes, `pruneOldNotifications` to the cron pipeline description (now seven passes).
- **EVALUATION.md** — overall 9.3 → 9.4. Code Quality 9 → 9.2 (IDOR closed + 20 new unit tests). User Experience 7.5 → 8 (mobile inbox + bell sheet). Mobile 8.5 → 8.7 (mobile-first inbox, Capacitor-readiness). Feature Completeness 9.4 → 9.5 (Notifications Inbox v1).
- **COST_PROJECTIONS.md** — audit log entry for Apr 27 noting net positive impact: $0.75 fee floor closes the sub-$6 platform-loss zone. No new services, all on documented free tiers.
- **CLAUDE.md** — Services & Infrastructure table unchanged this session (no new services added).
- **TECHNICAL_FEATURES.md** — Feature #28 (Notifications Inbox) added at end of day (already in place).
- **BACKLOG.md** — added "⭐ Next Session Main Priority" callout at top: validate Second Chance offer flow live (in-flight 48h window started today); Payment Deadline anchor fix (display side fixed, value-side fix still pending); validate the 27 new manual TEST_CASES from the inbox work. Three new low-priority post-launch items added: Audit other supabaseAdmin notification writes, Rate-limit GET /api/notifications/:id, Per-Profile Timezone Preference.
- **TEST_CASES.md** — 27 new cases added during the inbox build for: inbox loads, infinite scroll, dismiss row + rollback, mark-all-read race, focus-on-mount + 404 fallback, NON_DELETABLE rejects DELETE, suspended-user 403, IDOR scoping, truck icon, offline cache, sign-out cache clear, Capacitor push tap deep-link (deferred), iOS safe-area, Android PWA PTR-disabled.

### Cleanup notes
- One `console.log` flipped to `console.warn` in the cron route's prune-output (consistency with other cron logging patterns at `[expireUnpaidAuctions] processed N`). No other cleanup needed — no TODOs, no dead code, no unused imports introduced this session.

### Changes Since Last Deploy
*(empty — Sub-session 42d-hotfix deployed at `c5670fa`. Local commits `39b5c0d` (DEV_LOG hotfix) + `bc8416a` (backfill migration file) + close-up-shop docs commit will ride out with the next deploy.)*

---

## Apr 27, 2026 (Monday) - Session 42: Second-Chance Flow End-to-End Fixes (Code Complete, Pending Deploy)

### Summary
First three feedback items from PROD test continuation surfaced a partially broken Second Chance flow on the Apr 24 auction (Giant-Size X-Men #1, $6 winner unpaid, $5 runner-up). All three were code-complete in one session and bundled for deploy.

### Bugs Surfaced
1. **Both seller emails fired simultaneously** — At payment-expiry, the seller (`patton716`) received BOTH "Buyer didn't pay: cancelled, relist ready" AND "Second Chance Available" emails (timestamp 10:20 AM ET). The two paths in `expireUnpaidAuctions` were unconditional: Phase 3 sent the cancellation email/notification to all sellers; Phase 4's `handleRunnerUpForExpiredAuction` then ALSO sent the second-chance email when a runner-up existed.
2. **No seller CTA to send the offer** — `SecondChanceOfferButton` component existed (`src/components/auction/SecondChanceOfferButton.tsx`) but was never imported anywhere. The "OFFER TO RUNNER-UP →" button in the email linked to `/shop?listing=<auctionId>`, which opened `AuctionDetailModal` — a modal that had no rendering branch for cancelled+seller. So neither the email nor the in-app path actually exposed a way to send the offer.
3. **Buyer's payment-deadline email displayed UTC without a timezone label** — Email said "Apr 26, 2:20 PM" (with no abbreviation). Actual expiry fired ~10:20 AM ET. The 4-hour gap was the timezone offset: 14:20 UTC = 10:20 AM EDT, and `paymentDeadline.toLocaleString("en-US", {dateStyle, timeStyle})` rendered server-local time (Netlify Lambdas → UTC) without a `timeZone` argument or `timeZoneName: "short"`. Users mis-read the unlabeled "2:20 PM" as ET.

### Fixes Shipped (code complete, deploy pending)

**Bug 1 — Mutex on Phase 3 seller cancellation email/notification** (`src/lib/auctionDb.ts`)
- New helper `shouldSuppressSellerCancellationEmail(auctionId)`: returns true iff a runner-up exists in `bids` AND no `second_chance_offers` row exists yet for the auction.
- New "Phase 1.5" in `expireUnpaidAuctions` builds a `Map<auctionId, suppress>` (parallel + best-effort). Phase 2 (notification batch) and Phase 3 (email batch) gate the seller cancellation insert/push on `!suppressMap.get(a.id)`.
- Critical case preserved per user request: if the runner-up accepts and then doesn't pay within their own 48h window, a `second_chance_offers` row exists, suppression returns false, and the cancellation email/notification fires correctly. Validated logically against all 4 second-chance offer states (no row / pending / accepted / declined / expired).
- Failure mode is "fail open" — if the suppression check itself errors, we default to sending the cancellation. A documented double-email is safer than silent loss.

**Bug 2 — Wire `SecondChanceOfferButton` into AuctionDetailModal**
- Extended `Auction` type (`src/types/auction.ts`) with three optional fields: `hasRunnerUp`, `runnerUpLastBid`, `secondChanceOfferStatus`.
- Added private `getAuctionSecondChanceState(auctionId)` helper in auctionDb.ts. `getAuction()` now populates the three fields when `status === "cancelled"` AND viewer is the seller (skips the round-trip for everyone else).
- `AuctionDetailModal` renders a new "Buyer Did Not Pay" section for cancelled+seller. Branches on `secondChanceOfferStatus`:
  - `null` + has runner-up → renders `SecondChanceOfferButton` (button → confirm modal → POST `/api/auctions/:id/second-chance`).
  - `null` + no runner-up → "No runner-up bid was placed. The comic is back in your collection and ready to be re-listed."
  - `"pending"` → "Second chance offer sent. The runner-up has 48 hours to accept or decline."
  - `"accepted"` → "The runner-up accepted your offer. Awaiting their payment."
  - `"declined"` / `"expired"` → "The comic is back in your collection and ready to be re-listed."
- `onOfferCreated` callback re-runs `loadAuction()` so the section flips to the "pending" copy without a hard reload.

**Bug 3 — Payment deadline rendered in ET with explicit timezone**
- New `formatDeadlineForEmail(date)` exported helper in `auctionDb.ts`. Uses `Intl.DateTimeFormat("en-US", {…, timeZone: "America/New_York", timeZoneName: "short"})`. Output: `"April 26, 2026 at 10:20 AM EDT"`. Handles DST flip automatically (`"EST"` in winter).
- Replaced 3 `toLocaleString` callsites: `auctionDb.ts:2197` (auction_won email), `auctionDb.ts:2907` (payment_reminder email), `auctionDb.ts:3678` (second_chance_offered runner-up email).
- Added 3 unit tests in `src/lib/__tests__/auctionDbHelpers.test.ts`: DST → "EDT", standard time → "EST", regression test for the unlabeled-UTC bug.
- BACKLOG entry added (Low / Post-Launch): per-profile timezone preference for when user base expands beyond US Eastern.

### Files Modified
- `src/lib/auctionDb.ts` — `formatDeadlineForEmail`, `shouldSuppressSellerCancellationEmail`, Phase 1.5 in `expireUnpaidAuctions`, gate in Phase 2 + Phase 3, `getAuctionSecondChanceState`, populate fields in `getAuction`, 3 deadline render-site swaps.
- `src/types/auction.ts` — `hasRunnerUp` / `runnerUpLastBid` / `secondChanceOfferStatus` on `Auction`.
- `src/components/auction/AuctionDetailModal.tsx` — import `SecondChanceOfferButton`; new "Buyer Did Not Pay" section.
- `src/lib/__tests__/auctionDbHelpers.test.ts` — new test file (3 tests for `formatDeadlineForEmail`).
- `BACKLOG.md` — yesterday's "Payment Deadline Anchored to Cron Run Time" item updated with Apr 27 context (display side fixed, anchor still open). New "Per-Profile Timezone Preference" item.

### Open BACKLOG Item Touched
- "Payment Deadline Anchored to Cron Run Time" — added Apr 27 context noting the display side is now fixed; the deadline anchor fix is still pending. Priority unchanged (Medium / Pre-Launch).

### Quality Checks
- TypeScript: clean (0 errors)
- ESLint: 0 errors, 115 warnings (all pre-existing)
- Tests: 748/748 passing across 48 suites (was 745/745 — added 3 new tests)
- No build run yet — will run as part of Deploy command.

### Pending User Actions
1. Confirm understanding + approve deploy.
2. After deploy: open `/shop?listing=<auctionId>` for the Apr 24 Giant-Size X-Men #1 auction (now status=cancelled with runner-up `pattonrt` at $5). Send the second-chance offer to validate the live flow with partner present.

### Deploy
- Pushed to main at commit `42f2caa` → Netlify auto-deploy.

### Continued (Apr 27, post-deploy)

**Sub-session 42b — UX polish + fee documentation pass (deployed at `f0330f3`):**
- SecondChanceOffer confirm dialog: "Send Offer" button moved from blue to green so the affirmative action reads clearer next to the gray Cancel. Initial CTA stays blue. (commit `f698f32`)
- User asked whether FAQs explain the 5%/8% mechanics. Audit found the pricing FAQ had a single one-liner (no snapshot, no Stripe-fee clarification), the Navigation "Ask the Professor" FAQ had no entry on seller fees, and Terms 4.5 said "Stripe fees are separate and in addition" — sellers would naturally read that as "I pay Stripe on top of your fee," contradicting our destination-charge implementation. Pricing FAQ expanded, new Navigation FAQ added ("What does it cost me to sell on Collectors Chest?"), Terms 4.5 rewritten to state explicitly that Stripe fees are absorbed by the Company. `docs/TECHNICAL_FEATURES.md` Feature #11 expanded with full snapshot mechanics (file:line refs), worked numeric examples at 5% and 8%, and the small-ticket caveat that surfaced the fee-floor decision. (commit `f0330f3`)

**Sub-session 42c — $0.75 minimum platform fee floor (pending deploy):**
- User flagged that the Apr 26 $2 PROD test transaction was unprofitable (8% × $2 = $0.16 fee vs Stripe's $0.36 cost = −$0.20 platform net). Break-even analysis: free tier (8%) breaks even at $5.88; premium (5%) at $14.29. Below those numbers, every sale loses money.
- Implemented Option A (industry standard, used by eBay/Mercari/Discogs): `MIN_PLATFORM_FEE_CENTS = 75` exported const in `src/lib/stripeConnect.ts`. `calculateDestinationAmount` now does `Math.max(percentFee, MIN_PLATFORM_FEE_CENTS)`, capped at `totalCents` so the seller payout can never go negative.
- Floor is invisible above $9.38 (8%) / $15.00 (5%) — 95%+ of typical comic sales unaffected.
- User direction: "I'm okay with the site not being loaded with dollar bin books" — i.e., the friction added on sub-$10 sales is acceptable as a soft signal toward higher-value listings.
- Existing 22 `stripeConnect` tests refreshed (1 expectation flipped: $5 sale at 8% now yields $0.75 floor instead of $0.40 percent-fee). 5 new tests covering: floor application at 8%, floor application at 5%, percent-fee at 8% break-even, percent-fee at 5% break-even, never-negative-payout cap (sub-floor sales).
- FAQ + Terms 4.5 + TECHNICAL_FEATURES.md Feature #11 all updated to mention the $0.75 minimum and explain when it kicks in.

### Sub-session 42c deploy
- Pushed to main at commit `1adca18` → Netlify auto-deploy.

### Changes Since Last Deploy
*(empty — Sub-session 42c deployed at `1adca18`)*

---

## Apr 24, 2026 (Friday) - Session 41: PROD Auction Close Validation + Documentation Audit Pass

### Summary
First-ever real-money PROD auction close test. Giant-Size X-Men #1 ended ~10:38 a.m. ET; collector-patton was the winner at $6.00. Surfaced one real bug, did a focused documentation audit of `docs/TECHNICAL_FEATURES.md`, and decided to let the 48h payment window expire naturally to validate the Second Chance Offer flow with the user's partner present (no manual fast-forwarding). No code shipped — docs-only session.

### Validated in PROD
- **Auction-won email** delivered to collector-patton on close. Subject: "Congratulations, you won Giant-Size X-Men #1!". Comic-themed Collectors Chest header, clear "Final price: $6.00", and the "Complete payment by ..." CTA rendered in a distinct (red/orange) color. User feedback: liked the visual standout on the deadline copy. ✅
- **Winner notification** logged on close. ✅

### Bug Surfaced
**Payment deadline anchored to cron run time instead of `auction.end_time`.** The won email displayed deadline of **April 26, 2:20 PM** — ~51.5 hours after the auction's actual end_time, not the advertised 48 hours. Root cause traced: `processEndedAuctions` at `src/lib/auctionDb.ts:2138` calls `calculatePaymentDeadline()` with no argument, which defaults to `new Date()` (cron run time). Auction ended at 10:38 a.m. but cron didn't process it until ~2:20 p.m. (~3h42m gap). Fix is one-line: pass `new Date(auction.end_time)`. Other 4 call sites (Buy Now / offer accepted / second-chance accepted) correctly anchor to `new Date()` — those are the moment the transaction starts, not a scheduled end. Captured as **BACKLOG → Medium (Pre-Launch)** with the fix sketch + audit-other-call-sites checklist + cron-lag note. User direction: "5 to 10 min cron lag is acceptable" — fix above makes deadline robust to any lag.

### Documentation Audit Pass
- **Mental-model correction:** ARCHITECTURE.md is the system overview (route table, cron pipeline, flow diagrams, DB tables, audit events, components); `docs/TECHNICAL_FEATURES.md` is the per-feature deep-dive. Feature specs (full schema fields, state transitions, idempotency rules, race-safety notes) belong in TECHNICAL_FEATURES.md. Memory entry added (`feedback_doc_layering.md`) so this distinction sticks.
- **Feature #22 (Second Chance Offer) tightened in TECHNICAL_FEATURES.md** — closed 6 gaps: schema columns enumerated (with explicit callout that the column is `runner_up_profile_id`, not `recipient_profile_id`); notification-type count corrected from "7" to **5** (verified against `src/types/auction.ts:39-43`); runner-up selection rule documented (ordering by `bid_amount DESC, created_at ASC`, ties broken by earliest `created_at`, single-bidder guard); idempotency guard in `handleRunnerUpForExpiredAuction` documented; auction-row state transitions on accept enumerated (status='ended', winner_id=runnerUp, winning_bid=offer_price, payment_status='pending', payment_deadline=NOW()+48h, payment_expired_at=NULL) including the non-transactional caveat; post-accept downstream behavior (mark-shipped + feedback eligibility identical to a normal win).
- **Whole-doc audit of TECHNICAL_FEATURES.md** (27 features total, 391 lines) found one 🔴 correctness drift in **Feature #20 — Email System**: doc said preference columns were `profiles.notify_marketplace`/`notify_social`/`notify_marketing`, actual columns are `profiles.email_pref_marketplace`/`email_pref_social`/`email_pref_marketing` (verified against `supabase/migrations/20260423_notification_preferences.sql:14-16` and `src/lib/notificationPreferences.ts:115-128`). Anyone querying or implementing downstream would have hit a dead end. Fixed.
- Test-count drift in Feature #20: doc said "49 unit tests", actual is 29. Fixed.
- Feature #24 noted but left: "All 82 API routes validate input" → grep shows 80. Off-by-2 from a post-doc refactor; will self-correct next time the validation layer is touched.
- All other features (1–8b, 11, 23, 26, 27, 21, 25, 11, 14, 19) spot-checked and verified clean.

### Files Modified (docs-only)
- `BACKLOG.md` — added "Payment Deadline Anchored to Cron Run Time Instead of Auction `end_time`" (Medium, Pre-Launch).
- `TESTING_RESULTS.md` — session-start entry for Apr 24.
- `docs/TECHNICAL_FEATURES.md` — Feature #22 expanded; Feature #20 column names + test count fixed.
- (Memory) `feedback_doc_layering.md` added; `MEMORY.md` index updated.

### Quality Checks at Close-Up-Shop
- TypeScript: clean (0 errors)
- ESLint: 0 errors, 115 warnings (all pre-existing, none introduced this session)
- Tests: 745/745 passing across 47 suites
- npm audit: 8 moderate severity (all pre-existing in `svix` transitive via `resend`)
- Build: production build succeeds
- Circular deps: none (374 files processed)
- Dead code: knip flags handful of unused email-template type exports + tradingDb helper aliases (pre-existing, warn-only)

### Deferred
- **Auction payment expiry @ Apr 26 ~2:20 p.m. ET** — letting it expire naturally to test Second Chance Offer flow live (user wants partner present to watch the moment). After expiry: validate seller gets `second_chance_available` notification + email, seller initiates offer to runner-up (`pattonrt`), runner-up accepts at last bid price, completes payment, mark-shipped, ownership transfer, feedback flow.
- **Payment deadline anchor fix** — captured in BACKLOG, will land in a focused session post-Second-Chance-flow validation. Not fixing mid-test (deadline is already persisted on the auction row; code change wouldn't retro-update it).

### Cost / Services
No service changes this session. COST_PROJECTIONS.md and CLAUDE.md Services & Infrastructure table both still accurate as of Apr 23 audit.

---

## Apr 23, 2026 - Session 40 End-of-Day Rollup (Close Up Shop)

### Day Summary
A very heavy day of reactive PROD-testing work. User (product owner) worked through end-to-end marketplace testing across 3 accounts (collector-patton buyer on Mac Chrome, patton716 seller on Android Chrome, pattonrt bidder on iOS Chrome). Five distinct sub-sessions (40a–40e), each ending in a production deploy to Netlify. Every issue surfaced during testing was triaged, fixed, deployed, and re-verified in PROD before moving on.

### Deploy History (chronological)

| Sub-session | Commit | Summary |
|-------------|--------|---------|
| 40a | `814ca29` | Buy Now 500 root-cause fix (Stripe image URL guard), mobile auction + buy-now modal cover caps |
| 40b | `e04ee1a` | Feedback flow (rating_request moved to mark-shipped, eligibility refresh), FMV refresh-value endpoint + ComicDetailModal CTA, purchase confirmation email copy, new FAQ entry, outbid email max-bid line |
| 40c | `803db7c` | Feedback submit auto-refresh (refreshKey tick), Ask the Professor body scroll lock + close-on-link |
| 40d | `6053bcf` | Active Bids 500 fix (`bid_amount` column), sales page partial gating restructure, site-wide em dash sweep (~55 replacements across 10 files), seller onboarding typo fix |
| 40e | `be8ceb9` | Sales page — hide Cost + Profit columns from free-tier sellers |

Interleaved local-only docs commits (DEV_LOG entries batched to avoid redundant Netlify builds): `e7c1763` (40a), `56d6d1f` (40b), `f530d5b` (40c), `2ba18b0` (40d), `4c5deb3` (40e).

### New BACKLOG Items Captured
- **Audit `cover_image_url` Source** (Low, Post-Launch) — stop persisting long signed URLs / base64 data: URIs at the source (multiple defensive strip points exist; fix should be at the write path).
- **FMV Lookup Graceful Fallback for Rare / Key Issues** (Medium, Pre-Launch) — current eBay search requires ≥3 listings at exact grade which fails for high-value key issues at low grades (e.g., Hulk #181 CGC 2.5). Needs grade-band fallback + `GRADE_MULTIPLIERS` normalization before public launch.

### Close-Up-Shop Documentation Pass
- `ARCHITECTURE.md` — updated 10 sections covering new endpoint, feedback flow timing, checkout image guard, sales gating, outbid email, FAQ modal, mobile modal caps.
- `EVALUATION.md` — flipped status to ✅ for Marketplace, Feedback System, Sales Page (Free Tier), Auction, Mobile Experience; overall score 9.1 → 9.2. FMV row marked ⚠️ partial with reference to BACKLOG entry.
- `TEST_CASES.md` — 22 test cases added (18 marked Completed 2026-04-23 from live PROD verification, 3 Pending for 2026-04-24 auction close).
- `docs/TECHNICAL_FEATURES.md` — 5 modified features (Real-Time Pricing, Auction Marketplace, Seller Reputation, Email System) + 2 new features (Sales Page Partial Gating, Ask the Professor FAQ Modal). Last Updated bumped to Sessions 38 + 39 + 40 (a–e).
- `COST_PROJECTIONS.md` — Session 40 row added to audit log noting no cost changes. All existing services remain on documented free tiers.
- `BACKLOG.md` — no completed items from today required removal (all Session 40 work was reactive to live testing, not pre-planned BACKLOG items).
- `CLAUDE.md` — Services & Infrastructure table still matches COST_PROJECTIONS.md (no service changes this session).

### Quality Checks at Close-Up-Shop
- TypeScript: clean (0 errors)
- ESLint: 0 errors, 115 warnings (all pre-existing, not introduced this session)
- Tests: 745/745 passing across 47 suites
- npm audit: 5 moderate severity (all pre-existing in `svix` transitive via `resend`)
- Build: production build succeeds
- Circular deps: none
- Dead code: knip flags a handful of unused email-template type exports and tradingDb helper aliases (pre-existing, warn-only)

### Deferred to 2026-04-24
- **Auction close @ 10:30 a.m.** — Giant-Size X-Men #1 auction ends. Verify: winner notification + email, winner flow from notification link, payment deadline behavior, payment → Stripe Connect transfer, shipment + ownership transfer.
- **Feedback submit auto-refresh** — will validate end-to-end when collector-patton leaves feedback on the auction win (40c fix not yet live-tested; 40b+40c fix combined was verified working for the Buy Now flow).
- **FMV grade-band fallback** — BACKLOG item queued for a focused session before public launch.

---

## Apr 23, 2026 - Session 40e: Sales Page — Hide Cost + Profit Columns for Free Tier

### Summary
Follow-up to 40d. User verified 40d fixes, confirmed the Profit column was still leaking through to free-tier sellers. Wanted free-tier view to show only Comic, Sale Price, and Date.

### Fix
- `src/app/sales/page.tsx` — Cost `<th>`/`<td>` and Profit `<th>`/`<td>` now wrapped in `hasStatsAccess` guards (desktop table + mobile detail panel). Empty-state copy drops the "with profit tracking" phrase for free users so we don't promise a view they won't get.
- No change to the write path; `sales` table continues to persist purchase_price and profit on every sale regardless of tier, so the columns become visible retroactively on upgrade.

### Deploy
- Pushed to main at commit `be8ceb9` → Netlify auto-deploy.

---

## Apr 23, 2026 - Session 40d: Active Bids Fix, Sales Gating Restructure, Em Dash Sweep, Typo Fix

### Summary
Third PROD testing feedback round surfaced one broken feature, one gating strategy mismatch, a site-wide copy preference, and a typo. Four fixes shipped in one bundle.

### Features / Fixes Shipped

1. **Active Bids tab threw 500 "Failed to fetch transactions".** pattonrt (current winning bidder) couldn't load `/transactions?tab=bids`. Root cause: the handler's Supabase `select` on the `bids` table listed column `amount`, but the real column is `bid_amount`. Supabase returned a schema error that bubbled as a 500. One-character fix in the select plus matching rename at the access site (`row.amount` to `row.bid_amount`).

2. **Sales page gated everything behind `fullStats`.** Free seller (patton716) could not see their own sold-books list because the page wrapped list + row details + summary cards in a single `<FeatureGate feature="fullStats">`. Restructured:
   - Sales list + per-row detail: always visible to every user.
   - 3 Summary Cards (Total Sales / Total Profit / Avg. Profit): wrapped in a `relative` container with `filter blur-sm pointer-events-none select-none` when `features.fullStats` is false, plus an absolutely positioned upgrade CTA card overlay ("Unlock your Sales Stats" / "Start 7-Day Free Trial" / "View Pricing").
   - Copy on the overlay explicitly says "Your sale data is still being saved" so users know upgrade works retroactively.
   - **Data storage audited and confirmed:** `src/lib/db.ts`'s `markComicAsSold` inserts `purchase_price`, `sale_price`, and `profit` into the `sales` table with no tier check. Free users' sales history is fully preserved — upgrading reveals the existing data. No write-path changes needed.

3. **Em dash site-wide sweep.** ~55 em dashes (`—`, U+2014) replaced in user-facing copy across 10 files: Navigation FAQ answers, all email templates (HTML and text), auctionDb notification titles/messages, seller-onboarding guide, about/terms/settings pages, SecondChanceInboxCard, comicFacts (home-page fun facts), refresh-value API error message, and collection placeholder glyphs. Context-aware replacements: names followed by em dash → comma; sentence breaks → period; glosses → colon; no-space em dashes → hyphen. Skipped ~224 occurrences in code comments, `console.*` args, AI prompts (`anthropic.ts`, `coverValidation.ts`), internal validator reason strings, JSDoc, tests, migrations, and markdown docs.

4. **"Agree and continueto use Link" typo** in `src/app/seller-onboarding/page.tsx`. The source had a proper space between `</strong>` and `to`, but JSX was collapsing it on render. Forced the space with explicit `{" "}` interpolation.

### Files Modified
- `src/app/api/transactions/route.ts` — bid_amount column fix.
- `src/app/sales/page.tsx` — restructured gating + blur overlay.
- `src/app/seller-onboarding/page.tsx` — typo fix + em dashes.
- `src/components/Navigation.tsx` — FAQ em dashes.
- `src/lib/email.ts` — all templates em dashes.
- `src/lib/auctionDb.ts`, `src/lib/comicFacts.ts` — copy em dashes.
- `src/app/about/page.tsx`, `src/app/terms/page.tsx`, `src/app/settings/notifications/page.tsx`, `src/app/collection/page.tsx` — em dashes.
- `src/components/auction/SecondChanceInboxCard.tsx` — em dashes.
- `src/app/api/comics/[id]/refresh-value/route.ts` — error message em dash.

### Deploy
- Pushed to main at commit `6053bcf` → Netlify auto-deploy.

### User-Confirmed Working (post-40c)
- FAQ internal link now closes the modal on click ✓

### Deferred
- Feedback submit refresh verification → will validate when collector-patton leaves feedback on tomorrow's auction close.

---

## Apr 23, 2026 - Session 40c: Feedback Submit Refresh + FAQ Modal Polish

### Summary
User continued PROD testing post-40b and surfaced three more UX bugs plus one FMV-search issue. Shipped three fixes in one bundle; FMV captured to BACKLOG as a pre-launch item requiring more thought.

### Features / Fixes Shipped

1. **Feedback button didn't hide after submit.** `useFeedbackEligibility` deps only included `transactionId`, `transactionType`, and the `shippedAt` refresh key — none of which change when the user submits feedback. The button stayed visible until a hard refresh. Added a local `feedbackRefreshTick` state in both `ListingDetailModal` and `AuctionDetailModal` that bumps via the `LeaveFeedbackButton`'s `onFeedbackSubmitted` callback (in addition to `loadListing`/`loadAuction`). Tick is folded into the hook's refreshKey so submission triggers a fresh eligibility query, which returns `canLeaveFeedback: false` with `feedbackLeftAt` populated → UI swaps to "Feedback submitted on …".

2. **Ask the Professor FAQ modal — scroll bled through.** User reported scroll reaching the end of the FAQ list would scroll the underlying page instead. Added a `useEffect` in `Navigation.tsx` that sets `document.body.style.overflow = "hidden"` while `showProfessor` is true, with cleanup restoring the previous value. Scroll now stays inside the modal.

3. **Ask the Professor FAQ modal — internal links navigated but modal stayed open.** The Seller Onboarding link in the "How do I set up my Stripe seller account?" FAQ answer correctly navigates but the modal kept floating over the destination page. Added a delegated click handler on the FAQ list container: if the click target is inside an `<a>`, call `setShowProfessor(false)`. Works for the existing link and any future FAQ links without per-link handlers.

### Backlog / Follow-up Captured

- **FMV Lookup — Graceful Fallback for Rare / Key Issues at Exact Grade** (Medium / pre-launch). Current `searchActiveListings` + `filterIrrelevantListings` requires `MIN_LISTINGS_THRESHOLD = 3` listings at exactly the target grade. For high-value key issues at uncommon grades (Hulk #181 CGC 2.5 in the test) there are often 0–2 active listings on eBay at any moment, so `refresh-value` returns "No eBay sales data found" even when the user can clearly find one via eBay's search. Fix direction: grade-band fallback + `GRADE_MULTIPLIERS` normalization, or relaxing threshold to 1 with explicit confidence label. Captured in BACKLOG — needs a focused session before public launch.

### User-Confirmed Working
- Leave Feedback button now renders correctly post-shipment (40b fix verified in PROD)
- Purchase confirmation email copy matches new ownership-transfer timing

### Files Modified
- `src/components/auction/ListingDetailModal.tsx` + `AuctionDetailModal.tsx` — feedback refresh tick.
- `src/components/Navigation.tsx` — body scroll lock + link-close delegation.
- `BACKLOG.md` — FMV fallback item captured.

### Deploy
- Pushed to main at commit `803db7c` → Netlify auto-deploy.

---

## Apr 23, 2026 - Session 40b: PROD Testing Feedback Batch — Feedback Flow, FMV Lookup, Email Polish, FAQ

### Summary
User continued PROD testing post-hotfix: completed a Buy Now purchase end-to-end (Hulk #181 $2 test sale) and worked through the full post-payment flow (payment, Stripe Connect payout, mark-shipped, ownership transfer, email notifications). Surfaced 5 feedback items covering the feedback UI, payout clarity, missing FMV on purchased comics, misleading purchase-confirmation copy, and incomplete outbid email content. All 5 fixed in a single bundle and deployed.

### Features / Fixes Shipped

1. **Feedback flow — right timing + re-fetch bug.** `rating_request` notification was firing from the Stripe webhook (payment completed), but server-side eligibility requires `shipped_at`. Buyer got the prompt, clicked through, found no feedback UI. Moved `rating_request` to the `mark-shipped` route so it fires when the button actually becomes visible. Seller now also gets a `rating_request` at shipment (they can rate the buyer). Separately, `useFeedbackEligibility` hook only re-ran on `transactionId/transactionType` change — added a `refreshKey` arg (caller passes `listing.shippedAt`) so it re-queries when shipment flips eligibility true. Applied to both `ListingDetailModal` and `AuctionDetailModal`.

2. **FMV lookup for comics without price data.** When a buyer-side clone inherits `price_data: null` from a seller who manually added the comic (no scan), the buyer was stuck — the edit form had no value field and no lookup trigger. New `POST /api/comics/[id]/refresh-value` does owner auth + eBay Browse lookup + persists `price_data` and `average_price`. Honors the same 12h Redis cache as `/api/ebay-prices`. UI: blue "Look Up Market Value" CTA card in `ComicDetailModal` when `effectivePriceData?.estimatedValue` is falsy, plus a small "Refresh value" link inside the value card for stale data. Result applies optimistically via local state so the value appears immediately without a reload.

3. **Purchase confirmation email copy.** "The comic has been added to your collection." → "The comic will be added to your collection once the seller marks it as shipped." Matches actual ownership-transfer timing (gates on ship, not payment).

4. **FAQ entry for the buy-ship-transfer flow.** New "What happens after I buy a comic?" entry in `Navigation.tsx`'s Ask the Professor FAQ. Explains: payment → seller notified → ship → comic added to collection → feedback window opens. Sets expectations and gives a plain-English answer for the "why doesn't it show up yet?" question.

5. **Outbid email — added max bid line.** `BidActivityEmailData.yourMaxBid` was already on the interface but the template never rendered it. Added a conditional "Your max bid: $X" line to both HTML and text variants, wired from `currentWinningBid.max_bid` at the `placeBid` call site. Lets bidders know whether their proxy is still in the running.

### User-Facing Clarification (no code change)
User asked whether seller payout is held until shipping info is provided. Currently no — destination charges transfer to seller's Connect balance on payment. Shipping-gated payout is already tracked in BACKLOG as pre-launch blocker ("Shipping Tracking for Sold Items — payment gated on validated tracking" / Option B). For private beta, trust-based Option A is acceptable; full-launch requires Option B (Stripe separate charges + transfers, EasyPost carrier validation, auto-refund on 7-day ghost).

### Files Modified
- `src/app/api/webhooks/stripe/route.ts` — removed premature `rating_request`.
- `src/app/api/auctions/[id]/mark-shipped/route.ts` — added `rating_request` for both buyer + seller.
- `src/hooks/useFeedbackEligibility.ts` — added `refreshKey` arg.
- `src/components/auction/ListingDetailModal.tsx` + `AuctionDetailModal.tsx` — pass `shippedAt` as refresh key.
- `src/app/api/comics/[id]/refresh-value/route.ts` — new endpoint.
- `src/components/ComicDetailModal.tsx` — Look Up / Refresh value UI + local-state override.
- `src/lib/email.ts` — purchase copy fix + outbid maxBid render.
- `src/lib/auctionDb.ts` — pass `yourMaxBid` at outbid call site.
- `src/components/Navigation.tsx` — new FAQ entry.

### Deploy
- Pushed to main at commit `e04ee1a` → Netlify auto-deploy.

### Backlog / Follow-ups Captured
- (Still open from Session 40a) `cover_image_url` source audit — multiple defensive strip points exist, fix at persistence layer.
- User-requested Option B (shipping-gated payout) remains in BACKLOG as pre-launch blocker.

---

## Apr 23, 2026 - Session 40: Marketplace PROD Testing — Buy Now 500 Hotfix + Mobile Modal Layout

### Summary
User began PROD testing of auction + buy-now flows with three accounts (collector-patton buyer / patton716 seller / pattonrt bidder). Auction bidding path worked end-to-end (outbid notifications + emails + links all verified). Buy Now blocked by a 500 from `/api/checkout`. Mobile auction page had unusable cover-image sizing. Both fixed in a single deploy bundle.

### Features / Fixes Shipped

1. **Buy Now checkout 500 — root cause fixed.** Stripe API was returning `invalid_request_error: "Invalid URL: URL must be 2048 characters or less"` on `line_items[0].product_data.images[0]`. The `cover_image_url` field sometimes carries a very long Supabase signed URL (JWT query param) or a base64 `data:` URL, both of which blow past Stripe's 2048-char cap. `src/app/api/checkout/route.ts` now only passes the cover to Stripe when it's an `http(s)://` URL ≤2048 chars; otherwise omits the image (cosmetic-only on the Checkout page). Same defensive pattern already exists in `csvExport.ts` for `data:` URLs — consistent with existing codebase approach.

2. **Mobile Auction modal cover dominated viewport.** `AuctionDetailModal.tsx:180` forced `aspect-square` + `max-h-[60vh]` on mobile, leaving a tiny sliver for bid details. Dropped to `max-h-[35vh]` on mobile; desktop `md:max-h-[70vh]` unchanged.

3. **Mobile Buy Now modal had same class of bug.** `ListingDetailModal.tsx:219` used `aspect-[3/4]` with no mobile height cap — portrait ratio at 100vw produced ~76vh of cover. Added `max-h-[40vh]` on mobile; desktop layout untouched.

### Files Modified
- `src/app/api/checkout/route.ts` — defensive image URL guard before Stripe session creation.
- `src/components/auction/AuctionDetailModal.tsx` — mobile image cap.
- `src/components/auction/ListingDetailModal.tsx` — mobile image cap.

### Testing Context
- **Buyer:** collector-patton (Mac Chrome, Free)
- **Seller:** patton716 (Android Chrome, Free)
- **Bidder:** pattonrt (iOS Chrome, Free)
- **Verified working:** auction bidding, outbid notification + email, link navigation from notification/email.
- **Not yet verified:** auction close at 10:30 tomorrow (winner notification + winner flow), Buy Now checkout in prod (fix deployed, user to re-test), post-purchase flows (Stripe payment, order confirmation emails, shipping workflow).

### Deploy
- Pushed to main at commit `814ca29` → Netlify auto-deploy.

### Backlog / Follow-ups Captured
- Audit where `cover_image_url` gets persisted as a `data:` URL or overlong signed URL. Multiple codepaths (checkout, CSV export) now defensively strip it — worth fixing at the source eventually.

---

## Changes Since Last Deploy

**Last Deploy:** 2026-04-23 (Session 40e — sales page Cost+Profit column gate at commit `be8ceb9`). Same-day prior deploys: `6053bcf` (Session 40d), `803db7c` (Session 40c), `e04ee1a` (Session 40b), `814ca29` (Session 40a), `4175035` (Session 39c), `14037e1` (Session 39), `8b4a9eb` (Session 38).
**Sessions Since Last Deploy:** 0
**Deploy Readiness:** Deployed — Session 40e sales column gate. No new migrations, no new env vars.

---

## Apr 23, 2026 - Session 39: Pre-Beta Hardening Batch — Zod Sweep, Audit Log, Second Chance Offer, Strike System, Notification Prefs

### Summary
- User's target: go live in private beta on Sunday April 26, 2026. Goal for today's second session: clear as many remaining pre-launch BACKLOG items as possible in a single deploy-ready bundle. 10 distinct features shipped across 9 subagent runs, plus several cleanup/audit items. Full deploy bundle landed at commit `14037e1`.
- Largest single item: Zod validation sweep across 82 API routes (marketplace, user/social/admin, content/scan/lookup). New shared helper `src/lib/validation.ts` with `validateBody`/`validateQuery`/`validateParams` and standardized `{error, details:[{field, issue}]}` error shape, HTTP 400 on validation failure. Routes now reject malformed input before any logic runs — catches UUID format, enum values, length caps, nested shapes.
- Shipped full payment-deadline enforcement suite started in Session 38: `expireUnpaidAuctions` and `sendPaymentReminders` were functional, this session added (1) Second Chance Offer flow for seller to re-offer to runner-up, (2) Payment-Miss Strike System with warning-on-first-offense and flag-at-2-strikes-in-90-days, (3) cron batching via Resend `batch.send()` + concurrency cap for scale.
- Filled the long-flagged audit gap: new `auction_audit_log` table, helper library, 17 wire-ups across auction/offer/payment/shipment lifecycle, admin-only RLS, Stripe webhook integration. Admins can now query a complete transaction log for dispute resolution + debugging.
- New Email Notification Preferences system: 4-category toggles on `/settings/notifications` (Transactional locked always-on, Marketplace/Social/Marketing togglable). Gates `sendNotificationEmail` + batch variant, full category coverage for all 27 notification email types.
- CC ↔ Clerk username sync-on-write: when a user sets their CC username, Clerk's username is also updated via Backend API. Graceful degradation if Clerk fails (Supabase remains source of truth).
- Defensive cleanup: Metron integration fully removed (decision from Apr 22). Cover harvest aspect-ratio guard (new `coverCropValidator.ts`) rejects AI crops outside 0.55-0.85 w/h range before they pollute the cover cache. ScreenshotPlaceholder soft-match for filename typos.

### Features Shipped (11)

1. **Zod Validation Sweep — 82 routes** across three scope groups:
   - Marketplace + money (31 routes): auctions, offers, listings, checkout, billing, connect, trades, transactions, feedback, reputation
   - User + social + admin (32 routes): username, users, sellers, follows, messages, notifications, settings, age-verification, waitlist, email-capture, watchlist, sharing, location, admin/*
   - Content + scan + lookup (19 routes): analyze, barcode-lookup, cert-lookup, comic-lookup, quick-lookup, import-lookup, con-mode-lookup, key-hunt, cover-*, comics, ebay-prices, titles
   - Shared helper at `src/lib/validation.ts` with `validateBody`/`validateQuery`/`validateParams`, `schemas.uuid`/`email`/`url`/`trimmedString`/`positiveInt`/`nonNegativeNumber`
   - Standard error shape; HTTP 400 on invalid; `.strict()` used on settings to reject unknown fields

2. **Auction Audit Log** — new `auction_audit_log` table (admin-read RLS, service-role insert), `auction_audit_event_type` enum covering 20 event types (auction lifecycle + bid + offer + payment + shipment), `src/lib/auditLog.ts` with fire-and-forget single + batch variants, 17 wire-ups across `auctionDb.ts`, `mark-shipped` route, and Stripe webhook. 15 unit tests.

3. **Second Chance Offer (Seller-Initiated)** — when auction expires unpaid and runner-up exists, seller gets email + in-app notification with "Offer to runner-up" CTA. Runner-up has 48h to accept at their last actual bid price. No cascade (if declined/ignored, offer ends). New routes, UI components (`SecondChanceOfferButton`, `SecondChanceInboxCard`), cron pass `expireSecondChanceOffers`, 5 new email templates, 7 new notification types.

4. **Payment-Miss Strike System** — first offense logged + warning email sent ("Please pay on time"), 2 strikes within 90 days triggers flag: bid restriction applied at bid placement route, reputation hit via system-inserted negative rating (idempotent on unique constraint), `payment_missed_flagged` email to user, admin notification. New `/api/admin/flagged-users` endpoint. New `user_flagged` audit event type.

5. **Email Notification Preferences** — per-category toggles (Transactional locked / Marketplace / Social / Marketing). `NOTIFICATION_CATEGORY_MAP` covers all 27 notification email types + forward-compat for Second Chance + Strike. `sendNotificationEmail` + `sendNotificationEmailsBatch` gate on preferences with skipped-count reporting. GET/PATCH `/api/settings/notifications` extended, UI at `/settings/notifications`. 49 unit tests.

6. **Payment-Expiry Cron Batching** — `src/lib/concurrency.ts` with `mapWithConcurrency` helper. `sendPaymentReminders` + `expireUnpaidAuctions` refactored into three-phase pattern: serial race-safe UPDATE → batched Supabase notification insert → Resend `batch.send()` (50 emails/batch) + mapWithConcurrency(5) for email prep. Handles 50+ expirations per cron tick without timeout or rate-limit issues. 13 unit tests.

7. **Cover Harvest Aspect-Ratio Guard** — new `src/lib/coverCropValidator.ts` validates AI-returned crop coordinates produce comic-book aspect ratio (0.55–0.85 w/h). Out-of-range crops logged + skipped so they don't pollute the cover cache. Wired at the top of `harvestCoverFromScan`. 16 unit tests.

8. **CC ↔ Clerk Username Sync-on-Write** — POST and DELETE on `/api/username` now call Clerk Backend API after successful Supabase update. Graceful failure (Clerk errors logged but don't fail the request).

9. **Metron Integration Removed** — `src/lib/metronVerify.ts` + test deleted, references pruned from `src/app/api/analyze/route.ts` and `src/lib/coverValidation.ts`. `.env.local` entries left for user to clean manually.

10. **ScreenshotPlaceholder Soft-Match** — prefix fallback when exact filename doesn't match (e.g. `09-stripe-success.png` matches even if file is named `09-success.png`). Module-scope directory cache with dev-server hot-reload bypass.

11. **hCaptcha Guest Scan Protection (Sessions 4-5)** — Invisible + floating badge (Pro trial until May 7, then auto-downgrade to free). Server-side siteverify verification with 5s AbortSignal timeout; dev/prod key swap via NODE_ENV. Client component (`GuestCaptcha`) + helper (`src/lib/hcaptcha.ts`). Gated on `guestScansCompleted >= 3` in `/api/analyze`; authenticated users never see CAPTCHA. 15 unit tests covering siteverify success/failure/timeout/no-token paths.

### Key Files Created
- `src/lib/validation.ts`, `src/lib/auditLog.ts`, `src/lib/concurrency.ts`, `src/lib/coverCropValidator.ts`, `src/lib/notificationPreferences.ts`
- `src/components/auction/SecondChanceOfferButton.tsx`, `SecondChanceInboxCard.tsx`
- `src/app/api/admin/flagged-users/route.ts`, `src/app/api/auctions/[id]/second-chance/route.ts`, `src/app/api/second-chance-offers/[id]/route.ts`, `src/app/api/second-chance-offers/route.ts`
- `src/types/notificationPreferences.ts`
- 4 test files (auditLog, concurrency, coverCropValidator, notificationPreferences, secondChance)

### Migrations Applied (to production Supabase before deploy)
- `20260423_auction_audit_log.sql` — new table + enum + indexes + RLS
- `20260423_notification_preferences.sql` — 3 boolean columns on profiles
- `20260423_second_chance_offers.sql` — new table + indexes + RLS
- `20260423_payment_miss_tracking.sql` — 4 profile columns + `user_flagged` enum value + notification CHECK constraint fix (bonus — resolved pre-existing drift where 4 notification types were inserted in code but not on the allowlist)

### Dependencies Added
- `zod` (runtime) — for API route validation schemas

### Tests
- Before session 39: 620
- After session 39: **730** (+110)
- All suites passing, 0 TS errors, 0 lint errors, build clean, smoke test passes

### Post-Initial-Deploy Work (Session 39 continued)
- **hCaptcha integration** — full implementation wired into guest scan flow as described in Feature #11 above. Client component + helper library + `/api/analyze` gating + 15 unit tests.
- **hCaptcha siteverify timeout** — 5-second AbortSignal cap on siteverify fetch; new `siteverify_timeout` failure reason + user-friendly message ("CAPTCHA verification is slow right now. Please try again in a moment."). Prevents 30-second hangs during hCaptcha outages. +3 tests.
- **BACKLOG.md reconciliation** — Removed 13 completed items (all shipped this session); reclassified CGC Cert Lookup (+ Pre-populate Top Comics Cache) from High Pre-Launch to Medium Post-Launch pending ZenRows ROI decision (price bumped $49→$69, break-even now ~4,600 slab scans/month — unlikely in private beta); added 6 new deferred items (Align Clerk Username Rules, Second Chance cascade, cover validator expansion, cron batching enhancements, notification drift audit, hCaptcha retry-on-transient). File size 1346 → 1070 lines.
- **ZenRows paid plan decision** — Evaluated against updated pricing. Recommendation to partner: defer post-launch, revisit after 2-4 weeks of real scan volume. Fallback to AI pipeline is working; no user is blocked. BACKLOG entry reflects this.
- **Pricing backfill preflight** — Ran preflight SQL against production `comics` table: 0 legacy rows with non-eBay priceSource. Confirmed `scripts/backfill-pricing.ts` is not needed for beta launch; kept as a safety-net script.
- **Partner hCaptcha setup** — User signed up via GitHub OAuth, landed in Pro Publisher 14-day trial. No payment info provided, will auto-downgrade to free tier on May 7, 2026. Keys added to `.env.local` AND Netlify environment variables.

### Issues Encountered
- **Parallel agent coordination around `src/lib/email.ts`.** Both Second Chance + Strike agent and Email Notification Preferences agent needed to modify email.ts. Resolved by strict instructions: Email Prefs agent adds preference-check wrapper only (no template changes), Second Chance agent appends new templates in a clearly-labeled section at the end of the file. No conflicts observed post-merge.
- **Pre-existing notification CHECK constraint drift.** Discovered by the Second Chance agent while adding new notification types: the `valid_notification_type` CHECK constraint on `notifications` table was missing 4 types that were already being inserted in code (`auction_payment_expired`, `auction_payment_expired_seller`, `bid_auction_lost`, `new_bid_received`). Silent because Postgres wasn't rejecting them (column width permitted, constraint was either loose or the inserts were bypassing somehow). Payment-miss migration now updates the constraint to include everything. Worth a follow-up investigation for whether any inserts were silently failing on affected types in production — BACKLOG.
- **UserId/CLERK regex friction surfaced earlier today.** Supabase `profiles.username` enforces `^[a-z0-9_]{3,20}$`; Clerk allows more (including dashes). Webhook sanitizer added today handles this for inbound sync; the new sync-on-write path handles outbound direction. BACKLOG item for aligning Clerk dashboard username rules still open.

### Where We Left Off
- **Three deploys shipped today.** Deploy 1 (`8b4a9eb`, Session 38). Deploy 2 (`14037e1`, Session 39 pre-beta hardening batch). Deploy 3 (`4175035`, pending tonight) — hCaptcha guest-scan protection + siteverify timeout guard + BACKLOG reconciliation + doc updates.
- **Real-money Stripe Connect live-mode test still on deck** — user will schedule when ready. Can happen any time; the platform is production-ready.
- **Sunday April 26 private-beta launch is ON TRACK.** All pre-launch blockers closed. hCaptcha is live on guest scans 4-5; authenticated users never see it. Siteverify timeout guard prevents user lockout during hCaptcha outages.
- **ZenRows / CGC cert lookup deferred post-launch.** Updated pricing ($49→$69) pushes break-even to ~4,600 slab scans/month, which is unrealistic in private beta. Fallback AI pipeline is adequate. Revisit after 2-4 weeks of real volume. Not a beta-launch blocker.
- **Pricing backfill script not required for launch.** Preflight showed 0 legacy non-eBay rows in production. Script stays in repo as a safety net.
- BACKLOG items still open but not pre-launch critical: Apple Developer enrollment (1-3 week window), and 6 newly-captured medium/low post-launch items (see BACKLOG.md for details).

---

## Apr 23, 2026 - Session 38: Payment Deadline Enforcement, Seller Onboarding Page, 9 Pre-Launch Items

### Summary
- Shipped 5 of 6 payment-deadline enforcement gaps surfaced in the Session-37 audit: checkout-time deadline guard, live countdown on /transactions, `sendPaymentReminders()` cron pass at T-24h, `expireUnpaidAuctions()` cron pass that transitions stale auctions to cancelled, and `PAYMENT_WINDOW_HOURS` constant cleanup. Gap 4 (second-highest-bidder promotion) deferred to BACKLOG — significant product surface, MVP skip.
- Built `/seller-onboarding` help page in Lichtenstein style, mobile-first. Nine screenshots captured from the real Stripe Connect onboarding flow validated that the Link-based happy path skips Address + SSN entry entirely; the page was restructured around the real 9-step flow rather than the originally-scoped 8 steps.
- Closed the Clerk → Supabase username/name sync bug. Webhook previously only synced email; now syncs username (sanitized against `^[a-z0-9_]{3,20}$`), first_name, last_name, and derived display_name on both `user.created` and `user.updated`. Sanitizer ensures an invalid username (e.g. with a dash) doesn't kill the entire upsert.
- Ran a batch of pre-launch items autonomously via subagent fan-out: marketplace policy gaps in Terms + FAQs (§4.11-4.14 and §10.1 rewrite, 5 new FAQs), Hottest Books feature fully removed (4 files deleted), 10MB image-upload cap + 18 tests, auto-harvest cover AI prompt fix, payment-deadline audit + TEST_CASES.md scenarios.
- Granted admin to 3 Clerk users via production SQL (`is_admin = TRUE` on `profiles`). Filled a NULL username via direct SQL for `user_3ClOCDQWU8RAM7wmIehSNEcoWl2` (`collector_patton`) after discovering the Clerk regex mismatch with Supabase.

### Bug Fixes Shipped (core)
1. **Clerk webhook only synced email** (`src/app/api/webhooks/clerk/route.ts`): `user.created` + `user.updated` now upsert username/first_name/last_name/display_name. Sanitizer rejects usernames that would fail the Supabase `profiles.username` CHECK constraint (`^[a-z0-9_]{3,20}$`) so the rest of the upsert still lands. This was the root cause of NULL usernames on two of the three admin accounts.
2. **Post-deadline payment charge path open** (`src/app/api/checkout/route.ts:97-108`): defensive guard returns HTTP 400 with "The payment window for this auction has expired" when `listing.paymentDeadline < now`. Previously a buyer could pay days or weeks late and the charge succeeded because the route only checked `paymentStatus !== "pending"`.
3. **No auto-expiry of unpaid auctions** (`src/lib/auctionDb.ts` new `expireUnpaidAuctions()`): cron pass transitions `status='ended' AND payment_status='pending' AND payment_deadline < NOW() AND payment_expired_at IS NULL` to `status='cancelled'`, sets `payment_expired_at = NOW()`, notifies both parties with new email templates. Race-safe via conditional UPDATE `WHERE payment_expired_at IS NULL` with `.select()` row-count check.
4. **Dead `payment_reminder` notification** (new `sendPaymentReminders()`): fires at T-24h, idempotent via new `payment_reminder_sent_at` column. `payment_reminder` NotificationType was already declared but never emitted.
5. **Auto-harvest AI prompt color blind-spot** (`src/lib/providers/anthropic.ts`): prompts now enumerate the full grade-label color palette (blue, yellow, purple, green, red) with explicit `(EXCLUDE)` and `(CROP THIS)` markers. Prior prompt said "white/blue" only, which may have caused the AI to fail to recognize yellow/purple/green/red CGC/CBCS labels as labels. Both Anthropic and Gemini providers fixed — Gemini imports the same prompt constants.
6. **`/api/analyze` scan-slot leak on error branches**: 413 "image too large" and 400 "no image" paths now release the reserved scan slot. Previously users were billed a scan for a malformed request.
7. **Scan-slot reservation pattern** applied uniformly with the new 10MB upload cap.

### Features Completed
- **`/seller-onboarding` help page** — 9-step Link-aware walkthrough, ScreenshotPlaceholder auto-swap, troubleshooting as native `<details>`, FAQ link from Navigation.tsx. Support email pulled from Terms (`admin@collectors-chest.com`). Server component, mobile-tested at 375px.
- **Countdown timer on /transactions** — `<PaymentDeadlineCountdown>` client component renders on pending-payment rows. Live tick every 60s; neutral >24h, orange ≤24h, red ≤6h, red "Expired" at ≤0. Hydration-safe (renders invisible placeholder on SSR, populates in `useEffect`).
- **Marketplace Terms §4.11-4.14 + §10.1 rewrite** — refunds & chargebacks, seller vetting & restricted products, first-line support (2-day response SLA), risk & fraud notifications, seller remediation / additional information. Closes the pre-launch gaps acknowledged to Stripe during Session 36 Connect setup.
- **5 new marketplace FAQs** in `Navigation.tsx` `faqs` array (refunds, seller legitimacy, payment problems, restricted accounts, remediation info requests).
- **10MB image upload cap** (`src/lib/uploadLimits.ts`) — shared helper exports `MAX_IMAGE_UPLOAD_BYTES`, `assertImageSize()`, `base64DecodedByteLength()`. Wired into `/api/analyze` and `/api/messages/upload-image`; client-side pre-validation in `ImageUpload.tsx` and `MessageComposer.tsx`. HTTP 413 responses with clean error shapes.
- **Hottest Books removal** — `src/app/hottest-books/`, `src/app/api/hottest-books/`, `src/lib/hotBooksData.ts` deleted. Commented-out nav entries in `Navigation.tsx` + `MobileNav.tsx` cleaned up.

### Key Files Modified
- `src/types/auction.ts` — `PAYMENT_REMINDER_WINDOW_HOURS` const, `calculatePaymentDeadline()`, `isWithinPaymentReminderWindow()`, two new `NotificationType` values (`auction_payment_expired`, `auction_payment_expired_seller`)
- `src/lib/auctionDb.ts` — new `sendPaymentReminders()`, `expireUnpaidAuctions()`; four hardcoded `48`s replaced with `calculatePaymentDeadline()`; new notification title/message entries
- `src/lib/email.ts` — three new templates (`payment_reminder`, `auction_payment_expired`, `auction_payment_expired_seller`), new data interfaces, sound effects
- `src/app/api/cron/process-auctions/route.ts` — pipeline now: `processEndedAuctions → sendPaymentReminders → expireUnpaidAuctions → expireOffers → expireListings`; returns stats for all five passes
- `src/app/api/checkout/route.ts` — deadline guard on auction path
- `src/app/api/webhooks/clerk/route.ts` — username/name/display_name sync, regex sanitizer, `buildDisplayName()` helper
- `src/app/transactions/page.tsx` — countdown integrated into `TransactionCard`
- `src/components/PaymentDeadlineCountdown.tsx` — NEW
- `src/app/seller-onboarding/page.tsx` — NEW with `ScreenshotPlaceholder` auto-swap, `StepCard`, `ProTip`, `CriticalCallout`, `TrustCue` inline components
- `src/app/terms/page.tsx` — §4.11-4.14 added, §10.1 rewritten
- `src/components/Navigation.tsx` — 6 new FAQ entries (5 marketplace + 1 seller onboarding); Hottest Books nav cleaned
- `src/components/MobileNav.tsx` — Hottest Books drawer entry cleaned
- `src/lib/uploadLimits.ts`, `src/lib/__tests__/uploadLimits.test.ts` — NEW
- `src/lib/providers/anthropic.ts` — three prompt constants updated for slab-cover crop accuracy
- `TEST_CASES.md`, `TESTING_RESULTS.md` — session 38 entries

### Migrations Applied
- `supabase/migrations/20260423_payment_reminder_tracking.sql` — adds `payment_reminder_sent_at`, `payment_expired_at` columns on auctions + partial index on `(payment_deadline) WHERE status='ended' AND payment_status='pending'`. Applied to production Supabase **before** deploy per user's manual SQL run.

### Data Backfills Applied (via Supabase SQL)
- Granted `is_admin = TRUE` to 3 Clerk users: `user_3CjC6Ov6pTXPw2u93VFli8l2vOQ`, `user_3BzGTFOIRnURGTRDO2YfYvnDvVi`, `user_3ClOCDQWU8RAM7wmIehSNEcoWl2`.
- Set `username = 'collector_patton'` on `user_3ClOCDQWU8RAM7wmIehSNEcoWl2` after discovering Clerk regex mismatch.

### Scripts Added (not yet executed)
- `scripts/backfill-pricing.ts` — one-time refresh of legacy AI-era bogus pricing. Queries `comics` where `price_data.priceSource != 'ebay'`, calls `/api/ebay-prices` to get fresh eBay-sourced values, updates row or clears if no eBay data available. Dry-run by default (`APPLY=true` required to write). Queued for manual run post-deploy.

### Issues Encountered
- **Clerk username regex mismatch with Supabase.** Supabase `profiles.username` enforces `^[a-z0-9_]{3,20}$` but Clerk allows dashes. Users who set usernames with dashes at Clerk signup would never have them propagate to Supabase — the webhook upsert hit the CHECK constraint silently. Fixed by adding `sanitizeUsername()` to strip invalid values before upsert so the rest of the fields still land. Follow-up BACKLOG item: align Clerk's username rules with Supabase's so users get a friendly error at signup rather than a silent drop.
- **Stripe onboarding flow is shorter than spec assumed.** Real capture showed the Link-based path skipped Address + SSN steps (Link verifies both via bank authentication). Page was rewritten from 8 to 9 steps, with the dropped steps replaced by the Link intro + bank search + payout confirmation + Link success. Also reduced time estimate from "5 minutes" to "3-5 minutes" based on actual wall time.
- **Screenshot naming friction.** User saved two screenshots with old/typo filenames (`01-verify-email-phone.png` and `09-strip-success.png`). `ScreenshotPlaceholder` auto-swap relies on exact match to the expected filename, so both had to be renamed. Consider adding soft matching (e.g. `09-strip*` or suffix tolerance) to the component in a future session if screenshots get refreshed often.
- **Auto-harvest root cause was likely label color, not prompt ambiguity.** Previously diagnosed as "AI interpreting 'cover' as top of slab." Actual cause more likely: prompt said "white/blue" label but CGC yellow/purple/green and CBCS variants exist — if AI didn't recognize non-white/blue as a grading label, it may have defaulted to cropping the whole slab top. Fixed by enumerating all label colors and adding explicit region tags.

### Where We Left Off
- Deploy pushed; Netlify auto-deploy building. Once live, real-money Stripe Connect test is on deck.
- Pricing-backfill script written but not executed — user to run dry-run (`npx tsx scripts/backfill-pricing.ts`) post-deploy to see scope.
- `account.updated` webhook toggle test outstanding for during the real-money flow.
- Shipping Tracking Option B (EasyPost + 10-day auto-refund) queued for a dedicated session after real-money validation.
- BACKLOG items accumulated this session (to be captured at close-up-shop): cover-harvest aspect-ratio guard, Clerk/Supabase username rule alignment, CC↔Clerk username sync-on-write, second-chance-offer for expired auctions, payment-expiry cron batching (Resend rate-limit at scale), `ScreenshotPlaceholder` soft-match, memory correction (`AskProfessor.tsx` doesn't exist — FAQs live in `Navigation.tsx` only).

---

## Apr 22, 2026 - Session 37: Auction Flow E2E Testing, 9 Bug Fixes, Transactions Page, Clerk Email Sync

### Summary
- Ran complete auction + marketplace flow end-to-end in localhost with Stripe sandbox using 3 test accounts (patton+test1 buyer, patton+test2 seller, patton@rovertown.com Google OAuth as 3rd bidder).
- Shipped "Marketplace UX / Purchase Flow Cleanup" umbrella (16 sub-bugs) and "Transactions Page for Buyers" — both were Beta-Launch blockers and are now complete.
- Fixed 9 distinct bugs surfaced during E2E testing, most of which were silent failures that would have reached production undetected.
- Validated every email on the auction path: outbid, auction_won, auction_sold, bid_auction_lost, purchase_confirmation, item_sold, payment_received, shipped, rating_request.
- Full feedback flow validated: seller marks shipped → buyer gets shipped + rating_request notifications → buyer leaves feedback → seller rating count updates.

### Bug Fixes Shipped (9)
1. **Flat $1 bid increment** — `src/types/auction.ts` `getBidIncrement` was tiered ($1 / $5 / $25). Now returns $1 at every price level. `calculateMinimumBid` simplified to `currentBid + 1`.
2. **Buy It Now auto-hides when bid exceeds BIN** — `BidForm.tsx` now hides the button when `(currentBid ?? 0) >= buyItNowPrice` rather than always showing it. Removed the `!isHighBidder` gate.
3. **Bid error message styling** — Red bg + red-200 border + `font-semibold` + larger icon. Raw DB `valid_max_bid` Postgres errors translated to friendly "Your max bid must be at least the current bid plus the increment."
4. **`bid_amount` vs `max_bid` integrity** — Losing bids now record `bid_amount = maxBid` (was `newCurrentBid`, which could exceed `max_bid` and fail the DB `valid_max_bid` check constraint).
5. **`processEndedAuctions` idempotent** — Conditional `UPDATE ... WHERE status='active'` with `.select("id")` row-count check. If 0 rows, skip notifications + emails. Prevents duplicate win/sold notifications if cron fires twice.
6. **Clerk profile.email NULL on social sign-in** — `/api/webhooks/clerk` `user.created` now upserts profile with email from Clerk payload; new `user.updated` handler syncs email changes. Previously Google-OAuth users ended up with NULL email → silent email delivery skip.
7. **`getListingComicData` PGRST201** — Added `comics!auctions_comic_id_fkey(...)` qualifier. The `sold_via_auction_id` FK added in the sold-tracking migration created a second FK path that made PostgREST throw on the unqualified embed. This was silently throwing inside the outbid / auction_won / auction_sold try/catch blocks — which is why no auction-path emails had been delivering.
8. **Auction buyer feedback eligibility** — `checkAuctionFeedbackEligibility` now unlocks for buyer on `shipped_at` (mirrors `checkSaleFeedbackEligibility`). Previously buyer had to wait for `completed_at` or 7 days, so even after shipping the "Leave Feedback" button never showed.
9. **`submitFeedback` join FK columns** — All five `.select("..., reviewer:profiles!reviewer_id(first_name, last_name, username)")` calls referenced non-existent columns. Changed to `(display_name, username)` to match the actual `profiles` schema. Insert was succeeding; the returning join was failing, which surfaced as "Failed to submit feedback" in the UI.

### Features Completed
- **`/transactions` page for buyers** — Tabbed view: Wins, Purchases, Bids, Offers. Backed by new `GET /api/transactions?type=...` endpoint with flat `TransactionRow` / `BidRow` / `OfferRow` shapes. "Awaiting Shipment" / "Shipped" / "Pending Payment" / "Paid" pills.
- **Mark-as-shipped flow with ownership gating** — `POST /api/auctions/[id]/mark-shipped` accepts carrier + tracking, sets `shipped_at`, clones comic row to buyer, fires shipped notification. Inline `<MarkAsShippedForm>` renders in seller's view of the listing modal when `paid && !shipped`.
- **Auction-end email templates** — `auction_won`, `auction_sold`, `bid_auction_lost` templates + notification types. All use `getListingComicData` and now deliver correctly.
- **Friendly DB error translation** — `placeBid` translates Supabase `valid_max_bid` and RLS errors to user-facing messages.

### Key Files Modified
- `src/types/auction.ts` — flat $1 increment, `isListingCompleted` / `isListingPendingPayment` type predicates, `shippedAt` / `trackingNumber` / `trackingCarrier` fields
- `src/components/auction/BidForm.tsx` — $1 increment, BIN auto-hide, red-pill bid error, min-bid logic for self-raise
- `src/lib/auctionDb.ts` — idempotent `processEndedAuctions`, outbid email error logging, friendly DB error mapping, FK qualified on 5+ queries
- `src/lib/email.ts` — `getListingComicData` FK qualified, 5 new templates (purchase_confirmation, item_sold, outbid, auction_won, auction_sold)
- `src/lib/creatorCreditsDb.ts` — auction buyer eligibility unlocks on `shipped_at`, FK join columns fixed in 5 places, `FeedbackRow` type updated
- `src/lib/db.ts` — `getOrCreateProfile` self-heals existing profile email if passed
- `src/app/api/webhooks/clerk/route.ts` — upsert profile on `user.created`, sync email on `user.updated`
- `src/app/api/transactions/route.ts` — NEW (tabbed transaction fetch)
- `src/app/transactions/page.tsx` — NEW
- `src/app/api/auctions/[id]/mark-shipped/route.ts` — NEW
- `src/components/auction/MarkAsShippedForm.tsx` — NEW
- `src/components/auction/ListingDetailModal.tsx`, `AuctionDetailModal.tsx` — PaymentButton wiring, MarkAsShippedForm, type predicate usage
- `src/components/NotificationBell.tsx` — `deriveNotificationHref` helper + click routing via `router.push`
- `src/components/Navigation.tsx`, `MobileNav.tsx` — Wallet icon + Transactions link
- `src/app/shop/page.tsx` — `listing` query param routing by `listingType` (not URL tab) — fixes auction-in-BuyNow-modal bug
- `src/app/api/listings/[id]/purchase/route.ts` — returns HTTP 410 deprecated
- `src/app/api/checkout/route.ts` — accepts `listingId` or `auctionId`, validates separately, success_url routes to `/transactions`
- `src/app/api/webhooks/stripe/route.ts` — unified `handleMarketplacePayment`, race-safe refund, FK qualified

### Migrations Applied
- `supabase/migrations/20260422_comic_sold_tracking.sql` — `sold_at`, `sold_to_profile_id`, `sold_via_auction_id` on comics
- `supabase/migrations/20260422_shipping_tracking_option_a.sql` — `shipped_at`, `tracking_number`, `tracking_carrier`, `completed_at`, `ended_at` on auctions

### Data Backfills Applied (via Supabase SQL)
- Backfilled `profiles.email` for user `6411be84-e807-44c5-9c32-89438d9caed0` (Google OAuth patton@rovertown.com) — was NULL, unblocking outbid / win emails for that account.

### Issues Encountered
- **Stale JS bundle** forced hard refreshes multiple times during testing — Turbopack HMR doesn't always pick up server-code changes. Workflow: kill dev server, `rm -rf .next`, restart.
- **Supabase FK ambiguity (PGRST201)** after adding `sold_via_auction_id` FK — broke all PostgREST embeds like `comics(title, issue_number)` until qualified with `comics!auctions_comic_id_fkey(...)`. Fixed in 6+ places across `auctionDb.ts`, `email.ts`, `webhooks/stripe/route.ts`, `transactions/route.ts`.
- **Fire-and-forget email IIFE dropping** in `placeBid` — the outbid email was wrapped in an unawaited async IIFE whose inner errors weren't caught. Converted to awaited call with explicit error log. Would have dropped silently on serverless.
- **Mystery account with NULL email** (`6411be84`) initially looked like a code bug but turned out to be a second Clerk user created via Google OAuth whose email never synced to Supabase `profiles`. Root cause: Clerk webhook wasn't creating profile rows — profile creation was lazy via `getOrCreateProfile`, which accepts optional email and some server routes didn't pass it.

### Where We Left Off
- Full auction + marketplace flow validated locally. Ready for production deploy tonight so user can test with real money + real seller identity tomorrow on `collectors-chest.com`.
- BACKLOG trimmed — "Marketplace UX / Purchase Flow Cleanup" (16 sub-bugs) and "Transactions Page for Buyers" both removed as completed.
- Deploy is next: `npm run check` + build + smoke test, confirm no new env vars need to be added to Netlify, then push to main.

---

## Apr 21, 2026 - Session 36: Stripe Connect Enablement (Test + Live), Marketplace UX Validation, 7 Live Patches

### Summary
- Completed Stripe Connect end-to-end validation in test mode and enabled production Connect in Live mode. Stripe payment infrastructure is now production-ready for real-money testing tomorrow on `collectors-chest.com`.
- Stripe Connect platform setup completed in both Test and Live mode: Marketplace business model, Express account type, Transfers-only capability, platform profile, liability acknowledgements.
- Validated full Buy Now payment flow end-to-end on localhost: seller onboarding → fixed-price listing → buyer purchase → Stripe Checkout → destination charge → `transfer.created` webhook → 5% platform / 95% seller split verified.
- Validated full auction payment flow end-to-end: auction creation → bidding (3 bids, proxy bidding logic validated) → force-end via Supabase REST API → cron processing → winner payment → Stripe Checkout → transfer.
- Live webhook endpoint updated — added `account.updated` event (8 events total now subscribed on `https://collectors-chest.com/api/webhooks/stripe`).
- Discovered and patched a chain of silent-failure bugs in the marketplace transaction flow — 7 live patches shipped (see below).
- Captured 21 new BACKLOG items (5 standalone features + 16 sub-bugs) covering open marketplace UX blockers.
- Created 8-phase Stripe Connect setup doc at `docs/stripe-connect-setup.md`.

### Bug Fixes Shipped (7 live patches)
1. **RLS silent-fail in `purchaseFixedPriceListing`** (`auctionDb.ts:876`): switched from `supabase` → `supabaseAdmin` client. Buyers lacked RLS permission for the UPDATE; regular client silently failed with `success: true` but no DB state change. Root cause of "Purchase Complete!" UI while listing remained active.
2. **RLS silent-fail in `placeBid`** (`auctionDb.ts`): 4 writes (bid insert + bid updates + auction updates) switched to `supabaseAdmin`. Symptom: `"new row violates row-level security policy for table bids"`.
3. **RLS silent-fail in `processEndedAuctions`** (`auctionDb.ts:1834, 1867`): cron processor UPDATE to set `status=ended` switched to `supabaseAdmin`. Symptom: cron returned `processed: 1` but auction stayed `status: active` with `winner_id: null`.
4. **PaymentButton wired into ListingDetailModal** — new amber "Payment required" / "Item reserved" state renders when current user is buyer with payment pending.
5. **PaymentButton wired into AuctionDetailModal** — same pattern for auction winners. Previously AuctionDetailModal had NO payment UI at all.
6. **Notification copy overrides** — `createNotification` accepts optional `{title, message}` overrides. Buy Now purchases now say "Purchase reserved!" / "A buyer completed a Buy Now purchase" instead of auction-specific copy.
7. **Checkout `success_url` fix** — redirected from `/my-auctions` (seller view) to `/collection` for buyer.
8. **UI polish:** mobile sign-in icon button (bypassed Clerk wrapper via `useUser` hook), "SCAN YOUR FIRST BOOK!" guest CTA.

### Key Files Created/Modified
- `src/lib/auctionDb.ts` — RLS fixes (3 functions), notification override param
- `src/components/auction/ListingDetailModal.tsx` — PaymentButton integration, status normalization
- `src/components/auction/AuctionDetailModal.tsx` — PaymentButton integration
- `src/app/api/checkout/route.ts` — `success_url` → `/collection`
- `src/components/Navigation.tsx` — mobile sign-in icon
- `src/app/page.tsx` — "SCAN YOUR FIRST BOOK!" CTA
- `docs/stripe-connect-setup.md` — NEW 8-phase setup guide
- `BACKLOG.md` — 21 new items (5 standalone features + 16 sub-bugs)

### Issues Encountered
- **Clerk auth issue on mobile localhost (via IP 10.0.0.34):** `<SignedIn>` / `<SignedOut>` wrappers silently render nothing when host isn't authorized. Worked around by switching to `useUser()` hook for the sign-in button. Full fix would require adding IP to Clerk dev origins or using ngrok. Not blocking.
- **Initial test-mode Connect call failed** with Stripe error "You can only create new accounts if you've signed up for Connect" — required completing the Connect platform wizard in dashboard (had jumped to Phase 7 testing without confirming Phases 1–6 were done).
- **Modal renders based on URL `tab` param, not `listing_type`** — auction opened via `/shop?listing=<id>` (no tab) routed to Buy Now modal, showing "Buy Now for $X" button on an auction. Captured as backlog bug #9.
- **`expireOffers` cron error:** `"Could not find a relationship between 'auctions' and 'collection_items'"` — stale join definition. Non-blocking (doesn't affect auction processing). Captured as backlog bug #12.

### Where We Left Off
- **Stripe Connect production-ready** for real-money testing tomorrow on `collectors-chest.com`.
- Session 36 code deployed to production via push to main (Netlify auto-deploy).
- 21 new BACKLOG items captured — most critical: #6 comic ownership transfer (buyer pays but never receives comic in collection), transactions page, policy doc gaps.
- User will run real-money tests tomorrow with real seller identity + bank account + real card ($1–2 test transaction).

---
## Older Sessions (Archived)

Sessions older than Session 36 (Apr 21, 2026) — Session 35 back to the January 2026 deploy log — have been moved to [`DEV_LOG_ARCHIVE.md`](./DEV_LOG_ARCHIVE.md) to keep this log lean.
