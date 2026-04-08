# Collectors Chest Backlog

## Pre-Launch — Critical / High Priority

### Fix CGC Cert Lookup Cloudflare 403 Errors
**Priority:** High
**Status:** Pending — ZenRows validated, awaiting cost review
**Added:** Apr 5, 2026
**Updated:** Apr 7, 2026

CGC website (`cgccomics.com/certlookup/`) is blocking cert lookups with Cloudflare bot protection (HTTP 403). The current User-Agent (`"CollectorsChest/1.0"`) is detected as a bot. All cert lookups fail, forcing fallback to the full AI pipeline.

**Root cause:** Cloudflare managed challenge blocks non-browser requests. Even full browser headers via curl return 403 — JS execution is required.

**Validated solution:** ZenRows API with `mode=auto&wait=5000` successfully bypasses Cloudflare and returns full cert data (tested Apr 7, 2026 — cert #3986843008 returned complete HTML with grade, title, publisher, etc.).

**Services tested:**
- ❌ ScraperAPI (standard, premium) — failed against CGC
- ❌ ZenRows (`js_render=true&antibot=true`) — timed out
- ✅ ZenRows (`mode=auto&wait=5000`) — **works**, returns full cert page HTML

**Cost:** 25 credits per request. Free trial: 1,000 credits (14 days). Paid plans start at $49/mo for 250K credits (~10,000 cert lookups). With 1-year Redis cache, ongoing costs should be low.

**Blocked on:** Partner cost review of ZenRows subscription before implementation.

**Implementation:** Replace `fetch()` in `src/lib/certLookup.ts` `lookupCGCCert()` with ZenRows API call. Env var `ZENROWS_API_KEY` already added to `.env.local`. Needs to be added to Netlify when ready.

**Impact:** Cert-first pipeline falls back to full AI on every slabbed scan, negating cost savings. Also affects existing cert lookup feature for all users.

---

### Optimize Scan Pipeline for Slabbed Comics (Cert-First)
**Priority:** High
**Status:** Implemented (Apr 5, 2026) — effectiveness limited by CGC Cloudflare 403
**Added:** Apr 5, 2026

Pipeline code is complete and deployed. The cert-first path works end-to-end for CBCS and PGX slabs. CGC slabs fall back to the full AI pipeline due to the Cloudflare 403 blocking issue (see "Fix CGC Cert Lookup Cloudflare 403 Errors"). Once ZenRows is deployed, this item is fully complete.

---

### Auto-Harvest Cover Images from Graded Book Scans
**Priority:** High
**Status:** Prompt fixed — needs deploy + re-test
**Added:** Feb 26, 2026
**Updated:** Apr 7, 2026

Pipeline is running end-to-end (7 covers harvested in production), but the AI is returning **wrong crop coordinates**. It's cropping the grade label area (top of slab) instead of the cover artwork (lower portion visible through the case). All 3 tested images show the same pattern: grade number + label info + just the top edge of the cover.

**Root cause:** The `extractSlabDetails()` AI prompt isn't specific enough about what "cover artwork" means. The AI is interpreting "cover" as the top of the slab (which includes the grading label) rather than the comic book cover art visible through the case below the label.

**Fix needed:** Update the AI prompt in `src/lib/providers/anthropic.ts` and `gemini.ts` to explicitly instruct: "The cover artwork is the comic book art visible through the clear slab case BELOW the grading label. Do NOT include the grade label, cert number, or barcode area in the crop coordinates."

**Also consider:** Delete the 7 bad harvested covers from `cover_images` table and Supabase Storage after fixing.

**Design doc:** `docs/plans/2026-02-25-cover-image-harvesting-design.md`
**Implementation Plan:** `docs/superpowers/plans/2026-04-02-cover-image-harvesting.md`

---

### Enable Stripe Connect in Live Mode
**Priority:** High (Pre-Launch)
**Status:** In Progress — blocked on Stripe identity verification
**Added:** Apr 6, 2026

Stripe Connect is only enabled in test/sandbox mode. Live mode Connect is required for sellers to onboard and receive real payments on the production site. Stripe requires completing the sandbox walkthrough before enabling Live mode, but identity verification is currently failing.

**Where we left off:**
1. ✅ Selected "Platform" business model in Stripe Connect
2. ✅ Started sandbox walkthrough
3. ❌ Identity verification step failing — retry next session

**Next steps:**
- Complete sandbox identity verification (may need to retry or use different browser)
- Once sandbox is complete, enable Connect in Live mode
- Test seller onboarding flow end-to-end on production
- Verify platform fee collection works in live mode

---

### Launch Tracker Review
**Priority:** High (Pre-Launch)
**Status:** Pending
**Added:** Mar 11, 2026
**Source:** Partner Meeting (Session 19)
**Target:** Week of April 20, 2026 (partner meeting April 22). Supabase Pro upgrade due by April 23.

Conduct a comprehensive review of launch readiness. Assess feature completeness, UX polish, performance, and outstanding bugs to determine a launch timeline.

---

### Signature Detection on Cached Scan Path
**Priority:** High (Pre-Launch)
**Status:** Implemented — effectiveness limited by CGC Cloudflare 403
**Added:** Apr 6, 2026
**Updated:** Apr 7, 2026

When cert lookups work (CBCS/PGX now, CGC after ZenRows fix), signature data comes directly from the cert — `signatures` field and `labelType: "Signature Series"`. This covers the primary use case of detecting signed slabbed books. Once the CGC Cloudflare fix (#1) is deployed, this is effectively resolved for all grading companies.

---

## Pending Enhancements

### Customizable Initial Message
**Priority:** Low
**Status:** Pending
**Added:** Jan 29, 2026

Allow users to customize the initial message when starting a conversation via the "Message Seller" button. Currently auto-sends "Hi! I'm interested in your listing." without user input.

**Proposed UX:**
- Show a modal/popup when clicking "Message Seller"
- Pre-fill with suggested text but allow editing
- Include listing context (title, image thumbnail) in the modal
- Send button to confirm

**Files to Modify:**
- `src/components/messaging/MessageButton.tsx`
- New: `src/components/messaging/ComposeMessageModal.tsx`

---

### Re-introduce Dedicated Barcode Scanning
**Priority:** Low
**Status:** Pending (Blocked)
**Added:** Feb 4, 2026
**Blocked:** Requires a barcode database to be set up first before this feature can proceed.

Re-enable dedicated barcode scanning feature once the crowd-sourced barcode catalog has sufficient data to provide reliable lookups.

**Context:**
The dedicated barcode scanner was removed on Feb 4, 2026 because:
- Comic Vine API returns garbage data for UPC queries (1.1M wildcard results)
- Metron.cloud has exact UPC matching but server was down
- No reliable external barcode → comic mapping API exists

**Current Approach:**
- Barcodes are now detected during AI cover scans and cataloged
- Building a crowd-sourced `barcode_catalog` database
- Admin review queue for low/medium confidence detections

**Prerequisites to Re-enable:**
1. Barcode catalog has 5,000+ verified entries
2. OR partner with local comic shop to seed data
3. OR find a reliable external UPC database (GoCollect API may provide this)
4. OR Comic Vine fixes their API to support exact UPC matching

**When Ready:**
1. Restore `BarcodeScanner.tsx` component from git history (commit before Feb 4, 2026)
2. Update barcode lookup to query our `barcode_catalog` first
3. Fall back to AI cover scan if barcode not in catalog
4. Re-add "Scan Barcode" option to scan page and Key Hunt

**Spec Document:** `docs/BARCODE_SCANNER_SPEC.md` - Full technical documentation

---

### Activate OpenAI as Fallback Provider for Full Anthropic Outages
**Priority:** Low
**Status:** Deferred to Post-Launch (Mar 9, 2026) — Self-healing pipeline handles model deprecation; OpenAI activation only needed for full Anthropic outages
**Design Doc:** `docs/plans/2026-02-27-scan-resilience-design.md`
**Implementation Plan:** `docs/plans/2026-03-01-scan-resilience-plan.md`

Code implementation is complete (8 commits, 370 tests passing). Deployment and alerting infrastructure are live. Remaining steps:

**Completed:**
- ✅ **Run migration SQL** — `supabase/migrations/20260301_scan_analytics_provider.sql` run in production; `provider`, `fallback_used`, `fallback_reason` columns live
- ✅ **Deploy** — Code pushed to production (Mar 3, 2026)
- ✅ **Add fallback rate alerting (Tier 1)** — `check-alerts` cron extended to query `scan_analytics` for fallback rate; sends Resend email if fallback_used exceeds 10% in the last hour
- ✅ **Add model health check (Tier 2)** — Lightweight scheduled probe at `/api/admin/health-check` makes minimal API call to each provider; sends immediate alert on 403/404

**Remaining:**
1. **Get OpenAI API key** — Pending business account setup at platform.openai.com; requires billing added before key can be generated
2. **Add `OPENAI_API_KEY`** to `.env.local` (local) and Netlify environment variables (production)
3. **Run prompt compatibility study** — Run 10-15 sample comic images through both Anthropic and OpenAI, document quality delta (see design doc "Prompt Compatibility & Validation" section)
4. **End-to-end fallback testing** — Set `ANTHROPIC_API_KEY` to invalid value, verify OpenAI fallback activates; test both keys invalid for graceful error; verify "taking longer" message after 5 seconds
5. **Set up EasyCron entry for `/api/admin/health-check`** — Schedule hourly call with `CRON_SECRET` auth header

**Complexity:** Low — remaining steps are account setup, configuration, and testing.

---

### Add "Professor" Persona Throughout Site
**Priority:** Medium
**Status:** Pending

Create a consistent "Professor" character/persona that provides tips, guidance, and commentary throughout the application. This persona adds personality and makes the app more engaging.

**Areas to Implement:**
- Tooltips and help text
- Empty state messages
- Loading messages / fun facts
- Welcome messages
- Feature explanations
- Error messages (friendly Professor-style guidance)

**Considerations:**
- Design a simple avatar/icon for the Professor
- Define the Professor's voice/tone (knowledgeable but approachable)
- Don't overuse - sprinkle in key moments for delight

---

### Error Reporting System with Creator Credits
**Priority:** Medium
**Status:** Pending
**Added:** Feb 26, 2026

Users can report incorrect data on comics (wrong publisher, year, key info, etc.) via a "Report Error" button. Reports go to an admin queue for review. When admin approves and fixes the data, the reporter earns a Creator Credit.

**Features to Build:**
- "Report Error" button on comic detail views (ComicDetailModal, ComicDetailsForm)
- Error description form (modal/sheet) with dropdown for error category (Wrong Publisher, Wrong Year, Wrong Grade, Key Info Error, etc.)
- Admin review queue at `/admin/reports` showing pending error reports
- Admin dashboard to review, approve/reject, and apply fixes
- Creator Credit wiring system: when admin approves, increment reporter's `creator_credits` and log action in audit trail
- Notification to reporter when their report is approved/rejected

**Database Changes Needed:**
- New table: `error_reports` (id, reporter_id, comic_id, error_category, description, status, created_at, approved_by, approved_at)
- New table: `creator_credits_log` (id, user_id, credit_amount, source, source_id, created_at)
- Add `creator_credits` column to `profiles` table

**Key Files to Create/Modify:**
- New: `src/components/ErrorReportModal.tsx` - Report form
- New: `src/app/admin/reports/page.tsx` - Admin review queue
- New: `src/lib/errorReportDb.ts` - Database helpers
- New: `src/app/api/errors/report/route.ts` - Report submission API
- New: `src/app/api/admin/errors/route.ts` - Admin approval API
- Modify: `src/components/ComicDetailModal.tsx` - Add report button
- Modify: `src/components/ComicDetailsForm.tsx` - Add report button

---

### Missing Metadata Contributions with Creator Credits
**Priority:** Medium
**Status:** Pending
**Added:** Feb 26, 2026

Users can fill in missing comic metadata (writer, cover artist, release year, etc.) and earn Creator Credits after admin approval. This crowdsources completion of incomplete metadata in the database.

**Features to Build:**
- Editable metadata fields on comic detail views for registered users (writer, artist, cover artist, inker, colorist, release year, etc.)
- Submission flow that captures user's changes and submits to admin queue for approval
- Admin review queue at `/admin/contributions` showing pending metadata submissions
- Admin dashboard to review, compare old vs new data, approve/reject, and apply changes
- Creator Credit wiring system: when admin approves, increment contributor's `creator_credits` and log action
- Notification to contributor when their contribution is approved/rejected
- "Contributors" section on comic detail showing who contributed which fields

**Features to Build:**
- User can edit a subset of comic metadata on detail view (marked as "Contribute metadata")
- Submit changes button triggers submission flow
- Form shows original vs proposed values clearly
- Admin review shows change diff and can approve/reject
- Approved contributions auto-update comic and credit user

**Database Changes Needed:**
- New table: `metadata_contributions` (id, contributor_id, comic_id, field_name, old_value, new_value, status, created_at, approved_by, approved_at)
- New table: `creator_credits_log` (id, user_id, credit_amount, source, source_id, created_at) - *shared with Error Reporting System*
- Add `creator_credits` column to `profiles` table
- Track contribution metadata on `comics` table (contributor_id, contributed_fields JSON array)

**Key Files to Create/Modify:**
- New: `src/components/MetadataEditor.tsx` - Editable metadata fields with submission
- New: `src/app/admin/contributions/page.tsx` - Admin review queue
- New: `src/lib/metadataDb.ts` - Database helpers
- New: `src/app/api/contributions/submit/route.ts` - Submission API
- New: `src/app/api/admin/contributions/route.ts` - Admin approval API
- Modify: `src/components/ComicDetailModal.tsx` - Add metadata editor section
- Modify: `src/components/ComicDetailsForm.tsx` - Add metadata editor section

**Note:** Both error reporting and metadata contributions use the same Creator Credit system. Consider creating shared utilities for credit wiring and audit logging.

---

### Expand to Support All Collectibles
**Priority:** Low
**Status:** Pending

Extend the platform beyond comic books to support other collectible categories, transforming the app into a universal collectibles tracker.

**Supported Categories:**
- Funko Pop figures
- Sports cards (baseball, basketball, football, hockey)
- Trading cards (Pokemon, Magic: The Gathering, Yu-Gi-Oh!)
- Action figures
- Vinyl records
- Movies (DVD, Blu-ray, 4K, digital) *(check CLZ Movies for ideation)*
- Video Games (console, PC, retro) *(check CLZ Games for ideation)*
- Music (CDs, vinyl, cassettes) *(check CLZ Music for ideation)*
- Books (first editions, signed copies, rare prints) *(check CLZ Books for ideation)*
- Other collectibles

**Implementation Considerations:**
- Update AI vision prompts to identify collectible type and extract relevant metadata
- Category-specific fields (e.g., card grade, Pop number, set name, ISBN, UPC)
- Category-specific price sources (eBay, TCGPlayer, Pop Price Guide, Discogs, PriceCharting)
- Update UI to accommodate different collectible types
- Allow users to filter collection by category
- Consider renaming app to something more generic (e.g., "Collector's Vault")

**Data Model Changes:**
- Add `collectibleType` field to items
- Dynamic metadata schema based on collectible type
- Category-specific grading scales (PSA for cards, VGA for games, etc.)

---

### Clean Up Copy Throughout the Site
**Priority:** Low
**Status:** Pending (Reviewed Jan 28, 2026 - Acceptable for Launch)

Review and improve all user-facing text throughout the application for consistency, clarity, and brand voice.

**Audit Notes (Jan 28, 2026):**
- Toast messages: Consistent tone, clear success/error messaging
- Empty states: Good user guidance across all pages
- Sign-in prompts: Consistent "Sign in to..." pattern
- Milestone modals: Well-crafted progressive urgency
- Overall: Copy is clean and launch-ready; this is a polish task for post-launch

**Areas for Future Polish:**
- Page titles and descriptions
- Button labels and CTAs
- Error messages and confirmations
- Empty states and placeholder text
- Toast notifications
- Form labels and helper text
- Sign-up prompt modals (milestone prompts for guest users)

---

### Native App: Cover Image Search via Default Browser
**Priority:** Low
**Status:** Pending
**Note:** No external image search API available. Current approach uses manual URL paste. Revisit when native apps are built.

When converting to native mobile apps (iOS/Android), the cover image search feature may need to open the device's default browser for image searches instead of an in-app webview.

**Current Behavior (PWA/Web):**
- User searches for cover images via community DB or Open Library
- User can manually paste a cover image URL from any source
- User pastes copied image URL

**Native App Requirements:**
- Open device's default browser (Safari on iOS, Chrome/default on Android)
- Maintain app state while user is in browser
- Handle return to app gracefully (deep link or app switcher)
- Consider clipboard monitoring to auto-detect copied image URLs (with permission)
- Alternative: In-app browser with "Copy URL" detection

**Platform-Specific Notes:**
- iOS: Use `SFSafariViewController` or `UIApplication.open()` for external browser
- Android: Use `Intent.ACTION_VIEW` or Chrome Custom Tabs
- React Native: `Linking.openURL()` or `react-native-inappbrowser`

**UX Considerations:**
- Clear instructions that user will leave the app temporarily
- "Paste URL" button should be prominent on return
- Consider toast/notification when URL is detected in clipboard

---

### Evaluate Clerk Billing as Stripe Alternative
**Priority:** Low
**Status:** Pending
**Added:** April 2, 2026

Clerk offers subscription/billing services. Investigate whether Clerk Billing could replace or simplify the current Stripe integration for subscription management. Note: Stripe is still likely needed for marketplace payments (seller payouts via Connect), but Clerk might handle the subscription tier management more simply.

**Questions to Research:**
- What does Clerk Billing offer vs Stripe subscriptions?
- Can it handle trial periods, plan upgrades/downgrades?
- Would it reduce integration complexity?
- Does it still require Stripe underneath?

---

### Upgrade Clerk SDK to v7 + Enable Client Trust Status
**Priority:** Low
**Status:** Pending
**Added:** April 2, 2026

Clerk has a pending "Client Trust Status" update that adds `needs_client_trust` sign-in status for second-factor challenges on new devices. Requires `@clerk/nextjs` v7.0.0+ (currently on v6.36.6). This is a major version bump — defer until after launch.

**Warning:** The update notes say custom flows need code changes to handle the new `needs_client_trust` status attribute instead of `client_trust_state`. Review breaking changes before upgrading.

---

### Apple Sign-In & Native App
**Priority:** Low
**Status:** Pending
**Added:** Apr 6, 2026

Re-enable "Sign in with Apple" on the sign-up/sign-in pages. This requires an Apple Developer Program account ($99/yr), which also unlocks building a native iOS app. Since we need the developer account anyway, bundle both efforts together.

**Steps:**
1. Enroll in Apple Developer Program ($99/yr)
2. Create an App ID and configure Sign in with Apple
3. Add Apple OAuth credentials to Clerk Production (replace shared credentials)
4. Re-enable Apple SSO in Clerk Dashboard
5. Consider building a native iOS app wrapper (PWA → native) while we have the account

**Blocked on:** Apple Developer Program enrollment

---

### Custom Sign-Up Form (Replace Clerk's Default)
**Priority:** Medium
**Status:** Pending
**Added:** Apr 6, 2026

Replace Clerk's default `<SignUp />` component with a custom form using Clerk's `useSignUp()` hook. This gives full control over field order, styling, and layout — allowing us to match our Lichtenstein design language and control field order (email → username → password). Currently the browser autofills the email into Clerk's username field, and we cannot reorder fields with the default component.

**Implementation Notes:**
- Use Clerk's `useSignUp()` hook for custom form
- Control field order: email first, then optional username, then password
- Match existing pop-art/Lichtenstein design language
- Keep social login buttons (Google, Apple) at top
- Maintain email verification flow

---

### About Page Copy
**Priority:** Medium
**Status:** Pending
**Added:** Mar 13, 2026

Write "Our Story" origin narrative and "Meet the Team" bios for the About page. Placeholder text is currently highlighted in red. Also complete the "Get in Touch" contact section.

---

### Flip Claude/Gemini Provider Order
**Priority:** Medium
**Status:** Pending
**Added:** Mar 18, 2026

Evaluate whether Gemini should be the primary scanner provider instead of Claude, based on production accuracy comparison data. Currently Claude is primary with Gemini as fallback.

---

### Expand Curated Key Info DB
**Priority:** Medium
**Status:** Pending
**Added:** Mar 18, 2026

Add more vintage key issues to the curated key info database based on user scanning patterns. Current DB has 403+ entries — expand with additional silver/bronze/copper age keys that users are frequently scanning.

---

### Native App Wrapper
**Priority:** Low
**Status:** Pending
**Added:** Mar 18, 2026

Create a native app wrapper (PWA or native shell) to hide the browser URL bar and provide a more app-like experience on mobile. Addresses feedback item #16 (browser URL bar showing on public collection).

---

### Scrape Marvel.com for Cover Images (ZenRows)
**Priority:** Low
**Status:** Pending
**Added:** Apr 7, 2026

Use ZenRows (or similar scraping API) to harvest comic cover images from Marvel's website (https://www.marvel.com/comics). Marvel's deprecated Developer Program means their API is no longer available, but cover images are still publicly accessible on the website. This could replace or supplement Open Library as a cover source in the pipeline.

**Approach:**
- One-time batch scrape of Marvel's comic catalog to pre-seed our `cover_images` / `comic_metadata` database with cover image URLs
- Marvel doesn't have Cloudflare-level bot protection — standard scraping should work
- Crawl their comics listing pages, extract cover image URLs + title/issue metadata, and bulk-insert into our community cover database
- Could also set up a periodic re-scrape (weekly/monthly) to pick up newly released covers
- Goal: When a user scans any Marvel book, we already have the cover image cached — no AI validation needed, no eBay image hunting

**Scale:** Marvel is the largest publisher. Pre-seeding their covers would dramatically improve cover hit rates across the platform.

**Dependencies:** ZenRows subscription (shared with CGC cert lookup if approved). Evaluate whether `mode=auto` is needed or if basic scraping suffices for Marvel.

**Related:** "Remove Open Library from Cover Pipeline" — Marvel scraping could replace Open Library as a more reliable cover source for Marvel titles. Could expand to DC, Image, and other publishers later.

---

### Remove Open Library from Cover Pipeline
**Priority:** Low
**Status:** Pending
**Added:** Mar 19, 2026

Open Library has low accuracy for single-issue comics and burns Gemini quota on validation attempts. Consider removing entirely in favor of community covers + eBay image harvesting only.

---

### Batch Re-Validation for CSV Imports
**Priority:** Low
**Status:** Pending
**Added:** Mar 20, 2026

Build a batch re-validation endpoint for CSV-imported comics with missing covers. Allows users to trigger cover validation for entire import batches without requiring individual scans, respecting Gemini rate limits.

---

### Periodic HEAD Check for Cached eBay URLs
**Priority:** Low
**Status:** Pending
**Added:** Mar 20, 2026

Implement a 30-day cycle periodic HEAD check for cached eBay image URLs to detect dead links early. Prevents showing broken images to users and triggers re-harvesting if needed.

---

### Durable eBay Price Cache in Supabase
**Priority:** Medium
**Status:** Pending
**Added:** Apr 5, 2026

Store eBay pricing results in Supabase with a timestamp. Before hitting the eBay API, check if a price exists that's less than 7 days old. Reduces eBay API calls, speeds up scans for popular books, and lowers costs. Requires new table (title, issue, grade, slabbed, price data, fetched_at), lookup logic in the scan pipeline, and a staleness threshold (suggested 7 days).

---

### User-Configurable Default Collection Sort
**Priority:** Low
**Status:** Pending
**Added:** Apr 5, 2026

Let users choose their preferred default sort method for the collection page (date added, title, issue, grade, value). Save preference in user settings. Currently defaults to date added (most recent first).

---

### IPv6 Private Address Checks in URL Validation
**Priority:** Low
**Status:** Pending
**Added:** Mar 20, 2026

Add IPv6 private address range checks (fd00::/8, fe80::/10, ::1) to URL validation. Currently only validates IPv4 loopback and private ranges; should expand for complete private/loopback detection.
