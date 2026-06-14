// Full Optimization Audit — reusable workflow template (see .claude/skills/full-audit.md)
// Invoke: Workflow({ scriptPath: ".claude/skills/full-audit.workflow.js",
//                    args: { root: "<repo root>", date: "<YYYY-MM-DD>", scope: "<scope>" } })
// Report-only. Adapt the FINDERS list to the audit scope before running (subset for a scoped audit).

export const meta = {
  name: 'full-optimization-audit',
  description: 'Exhaustive end-to-end feature + documentation optimization audit (report-only) with strategic breakdown',
  phases: [
    { title: 'Audit', detail: 'parallel auditors: feature areas + cross-cutting dimensions' },
    { title: 'Verify', detail: 'adversarial skeptic refutes each finding, fixes cost/autonomy claims' },
    { title: 'Consolidate', detail: 'merge duplicate findings per area' },
    { title: 'Report', detail: 'write AUDIT_<date>.md (findings + strategic breakdown) + return summary' },
  ],
}

const ROOT = (args && args.root) || '/Users/chrispatton/Coding for Dummies/Comic Tracker'
const DATE = (args && args.date) || 'UNDATED'
const SCOPE = (args && args.scope) || 'the entire application end-to-end plus all documentation'
const DOC_PATH = ROOT + '/AUDIT_' + DATE + '.md'

const SHARED = `You are ONE auditor in a COMPLETE, exhaustive, end-to-end optimization audit of a Next.js 16 (App Router) + React + TypeScript app (brand: Collectors Chest / "Comic Tracker"). Stack: Supabase (Postgres + storage), Clerk (auth), Stripe (payments + Connect), Anthropic Sonnet + Gemini (AI cover recognition), Upstash Redis (rate-limit + cache), Resend (email), eBay Browse API (pricing), hCaptcha, PostHog, Sentry. Repo root: "${ROOT}". Audit scope: ${SCOPE}.

GOAL: find OPTIMIZATIONS of every kind within your scope — performance, bundle size, running-cost reduction, code quality, maintainability/tech-debt, security, correctness, accessibility, UX, testing gaps, and documentation accuracy/drift. The owner MOST wants NO-COST optimizations to the codebase, but ALSO wants cost-REDUCING wins and any paid-service ideas — each clearly tagged with money impact. Nothing is off-limits. Be thorough; do NOT skip parts of your scope.

REPORT-ONLY: Do NOT edit, create, or delete any files. Investigate only with Read / Grep / Glob and read-only Bash. NEVER start the dev server.

GROUND every finding in real code with a file:line reference in "evidence". Verify in the actual files — do not speculate.

For EACH finding fill ALL fields:
- title: short imperative title
- area: scanning | pricing | collection | auctions | marketplace | payments | social | messaging | email | admin | cross-cutting | frontend | documentation
- dimension: performance | bundle | cost | code-quality | tech-debt | security | correctness | accessibility | ux | testing | dependencies | documentation | database
- severity: high (real bug / security hole / notable cost or perf hit) | medium | low (nit/polish)
- description: FIELD 1 — brief plain description
- issue: FIELD 2 — the specific problem
- recommendation: FIELD 3 — concrete recommended optimization
- costImpact: FIELD 4 — MONEY ONLY, saved/additional/neutral with a number where possible
- costDirection: saves | adds | neutral
- autonomous: FIELD 5 — yes (Claude Code can implement fully in-repo) | partial (code doable but needs a human step: env var, dashboard, DB migration, copy approval) | no (needs decision/approval/paid signup/native build/credentials)
- autonomousNote: one line — if partial/no, what's blocking
- evidence: file:line
- effort: S | M | L

COST CONTEXT: Anthropic Sonnet vision scan ~$0.015/scan; Anthropic Haiku ~$0.0008/call; Gemini cheap/free fallback (and is the PRIMARY vision provider); Supabase free = 500MB DB + 1GB storage (covers ~400KB/photo — storage is the scaling risk), Pro = $25/mo; Clerk free = 10K MAU; Upstash free = 10K cmds/day; Resend free = 3K emails/mo; PostHog 1M events/mo; Sentry 5K errors/mo; hCaptcha 1M req/mo; Netlify ~$9.54/mo; eBay Browse free/rate-limited; Stripe 2.9%+$0.30/txn. GoCollect + Marvel APIs were DISCONTINUED — flag dead references.

Return ONLY real, grounded findings. Be exhaustive within scope; prefer signal over noise.`

const FINDING_PROPS = {
  title: { type: 'string' }, area: { type: 'string' }, dimension: { type: 'string' },
  severity: { type: 'string', enum: ['high', 'medium', 'low'] },
  description: { type: 'string' }, issue: { type: 'string' }, recommendation: { type: 'string' },
  costImpact: { type: 'string' }, costDirection: { type: 'string', enum: ['saves', 'adds', 'neutral'] },
  autonomous: { type: 'string', enum: ['yes', 'partial', 'no'] }, autonomousNote: { type: 'string' },
  evidence: { type: 'string' }, effort: { type: 'string', enum: ['S', 'M', 'L'] },
}
const FINDINGS_SCHEMA = {
  type: 'object',
  properties: { findings: { type: 'array', items: { type: 'object', properties: FINDING_PROPS, required: Object.keys(FINDING_PROPS) } } },
  required: ['findings'],
}
const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    totalFindings: { type: 'number' }, highCount: { type: 'number' }, mediumCount: { type: 'number' }, lowCount: { type: 'number' },
    autonomousYes: { type: 'number' }, autonomousPartial: { type: 'number' }, autonomousNo: { type: 'number' },
    estMonthlySavings: { type: 'string' }, estAdditionalCost: { type: 'string' },
    durationAllRealistic: { type: 'string' }, effortTally: { type: 'string' },
    docWritten: { type: 'boolean' }, docPath: { type: 'string' },
    topItems: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, title: { type: 'string' }, area: { type: 'string' }, severity: { type: 'string' }, costImpact: { type: 'string' }, autonomous: { type: 'string' } }, required: ['ref', 'title', 'area', 'severity', 'costImpact', 'autonomous'] } },
    coverageNotes: { type: 'string' },
  },
  required: ['totalFindings', 'highCount', 'mediumCount', 'lowCount', 'autonomousYes', 'autonomousPartial', 'autonomousNo', 'estMonthlySavings', 'estAdditionalCost', 'durationAllRealistic', 'effortTally', 'docWritten', 'docPath', 'topItems', 'coverageNotes'],
}

// ---- Finder taxonomy: 12 feature areas + 11 cross-cutting dimensions. SUBSET for scoped audits. ----
const FINDERS = [
  { key: 'area:scanning', prompt: SHARED + `\n\nYOUR SCOPE: AI COVER RECOGNITION & SCANNING — api/analyze/route.ts, lib/aiProvider.ts, lib/models.ts, lib/providers/*, app/scan/page.tsx, lib/coverValidation.ts, lib/coverCropValidator.ts, lib/coverHeadCheck.ts, lib/variantResolver.ts, hooks/useGuestScans.ts, lib/hcaptcha.ts, api/con-mode-lookup, api/cover-candidates, api/cover-search, lib/imageOptimization.ts. Look for: redundant/duplicate AI calls, oversized image payloads (cost), missing scan caching, prompt bloat, retry inefficiency, model-tier mismatch (Sonnet where Haiku/Gemini suffices), guest-scan-limit correctness, dead provider code (e.g. OpenAI).` },
  { key: 'area:pricing', prompt: SHARED + `\n\nYOUR SCOPE: PRICING / FMV / eBay / KEY HUNT / CERT — lib/ebayBrowse.ts, api/ebay-prices, lib/gradePrice.ts, app/key-hunt/page.tsx, api/key-hunt, components/KeyHuntPriceResult.tsx, hooks/useKeyHunt.ts, api/comic-lookup, api/comics/[id]/refresh-value, lib/certLookup.ts, lib/certHelpers.ts, api/cert-lookup, lib/keyComicsDatabase.ts, lib/keyComicsDb.ts, lib/comicFacts.ts, lib/keyInfoHelpers.ts. Look for: uncached eBay/cert lookups burning rate limits, missing durable price cache, FMV threshold logic, duplicate key-comics sources, dead GoCollect/Marvel references.` },
  { key: 'area:collection', prompt: SHARED + `\n\nYOUR SCOPE: COLLECTION MANAGEMENT — app/collection/page.tsx, hooks/useCollection.ts, hooks/useSelection.ts, lib/bulkActions.ts, api/comics/* (route, [id], bulk-*, undo-delete, upload-cover), components/ComicDetailsForm.tsx, components/ComicDetailModal.tsx, components/CollectionStats.tsx, lib/statsCalculator.ts, components/CSVImport.tsx, lib/csvExport.ts, lib/csvHelpers.ts, lib/batchImport.ts, lib/coverImageDb.ts, lib/uploadCoverImage.ts, lib/uploadLimits.ts. Look for: over-fetching, client-side filtering of large lists, missing pagination/virtualization, expensive re-renders, oversized cover uploads (storage cost), giant components, optimistic-update correctness.` },
  { key: 'area:auctions', prompt: SHARED + `\n\nYOUR SCOPE: AUCTIONS & BIDDING — lib/auctionDb.ts (scrutinize hard), api/auctions/* (route, [id]/bid|bids|buy-now|mark-shipped|second-chance, by-comic), types/auction.ts, lib/snipingProtection.ts, api/cron/process-auctions, app/my-auctions/page.tsx, components/auction/*. Look for: N+1 queries, full-table scans, race conditions in bidding/buy-now (atomicity), cron efficiency, god-module decomposition, duplicated logic, missing indexes, money-handling correctness.` },
  { key: 'area:marketplace', prompt: SHARED + `\n\nYOUR SCOPE: MARKETPLACE / LISTINGS / SHOP / SALES / TRADES / OFFERS — app/shop, app/sales, app/trades, app/transactions, api/listings/[id]/purchase, api/checkout, api/comics/for-trade, lib/tradingDb.ts, lib/cloneSoldComic.ts, api/trades/*, api/offers/*, api/second-chance-offers/*, api/transactions, api/watchlist, app/watchlist, api/sharing. Look for: query inefficiency, duplicate listing/sale logic, trade-matching cost, missing pagination, status-transition correctness, redundant fetches.` },
  { key: 'area:payments', prompt: SHARED + `\n\nYOUR SCOPE: PAYMENTS / STRIPE / SUBSCRIPTIONS / BILLING / CONNECT — lib/stripeConnect.ts, lib/subscription.ts, api/billing/*, api/connect/*, api/webhooks/stripe, lib/choosePlanHelpers.ts, lib/promoTrial.ts, app/choose-plan, app/pricing, app/seller-onboarding, app/join/trial, SUBSCRIPTION_TIERS.md. Look for: webhook idempotency/signature/ordering, missing event handlers, subscription state correctness, trial logic, fee-calc consistency, security of money paths.` },
  { key: 'area:social', prompt: SHARED + `\n\nYOUR SCOPE: AUTH / USERS / PROFILES / REPUTATION / FOLLOW / SOCIAL — api/webhooks/clerk, api/username/*, app/profile, app/u/[slug], components/CustomProfilePage.tsx (scrutinize), lib/followDb.ts, api/follows/*, app/following, api/reputation/*, lib/creatorCreditsDb.ts, api/sellers/[id]/ratings, api/users/[userId]/block, api/users/blocked, lib/ageVerification.ts, api/age-verification, lib/usernameValidation.ts. Look for: god-component decomposition, N+1 in follow/reputation aggregation, count-decrement correctness, self-follow/self-block prevention, join column-name correctness, Clerk webhook robustness.` },
  { key: 'area:messaging', prompt: SHARED + `\n\nYOUR SCOPE: MESSAGING & NOTIFICATIONS — lib/messagingDb.ts, api/messages/* (route, [conversationId], read, report, unread-count, upload-image), app/messages, lib/contentFilter.ts, api/cron/moderate-messages, lib/notificationsCache.ts, api/notifications/*, components/notifications/NotificationsInbox.tsx, lib/notificationCursor.ts, lib/notificationLinks.ts, lib/notificationPreferences.ts, lib/alertBadgeHelpers.ts, app/notifications, app/settings/notifications, api/settings/notifications. Look for: polling vs realtime cost, unread-count query efficiency (hot path), notification cache correctness, moderation cost, cursor/pagination correctness.` },
  { key: 'area:email', prompt: SHARED + `\n\nYOUR SCOPE: EMAIL SYSTEM — lib/email.ts (scrutinize), lib/emailHelpers, lib/emailValidation.ts, api/email-capture (+verify), api/email-preview, api/test-email, api/waitlist, api/cron/send-feedback-reminders, api/cron/send-trial-reminders, api/feedback/*, EMAIL_TEST_CASES.md. Look for: god-file decomposition, Resend free-tier pressure, duplicate sends/missing dedup, missing batching, hardcoded copy, exposed test/preview routes in prod, template maintainability.` },
  { key: 'area:admin', prompt: SHARED + `\n\nYOUR SCOPE: ADMIN / MODERATION / USAGE & COST DASHBOARD — app/admin/* pages, api/admin/* routes, lib/adminAuth.ts, lib/auditLog.ts, lib/analyticsServer.ts, lib/scanAnalyticsHelpers.ts, api/admin/usage/* (route, check-alerts, alert-status), api/admin/health-check. Look for: admin authorization on EVERY admin route, usage/cost dashboard query efficiency, audit-log completeness, dead admin endpoints, expensive aggregations, fail-open cron auth.` },
  { key: 'area:infra-libs', prompt: SHARED + `\n\nYOUR SCOPE: CROSS-CUTTING INFRA LIBS — lib/supabase.ts, lib/db.ts, lib/cache.ts, lib/metadataCache.ts, lib/notificationsCache.ts, lib/offlineCache.ts, lib/rateLimit.ts, lib/concurrency.ts, lib/storage.ts, lib/imageOptimization.ts, lib/coverImageDb.ts, lib/coverHarvest.ts, lib/coverHeadCheck.ts, lib/coverImageUrlSanitizer.ts, lib/uploadCoverImage.ts, lib/haptics.ts, hooks/useOffline.ts, hooks/useDebounce.ts, lib/validation.ts. Look for: Supabase client instantiation patterns, cache TTL tuning (Upstash cost), rate-limit coverage gaps, pre-upload image optimization (storage cost), SSRF in cover fetching/harvesting, silent Supabase failure patterns.` },
  { key: 'area:frontend', prompt: SHARED + `\n\nYOUR SCOPE: FRONTEND SHELL / HOMEPAGE / NAV / PWA / STATIC — app/page.tsx, app/layout.tsx, components/Navigation.tsx, components/MobileNav.tsx, PWA manifest + service worker + offline, app/about, app/stats, legal pages, components/ShareCollectionModal.tsx, components/TitleAutocomplete.tsx. Look for: 'use client' overuse inflating client bundles, server-component opportunities, missing next/image, render-blocking, PWA caching strategy, hardcoded copy, duplicated nav logic, nav accessibility.` },
  { key: 'dim:performance', prompt: SHARED + `\n\nYOUR SCOPE (CROSS-CUTTING): PERFORMANCE & BUNDLE. ACTION: run \`npm run build\` (prints per-route First Load JS; do NOT run dev server). Investigate: large First Load JS routes, 'use client' on data-heavy pages, heavy deps in client bundles (lucide-react/date-fns/@zxing/html5-qrcode import style), missing dynamic import/lazy modals, missing memo on expensive lists, images not using next/image, sequential awaits that could be Promise.all. Set area to the affected feature when localizable, else cross-cutting.` },
  { key: 'dim:database', prompt: SHARED + `\n\nYOUR SCOPE (CROSS-CUTTING): DATABASE EFFICIENCY (perf AND cost). Grep src/lib + src/app/api for Supabase patterns: \`.select('*')\` over-fetch, N+1 (awaiting queries in .map/for), missing pagination (.range/.limit), repeated identical queries that should be cached, count queries on hot paths (unread-count, badges), queries implying a missing index, per-render client creation. Efficient queries reduce Supabase pressure — note in costImpact.` },
  { key: 'dim:cost', prompt: SHARED + `\n\nYOUR SCOPE (CROSS-CUTTING): RUNNING-COST REDUCTION — the owner's TOP interest. Hunt for ways to spend LESS: AI scan cost (downscale/compress before model; Gemini/Haiku where Sonnet is overkill; cache identical scans), Supabase storage (compress/resize/WebP covers; dedup; cleanup orphans), Upstash command volume (batch, raise TTL, disable analytics, avoid per-request churn), eBay calls (durable cache), Resend volume (batch/dedup), PostHog/Sentry event volume, redundant external calls. Quantify each saving. Mostly costDirection=saves; set area to the relevant feature.` },
  { key: 'dim:codequality', prompt: SHARED + `\n\nYOUR SCOPE (CROSS-CUTTING): CODE QUALITY / DEAD CODE / DUPLICATION / TECH-DEBT. ACTIONS: run \`npm run deadcode\` (knip), \`npm run circular\` (madge), \`npm run depcheck\`. Report concrete unused exports/files, circular deps, large files needing decomposition, duplicated logic, copy-pasted route scaffolding, TODO/FIXME debt (grep), inconsistent patterns. Tech-debt items wanted even if larger effort.` },
  { key: 'dim:security', prompt: SHARED + `\n\nYOUR SCOPE (CROSS-CUTTING): SECURITY. Audit: authorization on EVERY API route (Clerk auth + ownership; grep for routes missing auth()/userId checks), admin routes gated, IDOR, webhook signature verification, input validation (zod) coverage, SSRF in image/cover fetching + scraping proxy, rate-limit coverage on expensive/public endpoints, secret exposure (NEXT_PUBLIC_ misuse), content filtering, exposed test/preview/reset routes in prod, fail-open guards. Severity high for real holes; fixes are usually $0.` },
  { key: 'dim:correctness', prompt: SHARED + `\n\nYOUR SCOPE (CROSS-CUTTING): TYPE SAFETY & CORRECTNESS. Look for: \`any\`/\`as any\`/unsafe casts, unchecked Supabase results (known traps: \`.update()\` with no matching rows returns NO error; \`.or()\` with mixed column types crashes; join queries fail silently with wrong column names), unhandled rejections, missing await, swallowed errors (empty catch), nullable access without guards, race conditions, inconsistent error responses, floating-point money math.` },
  { key: 'dim:testing', prompt: SHARED + `\n\nYOUR SCOPE (CROSS-CUTTING): TESTING GAPS. ACTION: run \`npm test\`. Compare src/lib, src/types, src/hooks vs their __tests__ dirs to find untested business logic — ESPECIALLY money/limits/permissions/state-transitions (project mandate). Name specific untested files/functions. Flag brittle/over-mocked tests. costImpact almost always "$0".` },
  { key: 'dim:a11y-ux', prompt: SHARED + `\n\nYOUR SCOPE (CROSS-CUTTING): ACCESSIBILITY & UX POLISH. Audit for: missing alt text, missing aria-labels on icon-only buttons, contrast risks (bold pop-art palette), keyboard nav/focus traps in modals, missing loading/empty/error states, form validation feedback, tap-target sizing on mobile, motion without reduced-motion. Focus high-traffic surfaces. Most fixes $0.` },
  { key: 'dim:deps-build', prompt: SHARED + `\n\nYOUR SCOPE (CROSS-CUTTING): DEPENDENCIES & BUILD CONFIG. ACTIONS: run \`npm run audit\` + \`npm run depcheck\`. Investigate package.json: unused deps (confirm via grep, e.g. openai), redundant libs (@zxing/browser + @zxing/library + html5-qrcode), outdated/risky versions, heavy deps with lighter alternatives. Review config: next.config (Next 16/Turbopack, image config, middleware→proxy), tsconfig strictness, eslint, tailwind, jest, sentry deprecations.` },
  { key: 'dim:docs-core', prompt: SHARED + `\n\nYOUR SCOPE (CROSS-CUTTING): CORE TRACKING DOCS accuracy & drift. Audit README, ARCHITECTURE.md, docs/TECHNICAL_FEATURES.md, BACKLOG.md, EVALUATION.md, DEV_LOG.md (hygiene/size only), TEST_CASES.md, EMAIL_TEST_CASES.md, TESTING_RESULTS.md, COST_PROJECTIONS.md, SUBSCRIPTION_TIERS.md, COLOR_PALETTE.md, CLAUDE.md, tasks/lessons.md. Look for: stale facts contradicting code (discontinued APIs, outdated env vars/costs, AI-provider direction drift, features mis-marked), TEST_CASES gaps, completed BACKLOG items, internal contradictions. costImpact "$0".` },
  { key: 'dim:docs-plans', prompt: SHARED + `\n\nYOUR SCOPE (CROSS-CUTTING): PLANS / SPECS / FEATURE DOCS — docs/plans/*, docs/superpowers/plans/*, docs/engineering-specs/*, docs/features/*, docs/*.md briefs, FEEDBACK_*.md. Look for: completed plans to archive, specs drifted from shipped code, contradictory/superseded designs, references to discontinued services, organizational improvements. costImpact "$0"; recommend archival/consolidation where stale.` },
]

phase('Audit')
log('Phase 1: launching ' + FINDERS.length + ' parallel auditors')

const verified = await pipeline(
  FINDERS,
  (f) => agent(f.prompt, { label: f.key, phase: 'Audit', schema: FINDINGS_SCHEMA }),
  (res, f) => {
    if (!res || !res.findings || res.findings.length === 0) return { findings: [] }
    const verifyPrompt = SHARED + `\n\nYOU ARE THE ADVERSARIAL VERIFIER for auditor "${f.key}". Below are its raw findings as JSON. For EACH: independently CONFIRM against the real code (Read/Grep the cited evidence). DROP any that are false, not present, already handled, or unsupported by evidence. For survivors, CORRECT overstated severity, wrong cost direction/amount, or wrong autonomy ("yes" only if truly fully in-repo). Improve weak evidence with a real file:line. Return ONLY surviving, corrected findings. Default to dropping when uncertain.\n\nRAW FINDINGS:\n${JSON.stringify(res.findings, null, 2)}`
    return agent(verifyPrompt, { label: 'verify:' + f.key, phase: 'Verify', schema: FINDINGS_SCHEMA })
  }
)
const allConfirmed = verified.filter(Boolean).flatMap((r) => (r && r.findings ? r.findings : []))
log('Verified findings: ' + allConfirmed.length)

phase('Consolidate')
function groupBy(arr, key) {
  const m = {}
  for (const x of arr) { const k = (x && x[key]) || 'cross-cutting'; if (!m[k]) m[k] = []; m[k].push(x) }
  return m
}
const byArea = groupBy(allConfirmed, 'area')
const consolidated = await parallel(
  Object.keys(byArea).map((k) => () => {
    const cp = SHARED + `\n\nYOU ARE THE CONSOLIDATOR for area "${k}". Below are all confirmed findings for this area from multiple auditors. MERGE duplicates/near-duplicates into single best-stated findings (combine evidence, keep highest justified severity, keep most accurate cost/autonomy fields). Do NOT invent or drop unique findings. Return the clean, de-duplicated list.\n\nFINDINGS:\n${JSON.stringify(byArea[k], null, 2)}`
    return agent(cp, { label: 'consolidate:' + k, phase: 'Consolidate', schema: FINDINGS_SCHEMA })
  })
)
const finalFindings = consolidated.filter(Boolean).flatMap((r) => (r && r.findings ? r.findings : []))
log('Consolidated unique findings: ' + finalFindings.length)

phase('Report')
const writerPrompt = `You are the REPORT WRITER for an exhaustive optimization audit (scope: ${SCOPE}). Below is the full de-duplicated list of confirmed findings as JSON. WRITE a complete markdown report to exactly: "${DOC_PATH}" (use the Write tool).

REQUIRED STRUCTURE (exact order):
1. "# Comic Tracker — Full Codebase & Documentation Optimization Audit"
2. Header: Date ${DATE}; Scope: ${SCOPE}; Mode: Report-only (no code changed); Auditors: parallel agents, adversarially verified.
3. "## Executive Summary": totals, High/Medium/Low, autonomous yes/partial/no, est. total monthly savings (sum costDirection=saves; realistic range), est. additional cost if all paid ideas adopted, 3-4 sentence health narrative + biggest opportunities.
4. "## Top Opportunities" — TABLE of ~12 highest-value items: Ref | Title | Area | Severity | Cost Impact | Autonomous.
5. "## Remediation Effort & Impact Analysis" — compute over AUTONOMOUS = "yes" findings ONLY:
   - Note the scope (autonomous-Yes items; Partial/No excluded).
   - Effort breakdown table: Size | Count | What these are | Raw per-item — count S/M/L; S ~2-5min, M ~8-20min, L ~30-90min.
   - "### 1. Duration — All": RAW SEQUENTIAL hours = (countS*3.5 + countM*14 + countL*60)/60; REALISTIC parallelized = 40-60% of raw (state as a range); a "per-item feel" line (most 2-15 min); caveat that human review cadence is the real calendar bottleneck.
   - "### 2. Duration — By Priority": table Priority | Items | Mix (S/M/L) | Realistic active time | Notes. Bias High to the higher end (money/security testing), Low to the lower end (trivial, parallel).
   - "### 3. What to expect — as Company Executive": 5 business-outcome bullets (cost ceilings/margins, revenue protection & financial integrity, risk/security reduction, accurate projections, future velocity/compliance) grounded in the findings.
   - "### 4. What to expect — as Platform Admin": 5 operational bullets (trustworthy dashboards/telemetry, secured crons/quotas, audit-log accountability, fewer fire-drills, cleaner moderation/observability).
   - "### 5. What to expect — as End User": 5 experience bullets (speed, reliable money flows, accessibility, fewer bugs/crashes, privacy/security — "same features, friction removed").
   - "### 6. Elevator Pitch — Why we're doing this": one punchy blockquote paragraph; this is the pre-launch tune-up turning "it works" into "production-grade" for ~zero added spend; highest-ROI work; tailor to the findings.
6. "## Autonomous Remediation Worklist" — the autonomous="yes" findings as three tables (### 🔴 High / ### 🟡 Medium / ### 🟢 Low): Ref | Title | Area | Cost Impact | Effort. Include a count line.
7. "## Findings by Priority" — "### 🔴 High Priority", "### 🟡 Medium Priority", "### 🟢 Low Priority". Assign stable Refs (H-<AREA>n / M-... / L-...). Sort by area within each. Each finding rendered EXACTLY:

#### [Ref] Title
- **Area / Dimension:** area · dimension · effort S/M/L
- **1. Description:** ...
- **2. Issue identified:** ...
- **3. Recommended optimization:** ...
- **4. Cost analysis:** <costImpact> _(saved / additional / neutral)_
- **5. Can I handle autonomously:** Yes/Partial/No — <autonomousNote>
- **Evidence:** <evidence>

8. "## Findings by Area" — index of Refs per area.
9. "## Coverage Notes" — areas/dimensions reviewed, strong areas (few findings), caveats (DB-dependent items, cost estimate assumptions, anything downgraded).

Be faithful to the data — do not invent findings or change substance; you may tighten wording. After writing, RETURN the summary object (docWritten=true, docPath="${DOC_PATH}", topItems = the ~12 with Refs, effortTally e.g. "150 S / 70 M / 6 L", durationAllRealistic e.g. "~12-18 hrs").

FULL FINDINGS JSON:
${JSON.stringify(finalFindings, null, 2)}`

const summary = await agent(writerPrompt, { label: 'report-writer', phase: 'Report', schema: SUMMARY_SCHEMA })
return summary
