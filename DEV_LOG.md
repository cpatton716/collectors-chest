# Development Log

This log tracks session-by-session progress on Collectors Chest.

---

## Changes Since Last Deploy

**Last Deploy:** March 26, 2026 (Session 26 — 30-day promo trial link)
**Sessions Since Last Deploy:** 6
**Deploy Readiness:** Needs Testing

### Changes Since Last Deploy:
- Cover image harvesting from graded scans — code complete (9 tasks, 10 commits, 25+ new tests, awaiting manual integration test)
- Clerk Production DNS support ticket filed (SSL not provisioning, awaiting Clerk response Mon Apr 7)
- Cover image validation pipeline — full implementation (11 commits, 38 new tests, 15 files)
- Stripe payment integration — products, webhooks, checkout flow, scan pack purchases
- Post-signup Choose Your Plan page with 7-day trial CTA
- Billing tab fixes — redirect after purchase, scan count display with purchased scans
- Profile page hydration fix (dynamic import)
- Seller Payments loading fix (fallback to default state)
- Pop-art button styling across Profile/Security/Billing tabs
- Publisher clickable links on Stats page → filtered collection
- Sign-up page restored from waitlist to Clerk registration
- Waitlist/private beta copy removed from SignUpPromptModal and GuestLimitBanner
- Pricing page "Most Popular" badge overflow fix
- Display Preferences spacing fix
- Gemini API cost evaluation completed
- 30-day promo trial link (/join/trial) — QR code landing page for conventions, auto-checkout with Stripe, server-rendered
- Webhook improvements — direct trial date write from Stripe, $0 invoice guard, downgrade clears trial_ends_at
- Google Pay / Apple Pay enabled on Stripe checkout
- Checkout route uses getOrCreateProfile for new sign-ups
- Ben-day dots visibility improved for desktop
- DB migration run: 20260320_cover_validation.sql
- Netlify env vars configured, deployed to production
- New site logo/emblem across all icon touchpoints
- Navbar text nowrap fix for mobile
- Transparent emblem/icons across all touchpoints
- iOS Safari hero text fix
- Android speech bubble gap fix
- Clerk Production instance configured (DNS propagating)
- ADMIN_EMAIL code fallbacks updated
- Pricing architecture documented

---

## Apr 5, 2026 - Session 30: Cover Image Harvesting, Clerk Production Support

### Summary
- Implemented cover image harvesting from graded/slabbed comic scans (9 tasks, 10 commits)
- Auto-crops cover artwork from slab photos, uploads to Supabase Storage as WebP, submits to community cover DB
- Pipeline: eligibility check → duplicate check → sharp crop → color variance check → upload → DB submit
- 25+ new tests, 532 total passing
- DB migration run: variant column, unique index, sentinel profile, cover_harvested analytics
- Supabase Storage bucket created (cover-images, public, 500KB limit, image/webp)
- Clerk Production instance DNS verified but SSL not provisioning — support ticket filed in Clerk Discord
- Production auth currently broken (no Sign In button) — awaiting Clerk response Monday Apr 7

### Key Files Created/Modified
- `src/lib/coverHarvest.ts` — New: validation logic + harvest orchestrator
- `src/lib/__tests__/coverHarvest.test.ts` — New: 25 tests for harvest logic
- `src/lib/providers/types.ts` — Added coverHarvestable, coverCropCoordinates fields
- `src/lib/providers/anthropic.ts` — AI prompt expanded for harvest fields, max_tokens 1536
- `src/lib/providers/gemini.ts` — maxOutputTokens 1536
- `src/lib/coverImageDb.ts` — Variant support added
- `src/lib/analyticsServer.ts` — cover_harvested field added
- `src/app/api/analyze/route.ts` — Harvest integration with 2s timeout
- `supabase/migrations/20260405_cover_harvest_support.sql` — Schema changes
- `package.json` — sharp dependency added

### Issues Encountered
- Clerk Production SSL certificates not provisioning despite all 5 DNS CNAME records resolving correctly (3 days and counting)
- Supabase profiles table has NOT NULL on clerk_user_id — migration sentinel profile insert needed clerk_user_id field added
- Clerk Discord support requires onboarding verification before accessing #support channel

### Where We Left Off
- Cover harvesting code complete — needs manual integration test with slabbed comic scan
- Clerk support ticket open — response expected Monday Apr 7
- Sign Up Free CTA needed on guest homepage (identified during Clerk investigation)

---

## Apr 2, 2026 - Session 29: Icons, Clerk Production, Cover Harvest Spec

### Summary
- Replaced site emblem with clean transparent PNG across all icon touchpoints (favicon, PWA, maskable, ChestIcon)
- Fixed iOS Safari hero text white background (WebkitTextStroke → text-shadow)
- Fixed Android speech bubble sub-pixel gap
- Switched Clerk to Production instance — DNS CNAME records added, webhooks configured, API keys deployed
- Completed business setup Step 5 (payment methods on business card)
- Updated ADMIN_EMAIL GitHub secret + code fallbacks to admin@collectors-chest.com
- Renamed GitHub repo from collectors-catalog to collectors-chest
- Cleared all marketplace test data (auctions, listings, trades, offers, feedback)
- Documented full pricing architecture (4 entry paths) in ARCHITECTURE.md
- Wrote and triple-reviewed cover image harvesting spec (Rev 3, 25 findings addressed)
- Wrote implementation plan for cover harvesting (10 tasks, ~2.5hr estimated)
- Full backlog reconciliation — verified 26 open items against codebase
- Supabase project renamed to Collectors Chest

### Key Files Created/Modified
- `src/app/page.tsx` — iOS text-shadow fix for hero heading
- `src/app/globals.css` — Android speech bubble 1px overlap fix
- `src/components/icons/ChestIcon.tsx` — Switched to transparent emblem.png
- `src/app/layout.tsx` — Favicon updated
- `src/app/api/admin/health-check/route.ts` — Admin email fallback updated
- `src/app/api/admin/usage/check-alerts/route.ts` — Admin email fallback updated
- `public/icons/` — All PWA icons regenerated from clean transparent source
- `public/favicon.png` — Regenerated from clean source
- `ARCHITECTURE.md` — Pricing architecture section added
- `BACKLOG.md` — Major reconciliation, 8 items closed, 3 new items added
- `docs/superpowers/specs/2026-04-02-cover-image-harvesting-design.md` — Rev 3 spec
- `docs/superpowers/plans/2026-04-02-cover-image-harvesting.md` — Implementation plan

### Issues Encountered
- SVG from Illustrator was ~1MB with white background artifacts; used sharp to clean and regenerate PNGs
- iOS Safari renders WebkitTextStroke differently, causing white fill behind text — fixed with text-shadow stack
- Clerk Production SSL certificate not yet provisioned — auth broken on production until DNS fully propagates
- Supabase service role key mismatch prevented running SQL cleanup from CLI — used SQL Editor instead

### Where We Left Off
- Clerk Production DNS: 2/5 verified, 3 email DKIM records pending (can take 24-48h)
- Welcome email test blocked until Clerk SSL provisions
- Cover image harvesting: spec approved, implementation plan ready, first pickup next session

---

## Mar 30, 2026 - Session 28: Site Logo/Branding Update — New Collectors Chest Emblem

### Summary
- Updated site logo/branding with new Collectors Chest emblem
- Replaced old blue treasure chest SVG icons with new pop-art style emblem PNG across all icon touchpoints

### Key Files Created/Modified
- `src/components/icons/ChestIcon.tsx` — Replaced inline SVG with img tag pointing to new PNG
- `src/components/Navigation.tsx` — Updated icon size to 56, added whitespace-nowrap for mobile
- `src/app/sign-up/[[...sign-up]]/page.tsx` — Updated icon size to 72
- `src/app/layout.tsx` — Changed favicon from SVG to PNG
- `public/icons/` — Replaced all PWA icons (192, 512, maskable variants)
- `public/favicon.png` — New 32px favicon
- `BACKLOG.md` — Added SVG logo replacement item

### Files Removed
- `public/favicon.svg`, `public/icons/*.svg` — Old SVG icon variants
- `new icons/` — Old icon files

### Issues Encountered
- Original PNG had no transparency (white background baked in) — used Python Pillow to remove white background
- sips (macOS) can't generate .ico files — used PNG favicon instead
- Dev server lock file issues required manual cleanup

### Where We Left Off
- New emblem deployed across all icon touchpoints
- Old SVG icons removed from repo

---

## Mar 26, 2026 - Session 26: 30-Day Promo Trial Link for Conventions

### Summary
- Built /join/trial landing page for QR code convention sign-ups with 30-day free Premium trial
- Server-rendered page with Lichtenstein pop-art design, comic sound effect bullets (POW!, BAM!, ZAP!, BOOM!, WHAM!, KAPOW!)
- Stripe checkout auto-starts from choose-plan page with 30-day trial on monthly plan ($4.99/mo after)
- Webhook writes trial dates directly from Stripe data (bypasses startTrial guard)
- $0 trial invoice guard prevents status overwrite
- downgradeToFree() now clears trial_ends_at
- Google Pay / Apple Pay enabled (removed payment_method_types restriction)
- Fixed profile creation race condition for new promo sign-ups
- Plan went through 5 rounds of deep-dive reviews (general, convention UX, Stripe audit)
- Deployed to production, DB migration run

### Key Files Created/Modified
- 3 new: join/trial/page.tsx, PromoTrialActivator.tsx, PromoTrialCTA.tsx
- 2 new: promoTrial.ts + tests, choosePlanHelpers tests
- 8 modified: checkout route, webhook, subscription.ts, choose-plan page, useSubscription, billing status, choosePlanHelpers

### Issues Encountered
- Profile not found on new sign-ups (checkout used getProfileByClerkId instead of getOrCreateProfile — fixed)
- Stripe success redirect used localhost URL on mobile (NEXT_PUBLIC_APP_URL env var issue — fixed in Netlify)
- Ben-day dots too subtle on desktop (increased opacity and dot size)

### Where We Left Off
- Promo trial feature complete and deployed
- QR code URL ready: https://collectors-chest.com/join/trial
- Stripe Connect seller payouts still untested (deferred to future session)

---

## Mar 25, 2026 - Session 25: Stripe Payment Integration & Public Registration

### Summary
- Stripe payment integration (products, webhook, checkout), post-signup plan selection page, billing tab UX fixes, re-enabled public registration, pop-art button styling, publisher clickable stats, Gemini cost evaluation

### Key Files Created/Modified
- 10 modified, 4 new (choose-plan page, helpers, tests, plan doc)

### Issues Encountered
- Hydration errors on profile/stats pages (fixed with dynamic import and sandbox Stripe keys)
- Seller Payments stuck loading (fixed with fallback state)

### Where We Left Off
- Stripe integration complete on current branch
- DB migration still required: run 20260320_cover_validation.sql BEFORE deploy
- New Netlify env vars required: 7 Stripe variables + NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL

---

## Mar 20, 2026 - Session 24: Cover Image Validation Pipeline Implementation

### Summary
- Implemented the complete cover image validation pipeline from the design spec (15 rounds of review, ~85 issues addressed in spec)
- Two-stage pipeline: candidate gathering (Community DB → eBay listings → Open Library) + Gemini 2.0 Flash vision validation
- Shared title normalization utility (normalizeTitle.ts) — single source of truth for comic_metadata and cover_images queries
- Query fix: .ilike() → .eq() in all comic_metadata queries, with pre-normalization
- Redis cache key alignment with DB normalization
- Rate limiting added to con-mode-lookup route (was missing)
- Fire-and-forget saves converted to await in 4 routes (Netlify serverless compliance)
- Code review: 1 blocker (accepted — spec bug), 3 warnings fixed, 3 suggestions deferred
- 11 commits, 38 new tests (459 total), 15 files changed

### Key Files Created/Modified
- `src/lib/normalizeTitle.ts` (NEW — shared normalization)
- `src/lib/coverValidation.ts` (NEW — pipeline core, Gemini validation, URL safety)
- `src/lib/__tests__/normalizeTitle.test.ts` (NEW — 11 tests)
- `src/lib/__tests__/coverValidation.test.ts` (NEW — 24 tests)
- `supabase/migrations/20260320_cover_validation.sql` (NEW — migration SQL)
- `src/lib/db.ts` (modified — .ilike→.eq, cover fields, conditional upsert)
- `src/lib/cache.ts` (modified — aligned cache keys)
- `src/lib/coverImageDb.ts` (modified — shared normalizers, approveCover sync)
- `src/lib/metadataCache.ts` (modified — SAVEABLE_FIELDS + interface)
- `src/app/api/con-mode-lookup/route.ts` (modified — pipeline integration, rate limiting)
- `src/app/api/analyze/route.ts` (modified — pipeline fallback, coverImage rename)
- 3 other API routes (modified — normalization)

### Issues Encountered
- Spec bug: normalizeIssueNumber regex only stripped leading # but test case required stripping all #. Fixed in both TS and SQL.
- coverImageDb import chain issue (db→cache→upstash→uncrypto) required jest.mock in test
- Review found coverValidated:true set even when pipeline failed — fixed to be conditional

### Where We Left Off
- Implementation complete on feat/cover-image-validation branch (not merged to main)
- DB migration SQL ready at supabase/migrations/20260320_cover_validation.sql
- Must run migration in Supabase SQL Editor BEFORE deploying code
- After migration + deploy: existing covers re-validate organically on next lookup

---

## Mar 19, 2026 - Session 23: eBay Browse API Migration

### Summary
- eBay Browse API migration: Replaced dead Finding API (decommissioned Feb 2025) with Browse API for real pricing from active eBay listings. 32 files changed, 1,006 insertions / 1,508 deletions.
- New `ebayBrowse.ts` module: OAuth 2.0 auth, Browse API search, outlier filtering, grade multipliers (410 lines, 33 new tests)
- "Listed Value" labels replace "Estimated Value" / "AI Estimate" / "Technopathic Estimate" across all components
- All AI price estimation code removed — no more fabricated prices
- Deleted `ebayFinding.ts` (484 lines dead code)
- eBay Developer account verified — Browse API confirmed working with production credentials
- SQL migration run in Supabase to clear AI-fabricated prices from both `comic_metadata` and `comics` tables
- Bug fixes: auto-scroll to first field on manual entry, exclude base64 image data from CSV export
- Cover image validation pipeline design spec written — 15 rounds of sr. engineering review (~85 issues found and fixed). Addresses wrong cover images (e.g., Batman #423 showing 2000 AD cover). Implementation planned for next session.
- New env var deployed: `EBAY_CLIENT_SECRET` added to Netlify

### Key Files Created/Modified
- `src/lib/ebayBrowse.ts` (NEW — OAuth, search, filtering, grade multipliers)
- `src/lib/__tests__/ebayBrowse.test.ts` (NEW — 33 tests)
- `src/lib/ebayFinding.ts` (DELETED)
- 5 API routes updated (analyze, con-mode-lookup, quick-lookup, comic-lookup, import-lookup, ebay-prices, hottest-books)
- 7 UI components updated
- `docs/superpowers/specs/2026-03-19-cover-image-validation-design.md` (NEW — cover validation spec)

### Issues Encountered
- SQL migration initially targeted wrong column (`price_source` doesn't exist — data is inside `price_data` JSONB)
- Second migration needed for `comics` table (user collection records had cached AI prices)
- Worktree test runner picked up stale test copies

### Deploy Status
- Deployed to production during session
- New env var `EBAY_CLIENT_SECRET` added to Netlify before deploy
- SQL migrations run post-deploy

### Where We Left Off
- Cover image validation pipeline design spec is complete and ready for implementation next session
- 2 post-deploy bug fixes committed (auto-scroll on manual entry, base64 exclusion from CSV export)

---

## Mar 18, 2026 PM - Session 22: eBay Browse API Design & Planning

### Summary
- Discovered eBay Finding API is dead (decommissioned Feb 2025) — all pricing calls silently failing, falling back to AI-fabricated estimates
- Designed and planned eBay Browse API replacement (active listings instead of sold data)
- 8 rounds of senior engineering review on the implementation plan
- Admin email updated to admin@collectors-chest.com across all 4 legal pages
- Re-tested Session 21 feedback items: 8 confirmed working, 3 still broken, 8 need retest

### Key Design Decisions
- "Listed Value" label (median of active FIXED_PRICE listings, minimum 3 listings)
- No AI price fallback — show "No pricing data available" when no eBay data
- 12-hour cache TTL (active listings change faster than sold data)
- Database migration to clear fabricated AI prices

### Key Files Created
- `docs/superpowers/specs/2026-03-18-ebay-browse-api-design.md` — Design spec
- `docs/superpowers/plans/2026-03-18-ebay-browse-api.md` — Implementation plan (13 tasks, 32 files)

### Issues Encountered
- eBay Finding API returns error 10001 (rate limit = 0, API shut down)
- Marketplace Insights API (replacement) requires eBay business approval — effectively unavailable for indie developers
- Implementation plan required 8 review rounds to reach clean pass due to cascading type changes, dead code cleanup, and transition window guards

### Where We Left Off
- Implementation plan has been through 8 sr. engineering reviews with all issues fixed
- Plan needs one more clean pass review before implementation begins
- 3 feedback items from Session 21 still broken: #4 (financial toggle), #10 (notifications overflow), #12 (Key Hunt dark theme)

---

## Mar 18, 2026 - Session 21: Massive Bug Fix & Scanner Enhancement Session

### Summary
- Addressed all 21 feedback items from production mobile testing (FEEDBACK_MAR_18.md)
- Key Info overhaul: keyInfoSource tracking, year disambiguation for 403+ curated entries, production data migration (117 comics reviewed, 53 replaced, 12 cleared)
- Scanner fixes: SHA-256 image hash (Chamber of Chills fix), atomic scan limit enforcement, AI price source persistence
- New Gemini fallback provider (Claude → Gemini chain, low-confidence auto-fallback, "Cerebro" badge)
- Metron API integration as non-blocking verification layer (8 tests)
- Merged system prompt with vintage/foil/variant expertise
- Comic Vine cover search now includes year for volume disambiguation
- UI fixes: Hot Books link, scan limit error message, self-follow prevention, logo red fix, notifications overflow, Key Hunt autofocus, scroll-to-top, select button label, financial toggle race condition, Android layout, public page pop-art styling, action buttons wrapping
- New features: unlimited signatures for raw books, variant detection in scan prompt, foil cover UI tip
- Curated DB enriched: 16 copper/modern age keys fleshed out with variant/edition details
- Gemini provider order fix (was never actually being used as primary despite config)
- Comic Vine barcode lookup removed entirely (unreliable UPC data)
- AI price estimation (Call 3) disabled (showing fake prices)
- Barcode catalog lookup wired into analyze route
- eBay search special character fix (apostrophes/colons stripped)
- "No data" cache TTL reduced to 1 hour

### Key Files Modified
Too many to list individually — touches ~30 files across providers, components, API routes, types, database, and tests

### Issues Encountered
- API overload (529) on initial subagent dispatch, worked around by executing directly

### Deploy Notes
- Ready for deploy to test scanner improvements in real production conditions

---

## Mar 13, 2026 - Session 20: Legal Pages & Visual Polish

### Summary
- Finalized all 4 legal pages with Twisted Jester LLC business info (replaced all placeholders)
- Added scattered ben-day dots accents across About, Homepage, and Pricing pages
- Removed Professor's Hottest Books from homepage (deleted) and navigation (commented out)
- Fixed navigation dropdown overflow on short viewports
- Highlighted About page placeholder text in red for next review pass

### Key Files Modified (10 files, +81/−228 lines)
- `src/app/privacy/page.tsx` — LLC placeholders replaced
- `src/app/terms/page.tsx` — LLC placeholders replaced, state, arbitration location
- `src/app/acceptable-use/page.tsx` — LLC placeholders replaced
- `src/app/cookies/page.tsx` — LLC placeholders replaced
- `src/app/about/page.tsx` — Dots accents, placeholder text highlighted red
- `src/app/page.tsx` — Hottest Books section removed, dots accents added
- `src/app/pricing/page.tsx` — Dots accents added
- `src/components/Navigation.tsx` — Hottest Books link/FAQ commented out, dropdown scroll fix
- `src/components/MobileNav.tsx` — Hottest Books link commented out

### Issues Encountered
- Dev server kept dying during session due to port conflicts from build commands
- `.docx` files couldn't be read directly — extracted via Python zipfile/XML parsing

### Deploy Notes
- Ready for deploy — all quality checks passing (386 tests, clean TypeScript, clean lint, clean build)

---

## Mar 11, 2026 - Session 19: Partner Feedback Blitz & Financials Toggle

### Summary
- Addressed all Mar 6 partner feedback items (#4–#10): homepage blurb, financials toggle, FAQ entry, grade sort, grade multiselect pills, grading company filter, grading company deep links
- Fixed age verification modal infinite loop (Redis profile cache not invalidated after age_confirmed_at write)
- Hidden AI-generated "Recent Sales" when priceSource === "ai" in 3 components (ComicDetailModal, ComicDetailsForm, PublicComicModal)
- Restored approved tagline "Scan comics. Track value. Collect smarter." + added descriptive subtitle for guests
- Fixed CONNECT_REQUIRED raw error code → "Please connect your Stripe account before proceeding."
- Created FEEDBACK_MAR_11.md for partner meeting
- Added show_financials preference (collection page toggle + Account Settings, persists per-account via Supabase)
- New API route: /api/settings/preferences (GET/PATCH)
- New migration: 20260311_add_show_financials.sql
- Deployed multiple times during partner meeting for live testing

### Key Files Modified (15 files, +426/−70 lines)
- `src/app/collection/page.tsx` — URL params, grade sort, filters, financials toggle
- `src/components/CollectionStats.tsx` — Multiselect grade pills, clickable grading company counts
- `src/components/CustomProfilePage.tsx` — Financials toggle in account settings
- `src/app/api/age-verification/route.ts` — Cache invalidation fix
- `src/components/auction/ListInShopModal.tsx` — CONNECT_REQUIRED friendly message
- `src/components/ComicDetailModal.tsx` — Hide AI fake sales
- `src/components/ComicDetailsForm.tsx` — Hide AI fake sales
- `src/components/PublicComicModal.tsx` — Hide AI fake sales

### Key Files Created
- `src/app/api/settings/preferences/route.ts` — GET/PATCH user preferences
- `supabase/migrations/20260311_add_show_financials.sql` — show_financials column

### Issues Encountered
- **Age verification modal loop** — Redis profile cache (5-min TTL) was not invalidated after writing age_confirmed_at to Supabase, causing modal to re-appear on every page load
- **AI-generated "Recent Sales"** — Fake dates shown alongside "No eBay data" disclaimer; hidden when priceSource === "ai"
- **CONNECT_REQUIRED raw error** — Stripe error code shown directly to users in shop listing modal

### Deploy Notes
- Multiple deploys during partner meeting for live testing (March 11, 2026)

---

## Mar 9, 2026 - Session 18: Branding & About Page

### Summary
- Finalized tagline and mission statement with partner approval
- Updated branding copy across hero section, meta description, sign-up page, and navigation FAQ
- Created new About page with placeholder sections for Our Story, Meet the Team, and Contact
- Added About link to navigation for both guest and registered users
- Deployed all changes to production

### Key Files Modified
- `src/app/page.tsx` — Hero tagline updated
- `src/app/layout.tsx` — Meta description updated
- `src/app/sign-up/[[...sign-up]]/page.tsx` — Mission statement added, benefit text updated
- `src/components/Navigation.tsx` — FAQ answer updated, About nav link added
- `src/app/about/page.tsx` — New About page created

### Key Files Created
- `src/app/about/page.tsx` — About page with Lichtenstein pop-art design

### Issues Encountered
- None

### Deploy Notes
- Deployed to production March 11, 2026

---

## Mar 9, 2026 - Session 17: Self-Healing Model Update Pipeline

### Summary
- Designed and implemented a self-healing model update pipeline using GitHub Actions that automatically detects, replaces, tests, and deploys Anthropic model changes
- Pipeline runs daily at 6 AM UTC, probing both PRIMARY and LIGHTWEIGHT models via vision requests
- Completed 3 rounds of Sr. Engineering review (18 → 9 → 5 findings, 0 critical in final round)
- Successfully tested healthy path via manual workflow trigger

### Key Accomplishments
1. **Model Health Pipeline** — GitHub Actions workflow that probes Anthropic models, auto-discovers replacements, updates `src/lib/models.ts`, runs tests, deploys via git push to main, smoke tests, and rolls back on failure.
2. **Email Alerting** — Resend-based alerts on every pipeline outcome: success, failure, rollback, and weekly heartbeat.
3. **Pipeline Scripts** — 7 TypeScript scripts in `.github/scripts/` covering model probing, replacement discovery, code updates, deployment, rollback, email alerts, and heartbeat.
4. **GitHub Secrets Setup** — Configured ANTHROPIC_API_KEY, RESEND_API_KEY, ADMIN_EMAIL, and CRON_SECRET. Updated PAT with workflow scope for pushing GitHub Actions files.
5. **Sr. Engineering Reviews** — 3 rounds of review drove findings from 18 → 9 → 5, with 0 critical issues in the final round.

### Key Files Created
- `.github/workflows/model-health-check.yml` — Daily workflow definition
- `.github/scripts/probe-model.ts` — Vision-based model health probe
- `.github/scripts/find-replacement.ts` — Auto-discovery of replacement models
- `.github/scripts/update-model-code.ts` — Updates model constants in source
- `.github/scripts/deploy.ts` — Git push deployment with verification
- `.github/scripts/rollback.ts` — Automated rollback on failure
- `.github/scripts/send-alert.ts` — Resend email notifications
- `.github/scripts/heartbeat.ts` — Weekly heartbeat check
- `.github/SECRETS_SETUP.md` — Documentation for required GitHub secrets
- `docs/plans/2026-03-06-self-healing-model-pipeline.md` — Implementation plan

### Issues Encountered
- PAT needed `workflow` scope to push `.github/workflows/` files — updated token permissions
- CRON_SECRET was missing from `.env.local` — generated and added during session

### Deploy Notes
- Pipeline code pushed and verified on GitHub Actions. No production deploy of app code needed (pipeline is CI/CD infrastructure only).

---

## Mar 6, 2026 - Session 16: Trial Button & Lightbox Fixes

### Summary
- Fixed two user-facing bugs identified during partner testing: non-responsive trial button on stats page and cover lightbox not rendering on mobile
- Created feedback tracking document from partner testing session
- Reset trial for admin test account via direct Supabase query

### Key Accomplishments
1. **Trial Button Fix** — Extracted UpgradePrompt component from FeatureGate.tsx with proper loading state and error feedback. Fixed silent-failure pattern where button click did nothing.
2. **Cover Lightbox Fix** — Switched from Next.js Image fill to plain img tag in ComicDetailModal.tsx to resolve mobile rendering issue.
3. **FeatureButton Fix** — Applied same silent-failure pattern fix to FeatureButton component.
4. **Partner Feedback Doc** — Created FEEDBACK_MAR_6.md documenting 10 feedback items from partner testing session.

### Key Files Modified
- `src/components/FeatureGate.tsx` — Extracted UpgradePrompt component, added loading/error states
- `src/components/ComicDetailModal.tsx` — Fixed cover lightbox image rendering on mobile

### Key Files Created
- `FEEDBACK_MAR_6.md` — 10 feedback items from partner testing

### Issues Encountered
- Mobile dev server not accessible from phone — needed `--hostname 0.0.0.0` flag
- Admin trial already expired, needed manual Supabase reset to test trial flow

---

## Mar 3, 2026 - Session 15: Scan Resilience Monitoring & Deploy

### Summary
- Completed scan resilience monitoring layer (3 features) and deployed all scan resilience + scan cost dashboard code to production
- Ran Supabase migration for provider tracking columns
- 386 tests passing (16 new)

### Key Accomplishments
1. **Fallback Rate Alerting** — Extended check-alerts cron with AI fallback rate monitoring (warn 10%, critical 25%). Pure helper function with 7 unit tests.
2. **Provider Health Check Route** — Standalone `/api/admin/health-check` endpoint that probes each configured AI provider with minimal API call, sends Resend email alerts when providers are unhealthy (Anthropic down = critical, OpenAI down = warning). 6 unit tests.
3. **PostHog Provider Tracking** — Enhanced `comic_scanned` event with provider, fallbackUsed, and fallbackReason metadata from scan responses. 3 unit tests.
4. **Deployed** — Pushed scan cost dashboard + scan resilience Phase 1 + monitoring to production. Ran scan_analytics provider migration in Supabase.

### Key Files Added
- `src/app/api/admin/usage/check-alerts/fallbackRate.ts` — Fallback rate calculation helper
- `src/app/api/admin/usage/__tests__/check-alerts-fallback.test.ts` — 7 tests
- `src/app/api/admin/health-check/route.ts` — Health check API route
- `src/app/api/admin/health-check/probeProviders.ts` — Provider probe logic
- `src/app/api/admin/health-check/__tests__/probeProviders.test.ts` — 6 tests
- `src/components/__tests__/trackScan.test.ts` — 3 tests
- `docs/plans/2026-03-03-finish-scan-resilience.md` — Implementation plan

### Key Files Modified
- `src/app/api/admin/usage/check-alerts/route.ts` — Added fallback rate metric (#7)
- `src/components/PostHogProvider.tsx` — Added buildScanEventProps helper
- `src/app/scan/page.tsx` — Pass _meta to trackScan on success

### Issues Encountered
- None — clean execution via subagent-driven development

---

## Mar 1, 2026 - Session 14: Scan Cost Dashboard & Multi-Provider Fallback

### Summary
- Built complete Scan Cost Dashboard (Tasks 1-8) with analytics table, recording helpers, route instrumentation, admin UI, and threshold alerts
- Implemented Scan Resilience Phase 1 — Multi-Provider Fallback (9 tasks) with provider abstraction, Anthropic/OpenAI providers, fallback orchestrator, and UX improvements
- Updated backlog with deployment steps and alerting tiers for scan resilience

### Key Accomplishments
1. **Scan Cost Dashboard** (Tasks 1-8 complete):
   - Created `scan_analytics` table and migration
   - Added `recordScanAnalytics` helper with tests
   - Added display helpers for scan cost formatting
   - Instrumented all 4 Anthropic-calling routes (analyze, comic-lookup, con-mode-lookup, import-lookup, quick-lookup)
   - Added scan analytics aggregation to admin usage API
   - Added scan cost section to admin usage page
   - Added scan cost threshold alerts to check-alerts route

2. **Scan Resilience Phase 1 — Multi-Provider Fallback** (9 tasks, all complete):
   - Designed multi-provider fallback system (2 rounds of Sr. Engineering review, 24 findings incorporated)
   - Created provider abstraction layer (AIProvider interface)
   - Extracted AnthropicProvider from analyze route
   - Built OpenAIProvider for GPT-4o fallback
   - Built fallback orchestrator with per-call fallback, error classification, dynamic timeout budget
   - Added provider tracking to scan analytics (migration run)
   - Refactored analyze route (-119 lines, 3 inline calls replaced by orchestrator)
   - Added "taking longer" UX message for fallback scenarios
   - 370 tests passing, 0 type errors, 0 lint errors, build clean

3. **Backlog Updates:**
   - Added "Finish Scan Resilience" with 8 deployment steps + alerting tiers

### Key Files Added
- `src/lib/providers/types.ts` — AIProvider interface and provider types
- `src/lib/providers/anthropic.ts` — AnthropicProvider implementation
- `src/lib/providers/openai.ts` — OpenAIProvider (GPT-4o fallback)
- `src/lib/aiProvider.ts` — Fallback orchestrator
- `supabase/migrations/20260301_scan_analytics_provider.sql` — Provider tracking migration
- Multiple test files (62 new tests for provider system)

### Key Files Modified
- `src/lib/analyticsServer.ts` — Provider-aware cost tracking
- `src/app/api/analyze/route.ts` — Major refactor (-119 lines, orchestrator integration)
- `src/app/scan/page.tsx` — UX improvements for fallback scenarios

### Issues Encountered
- None significant — all 9 tasks executed cleanly via subagent-driven development

---

## Feb 27, 2026 - Session 13: Scan Outage Fix, Scan Resilience Design, API Cancellations

### Summary
- Fixed production scanning outage — `claude-sonnet-4-latest` model alias was invalid, pinned to `claude-sonnet-4-20250514`
- Deployed hotfix immediately to restore scanning
- Brainstormed and designed scan resilience solution: multi-provider fallback (Anthropic -> OpenAI GPT-4o)
- Wrote complete design doc for scan resilience at `docs/plans/2026-02-27-scan-resilience-design.md`
- Cancelled Marvel API integration (developer program deprecated)
- Cancelled GoCollect API integration (API program discontinued)
- Sent Marvel follow-up blurb to user (before learning about deprecation)

### Key Files Added
- `docs/plans/2026-02-27-scan-resilience-design.md` — Multi-provider scan resilience design

### Key Files Modified
- `src/lib/models.ts` — Pinned MODEL_PRIMARY to explicit model version `claude-sonnet-4-20250514`
- `EVALUATION.md` — Cancelled Marvel/GoCollect items
- `BACKLOG.md` — Cancelled Marvel/GoCollect, added scan resilience item
- `CLAUDE.md` — Updated external APIs and costs for discontinued services

### Issues Encountered
- `claude-sonnet-4-latest` model alias not recognized by Anthropic API — caused all scans to fail with "temporarily busy" error
- Root cause: model alias format not valid for user's API key
- Fix: pin to explicit version `claude-sonnet-4-20250514`

**Deployed:** February 27, 2026 — Hotfix for scan outage (model pinning)

---

## Feb 27, 2026 - Session 12: Legal Update Briefing & Close Up Shop Skill Rewrite

### Summary
- Created comprehensive legal update briefing for lawyer covering Creator Credits, Community Cover Database, Age Verification, and Google CSE removal
- Rewrote Close Up Shop end-of-session skill with mandatory task tracking, concrete grep commands, and verification checkpoints to prevent skipped steps

### Key Accomplishments
- Created 14-item legal checklist for lawyer to update Terms of Service, Privacy Policy, Acceptable Use Policy, and Cookie Policy
- Rewrote Close Up Shop skill with enforcement mechanisms: mandatory TaskCreate per phase, concrete grep-based Phase 3 cleanup, Phase 4 verification checkpoint

### Key Files Added
- `Legal Docs/Legal_Update_Briefing_Feb_2026.md` — Comprehensive legal update briefing for lawyer

### Key Files Modified
- `~/.claude/skills/collectors-chest-close-up-shop/SKILL.md` — Close Up Shop skill rewritten (outside project repo)

### Issues Encountered
- Identified that Close Up Shop skill was being executed from memory rather than tracked tasks, leading to skipped steps in previous sessions

**Deployed:** February 27, 2026 — Includes Sessions 10-12 (Netlify bandwidth tracking, Google CSE removal, Creator Credits rename, legal page updates)

---

## Feb 26, 2026 - Google CSE Removal, Creator Credits Rename, Cover Submission Flow

### Summary
- Investigated Google CSE 403 errors — discovered Custom Search JSON API is closed to new customers
- Investigated Bing Image Search API — also retired (August 11, 2025)
- Removed all Google CSE code, env vars, usage tracking, and alert thresholds
- Evaluated alternatives: Brave Search API, SerpAPI, Metron.cloud — decided to skip external image search for now
- Implemented manual URL paste → community cover submission (pending for admin approval)
- Renamed reputation system to "Creator Credits" across entire codebase
- Wired cover image approvals to award Creator Credits to submitters
- Updated Creator Credit tiers: 1-9 (Contributor), 10-25 (Verified), 26+ (Top)
- Added "cover_image" contribution type to community_contributions
- Added backlog items: Error Reporting System, Missing Metadata Contributions
- Ran Supabase migration for cover_image contribution type

### Key Files Added
- `src/types/creatorCredits.ts` — Creator Credits type definitions
- `src/lib/creatorCreditsDb.ts` — Creator Credits DB helpers
- `src/components/creatorCredits/CreatorBadge.tsx` — Badge components
- `src/components/creatorCredits/FeedbackList.tsx` — Moved from reputation/
- `src/components/creatorCredits/FeedbackModal.tsx` — Moved from reputation/
- `src/components/creatorCredits/LeaveFeedbackButton.tsx` — Moved from reputation/
- `src/components/creatorCredits/SellerResponseForm.tsx` — Moved from reputation/
- `supabase/migrations/20260226_add_cover_image_contribution_type.sql` — Migration
- `docs/plans/2026-02-26-bing-image-search-design.md` — Design doc with decision

### Key Files Modified
- `src/components/ComicDetailsForm.tsx` — Cover paste now submits to community DB
- `src/app/api/admin/cover-queue/route.ts` — Awards Creator Credits on approval
- `src/app/api/cover-candidates/route.ts` — Removed Google CSE, updated comments
- `src/app/api/admin/usage/route.ts` — Removed Google CSE tracking
- `src/app/api/admin/usage/check-alerts/route.ts` — Removed Google CSE alerts
- `src/components/CustomProfilePage.tsx` — Reputation → Creator Credits UI
- 15+ files updated for reputation → Creator Credits rename

### Issues Encountered
- Google Custom Search JSON API closed to new customers — 403 after 22+ hours
- Bing Search APIs retired August 11, 2025
- No viable free image search API available currently

---

## Feb 25, 2026 - Cover Image Search System, Admin Cover Queue, UX Fixes, Deploy

### Summary
- Built complete cover image search system replacing Comic Vine with Google CSE + Claude AI + community cover database
- Added admin cover queue for variant approval
- Removed Comic Vine API from import-lookup
- Fixed CSV drag-and-drop (was opening file in browser)
- Fixed grade normalization ("3" → "3.0")
- Added Footer component to all pages
- Added collection deletion safety (blocks delete if active shop listing)
- Changed single delete to soft delete with undo toast
- Redesigned delete confirmation as centered overlay modal
- Fixed undo toast timer resetting on click
- Set up Google Cloud Console + Programmable Search Engine (14 comic domains)
- Upgraded Google Cloud from Free Trial to paid account
- Added GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX to Netlify

### Key Files Added
- `src/lib/coverImageDb.ts` — Cover image database helpers
- `src/lib/__tests__/coverImageDb.test.ts` — Cover image DB tests
- `src/app/api/cover-candidates/route.ts` — Cover candidate search API
- `src/app/api/cover-images/route.ts` — Cover images API
- `src/app/api/admin/cover-queue/route.ts` — Admin cover queue API
- `src/app/admin/cover-queue/page.tsx` — Admin cover queue page
- `src/components/CoverReviewQueue.tsx` — Cover review queue component
- `src/components/Footer.tsx` — Site-wide footer component
- `supabase/migrations/20260225_cover_images.sql` — Cover images migration
- `docs/plans/2026-02-25-cover-image-search-design.md` — Cover image search design plan

### Key Files Modified
- `src/components/ComicDetailModal.tsx` — Delete modal redesign, active listing warning
- `src/components/CSVImport.tsx` — Drag-drop fix, grade normalization
- `src/app/collection/page.tsx` — Soft delete with undo toast
- `src/app/api/comics/bulk-delete/route.ts` — Active listing check before delete
- `src/lib/db.ts` — deleteComic uses API route

### Issues Encountered
- Google CSE returning 403 — billing propagation delay after upgrading to paid account, still waiting
- Comic Vine was still referenced in import-lookup despite being "removed" previously

### Deploy
- Deployed to Netlify, February 25, 2026
- Added GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX to Netlify env vars

---

## Feb 19, 2026 - Session 2 (Cost Monitoring, Age Gate, Sentry, Deploy)

### Summary
- Implemented 18+ age gate with just-in-time marketplace gating (8 tasks)
- Built 3-layer cost monitoring system: metadata cache, admin alert badge, PostHog server-side instrumentation (8 tasks)
- Updated EVALUATION.md with Post-Launch Revisit section (18 items)
- Closed Dynamsoft SDK backlog item
- Reactivated Sentry error tracking (added SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN to Netlify)
- Set Anthropic dashboard spending cap ($100/month)
- Deployed to production

### Key Files Added
- `src/lib/metadataCache.ts` — fill-only merge helper for metadata cache
- `src/lib/alertBadgeHelpers.ts` — badge color mapping
- `src/lib/analyticsServer.ts` — server-side PostHog with cost estimation
- `src/components/AdminAlertBadge.tsx` — dot/count alert badge variants
- `src/app/api/admin/usage/alert-status/route.ts` — lightweight polling endpoint
- `src/components/AgeVerificationModal.tsx` — pop-art age verification modal
- `src/lib/ageVerification.ts` — age gate helpers
- `src/app/api/age-verification/route.ts` — age verification API
- `supabase/migrations/20260219_add_age_confirmed_at.sql` — age gate migration
- `docs/plans/2026-02-19-cost-monitoring-api-optimization.md` — implementation plan

### Key Files Modified
- `src/app/api/analyze/route.ts` — dual-layer metadata cache + PostHog instrumentation
- `src/app/admin/layout.tsx`, `Navigation.tsx`, `MobileNav.tsx` — alert badge wiring
- 5 marketplace API routes — age verification gate (403 AGE_VERIFICATION_REQUIRED)
- 7 UI components — age verification modal integration
- `src/app/my-auctions/page.tsx` — listing cap UI badge

### Issues Encountered
- None — all 16 tasks (8 age gate + 8 cost monitoring) completed cleanly

### Deploy
- Deployed to Netlify (pushed to main)
- Added SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN to Netlify env vars
- Sentry now active on free Developer plan (5K errors/month)

---

## Feb 18, 2026 - Session 10 (Real-Time Messaging, Search Optimization, Icons, Bug Fixes)

**Summary:** Major session covering 7 bug fixes, 3 new features, and extensive testing. Migrated real-time messaging from postgres_changes to Supabase Broadcast (fixing fundamental RLS/Clerk auth incompatibility). Built 3 search optimization features: abbreviation expansion, batch CSV imports, and popularity-based suggestions. Replaced all site icons. Updated FAQ to 20 questions. Fixed multiple bugs including notifications, model IDs, and nav highlighting.

**Key Accomplishments:**
- Migrated real-time messaging to Supabase Broadcast (7 files) — messages now instant without refresh
- Fixed notifications not showing in UI (supabaseAdmin for all read functions)
- Built fuzzy matching with 34 comic abbreviations (ASM, TEC, FF, etc.)
- Built batch CSV import with dedup + parallel processing (5-10 min → ~15 seconds)
- Built popularity-based autocomplete suggestions from comic_metadata.lookup_count
- Replaced all site icons with new blue comic-style chest design
- Updated Ask the Professor FAQ from 7 to 20 questions
- Fixed "More" dropdown incorrectly highlighting "Lists" on Collection page
- Fixed deprecated model IDs causing 404s (centralized in models.ts)
- Added partially_approved to custom_key_info_status DB constraint
- Per-item approve/reject for custom key info with color-coded buttons
- 18 new unit tests (248 total)

**Files Added:**
- `src/lib/titleNormalization.ts` — Abbreviation expansion utility
- `src/lib/batchImport.ts` — Batch import with dedup + parallel processing
- `src/app/api/titles/popular/route.ts` — Popular titles API endpoint
- `src/lib/__tests__/titleNormalization.test.ts` — 12 tests
- `src/lib/__tests__/batchImport.test.ts` — 6 tests
- `supabase/migrations/20260218_fix_custom_key_info_status_check.sql`

**Files Modified:**
- `src/lib/messagingDb.ts` — Added broadcastNewMessage() helper
- `src/app/api/messages/route.ts` — Broadcast after send
- `src/app/api/messages/[conversationId]/read/route.ts` — Broadcast after mark-read
- `src/components/messaging/MessageThread.tsx` — Broadcast subscription
- `src/app/messages/page.tsx` — Broadcast subscription
- `src/components/Navigation.tsx` — Broadcast subscription, profileId fetch, FAQ update, dropdown fix
- `src/components/MobileNav.tsx` — Broadcast subscription
- `src/components/TitleAutocomplete.tsx` — Abbreviation expansion, popular titles
- `src/components/CSVImport.tsx` — Batch import refactor
- `src/lib/cache.ts` — Added popularTitles cache prefix
- `src/app/api/titles/suggest/route.ts` — Enhanced AI prompt
- `src/components/AskProfessor.tsx` — 20 FAQs, font fix
- `src/components/icons/ChestIcon.tsx` — New icon SVG
- `src/app/layout.tsx` — Updated favicon reference
- `src/lib/auctionDb.ts` — supabaseAdmin for notification reads
- `src/app/admin/key-info/page.tsx` — Per-item approve/reject, color-coded buttons
- `src/app/api/admin/custom-key-info/[id]/route.ts` — Per-item decisions support
- Multiple icon files in public/ replaced

**Issues Resolved:**
- Real-time messaging broken (Clerk auth + RLS blocks postgres_changes)
- Notifications in DB but not visible in UI (anon client blocked by RLS)
- Batman #1 incorrect verified key info (wrong comic ID + constraint missing)
- Deprecated model IDs causing title autocomplete and comic details 404s
- "More" dropdown highlighting "Lists" when on Collection page
- FAQ font using comic font in all caps (hard to read)

---

## Feb 18, 2026 - Session 9 (Legal Pages + Stripe Connect Planning)

**Summary:** Researched the entire codebase to compile a comprehensive platform briefing for Claude Chat to draft legal documents. Received and deployed all 4 legal pages (Terms of Service, Privacy Policy, Acceptable Use Policy, Cookie & Tracking Policy). Verified 18/20 document claims against actual code. Updated EVALUATION.md with Stripe Connect plans and 18+ marketplace age gate.

**Key Accomplishments:**
- Compiled detailed platform briefing covering auction/trade flows, AI features, tier breakdown, Stripe structure, third-party services, and data collection
- Deployed all 4 legal pages with full content (placeholders remain for LLC info)
- Verified legal document accuracy: 18/20 claims exact match, 2 describe planned but unenforced features
- Updated EVALUATION.md: Stripe Connect referenced in 6 places, 18+ age gate added as Critical item
- Added comprehensive BACKLOG item for placeholder replacement post-LLC formation
- Updated Stripe section across docs to reflect Connect for automated seller payouts

**Files Added:**
- `src/app/acceptable-use/page.tsx` - Acceptable Use Policy page
- `src/app/cookies/page.tsx` - Cookie & Tracking Policy page

**Files Modified:**
- `src/app/privacy/page.tsx` - Replaced placeholder content with full Privacy Policy
- `src/app/terms/page.tsx` - Replaced placeholder content with full Terms of Service
- `EVALUATION.md` - Stripe Connect (6 locations), 18+ age gate, legal page status updates
- `BACKLOG.md` - Added "Finalize Legal Pages" pre-launch item

**Issues Resolved:**
- None (no bugs this session — documentation and content only)

---

## Feb 13, 2026 - Session 8 (Admin Key Info Management + Custom Key Info Sandboxing)

**Summary:** Major feature session implementing admin key info management. Built custom key info sandboxing (user-submitted key info only shows publicly when admin-approved), full CRUD for the key_comics database, and a consolidated admin review tab merging two separate approval flows into one.

**Key Accomplishments:**
- Sandboxed custom key info: `filterCustomKeyInfoForPublic()` filters unapproved custom key info from shop/auctions/trades
- Admin CRUD API for key_comics database: search, create, update, delete entries
- Admin "Database" tab with search/filter, create form, inline editing, delete confirmation
- Consolidated "Suggestions" and "From Comics" tabs into single "Review" tab with source badges
- Fixed critical bug: `updateComic()` was missing `custom_key_info` and `custom_key_info_status` fields
- Fixed stats cards to combine counts from both submission sources
- Fixed pre-existing type error in messagingDb content check fallback
- 5 new unit tests for key info sandboxing (all passing, 230 total)

**Files Added:**
- `src/lib/keyInfoHelpers.ts` - filterCustomKeyInfoForPublic helper
- `src/lib/__tests__/keyInfoSandbox.test.ts` - 5 unit tests
- `src/app/api/admin/key-comics/route.ts` - GET/POST API
- `src/app/api/admin/key-comics/[id]/route.ts` - PATCH/DELETE API
- `docs/plans/2026-02-13-admin-key-info-management-design.md` - Design doc

**Files Modified:**
- `src/app/admin/key-info/page.tsx` - Database tab, unified Review tab, mobile layout fixes, combined stats
- `src/lib/db.ts` - Custom key info sandboxing in getPublicComics, added fields to updateComic
- `src/lib/auctionDb.ts` - Custom key info sandboxing in auction transform
- `src/lib/keyComicsDb.ts` - Added searchKeyComics, createKeyComic, updateKeyComic, deleteKeyComic
- `src/lib/messagingDb.ts` - Fixed type error in content check fallback

**Issues Resolved:**
- Custom key info not persisting when users edited comics (missing fields in updateComic)
- Rejected count only showing submissions, not custom key info rejections
- Pre-existing TypeScript error in messagingDb content check

---

## Feb 12, 2026 - Session 7 (Claude Code Sound Notifications Setup)

**Summary:** Tooling/workflow session - no Comic Tracker code changes. Configured Claude Code hooks to play custom sound notifications globally across all projects for 4 key events: waiting for input, permission requests, task completion, and pre-compaction warnings.

**Key Accomplishments:**
- Created `~/Library/Sounds/` directory for custom macOS notification sounds
- Configured 4 global hooks in `~/.claude/settings.json`:
  - `Notification` (idle_prompt) → `claude-needs-input.mp3` + popup
  - `PermissionRequest` → `claude-permission.mp3` + popup
  - `Stop` → `claude-task-done.m4a` + popup
  - `PreCompact` (auto) → `claude-compacting.mp3` + popup with warning
- Unhid `~/Library` folder in Finder for easier access

**Files Modified:**
- `~/.claude/settings.json` - Added hooks configuration (global, not project-specific)
- `~/Library/Sounds/` - 4 custom sound files added

**No Comic Tracker code changes this session.**

---

## Feb 10, 2026 - Session 6 (Mobile Testing Feedback - 14 Fixes)

**Summary:** Android mobile testing session with Free/Registered user. Fixed 14 feedback items covering share modal, public profiles, messaging, admin nav, collection filters, shop page, account settings, Key Hunt, and technopathic text. Deployed 3 times to production for live testing.

**Key Accomplishments:**
- Share modal copy button: Fixed mobile overflow with `min-w-0` and `shrink-0`
- Public profile "Marvel Comics" overflow: Added `min-w-0` container constraints
- Mobile message badge: Added Supabase real-time subscription for unread count in MobileNav
- Messages landing page: Removed auto-select of first conversation on mobile
- Inquiry messages: Added listing details (title, issue, grade) + shop URL to initial message
- URL auto-linking: Added `linkifyContent()` to MessageBubble for clickable links in messages
- Report flag visibility: Changed from `text-pop-yellow` to `text-pop-red`
- Admin menu on mobile: Added admin link to MobileNav drawer (was completely missing)
- Admin nav layout: Split into two rows (header + tabs) for mobile readability
- Collection filters: Reorganized into two rows for better mobile UX
- Shop page: Fixed dropdown chevrons (removed `appearance-none`), reduced tab button sizes
- Shop cards: Updated ListingCard and AuctionCard to pop-art styling (border-3, hover shadow)
- Account settings: Updated to pop-art styling with comic fonts and bold borders
- Key Hunt routing: Non-premium users now route to `/key-hunt` (FeatureGate handles gate)
- Technopathic text: Removed duplicate "technopathic" from 3 price estimate disclaimers
- Code cleanup: Removed 3 unused imports from collection/page.tsx

**Files Modified:**
- `src/components/ShareCollectionModal.tsx` - Mobile overflow fix
- `src/app/u/[slug]/PublicCollectionView.tsx` - Publisher name overflow fix
- `src/components/MobileNav.tsx` - Unread badge, admin link, Key Hunt routing
- `src/app/messages/page.tsx` - Removed auto-select behavior
- `src/components/messaging/MessageButton.tsx` - Rich inquiry messages with listing details
- `src/components/messaging/MessageBubble.tsx` - URL auto-linking with linkifyContent()
- `src/components/messaging/MessageThread.tsx` - Report flag color fix
- `src/app/admin/layout.tsx` - Two-row mobile layout
- `src/app/collection/page.tsx` - Two-row filter layout, removed unused imports
- `src/app/shop/page.tsx` - Dropdown chevrons, tab button sizing
- `src/components/auction/ListingCard.tsx` - Pop-art styling, rich MessageButton
- `src/components/auction/AuctionCard.tsx` - Pop-art styling
- `src/components/auction/ListingDetailModal.tsx` - Rich MessageButton props
- `src/components/CustomProfilePage.tsx` - Pop-art styling
- `src/components/ComicDetailsForm.tsx` - Removed duplicate "technopathic"
- `src/components/ComicDetailModal.tsx` - Fixed "technopathic estimate" text
- `src/components/KeyHuntPriceResult.tsx` - Fixed "technopathic estimate" text
- `TESTING_RESULTS.md` - Added Feb 10 session entry

**Issues Resolved:**
- Share modal copy button cut off on mobile (horizontal scroll required)
- "Marvel Comics" text overflowed stat box on public profile
- No unread message badge on mobile nav
- Messages page auto-selected first conversation, hiding list on mobile
- Inquiry messages only showed "Re: Batman" with no details
- URLs in messages rendered as plain text (not clickable)
- Report flag invisible (yellow on white background)
- Admin panel completely inaccessible from mobile nav
- Admin nav tabs cramped on mobile
- Collection filters cramped on mobile
- Shop dropdown sort chevrons hidden by `appearance-none`
- Shop tab buttons too large on mobile
- Account settings didn't match pop-art design language
- Key Hunt sent non-premium users to /pricing instead of /key-hunt with FeatureGate
- "Technopathic estimate" text duplicated in 3 components

**Deployed:** 3 deploys to Netlify (commits 2a9da2d, b8043a1, e27813e)

---

## Feb 8, 2026 - Session 5 (Real-Time Messaging, Key Hunt Fix, UX Improvements)

**Summary:** Addressed 3 new feedback items (Following button color, message scroll, back-to-conversations link), implemented real-time messaging (#17), fixed Key Hunt trial access (#12), made @username tappable in messages and seller badges, deployed to production.

**Key Accomplishments:**
- Real-time messaging: Supabase `postgres_changes` subscription refreshes conversation list on incoming messages
- Created missing `POST /api/messages/{conversationId}/read` endpoint (was called but 404'd)
- Fixed Nav unread badge (Clerk ID vs Supabase UUID mismatch — always incremented)
- Fixed Key Hunt access for trial users (`isPremium` didn't check `isTrialing`)
- Following button color: pink → blue on Shop page
- Message container scroll fix (`overflow-hidden` + `min-h-0` on flex chain)
- "Back to conversations" link no longer refreshes current message
- @username tappable in MessageThread header → links to `/u/{username}`
- @username tappable in SellerBadge → links to `/u/{username}`
- 6 new unit tests for `markMessagesAsRead`

**Files Created:**
- `src/app/api/messages/[conversationId]/read/route.ts` - Mark-as-read endpoint
- `src/lib/__tests__/messagingDb.test.ts` - 6 unit tests

**Files Modified:**
- `src/app/messages/page.tsx` - Real-time subscription, scroll fix, back link fix, loading spinner fix
- `src/components/messaging/MessageThread.tsx` - Tappable @username, min-h-0 fix
- `src/components/auction/SellerBadge.tsx` - Tappable @username link
- `src/components/Navigation.tsx` - Fixed unread badge (fetchUnread instead of optimistic increment)
- `src/components/MobileNav.tsx` - Fixed isPremium to include isTrialing
- `src/lib/messagingDb.ts` - Extracted markMessagesAsRead helper
- `src/app/shop/page.tsx` - Following button pink → blue

**Issues Resolved:**
- Real-time messaging: No subscription existed, messages only appeared on refresh
- Missing read endpoint: `POST /api/messages/{id}/read` returned 404 silently
- Nav badge mismatch: Compared Clerk `user_xxx` against Supabase UUID — never matched
- Key Hunt trial: `MobileNav` checked `tier === "premium"` only, missing `isTrialing`
- Message scroll: Flex container height chain broken (needed overflow-hidden + min-h-0)
- Back link: `useSearchParams` doesn't update on `pushState`, causing re-selection

**Deployed:** 1 deploy to Netlify (commit 06faa08)

---

## Feb 6, 2026 - Session 2 (Continued Testing & /Following Page)

**Summary:** Continued Feb 5 feedback testing, built /following page, fixed admin search #11, added CSV cycling facts, deployed twice to production.

**Key Accomplishments:**
- Built `/following` page with Following/Followers tabs, pop-art styling, pagination
- Fixed FollowButton self-check pattern (fetches own status on mount when prop undefined)
- Fixed followDb.ts schema mismatch (first_name/last_name → display_name)
- Fixed Key Hunt desktop scroll bug (JS body overflow, not CSS)
- Fixed admin search #11 (hasSearched only set on success path)
- Added cycling comic facts to CSV import progress screen
- Extracted shared COMIC_FACTS to src/lib/comicFacts.ts
- Added "Following" link to Navigation More dropdown
- Tested and verified 15 of 21 Feb 5 feedback items

**Files Created:**
- `src/app/following/page.tsx` - Following/Followers page
- `src/lib/comicFacts.ts` - Shared comic facts array + getRandomFact()

**Files Modified:**
- `src/components/Navigation.tsx` - Added Following link
- `src/components/follows/FollowButton.tsx` - Self-check on mount
- `src/lib/followDb.ts` - Fixed column names (display_name)
- `src/components/KeyHuntBottomSheet.tsx` - Mobile-only overflow hidden
- `src/app/key-hunt/page.tsx` - Reverted margin hack, technopathy branding
- `src/app/admin/users/page.tsx` - Fixed #11 hasSearched bug, red no-results text
- `src/app/scan/page.tsx` - Refactored to use shared comicFacts
- `src/components/CSVImport.tsx` - Added cycling facts during import
- `FEEDBACK_FEB_5.md` - Status updates (15 Tested)

**Issues Resolved:**
- Key Hunt desktop scroll: JS `document.body.style.overflow = "hidden"` from bottom sheet
- FollowButton wrong state: DB query wrong columns + missing self-check
- Admin search icon overlap: CSS shorthand `padding` overriding Tailwind `pl-*`
- Admin search no results: `hasSearched` only set in try block, not catch

**Deployed:** 2 deploys to Netlify (commits 7ebc83d, d28833c)

---

### Feb 5, 2026 - Session 3 Changes

**Completed:**
- Feb 5 Feedback: Implemented 13 of 21 items (4 pinned, 1 closed, 3 already complete)
- CSV Import: Dollar sign/comma stripping for price fields (`parseCurrencyValue`)
- Publisher Dropdown: Alias mapping (DC → DC Comics, etc.) + "Suggest Publisher" for unknowns
- Sort by Value: Fixed to use `getComicValue()` (grade-aware) instead of raw averagePrice
- Admin Search: Fixed magnifying glass overlap, added "No results found" message
- Admin Navigation: New shared layout bar across all 5 admin pages (pop-art styled)
- Key Info Notifications: Submitters now notified on approval/rejection
- Reputation: Approving key info now increments contributor count
- Public Profile: Username fallback in display name chain + FollowButton on public pages
- Key Hunt Page: Pop-art styling overhaul + mobile scroll fix
- Key Hunt Button: Premium gate with locked state + upgrade flow for non-premium users
- Billing Status: Fixed missing `unlimitedScans` in guest features object
- 21 new unit tests (6 CSV parsing + 15 publisher normalization)

**Files Created:**
- `src/lib/csvHelpers.ts` - parseCurrencyValue helper
- `src/lib/__tests__/csvParsing.test.ts` - 6 tests
- `src/types/__tests__/publisherNormalize.test.ts` - 15 tests
- `src/app/api/admin/publishers/route.ts` - Publisher suggestion endpoint
- `src/app/admin/layout.tsx` - Shared admin navigation
- `docs/plans/2026-02-05-feb5-feedback-fixes.md` - Implementation plan

**Files Modified:**
- `src/types/comic.ts` - PUBLISHER_ALIASES + normalizePublisher()
- `src/components/CSVImport.tsx` - parseCurrencyValue + normalizePublisher
- `src/components/ComicDetailsForm.tsx` - Publisher normalization + Suggest Publisher button
- `src/app/collection/page.tsx` - Sort by value fix (getComicValue)
- `src/app/admin/users/page.tsx` - Search icon padding, no results msg, removed old links
- `src/types/auction.ts` - key_info_approved/rejected notification types
- `src/lib/auctionDb.ts` - Notification titles/messages for new types
- `src/lib/keyComicsDb.ts` - createNotification + recordContribution on approval
- `src/app/u/[slug]/page.tsx` - Username fallback in displayName
- `src/app/u/[slug]/PublicCollectionView.tsx` - Username fallback + FollowButton
- `src/app/key-hunt/page.tsx` - Pop-art styling + scroll fix
- `src/components/AddToKeyHuntButton.tsx` - Premium gate with locked state
- `src/app/api/billing/status/route.ts` - Added unlimitedScans to guest features
- `FEEDBACK_FEB_5.md` - Updated all statuses + test cases

**Pinned for Future Sessions:**
- #2: Cover images returned incorrectly (needs examples)
- #12: Premium user lost Key Hunt after trial reset (needs DB investigation)
- #17 & #20: Messaging real-time + notification icon (Messaging v2 session)

### Feb 5, 2026 - Session 2 Changes

**Completed:**
- CSV Import: Flexible boolean parsing (yes/no, Y/N, 1/0 in addition to true/false)
- Missing cover placeholders: Updated to Lichtenstein pop-art style (was old Riddler style)
- Partner feedback session: Documented 21 items in FEEDBACK_FEB_5.md
- FEEDBACK_JAN_28.md: Closed out #8 (stats), #10 (public share), #22 (payment error)

**Files Modified:**
- `src/components/CSVImport.tsx` - Added `parseBool()` helper for flexible boolean parsing
- `src/components/ComicImage.tsx` - Pop-art placeholder for missing covers
- `src/components/auction/ListingDetailModal.tsx` - Pop-art placeholder for missing covers
- `FEEDBACK_FEB_5.md` - Created with 21 feedback items
- `FEEDBACK_JAN_28.md` - Updated completed items

### Feb 5, 2026 - Session 1 Changes

**Completed:**
- Public share link bug FIXED: Root cause was `.or()` query comparing text slug against UUID column, causing PostgreSQL `22P02` error that killed the entire query. Fix: validate UUID format before building query.
- CLAUDE.md: Updated session-start testing questions (added Android/Windows devices, multiSelect for account type)
- Deployed to production

**Files Modified:**
- `src/lib/db.ts` - Fixed `getPublicProfile()` UUID type error
- `CLAUDE.md` - Updated testing context questions

### Feb 4, 2026 - Session 2 Changes

**Completed:**
- Public share link debugging: Applied RLS fix (supabaseAdmin in togglePublicSharing)
- FEEDBACK_JAN_28.md: Added "Priority for Next Session" section with 4 remaining items
- FEEDBACK_JAN_28.md: Detailed debugging notes for public share link issue (#10)
- EVALUATION.md: Updated Public Sharing status to "Bug - See FEEDBACK #10"
- Testing-complete skill: Created new skill at ~/.claude/skills/testing-complete/
- Barcode scanning: Removed feature (no reliable UPC API exists)
- BACKLOG.md: Added "Re-introduce Dedicated Barcode Scanning" item
- TEST_CASES.md: Removed barcode scanning test cases
- Verified CSV import working on mobile (#2 complete)

**In Progress:**
- Public share link (#10): RLS fix applied but still failing - needs DB verification

### Feb 4, 2026 - Session 1 Changes

**Completed:**
- CSV Import: Quick Import toggle (skip API lookups for faster import)
- CSV Import: Cover tip callout on completion ("edit to change covers")
- CSV Import: Modal stays until user clicks Done (was auto-closing)
- CSV Import: Pop-art styling improvements, toggle overflow fix
- CSV Import: Renamed sample file to "Collectors-Chest-Sample-Import.csv"
- Navigation: Fixed "More" button active state on Collection page
- Barcode Scanner: Rewrote to use `html5-qrcode` library (later removed)

---

## Deploy Log

### February 2, 2026
**Summary:** Follow system, bulk actions, pricing page UX, bug fixes

Key items deployed:
- Follow system: one-way follows (like eBay/Etsy seller follows)
- Follow/unfollow API endpoints with RLS policies
- FollowButton, FollowerCount, FollowListModal components
- "From people I follow" filter on Shop page
- Follower notifications (in-app + email) when followed users list items
- Bulk Actions (multi-select): selection toolbar, bulk delete/update/add-to-list
- Pricing page: blue Premium card, green CTAs, readable FAQ title
- Fixed CSV import listing creation bug (#17)
- Fixed /api/trades/available 500 error (wrong column name)
- 198 total tests

---

### January 29, 2026
**Summary:** Major feature deploy - messaging, trading, location, shop improvements

Key items deployed:
- Peer-to-peer messaging system (all 7 phases)
- Book trading feature (all 4 phases)
- User profile location with privacy controls
- Sales History page with profit tracking
- Seller location badges on Shop cards
- Message Seller buttons throughout app
- Route conflict detection + smoke test scripts
- Multiple bug fixes (500 error, messaging RLS, column names)

---

## February 2, 2026

### Session Summary
Completed multi-select bulk actions feature (#18), fixed trades API bug, and improved pricing page UX.

### Key Accomplishments
- **Bulk Actions (completed from previous session):**
  - Fixed bulk API routes (profile_id → user_id column name)
  - Improved SelectionToolbar button styling and order
  - Increased BulkListPickerModal size on desktop

- **Bug Fixes:**
  - `/api/trades/available` 500 error: Changed `seller_rating`/`seller_rating_count` to `positive_ratings`/`negative_ratings` (columns didn't exist)
  - Navigation "More" menu: Fixed unreliable click-outside behavior
  - Collection page filter styling: Standardized pop-art design

- **Pricing Page Improvements:**
  - Changed Premium card background from red to blue (more trustworthy)
  - Changed CTA buttons from yellow to green (better purchase psychology)
  - Fixed FAQ title readability (yellow text with black stroke)
  - Changed scan pack button to green

### Files Modified
- `src/app/api/trades/available/route.ts` - Fixed column names
- `src/app/pricing/page.tsx` - Color scheme improvements
- `src/app/api/comics/bulk-*.ts` - Fixed profile_id → user_id
- `src/components/collection/SelectionToolbar.tsx` - Styling
- `src/components/collection/BulkListPickerModal.tsx` - Size increase
- `src/components/Navigation.tsx` - Click-outside fix

### Issues Encountered
- Trades API was using non-existent `seller_rating` column from old schema

### Next Session Focus
1. Test bulk actions and pricing page changes
2. Follow up with GoCollect on API access
3. Form LLC (blocks Privacy Policy/ToS)
4. Set up Stripe account (blocks premium billing)

---

## January 30, 2026

### Session Summary
Implemented complete follow system (feedback item #23) using subagent-driven development. Also fixed CSV listing creation bug (#17) and organized feedback document with status tracking.

### Key Accomplishments
- **Follow System (16 tasks completed):**
  - Database: `user_follows` table with RLS, triggers for count updates
  - API: Follow/unfollow, followers list, following list endpoints
  - Components: FollowButton, FollowerCount, FollowListModal
  - Hook: useFollow for state management
  - Integrations: SellerBadge, CustomProfilePage, Shop filter
  - Notifications: In-app + email when followed users list items

- **CSV Import Fix (#17):**
  - Fixed `addComic()` not preserving client-generated ID
  - Listings now properly created when CSV has `forSale: true`

- **Feedback Document Organization:**
  - Added status table to FEEDBACK_JAN_28.md
  - Marked 14 items complete, 5 need testing, 4 remaining

### Files Added
- `supabase/migrations/20260130_follow_system.sql`
- `src/types/follow.ts`
- `src/lib/followDb.ts`
- `src/lib/__tests__/followDb.test.ts` - 13 unit tests
- `src/hooks/useFollow.ts`
- `src/components/follows/FollowButton.tsx`
- `src/components/follows/FollowerCount.tsx`
- `src/components/follows/FollowListModal.tsx`
- `src/components/follows/index.ts`
- `src/app/api/follows/[userId]/route.ts`
- `src/app/api/follows/[userId]/followers/route.ts`
- `src/app/api/follows/[userId]/following/route.ts`
- `docs/plans/2026-01-30-follow-system-design.md`
- `docs/plans/2026-01-30-follow-system.md`

### Files Modified
- `src/lib/db.ts` - Fixed addComic ID preservation
- `src/lib/auctionDb.ts` - followingOnly param, follower notifications
- `src/lib/email.ts` - New listing email template
- `src/types/auction.ts` - Added notification type
- `src/components/auction/SellerBadge.tsx` - Added FollowButton
- `src/components/CustomProfilePage.tsx` - Added FollowerCount
- `src/app/shop/page.tsx` - Added following filter
- `src/app/scan/page.tsx` - Improved CSV error handling
- `FEEDBACK_JAN_28.md` - Status tracking
- `CLAUDE.md` - Made tests mandatory for all features

### Issues Encountered
- CSV listing creation was failing silently due to ID mismatch between client-generated ID and Supabase-generated ID

### Next Session Focus
1. Run database migration for follow system
2. Test follow functionality end-to-end
3. Implement multi-select bulk actions (#18)
4. Test remaining feedback items (CSV on mobile, stats page, etc.)

---

## January 29, 2026

### Session Summary
Major bug-fix session. Pushed 82 commits to production, fixed critical 500 error from Next.js route conflict, added prevention scripts, then extended location badges and messaging buttons to all Shop cards. Fixed multiple messaging system bugs preventing conversations from working.

### Key Accomplishments
- **Production Deployment:**
  - Pushed 82 accumulated commits to Netlify
  - Ran missing SQL migrations (user_blocks, message_reports)

- **Critical Bug Fix - Production 500 Error:**
  - Root cause: Next.js dynamic route parameter conflict between `/api/messages/[messageId]` and `/api/messages/[conversationId]`
  - Fix: Moved `/api/messages/[messageId]/report` to `/api/messages/report/[messageId]`
  - Updated ReportMessageModal.tsx to use new path

- **Prevention Measures:**
  - Created `scripts/check-routes.js` - detects conflicting dynamic route parameters
  - Created `scripts/smoke-test.sh` - starts production server, verifies homepage loads
  - Added npm scripts: `check:routes`, `smoke-test`, `check:deploy`
  - Updated CLAUDE.md deploy process

- **Seller Location Badges Extended:**
  - Added LocationBadge to AuctionCard, AuctionDetailModal, ListingCard, ListingDetailModal
  - Updated SellerProfile type with location fields
  - Updated auctionDb.ts queries to fetch location data

- **Message Seller Buttons Extended:**
  - Added MessageButton to AuctionDetailModal, ListingDetailModal, ListingCard, TradeableComicCard
  - All cards now allow initiating conversations with sellers

- **Messaging System Bug Fixes:**
  - Fixed `blocked_user_id` → `blocked_id` column name
  - Fixed RLS blocking queries - switched to `supabaseAdmin`
  - Added missing `embedded_listing_id` columns via migration
  - Added `profileId` to `/api/username/current` response
  - Fixed `current_price` → `current_bid` column name

### Files Modified
- `src/app/api/messages/report/[messageId]/route.ts` (moved)
- `src/components/messaging/ReportMessageModal.tsx`
- `src/lib/messagingDb.ts` (major fixes)
- `src/app/api/username/current/route.ts`
- `src/components/auction/AuctionCard.tsx`
- `src/components/auction/AuctionDetailModal.tsx`
- `src/components/auction/ListingCard.tsx`
- `src/components/auction/ListingDetailModal.tsx`
- `src/components/trading/TradeableComicCard.tsx`
- `src/types/auction.ts`
- `src/lib/auctionDb.ts`
- `scripts/check-routes.js` (new)
- `scripts/smoke-test.sh` (new)
- `package.json` (new scripts)
- `CLAUDE.md` (deploy process)
- `BACKLOG.md` (customizable message feature)

### Issues Encountered
- Production 500 error from Next.js route conflict - identified and fixed
- Multiple messaging bugs required iterative debugging with user
- RLS (Row Level Security) was blocking queries even with valid Clerk auth

### Next Session Focus
1. Full messaging flow testing (send, receive, notifications, block/report)
2. Mobile responsiveness testing for messaging
3. Continue with EVALUATION.md priorities

---

## January 28, 2026

### Session Summary
Major backlog audit and cleanup session. Implemented User Profile Location feature, then conducted comprehensive backlog review discovering several items were already complete. Updated documentation and cost tracking.

### Key Accomplishments
- **User Profile Location Feature:**
  - Database migration with location_city, location_state, location_country, location_privacy columns
  - API route `/api/location` for GET/POST location management
  - `LocationBadge.tsx` component respecting privacy settings
  - Location section added to Profile page settings
  - Seller location displayed on tradeable comic cards

- **Backlog Audit (8 items marked complete):**
  - Peer-to-Peer Messaging (all 7 phases) - was already done
  - Book Trading Feature (all 4 phases) - was already done
  - User Profile Location - implemented this session
  - Project Cost Tracking Dashboard - already in CLAUDE.md
  - Fix TypeScript Errors in Test Files - already fixed
  - Key Hunt Scan History - already implemented with localStorage
  - Re-enable Live Hottest Books API - USE_STATIC_LIST removed
  - Sales Flow - Use Actual Transaction Price - Stripe webhook handles it

- **Documentation Updates:**
  - Updated GoCollect pricing to $89/yr (annual plan)
  - Added audit notes to "Clean Up Copy" backlog item
  - Cleaned up BACKLOG.md with accurate status updates

### Files Modified
- `supabase/migrations/20260128_user_location.sql` (new)
- `src/app/api/location/route.ts` (new)
- `src/components/LocationBadge.tsx` (new)
- `src/components/CustomProfilePage.tsx` - Location section
- `src/components/trading/TradeableComicCard.tsx` - Seller location
- `src/app/api/trades/available/route.ts` - Return location data
- `BACKLOG.md` - Multiple status updates
- `CLAUDE.md` - GoCollect pricing update

### Issues Encountered
- Import error in location/route.ts: `createClient` not exported
  - Fixed by using `supabase` import instead

### Next Session Focus
1. Run SQL migration in Supabase (if not done)
2. Test location feature on mobile/web
3. Consider tackling remaining high-priority items from EVALUATION.md

---

## January 27, 2026 (Evening)

### Session Summary
Brief session focused on GoCollect API setup and project priorities update. User generated API token from GoCollect portal.

### Key Accomplishments
- **GoCollect API Setup:**
  - Confirmed user has access to GoCollect API token creation
  - User created "gocollect-api" token (awaiting integration)
  - Documented next steps: add token to env, review API docs

- **Priority Updates:**
  - Updated EVALUATION.md Section 12 with new "Next Session Focus"
  - New priorities: 1) GoCollect API integration, 2) Messaging Phases 2-7, 3) Book Trading

- **Technical Fixes:**
  - Fixed 54 TypeScript errors in test files (gradePrice.test.ts, statsCalculator.test.ts)
  - Test fixtures now include all required properties (label, mostRecentSaleDate, etc.)
  - All 172 tests still passing

### Files Modified
- `EVALUATION.md` - Updated priorities and date
- `src/lib/__tests__/gradePrice.test.ts` - Fixed type errors in test fixtures
- `src/lib/__tests__/statsCalculator.test.ts` - Fixed type errors in test fixtures

### Issues Encountered
- TypeScript strict checking flagged test fixtures missing required properties
- Fixed by adding complete property sets to createPriceData, createGradeEstimates, createComicDetails factories

### Next Session Focus
1. Add GoCollect API key to .env.local and Netlify
2. Review GoCollect API documentation
3. Implement GoCollect FMV integration
4. Continue with Messaging Phases 2-7

---

## January 27, 2026

### Session Summary
Major feature session. Implemented peer-to-peer messaging Phase 1 using parallel worktree development. Also completed sales tracking feature and auction cancellation policy. Created color palette mockup for partner review.

### Key Accomplishments
- **Peer-to-Peer Messaging Phase 1:**
  - Database tables: `conversations`, `messages` with RLS policies
  - API routes: GET/POST `/api/messages`, GET `/api/messages/[id]`, GET `/api/messages/unread-count`
  - Components: MessageComposer, MessageBubble, MessageThread, ConversationList, MessageButton
  - `/messages` inbox page with conversation list and thread view
  - MessageButton integrated in ListingDetailModal
  - Full design document created through brainstorming session
  - Used git worktree for isolated development

- **Sales Tracking:**
  - Sales History page (`/sales`) with profit tracking
  - "Mark as Sold" button now available for ALL comics
  - Platform sales auto-recorded via Stripe webhook
  - Sales navigation button added to collection page

- **Auction Cancellation Policy:**
  - Section 4.5 added to Terms of Service
  - Offer-makers notified when fixed-price listings cancelled
  - Duplicate listing prevention (same comic can't have multiple active listings)

- **Design:**
  - Created Red & Black color palette mockup for partner review

### Files Added
- `supabase/migrations/20260127_messaging.sql` - Messaging database schema
- `src/types/messaging.ts` - Messaging TypeScript types
- `src/lib/messagingDb.ts` - Messaging database helpers
- `src/app/api/messages/route.ts` - List/send messages API
- `src/app/api/messages/[conversationId]/route.ts` - Get conversation API
- `src/app/api/messages/unread-count/route.ts` - Unread count API
- `src/components/messaging/` - 5 messaging components
- `src/app/messages/page.tsx` - Messages inbox page
- `src/app/sales/page.tsx` - Sales History page
- `docs/plans/2026-01-27-peer-to-peer-messaging-design.md` - Design document
- `docs/plans/2026-01-27-messaging-phase1-implementation.md` - Implementation plan
- `design-mockup-red-black.html` - Color palette comparison mockup

### Files Modified
- `src/components/auction/ListingDetailModal.tsx` - Added MessageButton
- `src/components/ComicDetailModal.tsx` - Show "Mark as Sold" for all comics
- `src/app/api/webhooks/stripe/route.ts` - Auto-record platform sales
- `src/app/collection/page.tsx` - Added Sales navigation button
- `src/app/terms/page.tsx` - Added Section 4.5 cancellation policy
- `src/types/auction.ts` - Added `listing_cancelled` notification type
- `src/lib/auctionDb.ts` - Offer notifications on cancel, duplicate prevention
- `BACKLOG.md` - Updated multiple items
- `TEST_CASES.md` - Added messaging and cancellation test cases

### Database Changes
- Created `conversations` table with RLS policies
- Created `messages` table with RLS policies
- Added `get_or_create_conversation()` helper function
- Added trigger to auto-update `last_message_at`

### Issues Encountered
- API error in parallel session required restart - resolved by relaunching Claude
- Pre-existing stashed changes needed to be committed after merge - resolved

### Next Session Focus
1. Complete messaging Phases 2-7 (images, embeds, block/report, real-time, moderation)
2. Book Trading feature

---

## Deploy Log - January 25, 2026

**Deployed to Netlify**

### Changes Included:
- **Admin User Management** - Full admin panel with user search, profile viewing, trial reset, premium granting, and account suspension
- **Admin Audit Logging** - All admin actions logged for accountability
- **Admin Navigation Link** - Admins see "ADMIN" link in nav bar (database-backed is_admin check)
- **Pop-Art Styling Updates** - Applied Lichtenstein theme to Collection, Shop, My Listings, Stats, and Scan pages
- **Scan Progress Bar Fix** - Aligned progress stepper width with upload container
- **Suspension System** - Protected routes check for suspended accounts
- **Trial Management** - Start trial and reset trial API endpoints

---

## January 24, 2026

### Session Summary
Major admin features session. Built complete admin user management system with search, profile viewing, and account management actions. Applied Pop-Art styling across remaining pages. Added database-backed admin authentication with audit logging.

### Key Accomplishments
- Built admin user management panel (`/admin/users`) with:
  - User search by email (partial match)
  - Profile detail view (subscription, scans, trial status)
  - Reset trial action
  - Grant premium action (custom days)
  - Suspend/unsuspend accounts with reason
- Added `is_admin` field to profiles with database migration
- Created centralized `adminAuth.ts` helper library
- Added admin audit logging table for accountability
- Added admin link to navigation (visible only to database admins)
- Applied Pop-Art styling to Collection, Shop, My Listings, Stats, and Scan pages
- Fixed scan page progress bar alignment
- Added `isAdmin` to useSubscription hook for client-side admin detection
- Added suspension checks to protected API routes (scan, auction, billing)

### Files Added
- `src/app/admin/users/page.tsx` - Admin user management UI
- `src/app/api/admin/users/search/route.ts` - User search endpoint
- `src/app/api/admin/users/[id]/route.ts` - User profile endpoint
- `src/app/api/admin/users/[id]/reset-trial/route.ts` - Reset trial endpoint
- `src/app/api/admin/users/[id]/grant-premium/route.ts` - Grant premium endpoint
- `src/app/api/admin/users/[id]/suspend/route.ts` - Suspend/unsuspend endpoint
- `src/app/api/billing/start-trial/route.ts` - Start trial endpoint
- `src/app/api/billing/reset-trial/route.ts` - Reset trial endpoint (testing)
- `src/lib/adminAuth.ts` - Centralized admin helpers and audit logging
- `supabase/migrations/20260124_admin_features.sql` - Database migration

### Files Modified
- `src/components/Navigation.tsx` - Added admin link with useSubscription
- `src/hooks/useSubscription.ts` - Added isAdmin state
- `src/app/api/billing/status/route.ts` - Added isAdmin to response
- `src/lib/db.ts` - Added is_admin to CachedProfile type
- Multiple page files for Pop-Art styling updates

### Database Changes
- Added `is_admin` boolean to profiles table
- Added `is_suspended`, `suspended_at`, `suspended_reason` to profiles table
- Created `admin_audit_log` table for action tracking

### Issues Encountered
- Hardcoded admin user IDs didn't match test accounts - Switched to database-backed `is_admin` field
- CachedProfile type missing `is_admin` - Added to type definition

---

## Deploy Log - January 23, 2026

**Deployed to Netlify**

### Changes Included:
- **Lichtenstein Pop-Art Design** - New visual style merged into main
- **Performance Optimization Phases 1-4** - Complete codebase optimization
  - Anthropic API cost reduced ~47% ($0.015 → ~$0.008/scan)
  - Combined 4 AI calls into 1-2 per scan
  - Redis caching for profiles, titles, barcodes, certs
  - ISR for hot books page (1-hour revalidation)
  - Deleted ebay.ts, consolidated to single eBay implementation
  - Database performance indexes added
- **Bug Fix:** Auction scheduled start time timezone issue
- **Backlog Updates:** Added 6 new items (trade feature, peer-to-peer messaging, sale tracking, auction cancellation policy, user location, free trial fix)

---

## January 23, 2026

### Session Summary
Partner demo session. Switched between design branches to showcase options. Merged Lichtenstein pop-art design into main branch. Fixed auction timezone bug. Added multiple backlog items based on partner feedback.

### Key Accomplishments
- Demonstrated 3 design branches to partner (pop-art, retro-futuristic, vintage-newsprint)
- Merged **pop-art-lichtenstein** design into main as the new default style
- Fixed auction scheduled start time bug (was interpreting dates as UTC instead of local time)
- Updated vintage-newsprint branch year from 2024 to 2026
- Added 6 backlog items:
  - User profile location
  - Peer-to-peer messaging
  - Track sale price when marking book as sold
  - Auction cancellation policy (books with bids)
  - Free trial not working (high priority)
  - Book trading feature

### Files Modified
- `src/lib/auctionDb.ts` - Fixed timezone parsing for scheduled auctions
- `BACKLOG.md` - Added 6 new items
- Multiple design/styling files from Lichtenstein merge

### Issues Encountered
- Auction start time showing "2 hours" when user selected "tomorrow" - Root cause: JavaScript `new Date("2026-01-24")` parses as midnight UTC, not local time. Fixed by appending `T00:00:00` to parse as local midnight.

---

## January 21, 2026

### Session Summary
Comprehensive performance optimization across 4 phases. Re-evaluated the entire codebase to identify opportunities for reducing API costs, improving response times, and consolidating redundant services.

### Key Accomplishments

**Phase 1 - Quick Wins:**
- Reduced Anthropic max_tokens allocations (10-15% cost savings)
- Switched title suggestions from Sonnet to Haiku model (60% cost reduction on endpoint)
- Fixed duplicate database query in admin/usage route
- Removed broken in-memory cache from con-mode-lookup

**Phase 2 - AI Optimization:**
- Combined 4 sequential Anthropic API calls into 1-2 calls (30-35% savings)
- Added image hash caching for AI analysis (30-day TTL) - avoids re-analyzing same covers
- Added barcode lookup caching (6-month TTL) - Comic Vine lookups
- Added cert lookup caching (1-year TTL) - CGC/CBCS certificates are immutable

**Phase 3 - Architecture:**
- Removed Supabase eBay cache layer, consolidated to Redis-only
- Deleted `src/lib/ebay.ts` (568 lines), consolidated to `ebayFinding.ts`
- Added profile caching (5-min Redis TTL) for ~40+ API calls per session
- Implemented ISR for hot books page with server-side data fetching
- Fixed hottest-books internal HTTP call (now direct library call)

**Phase 4 - Final Polish:**
- Created database performance indexes migration (8 indexes)
- Replaced broken title autocomplete in-memory cache with Redis (24-hour TTL)

### Files Added
- `src/app/hottest-books/HotBooksClient.tsx` - Client component for ISR
- `src/lib/hotBooksData.ts` - Server-side hot books data layer
- `supabase/migrations/20260121_performance_indexes.sql` - DB indexes

### Files Deleted
- `src/lib/ebay.ts` - Redundant Browse API implementation

### Files Modified
- `src/lib/cache.ts` - Added profile, titleSuggest cache prefixes
- `src/lib/db.ts` - Added profile caching with invalidation
- `src/app/api/analyze/route.ts` - Combined AI calls, Redis-only caching
- `src/app/api/ebay-prices/route.ts` - Migrated to Finding API + Redis
- `src/app/api/hottest-books/route.ts` - Direct library calls
- `src/app/api/titles/suggest/route.ts` - Redis caching
- `src/app/api/barcode-lookup/route.ts` - Added caching
- `src/lib/certLookup.ts` - Added caching
- `EVALUATION.md` - Updated optimization plan status

### Database Migrations Required
- `20260121_performance_indexes.sql` ✅ (already applied)

### Expected Impact
| Metric | Before | After |
|--------|--------|-------|
| Anthropic cost/scan | $0.015 | ~$0.008 |
| API calls/scan | 4+ | 1-2 |
| Cache hit rate | ~30% | ~70% |
| DB queries/session | ~25 | ~5 |

---

## Deploy Log - January 17, 2026

**Deployed to Netlify**

### Changes Included:
- **Email Capture** - Guest bonus scans for email signup
- **Test Coverage** - 43 Jest tests (auction, subscription, guest scans)
- **Subscription Foundation** - Billing routes, feature gating, pricing page
- **Community Key Info** - 402 curated key comics, user submissions, admin moderation
- **Username System** - Custom display names with validation
- **Custom Profile Page** - Replaced Clerk's UserProfile
- **Key Hunt Wishlist** - Track comics you want to find
- **Hot Books Caching** - Database-first with 24-hour price refresh
- **Usage Monitoring** - Admin dashboard, email alerts for service limits
- **Image Optimization** - Client-side compression to 400KB
- **Design Branch Sync** - Merged main into all 3 design branches

### Database Migrations Required:
- `20260115_add_subscription_fields.sql`
- `20250117_key_info_community.sql`
- `20250117_key_info_seed.sql`
- `20260117_add_username.sql`
- `20250117_hot_books_and_key_hunt.sql`
- `20250117_usage_monitoring.sql`

### New Environment Variables:
- `ADMIN_EMAIL` - For usage alert notifications

---

## January 17, 2026 (Late Session)

### Session Summary
Added Key Hunt wishlist feature allowing users to track comics they want to acquire. Implemented Hot Books database caching to reduce API calls. Created usage monitoring system with email alerts. Added client-side image optimization. Merged all changes to design branches.

### Key Accomplishments
- **Key Hunt Wishlist** - Full CRUD system for tracking wanted comics
  - Database table `key_hunt_lists` with RLS policies
  - API routes at `/api/key-hunt` (GET, POST, DELETE, PATCH)
  - `useKeyHunt` React hook for state management
  - `AddToKeyHuntButton` component for Hot Books and scan results
  - `KeyHuntWishlist` component for viewing/managing hunt list
  - Integrated "My Hunt List" option into Key Hunt bottom sheet
- **Hot Books Caching** - Reduced API calls and improved load times
  - Database tables `hot_books`, `hot_books_history`, `hot_books_refresh_log`
  - 10 seeded hot comics with static data
  - 24-hour lazy price refresh from eBay API
  - Refactored `/api/hottest-books` to use database-first approach
- **Usage Monitoring** - Alert system for service limits
  - Database table `usage_alerts` for tracking alerts
  - `/api/admin/usage` endpoint for metrics
  - `/api/admin/usage/check-alerts` for limit checking
  - Admin dashboard at `/admin/usage`
  - Netlify scheduled function for daily checks
- **Image Optimization** - Reduced storage usage
  - Client-side compression targeting 400KB (down from 1.5MB)
  - Updated ImageUpload and LiveCameraCapture components
- **Branch Sync** - Merged main into all design branches
  - design/pop-art-lichtenstein
  - design/retro-futuristic
  - design/vintage-newsprint

### Files Added
- `src/app/api/key-hunt/route.ts`
- `src/hooks/useKeyHunt.ts`
- `src/components/AddToKeyHuntButton.tsx`
- `src/components/KeyHuntWishlist.tsx`
- `src/lib/imageOptimization.ts`
- `src/app/api/admin/usage/route.ts`
- `src/app/api/admin/usage/check-alerts/route.ts`
- `src/app/admin/usage/page.tsx`
- `netlify.toml`
- `netlify/functions/check-usage-alerts.ts`
- `supabase/migrations/20250117_hot_books_and_key_hunt.sql`
- `supabase/migrations/20250117_usage_monitoring.sql`

### Files Modified
- `src/app/api/hottest-books/route.ts` - Refactored for database caching
- `src/app/hottest-books/page.tsx` - Added AddToKeyHuntButton
- `src/app/key-hunt/page.tsx` - Added My Hunt List flow
- `src/components/ComicDetailsForm.tsx` - Added AddToKeyHuntButton to scan results
- `src/components/KeyHuntBottomSheet.tsx` - Added My Hunt List option
- `src/components/ImageUpload.tsx` - Added compression
- `src/components/LiveCameraCapture.tsx` - Added compression

### Database Changes
- Created `hot_books` table with 10 seeded comics
- Created `hot_books_history` table for ranking tracking
- Created `key_hunt_lists` table for user wishlists
- Created `hot_books_refresh_log` table for API tracking
- Created `usage_alerts` table for monitoring

### Environment Variables Added
- `ADMIN_EMAIL` - For usage alert notifications

---

## January 17, 2026 (Earlier Session)

### Session Summary
Built community key info system with 402 curated key comic entries. Added username system with validation and custom profile page. Implemented key info submission with admin moderation.

### Key Accomplishments
- **Key Comics Database** - 402 curated key comic entries
  - `keyComicsDatabase.ts` with comprehensive key info
  - `keyComicsDb.ts` for database operations
  - Database-backed key info lookup in analyze API
- **Community Key Info** - User submission system
  - `SuggestKeyInfoModal` component for submissions
  - `/api/key-info/submit` for user submissions
  - Admin moderation at `/admin/key-info`
  - `/api/admin/key-info` routes for approval/rejection
- **Username System** - Customizable display names
  - `UsernameSettings` component
  - `/api/username` with validation
  - `/api/username/current` for fetching
  - `usernameValidation.ts` utilities
- **Custom Profile Page** - Replaced Clerk's UserProfile
  - `CustomProfilePage` component
  - Account settings, display preferences
  - Integrated username management

### Files Added
- `src/lib/keyComicsDatabase.ts` - 402 key comic entries
- `src/lib/keyComicsDb.ts` - Database operations
- `src/components/SuggestKeyInfoModal.tsx`
- `src/components/UsernameSettings.tsx`
- `src/components/CustomProfilePage.tsx`
- `src/lib/usernameValidation.ts`
- `src/hooks/useDebounce.ts`
- `src/app/admin/key-info/page.tsx`
- `src/app/api/key-info/submit/route.ts`
- `src/app/api/admin/key-info/route.ts`
- `src/app/api/admin/key-info/[id]/route.ts`
- `src/app/api/username/route.ts`
- `src/app/api/username/current/route.ts`
- `supabase/migrations/20250117_key_info_community.sql`
- `supabase/migrations/20250117_key_info_seed.sql`
- `supabase/migrations/20260117_add_username.sql`

### Files Modified
- `src/app/profile/[[...profile]]/page.tsx` - Use CustomProfilePage
- `src/components/ComicDetailModal.tsx` - Add Suggest Key Info button
- `src/components/auction/AuctionDetailModal.tsx` - Show key info
- `src/components/auction/ListingDetailModal.tsx` - Show key info
- `src/components/auction/SellerBadge.tsx` - Display username
- `src/app/api/analyze/route.ts` - Database key info lookup

### Database Changes
- Created `key_comics` table with 402 seeded entries
- Created `key_info_submissions` table for community submissions
- Added `username` and `display_name_preference` to user_profiles

---

## January 15, 2026 (Session)

### Session Summary
Added email capture for guest bonus scans, implemented test coverage with Jest, built subscription billing foundation, and created feature gating system.

### Key Accomplishments
- **Email Capture** - Bonus scans for email signup
  - `EmailCaptureModal` component
  - `/api/email-capture` with Resend integration
  - 5 bonus scans for email submission
- **Test Coverage** - 43 tests across 3 test files
  - `auction.test.ts` - Auction calculations
  - `subscription.test.ts` - Subscription logic
  - `useGuestScans.test.ts` - Guest scan tracking
- **Subscription Billing** - Foundation for premium tiers
  - `subscription.ts` with tier logic
  - `useSubscription.ts` hook
  - `/api/billing/*` routes (checkout, portal, status)
  - Stripe webhook updates
- **Feature Gating** - Control access by tier
  - `FeatureGate` component
  - `UpgradeModal` for upgrade prompts
  - `TrialPrompt` for trial conversion
  - `ScanLimitBanner` for limit warnings
- **Pricing Page** - Tier comparison at `/pricing`
- **Scan Limits** - Guest 5, free 10/month

### Files Added
- `src/components/EmailCaptureModal.tsx`
- `src/components/FeatureGate.tsx`
- `src/components/UpgradeModal.tsx`
- `src/components/TrialPrompt.tsx`
- `src/components/ScanLimitBanner.tsx`
- `src/lib/subscription.ts`
- `src/hooks/useSubscription.ts`
- `src/app/pricing/page.tsx`
- `src/app/api/email-capture/route.ts`
- `src/app/api/billing/checkout/route.ts`
- `src/app/api/billing/portal/route.ts`
- `src/app/api/billing/status/route.ts`
- `src/app/api/cron/reset-scans/route.ts`
- `jest.config.js`, `jest.setup.js`
- `src/types/__tests__/auction.test.ts`
- `src/lib/__tests__/subscription.test.ts`
- `src/hooks/__tests__/useGuestScans.test.ts`
- `SUBSCRIPTION_TIERS.md`
- `supabase/migrations/20260115_add_subscription_fields.sql`

### Files Modified
- `src/hooks/useGuestScans.ts` - Bonus scan support
- `src/app/api/analyze/route.ts` - Scan limit checks
- `src/app/api/webhooks/stripe/route.ts` - Subscription handling
- Various pages - FeatureGate wrappers

---

## Deploy Log - January 14, 2026 (Late Evening)

**Deployed to Netlify**

### Changes Included:
- **Bug Fix: Pull off the Shelf** - Fixed RLS blocking issue using `supabaseAdmin`
- **Bug Fix: Hydration Mismatch** - Added `hasMounted` state to MobileNav
- **Legal Pages** - Added `/privacy` and `/terms` page structure with CCPA compliance
- **Homepage Footer** - Added Privacy Policy and Terms of Service links
- **Documentation** - Added ARCHITECTURE.md, updated EVALUATION.md with LLC requirement
- **CLAUDE.md Updates** - Added "Let's get started" command, env var deploy check

### Files Added:
- `src/app/privacy/page.tsx`
- `src/app/terms/page.tsx`
- `src/hooks/useCollection.ts`
- `src/app/api/comics/[id]/route.ts`
- `ARCHITECTURE.md`

---

## January 14, 2026 (Late Evening Session)

### Session Summary
Fixed production bugs with listing cancellation and hydration errors. Created legal page structure for Privacy Policy and Terms of Service. Researched LLC requirements for marketplace operation.

### Key Accomplishments
- **Bug Fix: Pull off the Shelf** - Fixed RLS blocking issue by using `supabaseAdmin` instead of `supabase` in `cancelAuction` function
- **Bug Fix: Hydration Mismatch** - Added `hasMounted` state to MobileNav to prevent server/client render differences
- **Legal Page Structure** - Created `/privacy` and `/terms` pages with placeholder content tailored to Collectors Chest
- **Homepage Footer** - Added footer with Privacy Policy and Terms of Service links
- **LLC Research** - Determined LLC formation is recommended for marketplace liability protection
- **Documentation Updates** - Updated EVALUATION.md and BACKLOG.md to reflect LLC requirement and legal page dependencies

### Issues Encountered
- "Pull off the Shelf" returning 200 but not actually cancelling → Root cause: RLS policy blocking the update when using regular `supabase` client
- React hydration error in MobileNav → Root cause: `isSignedIn` value differing between server and client

### Files Added
- `src/app/privacy/page.tsx` - Privacy Policy page with CCPA section
- `src/app/terms/page.tsx` - Terms of Service page with marketplace terms

### Files Modified
- `src/components/MobileNav.tsx` - Added hasMounted state for hydration fix
- `src/lib/auctionDb.ts` - Changed cancelAuction to use supabaseAdmin
- `src/app/page.tsx` - Added footer with legal links
- `EVALUATION.md` - Added LLC requirement, updated priorities
- `BACKLOG.md` - Added LLC formation section

---

## January 14, 2026 (Evening Session - Continued)

### Session Summary
Debugging session to fix production listing creation errors. Discovered missing Supabase columns for graded comics and missing env var in Netlify.

### Key Accomplishments
- **Production Fix** - Added `SUPABASE_SERVICE_ROLE_KEY` to Netlify environment variables
- **Database Schema Fix** - Added missing columns for graded comics: `certification_number`, `label_type`, `page_quality`, `grade_date`, `grader_notes`, `is_signature_series`, `signed_by`
- **CLAUDE.md Updates** - Added critical env var check to deploy process, added "Let's get started" command
- **Test Cases** - Added test cases for listing features

### Issues Encountered
- Production "Unknown error" on listing creation → Root cause: missing database columns + missing env var in Netlify
- Debug logging helped identify the actual Supabase error (PGRST204)

### Files Modified
- `CLAUDE.md` - Added env var deploy check, "Let's get started" command
- `src/app/api/auctions/route.ts` - Removed debug logging
- `TEST_CASES.md` - Added listing feature test cases

### Database Changes (Supabase SQL)
```sql
ALTER TABLE comics ADD COLUMN IF NOT EXISTS certification_number TEXT;
ALTER TABLE comics ADD COLUMN IF NOT EXISTS label_type TEXT;
ALTER TABLE comics ADD COLUMN IF NOT EXISTS page_quality TEXT;
ALTER TABLE comics ADD COLUMN IF NOT EXISTS grade_date TEXT;
ALTER TABLE comics ADD COLUMN IF NOT EXISTS grader_notes TEXT;
ALTER TABLE comics ADD COLUMN IF NOT EXISTS is_signature_series BOOLEAN DEFAULT FALSE;
ALTER TABLE comics ADD COLUMN IF NOT EXISTS signed_by TEXT;
```

---

## Deploy Log - January 14, 2026 (Evening)

**Deployed to Netlify**

### Changes Included:
- **Listing Creation Fixed** - RLS policy bypass using service role key
- **Foreign Key Fix** - localStorage comics now sync to Supabase before listing
- **View Listing Button** - "List in Shop" changes to "View Listing" when comic already listed
- **Seller Name Display** - Shows email username as fallback when no display name set
- **Image Sizing** - Auction/listing modal images constrained to prevent oversizing
- **BidForm White Font** - Input text now visible (text-gray-900)
- **Button Layout** - Standardized primary/secondary buttons in ComicDetailModal
- **Backlog Items** - Added Marvel covers, Username system, Image optimization

### Files Added:
- `src/app/api/auctions/by-comic/[comicId]/route.ts` - Check for active listings

### Files Modified:
- `src/lib/supabase.ts` - Added supabaseAdmin client
- `src/lib/db.ts` - Added ensureComicInSupabase function
- `src/lib/auctionDb.ts` - Use supabaseAdmin, add seller name fallback
- `src/app/api/auctions/route.ts` - Accept comicData, sync before listing
- `src/components/ComicDetailModal.tsx` - View Listing button, button layout
- `src/components/auction/BidForm.tsx` - White font fix
- `src/components/auction/AuctionDetailModal.tsx` - Image constraints
- `src/components/auction/ListingDetailModal.tsx` - Image constraints

---

## Deploy Log - January 14, 2026 (Afternoon)

**Deployed to Netlify**

### Changes Included:
- **Currency Formatting Fixed** - All prices now show commas for thousands ($3,000 vs $3000)
- **Smart Cents Display** - Only shows decimals when not whole dollar ($44 vs $44.00, but $44.22 stays)
- **White Font Fix** - Comic title now visible in ListInShopModal (was white on gray)

### Files Modified:
- `src/lib/statsCalculator.ts` - Updated formatCurrency() function
- `src/app/hottest-books/page.tsx` - Applied formatCurrency to price ranges
- `src/app/page.tsx` - Applied formatCurrency to hottest books display
- `src/components/auction/ListInShopModal.tsx` - Added text-gray-900 to title

---

## January 14, 2026 (Morning Session)

### Session Summary
Bug fix session addressing 5 user-reported issues from production testing. Fixed critical waitlist API error (restricted Resend API key), deployed missing PWA icon PNG files, added iOS Chrome detection for PWA install prompts, and added GoCollect integration to backlog for future research.

### Key Accomplishments
- **Waitlist API Fixed** - Root cause was restricted Resend API key (send-only). Created new full-access key for Collectors Chest.
- **PWA Icons Deployed** - All PNG files were gitignored (`*.png` rule), causing 404s. Removed rule and committed icons.
- **iOS Chrome Detection** - Added specific UI for Chrome on iOS directing users to Safari for PWA install.
- **iOS Safari Instructions** - PWA install prompt now shows Share menu instructions for iOS Safari users.
- **Waitlist Debug Logging** - Added detailed error logging to diagnose API issues.
- **GoCollect Backlog Item** - Added research item for GoCollect API integration as potential data provider.
- **Design Review Backlog Item** - Added item to create unique visual identity for app.

### Files Added
- `public/icons/*.png` - All PWA icon files (7 files)

### Files Modified
- `.gitignore` - Removed `*.png` rule
- `src/app/api/waitlist/route.ts` - Added debug error logging
- `src/components/PWAInstallPrompt.tsx` - Added iOS Chrome detection and Safari redirect
- `BACKLOG.md` - Added GoCollect integration and design review items
- `EVALUATION.md` - Added launch prep item to remove debug info
- `TEST_CASES.md` - Added PWA install prompt test cases

### Issues Resolved
- Waitlist "Failed to join" error → New Resend API key with full access
- Android app icon white background → PNG files now in git and deployed
- Android shortcut icons showing white squares → Same fix as above
- iOS PWA install prompt not showing → Added iOS Safari/Chrome-specific UIs

---

## Deploy Log - January 14, 2026

**Deployed to Netlify**

### Changes Included:
- **PWA Icons Fixed** - Added all PNG icon files (were gitignored, causing 404s on production)
- **iOS Chrome Detection** - PWA install prompt now detects Chrome on iOS and shows Safari redirect instructions
- **Waitlist Error Logging** - Added detailed error logging for Resend API debugging
- **GoCollect Backlog** - Added GoCollect API integration as future enhancement

### Fixes:
- Android app icon white background → proper blue background
- Android shortcut icons (Collection/Lookup) → blue circular icons
- iOS Chrome users now get proper "Open in Safari" instructions

---

## Deploy Log - January 13, 2026 (Night)

**Deployed to Netlify**

### Changes Included:
- **Private Beta Mode** - Registration disabled, waitlist email capture instead
- **Waitlist API** - Connected to Resend Contacts for email collection
- **Technopathy Rebrand** - All user-facing "AI" references changed to "technopathic/technopathy"
- **Revert Command** - Added "revert technopathy" command to CLAUDE.md for quick rollback
- **Project Costs** - Documented fixed/variable costs in CLAUDE.md

---

## January 13, 2026 (Night Session)

### Session Summary
Risk assessment of live site led to implementing private beta mode. Disabled public registration, converted sign-up to waitlist with Resend integration. Rebranded all user-facing "AI" text to "technopathy" for comic-book theming. Discovered critical issue: signed-in user collections are stored in localStorage only, not synced to cloud.

### Key Accomplishments
- **Private Beta Mode** - Sign-up page now captures waitlist emails instead of creating accounts
- **Waitlist API** (`/api/waitlist/route.ts`) - Sends emails to Resend Contacts audience
- **Technopathy Rebrand** - Changed 12+ files from "AI" to "technopathic/technopathy"
- **Revert Command** - Documented all technopathy changes in CLAUDE.md for quick rollback
- **Project Costs** - Added cost tracking to CLAUDE.md (Netlify $9/mo, Domain $13.99/yr, Anthropic ~$0.015/scan)
- **Cloud Sync Priority** - Identified that collections are localStorage-only, added as #1 Critical priority

### Files Added
- `src/app/api/waitlist/route.ts` - Waitlist email capture via Resend

### Files Modified
- `src/app/sign-up/[[...sign-up]]/page.tsx` - Converted to waitlist form
- `src/components/GuestLimitBanner.tsx` - "Join Waitlist" CTAs
- `src/components/SignUpPromptModal.tsx` - Private beta messaging
- `src/app/layout.tsx`, `src/app/page.tsx` - Technopathy text
- `src/components/Navigation.tsx`, `AskProfessor.tsx` - FAQ updates
- `src/components/ComicDetailModal.tsx`, `ComicDetailsForm.tsx`, `KeyHuntPriceResult.tsx` - Price warnings
- `src/app/key-hunt/page.tsx`, `src/hooks/useOffline.ts` - Disclaimer text
- `src/app/api/analyze/route.ts`, `src/app/api/quick-lookup/route.ts` - API disclaimer
- `CLAUDE.md` - Revert technopathy command, project costs, services docs
- `EVALUATION.md` - Cloud sync as #1 priority, updated checklist items

### Issues Discovered
- **CRITICAL**: Signed-in users' collections stored in localStorage only - NOT synced across devices
  - Database schema exists (`src/lib/db.ts` has `getUserComics`, etc.)
  - Collection page uses localStorage (`src/lib/storage.ts`)
  - Must implement cloud sync before opening registration

---

## Deploy Log - January 13, 2026 (Evening)

**Deployed to Netlify**

### Changes Included:
- PWA icons fixed (no more white border on Android, proper maskable icons)
- Custom chest icon in header (replaces Archive icon)
- Shortcut icons for Collection (BookOpen) and Lookup (Search) in Android long-press menu
- Offers system API routes for offer/counter-offer flow
- Listing expiration cron job (30-day listings, 48-hour offers)
- Email notifications via Resend for offers/listings
- ListInShopModal, MakeOfferModal, OfferResponseModal components
- Services documentation in CLAUDE.md

---

## Deploy Log - January 13, 2026

**Deployed to Netlify**

### Changes Included:
- Auction Feature with eBay-style bidding and Stripe integration
- Mobile UX improvements, auto-hide nav, and hottest books fallback
- Con Mode, grade-aware pricing, and mobile camera enhancements
- Sentry error tracking (client, server, edge)
- PostHog analytics integration
- Upstash rate limiting on AI & bid routes
- Redis caching for AI/eBay price lookups
- Buy Now fixed-price listings in Shop
- Enhanced CGC/CBCS/PGX cert lookup with grading details
- Fixed viewport metadata (Next.js 16 migration)
- Fixed deprecated Stripe webhook config
- Added "Let's get started" daily standup skill
- Updated docs to reflect Netlify hosting

---

## January 11, 2026 (Evening)

### Session Summary
Major infrastructure improvements and enhanced CGC/CBCS certification lookup. Added Sentry, PostHog, rate limiting, and Redis caching. Completed Buy Now feature and enhanced graded comic data capture.

### Key Accomplishments
- Added Sentry error tracking (client, server, edge configs)
- Added PostHog analytics with provider component
- Added Upstash rate limiting for AI and bidding endpoints
- Added Redis caching for price lookups (reduces AI costs)
- Completed Buy Now fixed-price listings in Shop
- Enhanced CGC/CBCS/PGX cert lookup:
  - Captures signatures → signedBy
  - Captures key comments → keyInfo
  - Added gradeDate, graderNotes, pageQuality fields
  - Clickable cert verification links
  - CBCS alphanumeric cert support
- Fixed viewport metadata migration (Next.js 16)
- Removed deprecated Stripe webhook config
- Updated EVALUATION.md score from 6.8 → 8.2 (92% launch ready)
- Added test cases for new features

### Files Added
- `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
- `src/components/PostHogProvider.tsx`
- `src/lib/cache.ts` (Redis caching)
- `src/lib/rateLimit.ts` (Upstash rate limiting)
- `src/app/api/listings/[id]/purchase/route.ts` (Buy Now)
- `src/components/auction/CreateListingModal.tsx`, `ListingCard.tsx`, `ListingDetailModal.tsx`
- `supabase/migrations/20260111_add_grading_details.sql`

### Files Modified
- `src/lib/certLookup.ts` (enhanced parsing for all grading companies)
- `src/types/comic.ts` (added gradeDate, graderNotes)
- `src/components/ComicDetailsForm.tsx` (grading details section with cert link)
- `src/components/ComicDetailModal.tsx` (grading details display)
- `src/app/api/analyze/route.ts` (cert data mapping)
- `EVALUATION.md`, `TEST_CASES.md`, `CLAUDE.md`

### Issues Encountered
- Multiple files needed gradeDate/graderNotes fields added for TypeScript compliance
- Resolved by updating all ComicDetails instantiation points

---

## January 10, 2026

### Session Summary
Implemented the complete Auction Feature for the Shop, including eBay-style bidding with proxy support, watchlists, seller reputation, and payment integration.

### Key Accomplishments
- Created database migration with 5 new tables (auctions, bids, auction_watchlist, seller_ratings, notifications)
- Built TypeScript types and database helper functions
- Implemented 10 API routes for auctions, bidding, watchlist, notifications, and seller ratings
- Created 9 UI components (AuctionCard, BidForm, BidHistory, CreateAuctionModal, etc.)
- Built 3 new pages: /shop, /my-auctions, /watchlist
- Added NotificationBell component to navigation
- Integrated Stripe for payment processing
- Set up Vercel cron job for processing ended auctions

### Files Added/Modified
- `supabase/migrations/20260110_create_auctions.sql`
- `src/types/auction.ts`
- `src/lib/auctionDb.ts`
- `src/app/api/auctions/**` (multiple routes)
- `src/components/auction/**` (9 components)
- `src/app/shop/page.tsx`
- `src/app/my-auctions/page.tsx`
- `src/app/watchlist/page.tsx`
- `src/components/NotificationBell.tsx`
- `src/components/Navigation.tsx` (updated)
- `vercel.json` (cron config)
- `BACKLOG.md` (marked auction feature complete)

### Issues Encountered
- Supabase migration failed initially due to `auth.current_profile_id()` function not existing
- Resolved by creating helper functions in `public` schema instead of `auth` schema
- Stripe API version needed updating to match installed package

---

## January 9, 2026 (Evening)

### Session Focus
Mobile UX Improvements, Empty Image Fixes, Auto-Hide Navigation, and Hottest Books Static Fallback

### Completed

**Home Page Updates for Logged-In Users**
- Added collection insight cards: "Biggest Increase", "Best Buy" (ROI), "Biggest Decline"
- Duration filters for 30/60/90 day value changes
- Moved "Scan a Book" CTA to top position
- Changed title to "A Look in Your Chest" for logged-in users
- Removed Features section and "View Collection" button for logged-in users
- Inline Hottest Books grid on home page (no longer just a banner link)
- Removed "Powered by AI Vision" badge

**Empty Image Source Fixes**
- Fixed console error "empty string passed to src attribute" across 10+ components
- Added Riddler-style placeholder for missing covers (green glowing "?" on dark background)
- Components fixed: ComicCard, ComicListItem, ComicDetailModal, VariantsModal, PublicComicCard, PublicComicModal, collection/page.tsx, page.tsx

**Mobile Cover Image Improvements**
- ComicDetailModal: Cover now displays as small thumbnail (80px) alongside title on mobile
- Desktop unchanged - full cover panel on left side
- Edit modal: Hidden large cover preview on mobile, form-only view
- Added bottom padding to modals to clear floating nav bar

**Cover Image Editing in Edit Mode**
- ComicDetailsForm now shows cover options even when cover already exists
- Mobile: "Find New Cover" button + URL paste field
- Desktop: Inline URL input with search link
- Current cover thumbnail displayed with change options

**Auto-Hide Navigation on Scroll**
- Bottom nav slides down when scrolling down (past 100px)
- Nav reappears when scrolling up
- Always visible near top of page (< 50px)
- Small scroll threshold (10px) to prevent jitter
- Smooth 300ms transition animation

**Mobile Cover Image Search Enhancement**
- Large "Search Google Images" button at top of cover section on mobile
- Updated instructions for Android: "Tap & hold → Open in new tab → Copy URL"
- Added backlog item for native app implementation (open device default browser)

**Hottest Books Static Fallback**
- Created static list of 10 hot books with cover images from Comic Vine
- Added `USE_STATIC_LIST` flag to conserve API credits during testing
- Added Pre-Launch Checklist to BACKLOG.md with reminder to re-enable live API

### Files Created
- `src/lib/staticHotBooks.ts` - Static fallback list for Hottest Books feature

### Files Modified
- `src/components/MobileNav.tsx` - Auto-hide on scroll with transform animation
- `src/components/ComicDetailModal.tsx` - Compact mobile layout with thumbnail
- `src/components/ComicDetailsForm.tsx` - Cover editing for existing covers, mobile-first layout
- `src/components/ComicCard.tsx` - Riddler-style empty image placeholder
- `src/components/ComicListItem.tsx` - Riddler-style empty image placeholder
- `src/components/VariantsModal.tsx` - Riddler-style empty image placeholder
- `src/components/PublicComicCard.tsx` - Riddler-style empty image placeholder
- `src/components/PublicComicModal.tsx` - Riddler-style empty image placeholder
- `src/app/collection/page.tsx` - Empty image fixes, edit modal mobile improvements
- `src/app/page.tsx` - Home page updates for logged-in users, empty image fix
- `src/app/api/hottest-books/route.ts` - Static list fallback for testing
- `BACKLOG.md` - Added Pre-Launch Checklist, native app cover search item

### Blockers / Issues Encountered
1. **Anthropic API credits exhausted** - Hottest Books failed to load; solved with static fallback list
2. **Bottom nav overlapping CTAs** - Evaluated 6 options; implemented auto-hide on scroll
3. **Cover image taking full mobile screen** - Redesigned to compact thumbnail layout

### Notes for Future Reference
- Claude Max subscription ≠ Anthropic API credits (separate billing systems)
- Auto-hide nav pattern similar to Instagram/Twitter - users expect it
- Riddler-style "?" placeholder adds personality while indicating missing data
- `USE_STATIC_LIST = true` saves API costs during testing; flip to false before launch

---

## January 9, 2026

### Session Focus
Hybrid Database Caching, Bug Fixes, and Auto-Refresh Comic Details

### Completed

**Hybrid Database Caching System** (Performance Optimization)
- Created `comic_metadata` table in Supabase as shared repository
- Implemented 3-tier caching: Memory Cache (5min TTL) → Database (~50ms) → Claude API (~1-2s)
- Comic lookups now check database first, only calling AI for unknown comics
- Results from AI automatically saved to database for future users
- Tracks lookup count for popularity analytics
- Case-insensitive matching with indexed queries
- Updated import-lookup API to use same hybrid approach - CSV imports now seed the database

**Auto-Refresh Comic Details on Title/Issue Change**
- Detects when user changes title or issue number after initial lookup
- Automatically fetches fresh details for the new title/issue combination
- Smart data replacement: replaces AI-derived fields but preserves user-entered data (notes, purchase price, etc.)
- Works in both add and edit modes
- Tracks "last looked up" values to detect meaningful changes

**Bug Fixes**
- **Title Autocomplete Stale Results**: Fixed issue where typing new query showed results from previous search (cleared suggestions immediately on input change before debounce)
- **Value By Grade Button Form Submission**: Fixed button triggering form submit, incrementing scan count, and showing "book added" toast (added `type="button"` attribute)
- **Empty src Attribute Warning**: Fixed browser console warning from empty img src by adding conditional rendering
- **Disclaimer Text Update**: Changed pricing disclaimer from "AI-estimated values..." to "Values are estimates based on market knowledge. Actual prices may vary."

**Icons Directory Setup** (Preparation for Custom Branding)
- Created `/src/components/icons/index.tsx` with icon template and specifications
- Created `/public/icons/` directory for favicon variants
- Added TreasureChest placeholder component ready for custom SVG paths
- Documented all icon sizes used in app (12px to 64px)

**Backlog Updates**
- Added "Custom SVG Icons & Branding" as HIGH priority item
- Added "Further Optimize Search Results" as Medium priority item

### Files Created
- `supabase/migrations/20260109_create_comic_metadata.sql` - Shared comic metadata table with indexes and RLS policies
- `src/components/icons/index.tsx` - Custom icon template with TreasureChest placeholder

### Files Modified
- `src/lib/db.ts` - Added `getComicMetadata()`, `saveComicMetadata()`, `incrementComicLookupCount()` functions
- `src/app/api/comic-lookup/route.ts` - Complete rewrite with hybrid 3-tier caching
- `src/app/api/import-lookup/route.ts` - Added hybrid caching so CSV imports seed database
- `src/app/api/key-hunt-lookup/route.ts` - Updated disclaimer text
- `src/components/ComicDetailsForm.tsx` - Added auto-refresh when title/issue changes
- `src/components/TitleAutocomplete.tsx` - Fixed stale suggestions by clearing immediately on input change
- `src/components/GradePricingBreakdown.tsx` - Added `type="button"` to prevent form submission
- `src/app/scan/page.tsx` - Fixed empty src conditional rendering
- `BACKLOG.md` - Added two new items

### Blockers / Issues Encountered
1. **Supabase "destructive operation" warning** - The `DROP TRIGGER IF EXISTS` statement triggered a warning but is safe (idempotent pattern)
2. **Title/issue change detection** - Initially only showed re-lookup prompt in edit mode; refactored to detect changes from previous lookup values

### Notes for Future Reference
- Database lookups are ~50ms vs ~1-2s for Claude API calls - significant UX improvement
- Memory cache uses 5-minute TTL to balance freshness with speed
- CSV imports of common comics will now benefit all future users via shared repository
- The hybrid approach gracefully handles database failures (falls back to AI)
- Non-blocking saves with `.catch()` ensure failed caches don't break user experience

---

## January 8, 2026 (Evening)

### Session Focus
Key Hunt, Mobile Camera Enhancements, Grade-Aware Pricing, and Barcode Scanner Fixes

### Completed

**Key Hunt - Mobile Quick Lookup** (New Feature)
- Created dedicated `/key-hunt` page for quick price lookups at conventions
- Built QuickResultCard component with minimal UI for fast scanning
- Created `/api/quick-lookup` endpoint combining barcode lookup + AI pricing
- Added "Passed On" default list for tracking comics seen but not purchased
- All 25 standard CGC grades in horizontally scrollable picker for raw books
- Auto-detect grade for slabbed comics (no selector needed)
- Raw and slabbed price display based on selected grade
- Three quick-add buttons: Want List, Collection, Passed On
- Recent scans history with localStorage persistence
- Offline barcode cache (7-day TTL, 20 entries max)
- Added Key Hunt to mobile nav as 3rd item (Home → Scan → Key Hunt → Collection)

**Enhanced Mobile Camera Integration**
- Built LiveCameraCapture component with full-screen camera preview
- Capture button with photo review before submission
- Retake option before confirming
- Front/rear camera switching on supported devices
- Gallery access option alongside camera capture
- Graceful permission handling with clear error messages
- Fallback to file upload for unsupported browsers

**Sign-Up Prompts at Scan Milestones**
- Created SignUpPromptModal component for milestone-based prompts
- After 5th scan: Soft prompt highlighting cloud sync benefits
- Before 10th scan: Stronger prompt about limit approaching
- After limit reached: Clear CTA to unlock unlimited scanning
- Milestone tracking persisted in localStorage (shows each prompt only once)

**Grade-Aware Pricing**
- Updated PriceData type with GradeEstimate interface (6 grades: 9.8, 9.4, 8.0, 6.0, 4.0, 2.0)
- Modified analyze API to request grade-specific prices from Claude
- Created gradePrice.ts utility for interpolation between grades
- Built GradePricingBreakdown component (expandable grade/price table)
- Integrated into ComicDetailModal and ComicDetailsForm
- Raw vs slabbed price differentiation

**Barcode Scanner Camera Fixes**
- Rewrote BarcodeScanner with explicit Permissions API checking
- State machine approach (checking → requesting → starting → active → error)
- Detailed error messages for each error type (permission denied, not found, in use)
- Retry mechanism with "Try Again" button
- "How to Enable Camera" instructions for permission issues
- Support for multiple barcode formats (UPC-A, UPC-E, EAN-13, EAN-8, CODE-128)
- Visual scanning overlay with animated corners and scan line
- Fixed DOM timing issues with initialization delays

### Files Created
- `src/app/key-hunt/page.tsx` - Key Hunt page
- `src/components/QuickResultCard.tsx` - Minimal result card for Key Hunt
- `src/app/api/quick-lookup/route.ts` - Combined barcode + price lookup API
- `src/components/LiveCameraCapture.tsx` - Full-screen camera preview
- `src/components/SignUpPromptModal.tsx` - Milestone sign-up prompts
- `src/components/GradePricingBreakdown.tsx` - Expandable grade price table
- `src/lib/gradePrice.ts` - Grade interpolation utilities

### Files Modified
- `src/lib/storage.ts` - Added "Passed On" default list
- `src/lib/db.ts` - Added "Passed On" to Supabase mapping
- `src/components/MobileNav.tsx` - Added Key Hunt as 3rd nav item
- `src/components/BarcodeScanner.tsx` - Complete rewrite with better error handling
- `src/components/ImageUpload.tsx` - Integrated LiveCameraCapture, added gallery access
- `src/hooks/useGuestScans.ts` - Added milestone tracking
- `src/app/scan/page.tsx` - Integrated SignUpPromptModal
- `src/types/comic.ts` - Added GradeEstimate interface to PriceData
- `src/app/api/analyze/route.ts` - Added grade-specific price requests
- `src/components/ComicDetailModal.tsx` - Added GradePricingBreakdown
- `src/components/ComicDetailsForm.tsx` - Added GradePricingBreakdown
- `BACKLOG.md` - Moved 5 items to Completed section

### Blockers / Issues Encountered
1. **MilestoneType null handling** - Fixed TypeScript error with `Exclude<MilestoneType, null>` utility type
2. **Camera permission black screen** - Solved with explicit Permissions API checks before scanner init

### Notes for Future Reference
- Key Hunt barcode scans are always raw books (can't scan barcode through a slab)
- For slabbed comics, need image scan to detect grade from CGC/CBCS label
- Grade interpolation uses linear interpolation between known grade points
- Barcode cache uses 7-day TTL and max 20 entries to balance storage vs usefulness

---

## January 8, 2026

### Session Focus
UX Improvements, CSV Import Feature, and Home Page Refinements

### Completed

**Home Page Improvements**
- Moved Features section (Technopathic Recognition, Track Values, Buy & Sell) above "How It Works"
- Hide "View Collection" button for non-registered users
- Changed CTA text to "Scan Your First Book" for guests
- "How It Works" section only displays for non-logged-in users

**Collection Page Enhancements**
- Added List dropdown filter for filtering by user lists
- Updated Lists filter to use ListFilter icon
- Mobile-responsive filter bar (hidden labels on small screens)

**CSV Import Feature** (Registered Users Only)
- Built CSVImport component with multi-step flow (upload → preview → import → complete)
- Created `/api/import-lookup` endpoint for AI-powered price/key info lookups
- Added "Import CSV" button to scan page (only visible to signed-in users)
- Supports all collection fields: title, issueNumber, variant, publisher, etc.
- Progress tracking during import with success/failure reporting
- Added downloadable sample CSV template with example comics

**View Variants Feature**
- Created VariantsModal component to view all variants of same title/issue
- Added "View Variants (X)" link in comic detail modal when duplicates exist
- Search functionality within variants modal

**Cover Image Lightbox**
- Added click-to-enlarge cover images on book details page
- Zoom overlay on hover, full-screen lightbox on click

**Ask the Professor FAQ**
- Added FAQ about guest vs registered user features

**Copy Updates**
- "Other ways to add comics" → "Other ways to add your books"
- Various terminology refinements

### Files Created
- `src/components/CSVImport.tsx` - CSV import component with preview and progress
- `src/components/VariantsModal.tsx` - Modal for viewing comic variants
- `src/app/api/import-lookup/route.ts` - API for bulk import price/key lookups
- `public/sample-import.csv` - Sample CSV template for users

### Files Modified
- `src/app/page.tsx` - Features section moved, conditional CTAs, guest-only sections
- `src/app/collection/page.tsx` - List filter dropdown, ListFilter icon
- `src/app/scan/page.tsx` - CSV import integration, updated copy
- `src/components/ComicDetailModal.tsx` - Variants link, cover lightbox
- `src/components/AskProfessor.tsx` - New FAQ item

### Blockers / Issues Encountered
1. **Missing comicvine lib** - Import-lookup route referenced non-existent lib; simplified to use Claude AI only

### Notes for Future Reference
- CSV import uses Claude AI for price lookups during import (rate-limited with 200ms delay)
- Sample CSV template includes 4 example comics showing various scenarios (raw, slabbed, signed, for sale)
- Variant detection matches on title + issueNumber across collection

---

## January 7, 2026

### Session Focus
User Registration & Authentication + CCPA Compliance

### Completed

**User Registration & Authentication**
- Set up Clerk account and configured Google + Apple social login
- Set up Supabase project and database
- Created database schema with 5 tables: profiles, comics, lists, sales, comic_lists
- Added Row Level Security policies (relaxed for dev)
- Installed dependencies: `@clerk/nextjs`, `@supabase/supabase-js`, `svix`
- Created sign-in/sign-up pages with Clerk components
- Updated Navigation with UserButton and Sign In link
- Created profile page for account management
- Implemented guest scan limiting (10 free scans)
- Built data migration modal (prompts users to import localStorage on signup)
- Created database helper functions (`src/lib/db.ts`)

**CCPA Compliance**
- Created webhook endpoint for Clerk `user.deleted` event
- Webhook deletes all user data from Supabase (comics, lists, sales, profile)
- Added webhook signature verification with svix

**Deployment (Netlify)**
- Added environment variables to Netlify
- Fixed secrets scanning issues (removed `netlify.env` from repo)
- Successfully deployed all changes

**Backlog Updates**
- Changed "Enhance Mobile Camera" priority: Medium → Low
- Added new item: "Support File Import" (Medium priority)
- Marked "User Registration & Authentication" as complete

### Files Created
- `middleware.ts` - Clerk auth middleware
- `src/app/sign-in/[[...sign-in]]/page.tsx`
- `src/app/sign-up/[[...sign-up]]/page.tsx`
- `src/app/profile/[[...profile]]/page.tsx`
- `src/app/api/webhooks/clerk/route.ts`
- `src/lib/supabase.ts`
- `src/lib/db.ts`
- `src/hooks/useGuestScans.ts`
- `src/components/GuestLimitBanner.tsx`
- `src/components/DataMigrationModal.tsx`
- `src/components/AuthDataSync.tsx`
- `supabase/schema.sql`

### Files Modified
- `src/app/layout.tsx` - Added ClerkProvider
- `src/components/Navigation.tsx` - Added auth UI
- `src/components/Providers.tsx` - Added AuthDataSync
- `src/app/scan/page.tsx` - Added guest scan limiting
- `.env.local` - Added Clerk + Supabase credentials
- `.env.example` - Added placeholder variables
- `.gitignore` - Added netlify.env
- `BACKLOG.md` - Updated priorities and statuses

### Blockers / Issues Encountered
1. **Clerk peer dependency** - Required upgrading Next.js from 14.2.21 to 14.2.25+
2. **Supabase RLS policies** - Initial policies blocked inserts; relaxed for dev
3. **Netlify secrets scanning** - Failed builds due to "placeholder" string and `netlify.env` file in repo

### Notes for Future Reference
- Clerk + Supabase integration works but proper JWT integration needed for production RLS
- Netlify secrets scanner is aggressive - avoid common words like "placeholder" for secret values
- Consider using Clerk webhooks for more events (user.created, user.updated) in future

---

## January 6, 2026

### Session Focus
Initial App Build - Collector's Catalog

### Completed

**Core Application**
- Set up Next.js 14 project with TypeScript and Tailwind CSS
- Created AI-powered comic cover recognition using Claude Vision API
- Built collection management system with localStorage persistence
- Implemented custom lists (My Collection, Want List, For Sale)
- Added price tracking and profit/loss calculations
- Built sales tracking with history

**UI/UX**
- Mobile-responsive design with bottom navigation
- Comic card and list view components
- Detail modal for viewing/editing comics
- Image upload with drag-and-drop support
- Fun facts displayed during AI scanning
- Toast notifications
- Loading skeletons

**Mobile Camera Support**
- Added camera capture for mobile devices
- Mobile-specific copy and camera icon
- Basic capture via `capture="environment"` attribute

**Project Setup**
- Created BACKLOG.md with feature roadmap
- Added backlog reminder when starting dev server
- Initial Netlify deployment
- Fixed TypeScript build errors for Netlify

### Files Created
- `src/app/api/analyze/route.ts` - Claude Vision API integration
- `src/app/collection/page.tsx` - Collection management page
- `src/app/scan/page.tsx` - Comic scanning page
- `src/app/page.tsx` - Home/dashboard page
- `src/components/ComicCard.tsx`
- `src/components/ComicDetailModal.tsx`
- `src/components/ComicDetailsForm.tsx`
- `src/components/ComicListItem.tsx`
- `src/components/ImageUpload.tsx`
- `src/components/MobileNav.tsx`
- `src/components/Navigation.tsx`
- `src/components/Providers.tsx`
- `src/components/Skeleton.tsx`
- `src/components/Toast.tsx`
- `src/lib/storage.ts` - localStorage management
- `src/types/comic.ts` - TypeScript types
- `BACKLOG.md`
- `README.md`

### Blockers / Issues Encountered
1. **TypeScript Set iteration error** - Fixed for Netlify build compatibility
2. **TypeScript type error in ComicDetailsForm** - Resolved type mismatch

### Notes for Future Reference
- Claude Vision API works well for comic identification
- localStorage is fine for MVP but will need cloud sync for multi-device
- Mobile camera capture works but could be enhanced with live preview

---

<!--
Template for new entries:

## [Date]

### Session Focus
[Main goal for the session]

### Completed
- Item 1
- Item 2

### Files Created
- file1.ts
- file2.tsx

### Files Modified
- file1.ts - [what changed]

### Blockers / Issues Encountered
1. Issue and resolution

### Time Investment
- Estimated: X hours

### Notes for Future Reference
- Learnings, tips, things to remember

-->
