# Collectors Chest - System Architecture

> **Comprehensive map of pages, features, and service dependencies**

*Last Updated: Oct 22, 2026 — Session 52 (**Marketplace feature flag:** new `src/lib/features.ts` — `MARKETPLACE_ENABLED = false` hides buying, selling, auctions, offers, watchlist and seller onboarding; enforced in middleware (marketplace API prefixes → 404 JSON, marketplace pages → `/collection`, `/shop` → `/shop?tab=for-trade`), the `process-auctions` cron skips, and nav/copy/For Sale UI render conditionally. Collection, scan, Mark as Sold, `/sales`, For Trade, Trades and subscriptions are not gated. One-line re-enable. **Image host allowlist:** `src/lib/imageRemotePatterns.mjs` is the single source for `images.remotePatterns` (imported by `next.config.mjs`; Comic Vine + Marvel CDN added) and for `isOptimizableImageSrc()` (`src/lib/imageSrc.ts`, Next's own matcher), which sets `unoptimized` on cover/avatar `next/image` usages for unknown hosts so one bad URL can't crash a page. **Checkout:** destination charges now WITHOUT `on_behalf_of` (`buildMarketplacePaymentIntentData` in `stripeConnect.ts`) — the platform is merchant of record and pays Stripe's processing fee (verified in test mode). **Deps:** Next 16.4.2, sharp 0.35.5. `next.config.mjs` sets `agentRules: false` (no AGENTS.md generation).)*

*Earlier Session 51 (Oct 4, 2026): (**Gemini model swap:** `GEMINI_PRIMARY` in `src/lib/models.ts` moved `gemini-2.0-flash` (shut down 2026-06-01) → `gemini-3.5-flash-lite` (~$0.30 / $2.50 per M input/output tokens — higher than 2.0 Flash, so per-scan Gemini cost estimates below are now low). **New admin page** `/admin/pivot-brief` ("Pivot Brief" tab in `AdminNav`; strategy brief, admin-gated like `/admin/clz-comparison`). **Admin auth:** new `getAdminProfileByUserId(userId)` in `src/lib/adminAuth.ts` (`getAdminProfile()` now wraps it); middleware uses the `clerkMiddleware` callback's own `auth()` + `getAdminProfileByUserId` because the server `auth()` import crashes inside middleware. **Cover cleanup:** `cleanupOrphanedCover` (`db.ts`) only deletes a `comic-covers` file when no row in `COVER_REFERENCE_COLUMNS` (sales, comics, comic_metadata, cover_images, key_hunt_lists, admin_barcode_reviews) references the URL, via pure `decideCoverCleanup` (`skip`/`keep`/`delete`, fails safe to keep). **Marketplace fee copy:** `stripeConnect.ts` gained `STRIPE_PROCESSING_PERCENT`/`STRIPE_PROCESSING_FIXED_CENTS`, `estimateStripeProcessingFeeCents`, `estimateSellerTakeHomeCents`, `buildSellerFeeFaqAnswer` (feeds Pricing + Navigation FAQ); Terms §4.5 updated — who actually bears Stripe fees on destination charges is **UNVERIFIED** (Stripe docs suggest the platform pays) pending a test-mode check. **Trading:** comic value read as `estimated_value:price_data->estimatedValue` (there is no `comics.estimated_value` column) in `/api/trades/available`, `/api/comics/for-trade`, `tradingDb.ts`. **comic_metadata writes:** `saveComicMetadata` + `incrementComicLookupCount` now use the service-role client (RLS requires Supabase-authenticated; Clerk users aren't), so the shared cache actually fills. Session 50 + earlier context preserved below.)*

*Earlier Session 50 (Jul 25, 2026): (Dead-code removal + dependency-upgrade session. **Deleted unused exports** across lib/hooks/components — notable: `executeSlabDetection()` (aiProvider — slab flagging happens inside the main analysis pass since H-SC1; `executeSlabDetailExtraction()` remains), `markMatchTraded` (tradingDb), `requireAdmin` (adminAuth), `toggleListSharing` (db), messagingDb's `getUserConversations` / unread-count cache helpers (superseded by `getUserConversationsWithUnread` / `getUnreadMessageCount`), subscription's `canUserScan` / `incrementScanCount` / `endTrial` (superseded by `reserveScanSlot` / `releaseScanSlot` + the Stripe webhook), plus unused helpers in storage, the auction submodules, creatorCreditsDb, keyComicsDb, offlineCache, promoTrial, email/profiles, haptics, hooks (`useServiceWorker`, `useFeatureAccess`, `useScanLimits`, `deriveScanDisplay`) and components (`TrustBadgeCompact`, `useCanAccessFeature`, `RequiresTier`, `formatLocation`, `ComicListSkeleton`). **Deleted files:** unused barrels `src/lib/auction/index.ts` + `src/lib/email/index.ts` (the real facades are `src/lib/auctionDb.ts` / `src/lib/email.ts`). **New lib:** `src/lib/publicConfig.ts` — client-safe shared constants: `DEFAULT_SUPPORT_EMAIL` (support@collectors-chest.com; the server email layer overlays the `SUPPORT_EMAIL` env var) and `HCAPTCHA_SITE_KEY` (shared by `GuestCaptcha` + `hcaptcha.ts`). **Bug fixes:** offline-queue changed event unified — `offlineCache.ts` `OFFLINE_QUEUE_CHANGED_EVENT` is now `"cc:offline-queue-changed"` and `useOffline.ts` imports the constant (was a silent dispatch/listener name mismatch); seller-onboarding page support email now uses `DEFAULT_SUPPORT_EMAIL` (was hardcoded admin@collectors-chest.com). **Deps:** `next` 16.1.1→16.2.11, `sharp` 0.33.5→0.35.3 (npm override keeps Next's nested copy in sync), `@clerk/types` added (dev), `@eslint/eslintrc` removed; npm audit down from 13 vulnerabilities (7 high) to one accepted dev-only brace-expansion advisory. Session 49 was a docs-only cover-seeding source spike — no architecture changes. Session 48 + earlier context preserved below.)*

*Earlier Session 48 (Jun 14, 2026): Structural / audit-closeout session. **Lib decompositions:** `src/lib/auctionDb.ts` is now a re-export barrel over `src/lib/auction/*` (auctions, bids, offers, secondChance, watchlist, notifications, ratings, cron, transforms, columns, shared, index); `src/lib/email.ts` is a barrel over `src/lib/email/*` (constants, types, helpers, profiles, templates, send, index). Public import paths `@/lib/auctionDb` and `@/lib/email` unchanged. **New libs:** `src/lib/signedToken.ts` (HMAC-SHA256 sign/verify, falls back to `CLERK_SECRET_KEY`), `src/lib/guestScanToken.ts` (signed guest-scan cookie + Redis counters), `src/lib/unsubscribeToken.ts` (one-click email unsubscribe tokens), `src/lib/redis.ts` (shared Upstash client singleton); `src/lib/promoTrial.ts` gained server-side `mintPromoTrialToken()` / `verifyPromoTrialToken()`. **Component/page split-out:** `src/components/comicDetail/*` (ComicDetailsForm/ComicDetailModal sub-sections extracted; modal is now an accessible dialog), `src/components/profile/*` (CustomProfilePage tabs code-split via `next/dynamic`), `src/components/collection/CollectionToolbar+CollectionGrid`, `src/components/scan/ScanPanel`, `src/components/keyHunt/*`, `src/app/scan/BonusVerificationHandler`; new `src/hooks/useModalA11y.ts` applied across ~17 overlay modals (role=dialog/alertdialog, Escape, focus management); `admin/layout.tsx` is now a server component with an `AdminNav` client child. **New routes:** `/api/publishers/suggest`, `/api/unsubscribe`. **Middleware** now enforces `is_admin` on `/admin/*` *pages* (defense-in-depth with the admin layout's own server gate). **Payments:** marketplace checkout uses Stripe DESTINATION CHARGES (`on_behalf_of` + `application_fee_amount` + `transfer_data.destination`); webhook idempotency via Redis (`stripe_event_*`, 3-day TTL), with a `processed_stripe_sessions` table + `credit_scan_pack` RPC for one-time scan-pack credits. **Scanning:** Gemini is the PRIMARY vision provider (Anthropic fallback); guest scans are server-enforced via a signed cookie + Redis count; key-comics lookup is DB-primary (`key_comics`) with the static curated file as fallback; text-only lookups use Haiku (`MODEL_LIGHTWEIGHT`), not Sonnet. **DB (migration `20260614_audit_closeout.sql`, applied):** see Database Tables / migrations sections. **Deps:** `@clerk/nextjs` 6.39.5, `@anthropic-ai/sdk` 0.104; removed `openai` / `@zxing/*` / `html5-qrcode`; added `dotenv` (dev). **New env vars:** `GUEST_SCAN_SECRET`, `PROMO_TRIAL_SECRET`, `UNSUBSCRIBE_SECRET` (all fall back to `CLERK_SECRET_KEY`), `SUPPORT_EMAIL`. Session 47 + earlier context preserved below.)*

*Earlier Session 47 (May 27, 2026): No new architecture; validation + collection-UI hardening. Session 46's scan-cover persistence pipeline — `POST /api/comics/upload-cover` + `comic-covers` Storage bucket + `src/lib/uploadCoverImage.ts` — was confirmed end-to-end in production for the first time on both iPhone and Android. Five collection-UI fixes followed: detail-modal cover sizing (`w-20 aspect-[2/3]` replacing the undefined `h-30`), "Add Book" `whitespace-nowrap`, grid thumbnail sizing via `absolute inset-0 object-cover`, multi-select header reflow (`SelectionHeader.tsx`), and the multi-select action bar raised above the floating nav via a `cc:selection-mode` window event (`MobileNav.tsx` ↔ `collection/page.tsx` ↔ `SelectionToolbar.tsx`). Two iOS-Safari follow-ups: `ComicCard.tsx` now fades grid covers in on `onLoad` (with a `ref.complete`/`naturalWidth` cached-image guard) to force a repaint, and `tailwind.config.ts` enables `future.hoverOnlyWhenSupported` so `hover:`/`group-hover:` styles no longer steal the first tap on touch devices (single-tap checkbox app-wide). Grid thumbnails kept as plain `<img>` (not `next/image`) deliberately to avoid routing every thumbnail through Netlify's Image CDN. Session 46 + earlier context preserved below.)*

*Earlier Session 46 (May 9, 2026): Two scan-pipeline fixes: (1) Scan-cover persistence — new `POST /api/comics/upload-cover` route + `comic-covers` Supabase Storage bucket + `src/lib/uploadCoverImage.ts` client helper; signed-in `/scan` `handleSave()` now uploads data URI to Storage before DB write so the `cover_image_url` sanitizer at `db.ts:720` no longer drops the user's photo. (2) 3-tier variant name resolver — new `src/lib/variantResolver.ts` (`resolveVariant()` + `lookupApprovedVariantName` + `enrichVariantNameFromAI` Claude Haiku); `barcode_catalog` gained `variant_name`/`variant_name_source`/`variant_name_status` columns (admin-approval-required); `/api/analyze` calls resolver after barcode parse; `ComicDetails.variantSource` surfaces "🔍 Detected from..." hint in `ComicDetailsForm`. **Known production gap:** AI extracts only the 12-digit UPC, not the 5-digit add-on supplement, so the resolver currently lacks the variant-discriminating data it needs — tracked in BACKLOG as "Variant Detection — Two-Pass High-Res Barcode OCR (Option C3)". Session 45b + earlier context preserved below.)*

*Earlier Session 45b (May 6, 2026): Removed orphan `/api/quick-lookup` route + Comic Vine integration entirely; `KeyHuntHistoryEntry` localStorage shape gained `keyInfo` + `keyInfoMeta` fields so curated-DB key data persists across sessions; `/api/con-mode-lookup` no-data branch now calls AI for keyInfo on curated-DB miss, making both eBay-found and no-data paths symmetrical; PWA `manifest.json` "Quick Lookup" shortcut and `sw.js` precache entry removed; cover-image preservation product rule documented — user-uploaded `comics.cover_image_url` is mutated only via the manual edit flow.*

*Earlier Session 44 (May 5, 2026): Second Chance "Offer to Runner-up" RLS-anon-read bug closed in `getAuctionSecondChanceState`; Key Hunt key-issue chips wired UI-side + curated DB lookup integrated into `/api/con-mode-lookup` at all 3 result paths; new reusable `CoverLightbox` component for full-screen cover verification on Key Hunt; admin-only `/admin/clz-comparison` tablet "slide" page for convention-floor competitive talking points; `keyComicsDatabase.ts` curated DB expanded 404 → 1,130 entries (+726 net-new across 3 rounds, years normalized to series-start convention); Clerk dashboard username rules tightened (length 4-20, extended chars disabled — residual gap mitigated by webhook sanitizer); `docs/CLZ_COMPARISON_BRIEF.md` partner sales brief with verified pricing + feature comparison + data-partnership talking points authored. Session 43 + earlier context preserved below.*

*Earlier sessions: Apr 28, 2026 (deployed May 1) — Sessions 38 + 39 + 40 + 42d + 43 (Payment deadline enforcement, Second Chance Offers, Payment-Miss Strike System, Auction Audit Log, Zod validation across 82 routes, Email Notification Preferences, hCaptcha guest-scan protection, Cover crop validator, Clerk ↔ Supabase username sync-on-write, Metron + Hottest Books removed, seller onboarding help page, 10MB upload cap; Session 40: manual FMV refresh endpoint for owned comics, feedback rating-request moved from payment to ship, `/api/checkout` image URL guard against Supabase signed URLs + base64 data URIs, partial pricing-gate on `/sales` page (Cost + Profit columns + summary cards behind `fullStats`), outbid email now surfaces recipient's max bid, Active Bids tab column-name fix, site-wide em dash removal, mobile auction/buy-now modal image caps, Ask the Professor FAQ scroll-lock; Sessions 42d + 43: notifications + trade_matches IDOR closures with cross-cutting service-role write-scoping pattern)*

---

## Service Legend

| Icon | Service | Purpose |
|------|---------|---------|
| 🔐 | **Clerk** | Authentication |
| 🗄️ | **Supabase** | Database (PostgreSQL) |
| 🤖² | **Google/Gemini** | AI analysis (primary — Gemini 3.5 Flash-Lite, Session 51) |
| 🤖 | **Anthropic/Claude** | AI analysis (fallback — Claude Sonnet 4.5) |
| 💰 | **Stripe** | Payments |
| 📧 | **Resend** | Email |
| 🔴 | **Upstash Redis** | Cache/Rate limiting |
| 📊 | **PostHog** | Analytics |
| 🐛 | **Sentry** | Error tracking |
| 🏷️ | **eBay API** | Pricing data |
| 💾 | **localStorage** | Client storage |

---

## Pages & Features

### Home Page (`/`)

| Feature | Services | Notes |
|---------|----------|-------|
| Collection Overview | 💾 🗄️ | Value, count, profit/loss stats |
| Market Insights | 💾 | Biggest gains, best ROI, declines |
| Guest CTA | 🔐 | "Scan Your First Book" for non-auth |

---

### Scan Page (`/scan`)

| Feature | Services | Notes |
|---------|----------|-------|
| AI Cover Recognition | 🤖 🤖² 🔴 | Multi-provider: Gemini primary, Anthropic fallback |
| Barcode Scanning | 🤖 🗄️ | Barcode catalog lookup, AI fallback |
| Variant Name Resolver | 🗄️ 🤖 | 3-tier resolution after barcode parse: (1) `barcode_catalog` lookup by `(upc_prefix, addon_issue, addon_variant)` for admin-approved variant names, (2) focused Claude Haiku enrichment seeded with deterministically-derived cover letter (e.g., "Cover G"), (3) deterministic addon-derived fallback. Barcode trumps AI cover-derived hint when present. Catalog writes default to `variant_name_status='pending'` (admin moderation required). See `src/lib/variantResolver.ts`. (Session 46) |
| Cover Image Persistence | 🗄️ 🔐 | Signed-in users: `handleSave()` calls `uploadCoverImage()` → `POST /api/comics/upload-cover` → `comic-covers` Supabase Storage bucket → public URL written to `comics.cover_image_url` (works around `db.ts:720` data-URI sanitizer). Guests: keep base64 data URI in localStorage as before. (Session 46) |
| Price Estimation | 🏷️ 🗄️ 🔴 | eBay API → Supabase cache → Redis |
| Fallback Status | — | "Taking longer than usual" message when fallback triggers |
| CGC/CBCS Cert Lookup | Web scrape | Verifies graded comic certification |
| Cert-First Scan Pipeline | 🤖 🤖² 🗄️ 🔴 🏷️ | Slab detection → slab detail extraction → cert lookup → eBay pricing (Phases 1-5.5) |
| Slab Label Color Detection | 🤖 | AI detects CGC/CBCS label color (blue, yellow, green, etc.) from slab photo |
| Cover Validation | 🤖² 🗄️ | Gemini-powered cover image validation pipeline |
| Cover Harvest | 🤖 🗄️ | Auto-harvest cover image from scan result; crop, store in Supabase Storage (`cover-images` bucket), insert into `cover_images` with variant support |
| Key Info Lookup | 🗄️ | DB-primary: `key_comics` Supabase table first, curated static `keyComicsDatabase.ts` (1,132 entries) as fallback (`src/lib/keyComicsDb.ts`, Session 48) |
| Suggest Key Info | 🗄️ 🔐 | Community submissions for key facts |
| Scan Limits | 💾 🗄️ 🔴 | Guest 5, Free 10/mo, Pro unlimited. **(Session 48)** Guest count is now **server-enforced** via a signed `cc_guest` cookie + Redis counter (`src/lib/guestScanToken.ts`); `/api/analyze` checks the server-stored count, not a client-supplied header |
| hCaptcha Guest Gate | 🔐 | Guest scans 4 & 5 require invisible hCaptcha verification; floating badge; 5s siteverify timeout; dev/prod key swap (see `src/lib/hcaptcha.ts`, `src/components/GuestCaptcha.tsx`). Gate fires against the server-trusted scan count (Session 48) |
| Image Upload Cap | — | Shared 10MB cap via `src/lib/uploadLimits.ts` (`MAX_IMAGE_UPLOAD_BYTES`, `assertImageSize()`, `base64DecodedByteLength()`); HTTP 413 on oversize |
| Cover Crop Validator | — | Rejects AI crops outside comic-book aspect range (0.55-0.85 w/h) before harvest pollutes cover cache (`src/lib/coverCropValidator.ts`) |
| Email Capture | 📧 | 5 bonus scans for email signup |
| CSV Import | 🤖 🗄️ | Bulk import with dedup + parallel batch lookups (batches of 5) |
| Image Optimization | — | Client-side compression to 400KB |

---

### Collection Page (`/collection`)

| Feature | Services | Notes |
|---------|----------|-------|
| Comic Storage | 💾 🗄️ | localStorage for guests, Supabase for auth |
| Custom Lists | 💾 🗄️ | Want List, For Sale, Slabbed, etc. |
| Search & Filter | 💾 | By publisher, title, starred |
| View Variants | 💾 | Groups same title/issue variants |
| Mark as Sold | 💾 🗄️ | Tracks profit/loss |
| CSV Export | 💾 | Client-side download |
| Share Collection | 🗄️ 🔐 | Public profile generation |

---

### Sales Page (`/sales`)

| Feature | Services | Notes |
|---------|----------|-------|
| Sold Comics List | 💾 🗄️ | View all comics marked as sold — always visible to all tiers |
| Profit/Loss Tracking | 💾 🗄️ | Purchase price vs sale price — **partial gate**: the sales list + row detail are always visible, but **Cost + Profit columns** and the **3 summary cards** are gated on `features.fullStats` with blur + overlay upgrade CTA. Data persistence is unchanged — `sales` table writes `purchase_price`, `sale_price`, `profit` for every user regardless of tier, so historical stats light up the moment a user upgrades (Session 40e). |

---

### Following Page (`/following`)

| Feature | Services | Notes |
|---------|----------|-------|
| Following Feed | 🗄️ 🔐 | View collections of users you follow |
| Follow Management | 🗄️ 🔐 | Follow/unfollow users |

---

### Key Hunt (`/key-hunt`)

| Feature | Services | Notes |
|---------|----------|-------|
| Quick Price Lookup | 🏷️ 🤖 🗄️ | Optimized for convention use |
| Grade Selector | — | 25 CGC grades for raw books |
| Offline Mode | 💾 | Cached lookups, sync queue |
| Barcode Cache | 💾 | 7-day TTL, max 20 entries |
| Quick-Add Buttons | 💾 | Want List, Collection, Passed On |
| My Hunt List | 🗄️ 🔐 | Wishlist of comics user wants to find |
| Add to Hunt List | 🗄️ 🔐 | From scan results or cover scan |
| **Key Issue Chips (Session 44)** | 🗄️ 🤖 | Yellow KEY ISSUE tags rendered between grade and price; pulled from curated `keyComicsDatabase.ts` (1,132 entries) first, AI fallback for non-curated. Wins over stale `comic_metadata.key_info: []` rows. |
| **Cover Lightbox (Session 44)** | 💾 | Tap thumbnail → full-screen `CoverLightbox` for variant verification; iPhone safe-area aware; Escape/backdrop tap to close. Reusable component. |
| **History Persistence (Session 45b)** | 💾 | localStorage `KeyHuntHistoryEntry` shape gained `keyInfo?: string[]` and `keyInfoMeta?: { matchType: "exact" \| "year-resolved"; matchedYear: number \| null; totalCandidates: number }` so curated-DB key data + match provenance survive across sessions and don't have to re-query AI on history view. |

---

### Shop (`/shop`)

| Feature | Services | Notes |
|---------|----------|-------|
| Auction Listings | 🗄️ | eBay-style proxy bidding |
| Fixed-Price Listings | 🗄️ | Buy Now with offer support |
| For Trade Tab | 🗄️ | Browse comics marked for trade by other users |
| Search & Sort | 🗄️ | By price, ending time, bids |
| Watchlist | 🗄️ 🔐 | Track interesting auctions |

**Marketplace hidden (Session 52):** while `MARKETPLACE_ENABLED` is `false` (`src/lib/features.ts`), the nav shows **Trade** instead of Shop, `/shop` redirects to `/shop?tab=for-trade`, and the page renders only the For Trade view (heading "TRADE", no tab bar). Auction / Fixed-Price / Watchlist rows above are dormant until the flag is flipped.

**For Trade Tab:**
- Shows "X users want this" badge based on Hunt List demand
- Click to view details and initiate trade conversation

---

### Trades Page (`/trades`)

Manage comic trades with three tabs:
- **Matches** - Hunt List matches (comics you want that others have for trade, and vice versa)
- **Active** - Trades in progress (proposed, accepted, shipping)
- **History** - Completed, cancelled, and declined trades

| Feature | Services | Notes |
|---------|----------|-------|
| Trade Matches | 🗄️ 🔐 | Mutual matches from Hunt List + For Trade |
| Active Trades | 🗄️ 🔐 | Status tracking: proposed → accepted → shipped → completed |
| Trade History | 🗄️ 🔐 | Completed, cancelled, declined trades |
| Trade Proposals | 🗄️ 🔐 | Create multi-comic trade proposals |
| Shipping Tracking | 🗄️ | Carrier and tracking number for both parties |

**Key Components:**
- `TradeMatchCard` - Grouped matches by your comic
- `TradeCard` - Trade details with status-based actions
- `TradeProposalModal` - Create multi-comic trade proposals

---

### Auction System (`/shop`, `/my-auctions`, `/watchlist`)

| Feature | Services | Notes |
|---------|----------|-------|
| Create Auction | 🗄️ 🔐 | From collection comics; ListInShopModal gates on Stripe Connect status |
| Place Bid | 🗄️ 🔐 🔴 | Rate limited, proxy bidding; flat $1 increment across all price tiers |
| Buy It Now | 🗄️ 💰 | Instant purchase option via PaymentButton in ListingDetailModal |
| Auction Payment | 💰 🗄️ | PaymentButton in AuctionDetailModal for winning bidders |
| Payment Processing | 💰 🗄️ | Stripe Connect checkout with destination charges (fee split to seller) |
| Seller Ratings | 🗄️ 🔐 | Positive/negative reviews (part of Creator Credits system) |
| Notifications | 🗄️ | Outbid, won, sold alerts |
| Auction End Processing | 🗄️ | Cron job marks completed; idempotent via conditional `UPDATE ... WHERE status='active'` + row-count check (no duplicate win/sold notifications on repeat cron runs) |

---

### Offers System (`/shop`)

| Feature | Services | Notes |
|---------|----------|-------|
| Make Offer | 🗄️ 🔐 | Below asking price |
| Counter Offer | 🗄️ 🔐 📧 | Seller negotiation |
| Accept/Reject | 🗄️ 💰 | Triggers payment flow |
| Offer Expiration | 🗄️ | 48-hour auto-expire (cron) |

---

### Messages (`/messages`)

| Feature | Services | Notes |
|---------|----------|-------|
| Conversation List | 🗄️ 🔐 | Preview with last message, unread count |
| Message Thread | 🗄️ 🔐 | Real-time via Supabase Broadcast (bypasses RLS) |
| Send Messages | 🗄️ 🔐 | Text content up to 2000 chars |
| Image Attachments | 🗄️ 🔐 | Up to 4 images per message (Supabase Storage) |
| Embedded Listings | 🗄️ | Share listing cards in messages |
| Block User | 🗄️ 🔐 | Prevents messaging from blocked users |
| Report Message | 🗄️ 🔐 | Flags for admin review |
| Content Filtering | 🤖 | Blocks phone/email, flags payment mentions |
| Unread Badge | 🗄️ | Real-time updates via Supabase Broadcast |
| Email Notifications | 📧 🗄️ | Configurable per-user preference |

---

### Notifications Inbox (`/notifications`)

Full-page inbox added Apr 27, 2026 (Session 42d). Bell-dropdown preview kept; this page is the deep-read surface. Mobile-first.

| Feature | Services | Notes |
|---------|----------|-------|
| Cursor pagination (infinite scroll) | 🗄️ 🔐 | Composite cursor `(created_at, id)` ordered DESC. PostgREST `.or("created_at.lt.X,and(created_at.eq.X,id.lt.Y)")` predicate handles batch-insert ties. Page size default 50, capped at 100 server-side. |
| Tap-to-navigate | 🔐 | Reuses `getNotificationDeepLink()` from the bell — `/shop?listing=<id>` for auction-targeted, `/notifications?focus=<id>` fallback for system-only. Single source of truth for bell + inbox + email + Capacitor push (when iOS native ships). |
| Per-row dismiss (X) | 🗄️ 🔐 | Hidden for `NON_DELETABLE_NOTIFICATION_TYPES` (`payment_missed_*`, `auction_payment_expired*`). Optimistic remove + toast rollback on network failure. 44×44pt tap target. |
| Mark all as read | 🗄️ 🔐 | `asOf` clamp prevents silently sweeping notifications inserted between click and request. Conditional render — hidden when `unreadCount === 0`. |
| `?focus=<id>` deep-link | 🗄️ 🔐 | Scrolls row into view + flash-highlights for 1.5s. If row isn't in current page, GETs `/api/notifications/:id`; on 404 toasts and `router.replace`s to clear the param so a remount doesn't re-fire. |
| Offline cache | — | localStorage (profile-namespaced via Clerk user.id, version-tagged via `CACHE_VERSION` const). On fetch failure hydrates from cache + shows banner; distinguishes offline-empty from true-empty. Cleared on Clerk sign-out. |
| Auto-prune | 🗄️ | Cron pass deletes `read_at < NOW() - 30d` AND unread `created_at < NOW() - 90d`. |
| Capacitor-readiness | — | Pull-to-refresh deferred to `@capacitor/pull-to-refresh` post-launch; v1 uses "Last updated Xm ago — tap to refresh" pill instead. |

### Settings (`/settings/notifications`, `/settings/preferences`)

| Feature | Services | Notes |
|---------|----------|-------|
| Push Notifications Toggle | 🗄️ 🔐 | Enable/disable browser push |
| Email Notification Preferences | 🗄️ 🔐 | Per-category toggles: **Transactional** (locked always-on), **Marketplace**, **Social**, **Marketing**. `NOTIFICATION_CATEGORY_MAP` covers all 27 notification email types. Gates `sendNotificationEmail` + `sendNotificationEmailsBatch` with skipped-count reporting (`src/lib/notificationPreferences.ts`, `src/types/notificationPreferences.ts`) |
| Display Preferences | 🗄️ 🔐 | Show/hide financial data (show_financials toggle) |
| Auto-save | — | Changes saved immediately on toggle |

---

### Seller Onboarding Help (`/seller-onboarding`)

Static, Lichtenstein-style help page walking new sellers through the 9-step Link-aware Stripe Connect onboarding flow. Uses `ScreenshotPlaceholder` auto-swap, troubleshooting as native `<details>`, and links out to support email. Server-rendered; mobile-first at 375px. Complements the FAQ entry in `Navigation.tsx`.

---

### Stats (`/stats`)

| Feature | Services | Notes |
|---------|----------|-------|
| Collection Statistics | 💾 🗄️ | Total value, profit/loss |
| Value Trends | 💾 | Based on stored purchase prices |
| Refresh Stats | 💾 | Recalculates from collection |

---

### Public Profile (`/u/[slug]`)

| Feature | Services | Notes |
|---------|----------|-------|
| Shared Collection View | 🗄️ | Read-only public access |
| Profile Info | 🗄️ 🔐 | Display name, bio |
| Custom URL Slug | 🗄️ | e.g., collectors-chest.com/u/batman |

---

### Authentication (`/sign-in`, `/sign-up`, `/profile`)

| Feature | Services | Notes |
|---------|----------|-------|
| Sign In | 🔐 | Google + Apple social login |
| Sign Up (Waitlist) | 🔐 📧 | Currently captures email only |
| Profile Sync (Clerk → Supabase) | 🔐 🗄️ | Clerk `user.created` webhook upserts `profiles` row with email at account creation (replaces lazy `getOrCreateProfile`); `user.updated` webhook syncs email changes |
| Custom Profile Page | 🗄️ 🔐 | Replaced Clerk's UserProfile |
| Username System | 🗄️ 🔐 | Customizable display name with validation |
| Display Preferences | 🗄️ | Username vs real name preference |
| Data Migration | 💾 🗄️ | Import localStorage on signup |

---

### About Page (`/about`)

| Feature | Services | Notes |
|---------|----------|-------|
| About Page | — | Static informational page about the platform |

---

### Legal Pages (`/privacy`, `/terms`, `/cookies`, `/acceptable-use`)

| Feature | Services | Notes |
|---------|----------|-------|
| Privacy Policy | — | CCPA compliance, data practices |
| Terms of Service | — | Marketplace terms, liability |
| Cookie Policy | — | Cookie usage disclosure |
| Acceptable Use Policy | — | Marketplace conduct rules |
| Footer Links | — | Available from homepage footer |

**Status:** Page structure complete. Content pending LLC formation for official business name.

---

### Pricing Page (`/pricing`)

| Feature | Services | Notes |
|---------|----------|-------|
| Tier Comparison | — | Free vs Pro feature matrix |
| Upgrade Flow | 💰 🔐 | Stripe checkout integration |
| Current Plan Display | 🗄️ 🔐 | Shows user's subscription status |

---

### Choose Plan (`/choose-plan`)

| Feature | Services | Notes |
|---------|----------|-------|
| Plan Selection | 💰 🔐 | Monthly ($4.99/mo) or Annual ($49.99/yr) |
| Start Free Trial | 🗄️ 🔐 | 7-day free trial activation |
| Scan Pack Purchase | 💰 🔐 | $1.99 for 10 additional scans |
| Current Subscription Status | 🗄️ 🔐 | Shows active plan, trial status, scan usage |
| Promo Auto-Checkout | 💰 💾 | Detects `promoTrial` localStorage flag on mount, auto-initiates Stripe checkout with 30-day trial on monthly plan |

**Promo trial notes:**
- On mount, useEffect checks for valid `promoTrial` flag in localStorage; if present and user has no active subscription, auto-redirects to checkout
- Guards against infinite loop when returning from cancelled Stripe session (`billing=cancelled` query param suppresses re-trigger)
- Shows dedicated loading and error states during promo checkout initiation

---

### Promo Trial Landing (`/join/trial`)

Server-rendered landing page for convention QR code sign-ups. Three files:

| File | Type | Purpose |
|------|------|---------|
| `src/app/join/trial/page.tsx` | Server component | Renders the landing page |
| `src/app/join/trial/PromoTrialActivator.tsx` | Client component | Sets `promoTrial` flag in localStorage; redirects signed-in users directly to `/choose-plan` |
| `src/app/join/trial/PromoTrialCTA.tsx` | Client component | CTA button with loading state that triggers sign-up flow |

**Promo trial user flow:**
```
QR Code (convention) → /join/trial
  → PromoTrialActivator sets localStorage flag (7-day expiry)
  → Signed-in user? → /choose-plan (auto-checkout triggers)
  → Guest? → /sign-up (Clerk) → /choose-plan (auto-checkout triggers)
    → Stripe checkout (30-day trial, monthly plan)
    → /collection?welcome=promo
```

---

### Admin Pages

**Admin Users:**
- Chris Patton: `user_37wpeblFFxJ7XBc6vtJqOcAjLmg`
- Aponte (Gmail): `user_38FjGVWN3L55MTzoMAwW0SCZkoR`

Admin access is controlled via the `is_admin` field in the `profiles` table.

#### User Management (`/admin/users`)

| Feature | Services | Notes |
|---------|----------|-------|
| Search Users | 🗄️ | Search by email |
| View Profile | 🗄️ | Full user details, scans, comics |
| Reset Trial | 🗄️ | Clear trial dates, allow re-trial |
| Grant Premium | 🗄️ | Give free premium days |
| Suspend/Unsuspend | 🗄️ | Block user from actions |
| Audit Logging | 🗄️ | All admin actions logged |

#### Usage Dashboard (`/admin/usage`)

| Feature | Services | Notes |
|---------|----------|-------|
| Usage Dashboard | 🗄️ 🔴 🤖 | Monitor service consumption |
| Supabase Metrics | 🗄️ | Database size, row counts |
| Upstash Metrics | 🔴 | Commands used, storage |
| Anthropic Metrics | 🤖 | Token usage, costs |
| Alert History | 🗄️ | Past limit warnings |

#### Key Info Moderation (`/admin/key-info`)

| Feature | Services | Notes |
|---------|----------|-------|
| Submission Queue | 🗄️ | Pending community submissions |
| Approve/Reject | 🗄️ | Moderation actions |
| Edit Before Approve | 🗄️ | Modify submitted key info |

#### Message Moderation (`/admin/moderation`)

| Feature | Services | Notes |
|---------|----------|-------|
| Stats Dashboard | 🗄️ | Pending, reviewed, actioned counts |
| Report Queue | 🗄️ | Sortable by status, clickable filters |
| Dismiss Report | 🗄️ | Mark as non-actionable |
| Warn User | 🗄️ | Take action, update status |
| Admin Notes | 🗄️ | Document moderation decisions |
| AI Auto-Moderation | 🤖 🗄️ | Nightly cron analyzes flagged messages |
| Priority Scoring | 🤖 | 1-10 scoring, suggested actions |

#### Barcode Reviews (`/admin/barcode-reviews`)

| Feature | Services | Notes |
|---------|----------|-------|
| Review Queue | 🗄️ | Pending barcode catalog submissions |
| Approve/Reject | 🗄️ | Moderate community-submitted barcodes |

#### Cover Queue (`/admin/cover-queue`)

| Feature | Services | Notes |
|---------|----------|-------|
| Cover Image Queue | 🗄️ | Pending cover image submissions |
| Approve/Reject | 🗄️ | Moderate community-submitted cover images |

#### CLZ Comparison Slide (`/admin/clz-comparison`) — Session 44

| Feature | Services | Notes |
|---------|----------|-------|
| Tablet "slide" page | — | Convention-floor competitive talking points designed for partner to pull up on tablet during customer conversations |
| 30-second pitch hero | — | Pop-art framed pitch quote |
| Pricing apples-to-apples cards | — | Side-by-side CLZ ($10.94 catalog+pricing) vs CC ($4.99 all-in) |
| 5 talking points | — | Color-coded cards with floor-pitch delivery cues + pitfall warnings (specifically the cost-reframe trap) |
| Where CC Wins / Where CLZ Wins / Both Have | — | Verdict tables |
| Data partnerships section | — | CovrPrice queued as a beta tester (no public API today; targeting 2027 roadmap — NOT active conversations), GoCollect API discontinued context, resilience pitch quote, safe-to-say / don't-say guardrails |
| Common objections | — | Expandable Q&A cards |
| Pocket cheat sheet | — | Printable comic-style card |
| Source: `docs/CLZ_COMPARISON_BRIEF.md` | — | Brief is the markdown source of truth; admin page is the rendered version |

#### Pivot Brief (`/admin/pivot-brief`) — Session 51

| Feature | Services | Notes |
|---------|----------|-------|
| Internal strategy brief | — | Static server page (`src/app/admin/pivot-brief/page.tsx`), "Pivot Brief" tab in `AdminNav`. Sections: where we are today, the pricing-data problem, the pivot (convention companion), why hold the marketplace back, launch plan, willingness-to-pay test, risks |
| Admin gate | 🗄️ 🔐 | Page calls `getAdminProfile()` and redirects non-admins, same pattern as `/admin/clz-comparison` (plus middleware + admin layout gates) |

#### Flagged Users (Session 39)

Admin endpoint `GET /api/admin/flagged-users` returns users with 2+ missed payments in a 90-day window (`bid_restricted_at IS NOT NULL`). UI surface pending — endpoint is currently consumed by admin notifications only.


**Note:** Admin pages are protected by database `is_admin` check.

---

## Middleware (`src/middleware.ts`)

Clerk middleware protects specific routes requiring authentication. **Admin pages get a second layer (Session 48):** beyond the Clerk `auth.protect()` gate, `/admin/*` *page* routes look up the admin profile (Supabase `profiles.is_admin` check via `src/lib/adminAuth.ts`) and redirect non-admins to `/`. **Session 51:** middleware must use the `clerkMiddleware` callback's own `auth()` to get `userId` and then call `getAdminProfileByUserId(userId)` — calling `getAdminProfile()` (which uses the request-scoped server `auth()` import) throws inside middleware. `getAdminProfile()` is still the helper for server components, route handlers and server actions. This is defense-in-depth alongside the admin layout's own server-side gate — a non-admin signed-in user can no longer reach an admin page shell.

| Protected Route Pattern | Notes |
|------------------------|-------|
| `/admin(.*)` | All admin pages — Clerk auth **+ `is_admin` page-route gate (redirect to `/` on miss, Session 48)** |
| `/api/admin(.*)` | All admin API routes |
| `/api/billing(.*)` | All billing API routes |
| `/api/watchlist(.*)` | Watchlist management |
| `/api/notifications(.*)` | Notification management |
| `/notifications(.*)` | Inbox page (signed-in only; redirects guests to `/sign-in`) |
| `/api/sharing(.*)` | Collection sharing |
| `/api/key-hunt(.*)` | Hunt list management |
| `/api/auctions/:id/bid(.*)` | Placing bids |
| `/api/auctions/:id/buy-now(.*)` | Buy Now purchases |
| `/api/auctions/:id/mark-shipped(.*)` | Seller ship confirmation |
| `/api/auctions/:id/second-chance(.*)` | Seller-initiated Second Chance Offer |
| `/api/second-chance-offers(.*)` | Runner-up accept/decline actions |
| `/api/transactions(.*)` | Buyer transaction tabs |

All other routes are public (unauthenticated access allowed). Individual API routes may perform their own auth checks internally.

**Marketplace feature flag (Session 52):** when `MARKETPLACE_ENABLED` (`src/lib/features.ts`) is `false`, middleware runs before the auth gates and (a) answers `MARKETPLACE_API_PREFIXES` (`/api/auctions`, `/api/listings`, `/api/offers`, `/api/second-chance-offers`, `/api/checkout`, `/api/connect`, `/api/watchlist`) with `404 {"error":"Not found"}`, (b) redirects `MARKETPLACE_PAGE_PREFIXES` (`/my-auctions`, `/transactions`, `/watchlist`, `/seller-onboarding`) to `/collection`, and (c) redirects `/shop` without `tab=for-trade` to the For Trade tab. Matching is segment-aware, so `/api/transactions` (used by the kept `/sales` page) is not blocked. The `process-auctions` cron returns early under the same flag.

---

## API Routes

### AI & Recognition

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/analyze` | POST | Cover image analysis (multi-provider with fallback) + cover validation. Gates guest scans 4 & 5 on hCaptcha siteverify; 10MB upload cap; scan-slot reservation released on all error branches. After barcode parse (~line 730), invokes `resolveVariant()` from `src/lib/variantResolver.ts` for 3-tier variant-name resolution (catalog → focused AI enrichment → deterministic addon-derived fallback). Currently bottlenecked in production: AI extracts only the 12-digit UPC, not the 5-digit add-on supplement (see "Variant Detection — Two-Pass High-Res Barcode OCR" in BACKLOG). | 🤖 🤖² 🗄️ 🔴 🏷️ |
| `/api/comic-lookup` | POST | Title/issue lookup (text-only → `MODEL_LIGHTWEIGHT` / Claude Haiku, not Sonnet — Session 48) | 🤖 🗄️ 🔴 |
| `/api/con-mode-lookup` | POST | Key Hunt pricing. Both eBay-found and no-data branches symmetrically attach keyInfo: curated `keyComicsDatabase.ts` first, AI fallback on miss (Session 45b — previously only the eBay-found branch ran the AI fallback). | 🏷️ 🤖 🗄️ |
| `/api/import-lookup` | POST | CSV enrichment (text-only → `MODEL_LIGHTWEIGHT` / Claude Haiku — Session 48) | 🤖 🗄️ |
| `/api/titles/suggest` | POST | Title autocomplete with abbreviation guidance | 🤖 |
| `/api/titles/popular` | POST | Top 20 most-searched titles (cached 1hr in Redis) | 🗄️ 🔴 |
| `/api/cover-search` | POST | Cover image search (Open Library + manual Google fallback) | Open Library |
| `/api/cover-candidates` | POST | Community DB lookup + AI query generation (no external image search API) | 🗄️ 🤖 🔴 |
| `/api/cover-images` | GET/POST | Community cover image management | 🗄️ |
| `/api/cert-lookup` | POST | CGC/CBCS verification | Web scrape |

### Pricing & Market

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/ebay-prices` | POST/GET | eBay sold listings | 🏷️ 🗄️ 🔴 |

### Auctions & Listings

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/auctions` | GET/POST | List/create auctions | 🗄️ 🔐 |
| `/api/auctions/[id]` | GET/PATCH/DELETE | Auction management | 🗄️ 🔐 |
| `/api/auctions/[id]/bid` | POST | Place bid (enforces bid restriction for flagged users; blocks if profile has `bid_restricted_at`) | 🗄️ 🔐 🔴 |
| `/api/auctions/[id]/bids` | GET | Bid history | 🗄️ |
| `/api/auctions/[id]/buy-now` | POST | Buy It Now | 🗄️ 🔐 |
| `/api/auctions/[id]/mark-shipped` | POST | Seller marks shipped + clones comic to buyer | 🗄️ 🔐 |
| `/api/auctions/[id]/second-chance` | POST | Seller initiates Second Chance Offer to runner-up after payment-expiry | 🗄️ 🔐 |
| `/api/auctions/by-comic/[comicId]` | GET | Check active listing | 🗄️ |
| `/api/listings/[id]/purchase` | POST | Fixed-price purchase (HTTP 410 deprecated — unified into `/api/checkout`) | 🗄️ 🔐 |
| `/api/second-chance-offers` | GET | Runner-up's inbox of Second Chance Offers | 🗄️ 🔐 |
| `/api/second-chance-offers/[id]` | POST/PATCH | Accept/decline a Second Chance Offer | 🗄️ 🔐 |
| `/api/transactions` | GET | Tabbed buyer view (Wins / Purchases / Bids / Offers) | 🗄️ 🔐 |

### Offers

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/offers` | GET/POST | List/create offers | 🗄️ 🔐 |
| `/api/offers/[id]` | GET/PATCH/POST | Offer management | 🗄️ 🔐 |

### Watchlist & Notifications

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/watchlist` | GET/POST/DELETE | Manage watchlist | 🗄️ 🔐 |
| `/api/notifications` | GET/PATCH | List user notifications + mark read. GET supports both legacy bell shape (limit 50, no cursor) and inbox cursor-pagination shape (`?cursor=<base64>&limit=N` capped at 100). PATCH supports single-row mark-read + bulk `markAll` with optional `asOf` clamp. Owner-scoped writes (Apr 27 IDOR fix). | 🗄️ 🔐 |
| `/api/notifications/[id]` | GET/DELETE | GET fetches single notification (404 on owner mismatch — never leak existence) for the inbox `?focus=<id>` deep-link. DELETE is the per-row dismiss (atomic owner-scope, suspension check, blocks `NON_DELETABLE_NOTIFICATION_TYPES` like `payment_missed_*` / `auction_payment_expired*`). | 🗄️ 🔐 |

### Messaging

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/messages` | GET/POST | List conversations / Send message (broadcasts via Supabase) | 🗄️ 🔐 |
| `/api/messages/[conversationId]` | GET | Get messages in conversation | 🗄️ 🔐 |
| `/api/messages/[conversationId]/read` | POST | Mark messages as read (broadcasts unread-update) | 🗄️ 🔐 |
| `/api/messages/unread-count` | GET | Get unread message count | 🗄️ 🔐 |
| `/api/messages/upload-image` | POST | Upload message image | 🗄️ 🔐 |
| `/api/messages/report/[messageId]` | POST | Report a message | 🗄️ 🔐 |
| `/api/users/[userId]/block` | POST/DELETE | Block/unblock user | 🗄️ 🔐 |
| `/api/users/blocked` | GET | List blocked users | 🗄️ 🔐 |
| `/api/settings/notifications` | GET/PATCH | Notification preferences | 🗄️ 🔐 |
| `/api/settings/preferences` | GET/PATCH | Display preferences (show_financials) | 🗄️ 🔐 |

### Sellers & Sharing

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/sellers/[id]/ratings` | GET/POST | Seller ratings (Creator Credits) | 🗄️ 🔐 |
| `/api/sharing` | GET/POST/PATCH | Public profile settings | 🗄️ 🔐 |

### Payments & Billing

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/checkout` | POST | Stripe checkout session (accepts `listingId` or `auctionId`; blocks post-deadline auction payments with HTTP 400 when `listing.paymentDeadline < now`; guards `product_data.images[0]` — only passes URL when it's `http(s)://` and ≤2048 chars, so long Supabase signed URLs and base64 `data:` URIs that previously caused Stripe `invalid_request_error` are now dropped silently) | 💰 🗄️ 🔐 |
| `/api/billing/checkout` | POST | Subscription checkout | 💰 🗄️ 🔐 |
| `/api/billing/portal` | POST | Stripe customer portal | 💰 🗄️ 🔐 |
| `/api/billing/status` | GET | Subscription status | 🗄️ 🔐 |
| `/api/billing/start-trial` | POST | Start free trial | 🗄️ 🔐 |
| `/api/billing/reset-trial` | POST | Reset trial period | 🗄️ 🔐 |

**`/api/billing/checkout` — promo trial behavior:**
- Accepts optional `promoTrial: true` param; when present, forces monthly price, adds `subscription_data.trial_period_days: 30`
- Dynamic `success_url` (`/collection?welcome=promo`) and `cancel_url` (`/choose-plan?billing=cancelled`) when promo is active
- Google Pay and Apple Pay enabled via `payment_method_types` when promo is active

### Stripe Connect

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/connect/create-account` | POST | Create Stripe Connect account | 💰 🗄️ 🔐 |
| `/api/connect/dashboard` | POST | Stripe Connect dashboard link | 💰 🗄️ 🔐 |
| `/api/connect/onboarding-refresh` | GET | Refresh onboarding link | 💰 🗄️ 🔐 |
| `/api/connect/onboarding-return` | GET | Return from onboarding | 💰 🗄️ 🔐 |
| `/api/connect/status` | GET | Connect account status | 💰 🗄️ 🔐 |

### Key Hunt

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/key-hunt` | GET | Get user's hunt list | 🗄️ 🔐 |
| `/api/key-hunt` | POST | Add comic to hunt list | 🗄️ 🔐 |
| `/api/key-hunt` | DELETE | Remove from hunt list | 🗄️ 🔐 |
| `/api/key-hunt` | PATCH | Update hunt list item | 🗄️ 🔐 |

### Trading

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/trades` | GET | Get user's trades (filterable by status) | 🗄️ 🔐 |
| `/api/trades` | POST | Create new trade proposal | 🗄️ 🔐 |
| `/api/trades/[tradeId]` | GET | Get trade details | 🗄️ 🔐 |
| `/api/trades/[tradeId]` | PATCH | Update trade (accept, decline, ship, confirm) | 🗄️ 🔐 |
| `/api/trades/available` | GET | Get all comics marked for trade. Value selected as `estimated_value:price_data->estimatedValue` (no `comics.estimated_value` column — Session 51) | 🗄️ |
| `/api/trades/matches` | GET | Get user's Hunt List matches | 🗄️ 🔐 |
| `/api/trades/matches` | POST | Trigger match finding | 🗄️ 🔐 |
| `/api/trades/matches/[matchId]` | PATCH | Update match (view, dismiss). Owner-scoped writes via `tradingDb` helpers (`dismissMatch` / `markMatchViewed` require `userId` + `.or('user_a_id.eq.X,user_b_id.eq.X')` predicate); returns **404 on owner mismatch** to avoid existence leaks (Session 43 IDOR fix). | 🗄️ 🔐 |
| `/api/comics/for-trade` | GET | Get user's for-trade comics (value from `price_data->estimatedValue`, Session 51) | 🗄️ 🔐 |
| `/api/comics/[id]/for-trade` | PATCH | Toggle for_trade status | 🗄️ 🔐 |

### Follows

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/follows/[userId]` | GET/POST/DELETE | Check/follow/unfollow user | 🗄️ 🔐 |
| `/api/follows/[userId]/followers` | GET | List user's followers | 🗄️ |
| `/api/follows/[userId]/following` | GET | List who user follows | 🗄️ |

### Reputation & Feedback (Creator Credits)

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/reputation` | GET | Get current user's reputation | 🗄️ 🔐 |
| `/api/reputation/[userId]` | GET | Get user's reputation profile | 🗄️ |
| `/api/feedback` | GET/POST | List/create transaction feedback | 🗄️ 🔐 |
| `/api/feedback/eligibility` | GET | Check if user can leave feedback — server-side `checkSaleFeedbackEligibility` gate requires `shipped_at` (Session 40c), so eligibility is *not* unlocked at payment time. Paired with client hook `useFeedbackEligibility(..., refreshKey)` which re-queries when `listing.shippedAt` changes or after feedback is submitted. | 🗄️ 🔐 |
| `/api/feedback/[id]` | GET/PATCH | Get/update feedback | 🗄️ 🔐 |
| `/api/feedback/[id]/respond` | POST | Seller responds to feedback | 🗄️ 🔐 |

### Comics Management

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/comics/[id]` | GET/PATCH/DELETE | Comic CRUD | 🗄️ 🔐 |
| `/api/comics/[id]/refresh-value` | POST | Manual FMV refresh for an owned comic — triggers eBay Browse lookup, persists `price_data` + `average_price` on the `comics` row; honors the shared 12h Redis cache used by `/api/ebay-prices` (Session 40b) | 🏷️ 🗄️ 🔴 🔐 |
| `/api/comics/upload-cover` | POST | Multipart `File` upload from signed-in users; uploads to `comic-covers` Supabase Storage bucket; returns public URL. Used by `src/lib/uploadCoverImage.ts` to convert scan-page data URIs into hosted URLs before DB write so `db.ts:720` sanitizer no longer rejects the cover. (Session 46) | 🗄️ 🔐 |
| `/api/comics/bulk-update` | PATCH | Bulk update comics | 🗄️ 🔐 |
| `/api/comics/bulk-delete` | POST | Bulk delete comics | 🗄️ 🔐 |
| `/api/comics/bulk-add-to-list` | POST | Bulk add comics to list | 🗄️ 🔐 |
| `/api/comics/undo-delete` | POST | Undo comic deletion | 🗄️ 🔐 |

### Age Verification & Location

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/age-verification` | POST | Verify user is 18+ for marketplace | 🗄️ 🔐 |
| `/api/location` | GET | Get user's location (IP-based) | External |

### Admin

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/admin/users/search` | GET | Search users by email | 🗄️ |
| `/api/admin/users/[id]` | GET | Get user details | 🗄️ |
| `/api/admin/users/[id]/reset-trial` | POST | Reset user's trial | 🗄️ |
| `/api/admin/users/[id]/grant-premium` | POST | Grant free premium days | 🗄️ |
| `/api/admin/users/[id]/suspend` | POST | Suspend/unsuspend user | 🗄️ |
| `/api/admin/usage` | GET | Service usage metrics | 🗄️ 🔴 🤖 |
| `/api/admin/usage/check-alerts` | POST | Check limits, send alerts | 🗄️ 📧 |
| `/api/admin/usage/alert-status` | GET | Get alert status | 🗄️ |
| `/api/admin/key-info` | GET | List pending submissions | 🗄️ |
| `/api/admin/key-info/[id]` | PATCH/DELETE | Approve/reject submission | 🗄️ |
| `/api/admin/custom-key-info` | GET | List custom key info submissions | 🗄️ |
| `/api/admin/custom-key-info/[id]` | PATCH/DELETE | Moderate custom key info | 🗄️ |
| `/api/admin/key-comics` | GET/POST | Manage key comics database | 🗄️ |
| `/api/admin/key-comics/[id]` | PATCH/DELETE | Edit/delete key comic entries | 🗄️ |
| `/api/admin/barcode-reviews` | GET/PATCH | Review barcode catalog submissions | 🗄️ |
| `/api/admin/cover-queue` | GET/PATCH | Review cover image submissions | 🗄️ |
| `/api/admin/publishers` | GET | List publishers | 🗄️ |
| `/api/admin/message-reports` | GET | List message reports (paginated) | 🗄️ |
| `/api/admin/message-reports/[reportId]` | PATCH | Update report status | 🗄️ |
| `/api/admin/health-check` | GET | Production health check (used by CI/CD smoke test) | 🗄️ |
| `/api/admin/flagged-users` | GET | List users flagged via Payment-Miss Strike System (≥2 missed payments in 90 days) | 🗄️ |

### User & Profile

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/username` | GET/POST/DELETE/PATCH | Username management — POST and DELETE now sync-on-write to both Supabase and Clerk Backend API (graceful degradation: Clerk failures logged but don't fail request) | 🗄️ 🔐 |
| `/api/username/current` | GET | Get current user's username | 🗄️ 🔐 |
| `/api/key-info/submit` | POST | Submit key info suggestion | 🗄️ 🔐 |
| `/api/publishers/suggest` | POST | Signed-in user suggests a missing publisher (feeds key-info submissions). Public user route, intentionally namespaced under `/api/publishers` (not `/api/admin`) (Session 48) | 🗄️ 🔐 |
| `/api/email-capture` | POST | Guest email for bonus scans | 📧 🗄️ |
| `/api/email-capture/verify` | POST | Verify email capture token | 📧 🗄️ |

### Utility

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/waitlist` | POST | Email capture | 📧 |
| `/api/unsubscribe` | GET/POST | One-click email unsubscribe (Session 48). Verifies a signed HMAC `UNSUBSCRIBE_SECRET` token (never trusts a raw profile id) and flips the matching email-category preference off. Supports RFC 8058 one-click POST and GET-with-redirect. Token minted by the email sender via `src/lib/unsubscribeToken.ts`. | 📧 🗄️ |
| `/api/test-email` | GET | Dev email testing | 📧 |
| `/api/email-preview` | GET | Dev-only email template preview | 📧 |

---

## Webhooks

| Route | Trigger | Purpose | Services |
|-------|---------|---------|----------|
| `/api/webhooks/clerk` | `user.created` / `user.updated` / `user.deleted` | **Created/Updated:** upserts `profiles` row with email, **username (sanitized via `sanitizeUsername()` against `^[a-z0-9_]{3,20}$`), first_name, last_name, and derived display_name** (via `buildDisplayName()`). Sanitizer lets the rest of the upsert land even when Clerk username contains dashes or other Supabase-invalid characters. **Deleted:** cascade delete user data. | 🔐 🗄️ |
| `/api/webhooks/stripe` | Payment events | Auction payments, subscriptions | 💰 🗄️ |

**Stripe webhook — idempotency (Session 48):**
- Every event is deduped before processing: `isWebhookProcessed("stripe_event_<event.id>")` (Redis cache, `cache:webhook:` prefix, 3-day TTL via `src/lib/cache.ts`). Duplicate retries short-circuit with `{received, duplicate:true}` and the event is marked processed only after the handler completes without throwing.
- Scan-pack credits use a stronger, DB-backed guard: the `processed_stripe_sessions` table + `credit_scan_pack(session_id, profile_id, scans)` RPC make repeat `checkout.session.completed` deliveries for a scan-pack idempotent at the row level (insert-or-no-op on `session_id` PK).

**Stripe webhook — subscription handling notes:**
- `customer.subscription.updated` / `customer.subscription.created`: writes `trial_start` and `trial_end` directly from `subscription.trial_start` / `subscription.trial_end` (bypasses `startTrial()` helper so promo trials aren't double-applied)
- `invoice.payment_succeeded`: $0 invoice guard — if `invoice.amount_paid === 0` and the subscription status is `trialing`, skips `upgradeToPremium()` to prevent overwriting the trialing status with active
- `upgradeToPremium()` accepts an optional `isTrialing` param; when true, sets `subscription_status: 'trialing'` instead of `'active'`

---

## Cron Jobs & Scheduled Functions

All cron jobs run as **Netlify Scheduled Functions** (`netlify/functions/`). Each function calls the corresponding `/api/cron/*` route internally.

| Netlify Function | Schedule | API Route | Purpose | Services |
|------------------|----------|-----------|---------|----------|
| `process-auctions.ts` | Every 5 min | `/api/cron/process-auctions` | Pipeline: `processEndedAuctions → sendPaymentReminders → expireUnpaidAuctions → expireOffers → expireSecondChanceOffers → expireListings → pruneOldNotifications`. Returns stats for all seven passes. The prune pass hard-deletes notifications where `read_at < NOW() - 30d` OR (`is_read = false AND created_at < NOW() - 90d`); logs counts via `console.warn("[prune] notifications: ...")` when anything is deleted. | 🗄️ 📧 |
| `reset-scans.ts` | 1st of month | `/api/cron/reset-scans` | Reset free tier scan counts | 🗄️ |
| `moderate-messages.ts` | Every hour | `/api/cron/moderate-messages` | AI moderation of flagged messages | 🗄️ 🤖 |
| `send-feedback-reminders.ts` | Daily 3 PM UTC | `/api/cron/send-feedback-reminders` | Remind users to leave transaction feedback | 🗄️ 📧 |
| `check-usage-alerts.ts` | Daily | `/api/admin/usage/check-alerts` | Monitor service limits, send alerts | 🗄️ 📧 |
| `send-trial-reminders.ts` | Daily | — | Send trial expiration reminders | 📧 |

**Automation Logic:**
- Auctions: Mark as `ended`/`sold` when end time passes (idempotent via conditional UPDATE + row-count check)
- Payment Reminders: Fires T-24h before `payment_deadline`; idempotent via `payment_reminder_sent_at` column
- Unpaid Auction Expiry: When `status='ended' AND payment_status='pending' AND payment_deadline < NOW() AND payment_expired_at IS NULL`, transition to `cancelled`, set `payment_expired_at`, notify both parties, trigger Payment-Miss Strike System logging
- Second Chance Offer Expiry: 48h window enforced via `expireSecondChanceOffers`
- Offers: Expire after 48 hours if no response
- Listings: Expire after 30 days
- Scans: Reset monthly counts on 1st of month
- Alerts: Email admin when approaching service limits
- Message Moderation: Claude analyzes flagged messages, auto-creates reports with 1-10 priority
- Feedback Reminders: Nudge buyers/sellers to leave transaction feedback after completed transactions
- Cron Batching: `sendPaymentReminders` + `expireUnpaidAuctions` use `mapWithConcurrency(5)` (from `src/lib/concurrency.ts`) for email prep and Resend `batch.send()` (50 emails/batch). Handles 50+ expirations per tick without timeout or rate-limit issues.

---

## Data Flow Diagrams

### Cover Scan Flow (Standard Path)

```
┌──────────────────┐
│  User uploads    │
│  cover image     │
└────────┬─────────┘
         │
         v
┌──────────────────┐     ┌──────────────────┐
│  Rate Limit      │────>│  Blocked (429)   │
│  Check (Upstash) │     └──────────────────┘
└────────┬─────────┘
         │ Pass
         v
┌──────────────────┐
│  AI Provider     │
│  Orchestrator    │
│  (executeWith-   │
│   Fallback)      │
└────────┬─────────┘
         │
    ┌────┴────────────────┐
    │ 3 independent calls │
    │ each can fall back: │
    │ Gemini → Anthropic  │
    └────┬────────────────┘
         │
    ┌────┴────┐
    │         │
    v         v
┌────────┐ ┌────────────┐
│ Graded │ │ Raw Comic  │
│ Comic  │ │            │
└───┬────┘ └─────┬──────┘
    │            │
    v            v
┌────────────┐ ┌──────────────────┐
│ CGC/CBCS   │ │ eBay Price       │
│ Cert Lookup│ │ Lookup           │
└─────┬──────┘ └────────┬─────────┘
      │                 │
      └────────┬────────┘
               │
               v
       ┌───────────────┐
       │ Cache Result  │
       │ (Supabase)    │
       └───────┬───────┘
               │
               v
       ┌───────────────┐
       │ Cover Harvest │  coverHarvestable? → validate aspect ratio
       │ (async, no-op │    via coverCropValidator (0.55-0.85 w/h)
       │  on dup/fail) │  → crop with sharp → upload to cover-images
       │               │  → insert cover_images row w/ variant
       └───────┬───────┘
               │
               v
       ┌───────────────┐
       │ Return to     │
       │ User          │
       └───────────────┘
```

### Cert-First Scan Flow (Slabbed Comics)

```
┌──────────────────┐
│  User uploads    │
│  slab photo      │
└────────┬─────────┘
         │
         v
┌──────────────────────────┐
│  Phase 1: Slab Flagging  │  Main analysis pass (executeWithFallback())
│  "Is this a slabbed      │  flags the slab — no dedicated
│   comic?"                │  detection call (H-SC1)
└────────┬─────────────────┘
         │
    ┌────┴────┐
    │ yes     │ no → Standard scan path
    v         └──────────────────────>
┌──────────────────────────┐
│  Phase 2: Slab Detail    │  executeSlabDetailExtraction()
│  Extraction              │  Reads cert #, grade, company,
│                          │  label color, title, issue, etc.
└────────┬─────────────────┘
         │
         v
┌──────────────────────────┐
│  Phase 3: Cert Lookup    │  CGC/CBCS/PGX web scrape
│  (if cert # found)       │  mergeKeyComments() combines
│                          │  AI + cert provider data
└────────┬─────────────────┘
         │
         v
┌──────────────────────────┐
│  Phase 4: eBay Pricing   │  Year disambiguation,
│  (grade-specific search) │  filterIrrelevantListings(),
│                          │  Q1 conservative pricing
└────────┬─────────────────┘
         │
         v
┌──────────────────────────┐
│  Phase 5: Cache + Cover  │  Cache result in metadata
│  Harvest + Response      │  Harvest cover if eligible
└────────┬─────────────────┘
         │
         v
┌──────────────────────────┐
│  Phase 5.5: Analytics    │  scan_path: 'cert-first'
│                          │  barcode_extracted, etc.
└──────────────────────────┘
```

### Marketplace Purchase Flow (Buy Now + Auction — Sessions 36-39)

Two entry paths converge at the PaymentButton. Once `payment_status: "pending"` is set, a 48-hour payment window starts (`calculatePaymentDeadline()` from `src/types/auction.ts`). Cron enforces reminders, expiry, and Second Chance Offers.

**Buy Now entry:**
```
Buyer clicks "Buy Now" in ListingDetailModal
         ↓
POST /api/checkout (unified route) → purchaseFixedPriceListing (supabaseAdmin)
         ↓
Auction row: status="sold", winner_id=buyer, payment_status="pending", payment_deadline=now+48h
Notifications: seller "Your item sold!", buyer "Purchase reserved!"
         ↓
Modal renders amber "Payment required" banner + PaymentButton (+ live countdown on /transactions)
```

**Auction entry:**
```
Cron /api/cron/process-auctions (every 5 min) → processEndedAuctions (supabaseAdmin)
  - Idempotent: conditional UPDATE ... WHERE status='active' + row-count check
  - Repeat cron calls on same auction are no-ops (no duplicate notifications)
         ↓
Auction row: status="ended", winner_id=highest bidder, payment_status="pending", payment_deadline=now+48h
Audit: auction_audit_log insert (event: auction_ended)
Notifications: seller "Your item sold!", winner "You won!"
         ↓
Winner visits /shop?listing=<id>&tab=auctions → AuctionDetailModal
         ↓
Modal renders amber "You won! Complete payment" banner + PaymentButton (+ countdown timer)
```

**Payment deadline timeline (enforced by `/api/cron/process-auctions`):**
```
T=0      Auction ends / Buy Now purchase → payment_deadline = T+48h
                  ↓
T+24h    sendPaymentReminders() cron pass
         - Conditional UPDATE WHERE payment_reminder_sent_at IS NULL (race-safe)
         - Resend batch.send() (50 emails/batch, mapWithConcurrency(5))
         - Emails `payment_reminder` template + in-app notification
                  ↓
T+48h    expireUnpaidAuctions() cron pass (if still unpaid)
         - Conditional UPDATE WHERE payment_expired_at IS NULL (race-safe)
         - status → 'cancelled', payment_expired_at = NOW()
         - Emails: `auction_payment_expired` (buyer) + `auction_payment_expired_seller` (seller)
         - Audit: auction_audit_log insert (event: payment_expired)
         - Payment-Miss Strike System fires:
             - Increment profiles.payment_missed_count, set payment_missed_at
             - 1st offense: send warning email (`payment_missed_warning`)
             - 2nd offense in 90 days: set bid_restricted_at, insert system-negative
               reputation rating (idempotent unique constraint), email
               `payment_missed_flagged`, notify admins
                  ↓
Second Chance Offer (seller-initiated, optional)
         - POST /api/auctions/[id]/second-chance → creates second_chance_offers row
         - Runner-up notified (email + in-app) with 48h to accept at their last actual
           bid price (not their max_bid)
         - Accept → `/api/second-chance-offers/[id]` POST → checkout flow
         - Decline/ignore → expireSecondChanceOffers cron cancels after 48h
         - No cascade: if declined/ignored, the offer ends
```

**Shared payment flow (both entries, and Second Chance acceptance):**
```
Buyer clicks "Pay $X" (PaymentButton)
         ↓
POST /api/checkout → Stripe Checkout Session
  - Post-deadline guard: HTTP 400 "The payment window for this auction has expired"
    when listing.paymentDeadline < now (blocks late-pay attempts)
  - Age verification gate (profile.age_confirmed_at)
  - Seller Connect account lookup (stripe_connect_account_id + onboarding_complete)
  - computePlatformFeeCents() / calculateDestinationAmount() (src/lib/stripeConnect.ts)
    - Premium seller: 5% platform / 95% seller
    - Free seller: 8% platform / 92% seller
    - Math.floor (seller-favorable rounding); 75¢ minimum platform fee
  - DESTINATION CHARGE (Session 48; Session 52: built by buildMarketplacePaymentIntentData,
    NO on_behalf_of — transfers-only Express sellers lack card_payments, which Stripe
    requires for on_behalf_of, so checkout failed). PLATFORM is merchant-of-record and
    pays Stripe's 2.9%+30¢ (verified in test mode Oct 22, 2026). payment_intent_data = {
      application_fee_amount: platform fee (swept to platform balance),
      transfer_data: { destination: seller Connect acct }  // NO amount —
        seller share = total − application_fee
    }
         ↓
Redirect to Stripe hosted Checkout (buyer enters card)
         ↓
Buyer completes payment on Stripe
         ↓
Stripe fires webhook chain → /api/webhooks/stripe (8 events incl. account.updated)
  - checkout.session.completed → handleMarketplacePayment
    - Update auction: payment_status="paid", status="sold"
    - Audit: auction_audit_log insert (event: payment_received)
    - Insert sales record (seller's sales history)
    - Notify seller: payment_received; Notify buyer: purchase_confirmation
    - (Session 40c) `rating_request` is NOT fired here — server eligibility requires
      shipped_at, so prompting at payment was premature
  - transfer.created (destination charge fires transfer to seller's Connect account)
  - payment_intent.succeeded
         ↓
Buyer redirected to /transactions (unified transactions page, tabbed)
         ↓
Seller marks shipped via /api/auctions/[id]/mark-shipped:
  - Sets shipped_at + tracking_carrier + tracking_number
  - Audit: auction_audit_log insert (event: shipped)
  - Clones comic row to buyer's collection (ownership transfer gated on shipping)
  - Fires shipped + rating_request notifications to BOTH buyer and seller
    (Session 40c — rating_request moved here from Stripe webhook payment event)
         ↓
Seller's Stripe Express Dashboard shows incoming transfer on 2-5 day payout schedule
```

---

## Key Hooks

| Hook | Purpose | Services |
|------|---------|----------|
| `useCollection` | Cloud sync abstraction - routes to localStorage (guests) or Supabase (signed-in) | 💾 🗄️ 🔐 |
| `useGuestScans` | Tracks free scan usage, enforces limits | 💾 |
| `useOffline` | Offline queue for Key Hunt | 💾 |
| `useKeyHunt` | Hunt list management | 🗄️ 🔐 |
| `useSubscription` | Subscription status and feature gating | 🗄️ 🔐 |
| `useSelection` | Multi-select for bulk collection actions | 💾 |
| `useDebounce` | Debounce utility for inputs | — |
| `useFeedbackEligibility` | Check if user can leave feedback on a transaction; accepts a `refreshKey` arg so the client re-queries when `listing.shippedAt` changes or after feedback is submitted (Session 40c) | 🗄️ 🔐 |
| `useModalA11y` | **(Session 48)** Shared, behavior-preserving accessibility wiring for overlay modals — adds `role=dialog`/`alertdialog` semantics, Escape-to-close, and focus management to an existing modal without changing its markup/logic. Applied across ~17 overlay modals (auction/listing detail, bulk delete/list picker, feedback, follow list, block/report, share, sign-up prompt, suggest key info, variants, age verification, data migration, key-hunt bottom sheet, public comic, etc.). | — |

**useCollection provides:**
- `collection`, `lists`, `sales` - state
- `addToCollection`, `updateCollectionItem`, `removeFromCollection` - CRUD with optimistic updates
- `createList`, `deleteList`, `addItemToList`, `removeItemFromList` - list management
- `recordSale` - sales tracking
- `isCloudEnabled` - true when signed in and syncing to Supabase

---

## Key Components

| Component | Notable Features |
|-----------|-----------------|
| `src/components/TitleAutocomplete.tsx` | Abbreviation expansion with "Searching for..." hint, popular titles on empty input, keyboard navigation |
| `src/components/CSVImport.tsx` | Batch lookups with dedup + parallel processing, shows unique lookup count in progress |
| `src/components/messaging/MessageThread.tsx` | Real-time via Supabase Broadcast (replaced postgres_changes) |
| `src/components/Navigation.tsx` | Broadcast subscriptions for message badge, profileId from `/api/username/current`, 20 FAQs, fixed "More" dropdown active state |
| `src/components/MobileNav.tsx` | Broadcast subscriptions for message badge updates; listens for the `cc:selection-mode` window `CustomEvent` (dispatched by `/collection`) and hides the floating bottom nav while multi-select mode is active so the selection action bar isn't covered (Session 47) |
| `src/components/creatorCredits/` | Creator Credits UI (CreatorBadge, FeedbackList, FeedbackModal, LeaveFeedbackButton, SellerResponseForm) |
| `src/components/CoverReviewQueue.tsx` | Admin cover image contribution review |
| `src/components/follows/` | Follow system UI (FollowButton, FollowerCount, FollowListModal) |
| `src/components/collection/` | Bulk actions UI (SelectionToolbar, SelectionCheckbox, SelectionHeader, BulkDeleteModal, BulkListPickerModal, UndoToast) **+ CollectionToolbar, CollectionGrid** (extracted from `/collection` page, Session 48) |
| `src/components/comicDetail/` | **(Session 48)** Sub-sections extracted from the monolithic `ComicDetailsForm.tsx` / `ComicDetailModal.tsx` (which remain at root as the composers): ComicDetailHeader, CoverSourceSection, GradingSection, KeyInfoSection, ListMenu, PricingSection, RelookupPrompt, RemoveConfirmDialog, SellerActionPanel, SignatureSection, SoldConfirmDialog, ValueSection, plus `useDialogA11y.ts` (wraps `useModalA11y`). Modal is now a focus-trapped, Escape-closable `role=dialog`. |
| `src/components/profile/` | **(Session 48)** CustomProfilePage tabs, code-split via `next/dynamic` (SSR off): ProfileTab, SecurityTab, BillingTab + `profileTabHelpers.ts`. CustomProfilePage.tsx stays at root as the shell. |
| `src/components/scan/` | **(Session 48)** ScanPanel (extracted from `/scan` page) |
| `src/components/keyHunt/` | **(Session 48)** KeyHuntSearchForm, KeyHuntResults (extracted from `/key-hunt` page) |
| `src/app/scan/BonusVerificationHandler.tsx` | **(Session 48)** Handles the email-bonus-scan verification redirect on the scan page |
| `src/app/admin/AdminNav.tsx` | **(Session 48)** Client nav child; `admin/layout.tsx` is now a server component that gates on `is_admin` before rendering this. **(Session 51)** Added "Pivot Brief" tab → `/admin/pivot-brief` |
| `src/components/trading/` | Trading UI (TradeCard, TradeProposalModal, TradeableComicCard) |
| `src/components/auction/` | Auction/listing UI (AuctionCard, AuctionCountdown, AuctionDetailModal, BidForm, BidHistory, CreateAuctionModal, CreateListingModal, ListingCard, ListingDetailModal, ListInShopModal, MakeOfferModal, MarkAsShippedForm, OfferResponseModal, PaymentButton, PremiumSellerUpsell, SecondChanceInboxCard, SecondChanceOfferButton, SellerBadge, WatchlistButton) |
| `src/components/PaymentDeadlineCountdown.tsx` | Client component that live-ticks every 60s on pending-payment rows of /transactions — neutral >24h, orange ≤24h, red ≤6h, "Expired" at ≤0; hydration-safe (SSR placeholder, populates in useEffect) |
| `src/components/GuestCaptcha.tsx` | Invisible hCaptcha wrapper (via `@hcaptcha/react-hcaptcha`) used by scan page to gate guest scans 4 & 5; floating badge |
| `src/components/messaging/` | Messaging UI (ConversationList, MessageThread, MessageBubble, MessageButton, MessageComposer, BlockUserModal, ReportMessageModal) |
| `src/components/admin/` | Admin UI (ReportCard) |
| `src/components/icons/` | Custom icons (ChestIcon) |

---

## Key Library Files

| File | Purpose |
|------|---------|
| `src/lib/titleNormalization.ts` | Comic title abbreviation expansion (34 abbreviations, e.g. "ASM" -> "Amazing Spider-Man") |
| `src/lib/batchImport.ts` | Batch import utility — deduplicates CSV rows by title+issue, parallel lookups in batches of 5 |
| `src/lib/messagingDb.ts` | Messaging DB helpers including `broadcastNewMessage()` via Supabase Broadcast |
| `src/lib/cache.ts` | Redis cache helpers including `popularTitles` prefix with 1-hour TTL |
| `src/lib/creatorCreditsDb.ts` | Creator Credits DB helpers (transaction feedback + contribution badge tiers) |
| `src/lib/coverImageDb.ts` | Community cover image DB helpers (`getCommunityCovers`); variant support added for harvest dedup (unique index on title+issue+publisher+variant) |
| `src/lib/coverHarvest.ts` | Cover harvest orchestrator — validates result eligibility, crops with `sharp`, uploads to Supabase Storage, inserts `cover_images` row with `variant` field; no-op on duplicates |
| `src/lib/followDb.ts` | Follow system DB helpers (follow/unfollow, counts) |
| `src/lib/tradingDb.ts` | Trading system DB helpers (trades, matches). **(Session 51)** Comic value read via `price_data->estimatedValue` alias, not a nonexistent `estimated_value` column |
| `src/lib/auctionDb.ts` | **(Session 48)** Now a RE-EXPORT BARREL over `src/lib/auction/*` — re-exports the public auction/listing helper surface from focused submodules: `auctions.ts`, `bids.ts`, `offers.ts`, `secondChance.ts`, `watchlist.ts`, `notifications.ts`, `ratings.ts`, `cron.ts` (ended-auction processing / reminders / expiry passes), `transforms.ts`, `columns.ts`, `shared.ts` (unused `index.ts` barrel removed Session 50). Import path `@/lib/auctionDb` unchanged. |
| `src/lib/keyComicsDb.ts` | Key comics lookup/management helpers. **(Session 48)** DB-PRIMARY read path: `lookupKeyInfoFromDb()` / `lookupKeyInfoMetaFromDb()` query the `key_comics` Supabase table first (with leading-zero issue fallback) and fall back to the static `keyComicsDatabase.ts` curated set. Used by `/api/analyze` and `/api/con-mode-lookup`. |
| `src/lib/features.ts` | **(Session 52)** Feature flags. `MARKETPLACE_ENABLED` (currently `false`) + `MARKETPLACE_PAGE_PREFIXES` / `MARKETPLACE_API_PREFIXES`, segment-aware `isMarketplacePagePath` / `isMarketplaceApiPath` / `shouldRedirectShopTab` (used by middleware), and pure UI helpers `getMissionStatement`, `isForSaleDefaultList`, `getVisibleLists`, `resolveSelectedListId`. |
| `src/lib/imageRemotePatterns.mjs` | **(Session 52)** Single source of truth for `images.remotePatterns` (Supabase Storage, eBay, Clerk, Open Library, Comic Vine, Marvel CDN). Plain `.mjs` so `next.config.mjs` can import it. No wildcard hosts. |
| `src/lib/imageSrc.ts` | **(Session 52)** `isOptimizableImageSrc(src)` — true for same-origin paths or URLs matching the allowlist (uses Next's internal `matchRemotePattern`; re-check on Next upgrades). Used as `unoptimized={!isOptimizableImageSrc(url)}` on 22 cover/avatar `next/image` usages so unknown hosts, http, data: URIs and malformed URLs render instead of throwing. |
| `src/lib/faqData.tsx` | **(Session 52)** Shared Ask the Professor FAQ entries (marketplace answers conditional on `MARKETPLACE_ENABLED`). |
| `src/lib/stripeConnect.ts` | Stripe Connect account helpers. **(Session 52)** `buildMarketplacePaymentIntentData()` builds the destination-charge `payment_intent_data` (application fee + transfer destination, intentionally no `on_behalf_of`). Note: `estimateSellerTakeHomeCents()` still subtracts the Stripe fee — wrong now that the platform pays it; fix before marketplace relaunch (BACKLOG "Marketplace Relaunch Checklist"). **(Session 48)** `computePlatformFeeCents()` (canonical cents-based floored fee, 75¢ minimum) + `calculateDestinationAmount()` → `{sellerAmount, platformFee}` for destination charges. **(Session 51)** Display-only fee estimators: `STRIPE_PROCESSING_PERCENT` (2.9) / `STRIPE_PROCESSING_FIXED_CENTS` (30), `estimateStripeProcessingFeeCents()`, `estimateSellerTakeHomeCents()`, `buildSellerFeeFaqAnswer()` (shared by Pricing page FAQ + Navigation FAQ so copy can't drift from checkout math). |
| `src/lib/ageVerification.ts` | Age verification helpers |
| `src/lib/bulkActions.ts` | Bulk collection action helpers |
| `src/lib/certHelpers.ts` | Cert/slab helpers — `normalizeGradingCompany()`, `parseKeyComments()`, `mergeKeyComments()`, `parseArtComments()` |
| `src/lib/metadataCache.ts` | Comic metadata caching helpers; `hasCompleteSlabData()` checks if cached metadata has full slab details |
| `src/lib/contentFilter.ts` | Message content filtering (phone/email detection) |
| `src/lib/adminAuth.ts` | Admin authentication helpers — `getAdminProfile()` (server components/routes; uses Clerk server `auth()`) wraps **(Session 51)** `getAdminProfileByUserId(userId)` (middleware-safe; no request-scoped Clerk APIs) |
| `src/lib/db.ts` | Core database helper functions. **(Session 51)** `cleanupOrphanedCover()` deletes a `comic-covers` file only when no `COVER_REFERENCE_COLUMNS` row references its URL (pure `decideCoverCleanup()` → `skip`/`keep`/`delete`, fail-safe keep); `saveComicMetadata()` / `incrementComicLookupCount()` write via `supabaseAdmin` (comic_metadata RLS requires Supabase auth, which Clerk users lack) |
| `src/lib/promoTrial.ts` | localStorage helpers for promo trial flag — `setPromoTrialFlag()`, `getPromoTrialFlag()`, `clearPromoTrialFlag()`; timestamp-based 7-day expiration. **(Session 48)** Gained server-side `mintPromoTrialToken()` / `verifyPromoTrialToken()` (signed, QR-exclusive promo tokens via `signedToken`, secret `PROMO_TRIAL_SECRET`) plus migration-gated `isPromoTrialEligible()` / `consumePromoTrialEligibility()` against `profiles.promo_trial_eligible`. |
| `src/lib/signedToken.ts` | **(Session 48)** Shared HMAC-SHA256 sign/verify for JSON payloads with constant-time signature comparison — `sign()`, `verify()`. Each token names its own secret env var and **falls back to `CLERK_SECRET_KEY`** when that var is unset (`resolveSecret()`). Single source of truth for guest-scan, promo-trial, and unsubscribe tokens. |
| `src/lib/guestScanToken.ts` | **(Session 48)** Server-issued signed guest cookie (`cc_guest`, secret `GUEST_SCAN_SECRET`) + Redis-backed scan accounting — `issueGuestToken()`, `signGuestCookie()`, `verifyGuestCookie()`, `readGuestScans()`, `readGuestBonus()`, `incrementGuestScans()`. `/api/analyze` enforces guest scan limits against the **server-stored count**, never a client header. |
| `src/lib/unsubscribeToken.ts` | **(Session 48)** Single source of truth for email unsubscribe tokens (secret `UNSUBSCRIBE_SECRET`) shared between the email sender and `/api/unsubscribe` — `mintUnsubscribeToken()`, `buildUnsubscribeUrl()`, `verifyUnsubscribeToken()`. |
| `src/lib/redis.ts` | **(Session 48)** Shared Upstash Redis client singleton — exports `redis` (nullable) and `isRedisAvailable()`. |
| `src/lib/alertBadgeHelpers.ts` | Admin alert badge helpers |
| `src/lib/aiProvider.ts` | Fallback orchestrator: getProviders(), classifyError(), getRemainingBudget(), executeWithFallback(), executeSlabDetailExtraction() (unused executeSlabDetection() removed Session 50 — the main analysis pass flags slabs, H-SC1) |
| `src/lib/providers/types.ts` | Provider interface + shared types (AIProvider, CallResult, ScanResponseMeta, SlabDetectionResult, SlabDetailExtractionResult); AICallType includes `slabDetection`/`slabDetailExtraction`; `coverHarvestable` flag and `coverCropCoordinates` in result shape |
| `src/lib/providers/gemini.ts` | GeminiProvider class — primary vision provider (`GEMINI_PRIMARY` = `gemini-3.5-flash-lite` since Session 51; was Gemini 2.0 Flash, shut down 2026-06-01); `detectSlab()`, `extractSlabDetails()` methods; `maxOutputTokens` increased for harvest prompt |
| `src/lib/providers/anthropic.ts` | AnthropicProvider class — fallback provider (Claude); `detectSlab()`, `extractSlabDetails()` methods; new prompts: SLAB_DETECTION_PROMPT, SLAB_DETAIL_EXTRACTION_PROMPT, SLAB_COVER_HARVEST_ONLY_PROMPT; AI prompt includes `coverHarvestable` + `coverCropCoordinates` |
| `src/lib/models.ts` | AI model constants incl. GEMINI_PRIMARY, MODEL_PRIMARY, MODEL_LIGHTWEIGHT, VISION_PROVIDER_ORDER |
| `src/lib/analyticsServer.ts` | Server-side analytics helpers (provider-aware cost estimation via PROVIDER_COSTS lookup); ScanPath type, `scan_path` and `barcode_extracted` fields; `cover_harvested` boolean field |
| `src/lib/coverValidation.ts` | Gemini-powered cover image validation pipeline |
| `src/lib/coverCropValidator.ts` | Validates AI-returned crop coordinates produce comic-book aspect ratio (0.55-0.85 w/h); rejects out-of-range crops before they pollute the cover cache; wired at the top of `harvestCoverFromScan` |
| `src/lib/validation.ts` | Zod-backed API input validation shared across 82 routes — `validateBody()`, `validateQuery()`, `validateParams()`, `schemas.uuid`/`email`/`url`/`trimmedString`/`positiveInt`/`nonNegativeNumber`; standardized `{error, details:[{field, issue}]}` HTTP 400 response; `.strict()` supported for rejecting unknown fields |
| `src/lib/auditLog.ts` | Auction audit log helper; fire-and-forget single + batch variants; 17 wire-ups across `auctionDb.ts`, `mark-shipped` route, and Stripe webhook; writes to `auction_audit_log` table (admin-read RLS, service-role insert) |
| `src/lib/notificationPreferences.ts` | Per-category email notification gating — `NOTIFICATION_CATEGORY_MAP` (4 categories: transactional/marketplace/social/marketing) covers all 27 notification email types; `isNotificationAllowed()`, `filterRecipientsByPreference()` |
| `src/lib/concurrency.ts` | `mapWithConcurrency(items, concurrency, fn)` — used by `sendPaymentReminders` + `expireUnpaidAuctions` to cap parallel email prep at 5 while feeding Resend `batch.send()` |
| `src/lib/hcaptcha.ts` | hCaptcha siteverify helper; 5s timeout; dev/prod key swap via `HCAPTCHA_SECRET_KEY`/`NEXT_PUBLIC_HCAPTCHA_SITE_KEY`; invoked on `/api/analyze` for guest scans 4 & 5 |
| `src/lib/publicConfig.ts` | **(Session 50)** Client-safe shared constants — `DEFAULT_SUPPORT_EMAIL` (`support@collectors-chest.com`; the server email layer overlays the `SUPPORT_EMAIL` env var) and `HCAPTCHA_SITE_KEY` (dev/prod site-key selection shared by `GuestCaptcha.tsx` + `hcaptcha.ts`) |
| `src/lib/uploadLimits.ts` | Shared 10MB image upload cap — `MAX_IMAGE_UPLOAD_BYTES`, `assertImageSize()`, `base64DecodedByteLength()`; wired into `/api/analyze` and `/api/messages/upload-image` |
| `src/lib/uploadCoverImage.ts` | Client helper used by `/scan` `handleSave()` — converts data URI to Blob, multipart POSTs to `/api/comics/upload-cover`, returns Supabase Storage public URL. Pass-through for already-hosted `http(s)://` URLs; returns `null` on failure (caller decides whether to drop the cover or block save). (Session 46) |
| `src/lib/variantResolver.ts` | Variant name resolver invoked from `/api/analyze` after barcode parse. Exports `resolveVariant()` (3-tier orchestrator), `lookupApprovedVariantName` (Supabase `barcode_catalog` query for admin-approved rows), and `enrichVariantNameFromAI` (Claude Haiku, prompted with deterministically-derived cover letter from the addon code). Tier 1 catalog → Tier 2 focused AI → Tier 3 deterministic addon-derived fallback. Design principle: barcode trumps AI cover-derived hint (two physically distinct books can share identical cover art but differ in addon code). (Session 46) |
| `src/lib/choosePlanHelpers.ts` | Choose plan page helpers |
| `src/lib/imageOptimization.ts` | Client-side image compression utilities |
| `src/lib/scanAnalyticsHelpers.ts` | Scan analytics tracking helpers |
| `src/lib/normalizeTitle.ts` | Comic title normalization utilities |
| `src/lib/keyComicsDatabase.ts` | Key comics database management |
| `src/lib/keyInfoHelpers.ts` | Key info display and formatting helpers |
| `src/lib/offlineCache.ts` | Offline caching utilities for Key Hunt; exports `OFFLINE_QUEUE_CHANGED_EVENT` (`"cc:offline-queue-changed"`) dispatched on queue writes and imported by `useOffline` (event name unified Session 50 — dispatch/listener previously mismatched silently) |
| `src/lib/emailValidation.ts` | Email validation helpers |
| `src/lib/comicFacts.ts` | Random comic facts for UI display |
| `src/lib/certLookup.ts` | CGC/CBCS certificate lookup logic |
| `src/lib/ebayBrowse.ts` | eBay Browse API integration; `filterIrrelevantListings()` removes non-comic listings; `buildSearchKeywords()` accepts year param for disambiguation; `filterOutliersAndCalculateMedian()` uses Q1 for conservative pricing; grade filtering for slabbed results |
| `src/lib/gradePrice.ts` | Grade-based price calculation logic |
| `src/lib/csvExport.ts` | CSV export generation |
| `src/lib/csvHelpers.ts` | CSV parsing and import helpers |
| `src/lib/email.ts` | **(Session 48)** Now a RE-EXPORT BARREL over `src/lib/email/*` (`constants.ts`, `types.ts`, `helpers.ts`, `profiles.ts`, `templates.ts`, `send.ts` — unused `index.ts` barrel removed Session 50); import path `@/lib/email` unchanged. Email sending via Resend; `getListingComicData()` uses FK-qualified PostgREST join `comics!auctions_comic_id_fkey(...)`; `sendNotificationEmail` + `sendNotificationEmailsBatch` gate on `NOTIFICATION_CATEGORY_MAP` preferences with skipped-count reporting; Resend `batch.send()` (50 emails/batch) used by cron passes; new templates: `payment_reminder`, `auction_payment_expired`, `auction_payment_expired_seller`, `payment_missed_warning`, `payment_missed_flagged`, 5 Second Chance Offer templates. Outbid email (`BidActivityEmailData`) now renders a "Your max bid: $X" line when `yourMaxBid` is present — wired from `currentWinningBid.max_bid` at the `placeBid` call site in `auctionDb.ts` (Session 40b). |
| `src/lib/rateLimit.ts` | Upstash Redis rate limiting helpers |
| `src/lib/storage.ts` | Supabase storage helpers |
| `src/lib/supabase.ts` | Supabase client initialization |
| `src/lib/usernameValidation.ts` | Username format and uniqueness validation |
| `src/lib/statsCalculator.ts` | Collection statistics calculation |
| `src/types/creatorCredits.ts` | Creator Credits type definitions (transaction feedback, badge tiers, contribution types) |
| `src/types/comic.ts` | Core comic type definitions |
| `src/types/auction.ts` | Auction and listing type definitions |
| `src/types/messaging.ts` | Messaging type definitions |
| `src/types/trade.ts` | Trade type definitions |
| `src/types/follow.ts` | Follow system type definitions |
| `src/types/notificationPreferences.ts` | Email notification preference types — 4 categories (transactional/marketplace/social/marketing) |

---

## Database Tables (Supabase)

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts linked to Clerk |
| `comics` | Collection items |
| `lists` | Custom lists (Want List, For Sale, etc.) |
| `comic_lists` | Junction: comics ↔ lists |
| `sales` | Sold comic records |
| `comic_metadata` | Shared comic info cache |
| `ebay_price_cache` | eBay prices (24h TTL) |
| `auctions` | Auction and fixed-price listings |
| `bids` | Bid history |
| `auction_watchlist` | User watchlists |
| `seller_ratings` | Legacy seller ratings |
| `notifications` | In-app notifications |
| `offers` | Purchase offers on listings |
| `conversations` | Messaging conversations between users |
| `messages` | Individual messages with content filtering |
| `user_blocks` | User-to-user blocking |
| `message_reports` | Flagged messages for admin review |
| `trades` | Trade proposals between users |
| `trade_items` | Comics included in trades (many-to-many) |
| `trade_matches` | Mutual matches from Hunt List + For Trade |
| `transaction_feedback` | Creator Credits transaction feedback (positive/negative reviews) |
| `community_contributions` | Tracks user contributions (key_info, cover_image) for Creator Credits |
| `feedback_reminders` | Scheduled reminders for transaction feedback |
| `user_follows` | User-to-user follow relationships |
| `key_comics` | Curated key comics database |
| `key_info_submissions` | Community key info submissions for moderation |
| `key_hunt_lists` | User hunt/wish lists |
| `auction_audit_log` | Full auction/offer/payment/shipment lifecycle audit trail (20+ event types via `auction_audit_event_type` enum); admin-read RLS, service-role insert |
| `second_chance_offers` | Seller-initiated Second Chance Offers to runner-up after unpaid auction expiry (48h window, one-shot, no cascade) |
| `scan_usage` | Monthly scan count tracking per user |
| `bonus_scan_claims` | Email capture bonus scan claims |
| `usage_alerts` | Service usage monitoring alerts |
| `admin_audit_log` | Admin action audit trail |
| `app_cache` | General-purpose application cache |
| `barcode_catalog` | Community-submitted barcode-to-comic mappings |
| `admin_barcode_reviews` | Barcode catalog moderation queue |
| `cover_images` | Community-submitted cover images; `variant` column added (text, nullable) with unique index on title+issue+publisher+variant for harvest dedup; sentinel profile for harvest-contributed rows |
| `scan_analytics` | Scan tracking with `provider`, `fallback_used`, `fallback_reason`, `cover_harvested` (boolean) columns |
| `cover_validation` | Cover image validation results from Gemini pipeline |
| `processed_stripe_sessions` | **(Session 48)** Idempotency ledger for one-time Stripe Checkout sessions (`session_id` PK, `processed_at`); RLS enabled. Backs the `credit_scan_pack()` RPC so repeat scan-pack webhook deliveries are row-level no-ops. |

### Postgres RPCs (Session 48 — migration `20260614_audit_closeout.sql`)

| RPC | Purpose |
|-----|---------|
| `credit_scan_pack(session_id, profile_id, scans)` | Idempotent scan-pack credit — inserts into `processed_stripe_sessions` then bumps scan allowance; no-ops on a duplicate session |
| `complete_trade(trade_id)` | Atomic trade settlement — comic ownership swap + hunt-list cleanup in one transaction |
| `find_trade_matches(user_id, comic_id?)` | Reciprocal Hunt-List ↔ For-Trade matching with corrected `quality_score` formula (replaces the previously buggy matcher) |
| `review_barcode(review_id, admin_id, status, corrected_upc?, admin_notes?)` | Atomic admin barcode-review decision |
| `sum_seller_platform_fees(account_id)` | Sum of platform fees collected from a seller |

### Trading Tables Detail

**trades**
- `id`, `proposer_id`, `recipient_id`, `status`
- `proposer_tracking_carrier`, `proposer_tracking_number`
- `recipient_tracking_carrier`, `recipient_tracking_number`
- `proposer_shipped_at`, `recipient_shipped_at`
- `proposer_received_at`, `recipient_received_at`
- `completed_at`, `cancelled_at`, `cancel_reason`
- Status flow: proposed → accepted → shipped → completed (or cancelled/declined)

**trade_items**
- `id`, `trade_id`, `comic_id`, `owner_id`
- Links comics to trades (many-to-many)

**trade_matches**
- `id`, `user_a_id`, `user_b_id`
- `user_a_comic_id`, `user_b_comic_id`
- `quality_score`, `status` (pending/viewed/dismissed/traded)
- Mutual matches from Hunt List + For Trade

**comics table additions**
- `for_trade` (boolean) - Available for trade
- `acquired_via` (text) - How comic was obtained (scan/import/purchase/trade)
- `cover_validated` (boolean) - Whether cover image passed validation pipeline

**cover_images table additions**
- `variant` (text, nullable) - Cover variant label (e.g., "1:25 variant"); unique index on `(title, issue_number, publisher, variant)` for harvest dedup
- Sentinel profile (`cover_harvest_bot`) used as `submitted_by` for auto-harvested rows

**scan_analytics table additions**
- `cover_harvested` (boolean) - Whether a cover image was auto-harvested from this scan
- `scan_path` (text) - Scan pipeline path taken (e.g., `cert-first`, `standard`)
- `barcode_extracted` (boolean) - Whether a barcode was extracted from the scan image

**sales table additions (Session 48)**
- `sale_price_recorded` (boolean, default true) - Whether a real sale price was captured (vs placeholder)
- `platform_fee` (decimal) - Platform fee taken on the sale
- `seller_net` (decimal) - Seller's net proceeds after platform fee

**bids table additions (Session 48)**
- Unique partial index `uq_bids_one_winning_per_auction` on `(auction_id) WHERE is_winning = true` - guarantees at most one winning bid per auction

**profiles table additions**
- `show_financials` (boolean) - User preference to show/hide financial data in collection
- `promo_trial_eligible` (boolean, default false) + `promo_trial_used_at` (timestamptz) - QR-exclusive promo-trial eligibility gate, consumed once (Session 48)
- `comp_granted` (boolean, default false) - Complimentary access flag (Session 48)
- `stripe_connect_charges_enabled` / `stripe_connect_payouts_enabled` (boolean) - Mirrors Stripe Connect account capability state (Session 48)
- Unique partial index `uq_profiles_stripe_customer_id` on `(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL` (Session 48)
- `payment_missed_count` (int) - Total count of unpaid auction-wins (Payment-Miss Strike System)
- `payment_missed_at` (timestamp) - Timestamp of most recent missed payment
- `bid_restricted_at` (timestamp, nullable) - When set, user is blocked from placing new bids (2 strikes in 90 days)
- `notify_marketplace` (boolean, default true) - Marketplace email notifications opt-in
- `notify_social` (boolean, default true) - Social email notifications opt-in
- `notify_marketing` (boolean, default false) - Marketing email notifications opt-in (transactional is locked always-on, not toggleable)

**barcode_catalog table additions (Session 46)**
- `variant_name` (text, nullable) - Resolved variant label (e.g., "Cover G")
- `variant_name_source` (text, nullable) - Provenance: `catalog` / `ai` / `addon-derived`
- `variant_name_status` (text, default `'pending'`) - Admin moderation gate; only `'approved'` rows are returned by `lookupApprovedVariantName` for community use
- Migration: `supabase/migrations/20260509_variant_name_catalog_guard.sql`

**comics field surfaces (Session 46)**
- `ComicDetails.variantSource` (TS type only, not a DB column) - Surfaces "🔍 Detected from..." hint in `ComicDetailsForm.tsx`; populated by `/api/analyze` from `resolveVariant()` result

**auctions table additions (Session 38)**
- `payment_reminder_sent_at` (timestamp, nullable) - Idempotency marker for T-24h `sendPaymentReminders()` cron pass
- `payment_expired_at` (timestamp, nullable) - Set by `expireUnpaidAuctions()` when auction auto-cancels past deadline
- Partial index on `(payment_deadline) WHERE status='ended' AND payment_status='pending'` for cron scan efficiency

---

## Supabase Storage Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `cover-images` | Auto-harvested cover images from scan results (uploaded by `coverHarvest.ts`) | Public read, service-role write |
| `comic-covers` | User-uploaded scan cover images per `comics` row (uploaded by `/api/comics/upload-cover` via `src/lib/uploadCoverImage.ts`); 10MB cap, JPEG/PNG/WebP. Migration: `supabase/migrations/20260509_comic_covers_bucket.sql`. (Session 46) On comic hard-delete, `cleanupOrphanedCover()` removes the file only if no `sales`/`comics`/`comic_metadata`/`cover_images`/`key_hunt_lists`/`admin_barcode_reviews` row still references the URL (Session 51; fails safe to keep). | Public read, authenticated write |
| `message-images` | User-uploaded message attachments | Authenticated |

### Cover-Image Preservation Rule (Session 45b)

User-uploaded `comics.cover_image_url` is **only** mutated via the manual edit flow (`updateComic` in `db.ts`). API responses, cover-pipeline jobs, and refresh actions write to the shared catalog cache `comic_metadata.cover_image_url` instead. The user's per-instance photo is never silently swapped — display layers fall back to the catalog cover only when the per-comic field is empty.

---

## Key npm Dependencies (Non-obvious)

| Package | Purpose |
|---------|---------|
| `sharp` | Server-side image cropping and format conversion for cover harvest; used in `coverHarvest.ts` to crop to AI-returned coordinates before Supabase Storage upload (Session 50: `0.35.3`, with an npm override keeping Next's nested copy in sync) |
| `zod` | Runtime schema validation for 82 API routes via `src/lib/validation.ts` (Session 39) |
| `@hcaptcha/react-hcaptcha` | Invisible hCaptcha widget for guest-scan gating on scans 4 & 5 (`src/components/GuestCaptcha.tsx`) (Session 39) |
| `@clerk/nextjs` | Authentication (Session 48: `^6.39.5`) |
| `@anthropic-ai/sdk` | Claude API client — fallback vision provider + Haiku text lookups (Session 48: `^0.104.0`) |
| `dotenv` (devDependency) | Loads `.env.local` for standalone scripts/tests (added Session 48) |
| `@clerk/types` (devDependency) | Clerk type definitions for typechecking (added Session 50) |

**Removed Session 48:** `openai`, `@zxing/*`, `html5-qrcode` — no longer used (client-side barcode scanning / OpenAI dependency retired).

**Session 50:** upgraded `next` 16.1.1→16.2.11 and `sharp` 0.33.5→0.35.3; removed `@eslint/eslintrc`. npm audit reduced from 13 vulnerabilities (7 high) to one accepted dev-only brace-expansion advisory.

---

## Environment Variables

### Authentication
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`

### Database
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### AI
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY` (primary vision provider for scan resilience)

### Payments
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Email
- `RESEND_API_KEY`
- `RESEND_WAITLIST_AUDIENCE_ID`

### Caching
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Monitoring
- `SENTRY_DSN`
- `NEXT_PUBLIC_POSTHOG_KEY`

### External APIs
- `EBAY_APP_ID`
- `EBAY_CLIENT_SECRET` (eBay OAuth client secret — formerly documented as `EBAY_CERT_ID`)
- `EBAY_SANDBOX` (set to `"true"` to target eBay sandbox endpoints; defaults to production)
- ~~`COMIC_VINE_API_KEY`~~ (removed Session 45b — Comic Vine integration decommissioned alongside orphan `/api/quick-lookup` route; .env.local entry can be deleted)
- ~~`METRON_USERNAME` / `METRON_PASSWORD`~~ (removed Session 39 — Metron integration decommissioned; .env.local entries can be deleted)

### Guest Scan Protection
- `HCAPTCHA_SECRET_KEY` (server-side siteverify)
- `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` (client widget)

### Signed Tokens (Session 48)
All three are consumed by `src/lib/signedToken.ts` and **fall back to `CLERK_SECRET_KEY`** when unset:
- `GUEST_SCAN_SECRET` (signs the `cc_guest` guest-scan cookie)
- `PROMO_TRIAL_SECRET` (signs QR-exclusive promo-trial tokens)
- `UNSUBSCRIBE_SECRET` (signs one-click email unsubscribe tokens)

### Support
- `SUPPORT_EMAIL` (Session 48 — defaults to `DEFAULT_SUPPORT_EMAIL` = `support@collectors-chest.com`, now exported from client-safe `src/lib/publicConfig.ts` (Session 50); used in email footers/help copy and the seller-onboarding page)

### Stripe Price IDs
- `STRIPE_PRICE_PREMIUM_MONTHLY`
- `STRIPE_PRICE_PREMIUM_ANNUAL`
- `STRIPE_PRICE_SCAN_PACK`

### Hosting
- `NETLIFY_API_TOKEN`

### Cron
- `CRON_SECRET`

---

## Service Cost Summary

| Service | Tier | Cost | Limit |
|---------|------|------|-------|
| Netlify | Personal | $9.54/mo | Hosting + domain + DNS (billed 13th) |
| Google Gemini | Pay-per-use | ~$0.001/scan (pre-Session-51 estimate; 3.5 Flash-Lite is ~$0.30/$2.50 per M tokens, so expect higher) | Primary vision AI (Gemini 3.5 Flash-Lite) |
| Anthropic | Pay-per-use | ~$0.015/scan | Prepaid credits (fallback AI) |
| Stripe | Standard | 2.9% + $0.30 | Per transaction |
| Supabase | Free (Pro planned) | $0 ($25/mo) | 500MB (8GB Pro) |
| Clerk | Free | $0 | 10K MAU |
| Upstash | Free | $0 | 10K cmd/day |
| Resend | Free | $0 | 3K emails/mo |
| PostHog | Free | $0 | 1M events/mo |
| Sentry | Free | $0 | 5K errors/mo |
| eBay API | Free | $0 | Rate limited |

---

## Scan Resilience / Multi-Provider Fallback

The `/api/analyze` route uses a provider abstraction layer so that each of the 3 AI calls (image analysis, verification, price estimation) can independently fall back from Gemini to Anthropic when the primary provider fails.

### Architecture

```
┌────────────────────────────┐
│  src/lib/aiProvider.ts     │  Orchestrator
│  executeWithFallback()     │
└────────────┬───────────────┘
             │ iterates VISION_PROVIDER_ORDER
             v
┌────────────────────────────┐
│  src/lib/providers/        │
│  ├── types.ts (AIProvider) │  Provider Interface
│  ├── gemini.ts             │  Primary (Gemini 3.5 Flash-Lite)
│  └── anthropic.ts          │  Fallback (Claude)
└────────────────────────────┘
```

### Key Behaviors

| Behavior | Detail |
|----------|--------|
| Provider order | Gemini first, Anthropic fallback (defined in `VISION_PROVIDER_ORDER`) |
| Error classification | `classifyError()` determines retry-on-fallback vs immediate failure |
| Dynamic budget | `getRemainingBudget()` ensures all 3 calls fit within Netlify's 26s limit |
| Per-call fallback | Each of the 3 AI calls can independently fall back without affecting the others |
| Analytics tracking | `scan_analytics` records which provider handled each scan, whether fallback was used, and why |
| Client feedback | Scan page shows "taking longer than usual" message when `_meta.fallbackUsed` is true |

### Test Coverage

| Test File | Tests |
|-----------|-------|
| `src/lib/providers/__tests__/anthropic.test.ts` | Anthropic provider tests |
| `src/lib/providers/__tests__/gemini.test.ts` | Gemini provider tests |
| `src/lib/__tests__/aiProvider.test.ts` | Provider orchestrator tests |
| `src/lib/__tests__/coverHarvest.test.ts` | Cover harvest validation + orchestrator tests |

### Migration

- `supabase/migrations/20260301_scan_analytics_provider.sql` — adds `provider`, `fallback_used`, `fallback_reason` columns to `scan_analytics`
- `supabase/migrations/20260326_cover_harvest.sql` — adds `variant` column + unique index to `cover_images`; adds `cover_harvested` to `scan_analytics`; creates sentinel profile for harvest bot
- `supabase/migrations/20260422_comic_sold_tracking.sql` — `sold_at`, `sold_to_profile_id`, `sold_via_auction_id` on `comics`
- `supabase/migrations/20260422_shipping_tracking_option_a.sql` — `shipped_at`, `tracking_number`, `tracking_carrier`, `completed_at`, `ended_at` on `auctions`
- `supabase/migrations/20260423_payment_reminder_tracking.sql` — `payment_reminder_sent_at`, `payment_expired_at` on auctions + partial index (Session 38)
- `supabase/migrations/20260423_auction_audit_log.sql` — new `auction_audit_log` table + `auction_audit_event_type` enum + indexes + RLS (Session 39)
- `supabase/migrations/20260423_notification_preferences.sql` — 3 boolean columns on `profiles` (notify_marketplace/notify_social/notify_marketing) (Session 39)
- `supabase/migrations/20260423_second_chance_offers.sql` — new `second_chance_offers` table + indexes + RLS (Session 39)
- `supabase/migrations/20260423_payment_miss_tracking.sql` — 4 profile columns (payment_missed_count, payment_missed_at, bid_restricted_at) + `user_flagged` enum value + **fixes pre-existing `valid_notification_type` CHECK constraint drift** (4 notification types were being inserted without being on the allowlist: `auction_payment_expired`, `auction_payment_expired_seller`, `bid_auction_lost`, `new_bid_received`) (Session 39)
- `supabase/migrations/20260614_audit_closeout.sql` (Session 48) — `sales`: `sale_price_recorded`/`platform_fee`/`seller_net`; `profiles`: `promo_trial_eligible`/`promo_trial_used_at`/`comp_granted`/`stripe_connect_charges_enabled`/`stripe_connect_payouts_enabled` + unique index on `stripe_customer_id`; `bids`: unique one-winning-bid-per-auction partial index; new `processed_stripe_sessions` table (RLS on); new RPCs `credit_scan_pack`, `complete_trade`, `find_trade_matches` (corrected), `review_barcode`, `sum_seller_platform_fees`; supporting indexes on `comics` (user/date, for-trade normalized title+issue) and `key_hunt_lists` (normalized title+issue)

---

## Self-Healing Model Pipeline (CI/CD)

A GitHub Actions pipeline that monitors `src/lib/models.ts` and auto-updates Anthropic model IDs when they are deprecated. Runs daily at 6 AM UTC.

### Files

| Path | Purpose |
|------|---------|
| `.github/workflows/model-health-check.yml` | GitHub Actions workflow (daily schedule + manual trigger) |
| `.github/scripts/read-models.ts` | Reads `MODEL_PRIMARY` and `MODEL_LIGHTWEIGHT` from `src/lib/models.ts` via regex |
| `.github/scripts/probe-model.ts` | Sends a minimal vision API call (1x1 PNG) to verify a model is alive; outputs `healthy`, `deprecated`, or `transient` |
| `.github/scripts/discover-model.ts` | Queries Anthropic's Models API to find the newest model in the same tier (sonnet/opus/haiku) as the deprecated one. Handles minor version bumps (4.0 → 4.5 → 4.6) and legacy `claude-3-haiku` naming, prefers dated snapshots over undated aliases to match the pinning policy, and will not downgrade to older snapshots within the tier |
| `.github/scripts/update-model.ts` | Performs a targeted string replacement in `src/lib/models.ts` (old model ID to new) |
| `.github/scripts/diff-guard.ts` | Guardrail: verifies only `src/lib/models.ts` changed and at most 2 lines were modified |
| `.github/scripts/smoke-test.ts` | Post-deploy verification via `/api/admin/health-check` and site liveness check |
| `.github/scripts/send-alert.ts` | Sends email alerts via Resend (success, failure, rollback, heartbeat) |
| `.github/SECRETS_SETUP.md` | Documents required GitHub repository secrets |

### Pipeline Flow

```
Daily 6 AM UTC (or manual trigger)
         │
         v
┌──────────────────────┐
│  read-models.ts      │  Parse MODEL_PRIMARY + MODEL_LIGHTWEIGHT
└────────┬─────────────┘
         │
         v
┌──────────────────────┐
│  probe-model.ts      │  Vision API call per model
│  (x2: PRIMARY +      │  Result: healthy | deprecated | transient
│   LIGHTWEIGHT)        │
└────────┬─────────────┘
         │
    ┌────┴────┐
    │         │
 healthy   deprecated
    │         │
    v         v
 Monday    ┌──────────────────────┐
 heartbeat │  discover-model.ts   │  Query Models API for replacement
 email     └────────┬─────────────┘
                    │
                    v
           ┌──────────────────────┐
           │  update-model.ts     │  Replace model ID in models.ts
           └────────┬─────────────┘
                    │
                    v
           ┌──────────────────────┐
           │  diff-guard.ts       │  Verify only models.ts changed
           │  npm test            │  Full test suite
           └────────┬─────────────┘
                    │
                    v
           ┌──────────────────────┐
           │  git push origin     │  Triggers Netlify auto-deploy
           │  main                │
           └────────┬─────────────┘
                    │ (wait 240s)
                    v
           ┌──────────────────────┐
           │  smoke-test.ts       │  Hit /api/admin/health-check
           └────────┬─────────────┘
                    │
               ┌────┴────┐
               │         │
            pass       fail
               │         │
               v         v
           success    git revert + push
           email      rollback email
```

### Guardrails

| Guardrail | Detail |
|-----------|--------|
| File scope | Only `src/lib/models.ts` can be modified |
| Line limit | At most 2 lines changed (one per model constant) |
| Test gate | Full `npm test` must pass before commit |
| Smoke test | Production health-check + site liveness after deploy |
| Auto-rollback | `git revert` + push if smoke test fails |
| Concurrency | `cancel-in-progress` prevents overlapping runs |

### Alerting

Email alerts sent via Resend for every outcome:

| Alert Type | When |
|------------|------|
| `heartbeat` | Monday only, both models healthy |
| `success` | Model(s) auto-updated, deployed, smoke test passed |
| `rollback` | Smoke test failed, commit reverted |
| `failure` | Pipeline error, manual intervention needed |

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY` | Probe models + discover replacements |
| `RESEND_API_KEY` | Send email alerts |
| `ADMIN_EMAIL` | Alert recipient |
| `CRON_SECRET` | Authenticate smoke test against health-check endpoint |

---

## Stripe Integration (Payments & Subscriptions)

Stripe powers all payment flows: premium subscriptions, scan pack purchases, free trials, and marketplace seller payouts via Stripe Connect.

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /api/billing/checkout` | POST | Creates Stripe checkout session (subscription or scan pack) |
| `POST /api/billing/start-trial` | POST | Starts 7-day free trial |
| `GET /api/billing/status` | GET | Returns subscription tier, scan usage, trial status |
| `POST /api/webhooks/stripe` | POST | Handles Stripe webhook events (checkout.session.completed, subscription lifecycle, invoice events) |
| `POST /api/connect/create-account` | POST | Creates Stripe Connect Express account for sellers |
| `GET /api/connect/status` | GET | Gets seller payment status |
| `POST /api/connect/dashboard` | POST | Opens Stripe Express dashboard |

### Key Files

| File | Purpose |
|------|---------|
| `src/hooks/useSubscription.ts` | Client-side subscription state, checkout/trial actions |
| `src/lib/subscription.ts` | Server-side subscription logic, scan limits (`reserveScanSlot` / `releaseScanSlot`), trial management |
| `src/app/api/webhooks/stripe/route.ts` | Webhook handler for payment events |
| `src/app/api/billing/checkout/route.ts` | Checkout session creation |

### Products

| Product | Price | Type |
|---------|-------|------|
| Premium Monthly | $4.99/mo | Recurring subscription |
| Premium Annual | $49.99/yr | Recurring subscription |
| Scan Pack | $1.99 for 10 scans | One-time purchase |

### Features

- **Subscription management** — Monthly and annual premium plans with Stripe-hosted checkout
- **Scan pack purchases** — One-time scan bundles for free-tier users
- **7-day free trials** — Trial activation with automatic expiration tracking
- **Stripe Connect** — Express accounts for marketplace seller payouts

---

## Pricing Architecture

### Overview

Market pricing is powered exclusively by the **eBay Browse API** (`src/lib/ebayBrowse.ts`). Prices are based on active Buy It Now listings, filtered for outliers, with grade-aware estimates generated from a 9.4 NM baseline.

### Pricing by Entry Path

| Path | Route | eBay Called? | Price Stored? |
|------|-------|:---:|:---:|
| CSV Import | `/api/import-lookup` | No | No |
| Manual Entry | `/api/comic-lookup` | No | No |
| Cover Scan | `/api/analyze` | Yes | Yes |
| Key Hunt | `/api/con-mode-lookup` | Yes | Yes |

**CSV Import & Manual Entry** are metadata-only — they enrich publisher, writer, artist, key info via AI but do not fetch market pricing. The assumption is users know their own prices for these paths.

**Cover Scan & Key Hunt** fetch live eBay pricing as part of their flow.

### How eBay Pricing Works

1. `searchActiveListings()` queries eBay Browse API for up to 30 active Buy It Now listings
2. Search query built from: title + issue number + grade (if slabbed) + grading company
3. Category targeting: eBay category 259104 (comic books) with fallback chain
4. `filterOutliersAndCalculateMedian()` removes prices below 20% or above 300% of median
5. Requires minimum 3 listings after filtering (returns null otherwise)
6. `generateGradeEstimates()` applies multipliers from the 9.4 NM baseline (e.g., 9.8 = 2.5x, 6.0 = 0.35x)

### Price Data Structure

```typescript
priceData: {
  estimatedValue: number | null;      // Median price at detected grade
  recentSales: Array<{                // Sample of active listings
    price: number;
    date: string;
    source: "ebay";
  }>;
  mostRecentSaleDate: string | null;
  gradeEstimates: Array<{             // Prices across grade scale
    grade: number;                     // 9.4, 9.6, 9.8, etc.
    label: string;                     // "Near Mint", "Near Mint+"
    rawValue: number;                  // Price for raw comic
    slabbedValue: number;              // Price for slabbed comic
  }>;
  baseGrade: number;                   // 9.4 for raw estimates
  priceSource: "ebay";
}
```

### Caching Strategy

| Layer | TTL | Purpose |
|-------|-----|---------|
| **Redis** (eBay price) | 12 hours | Per-query cache keyed by title+issue+grade+slab status |
| **Redis** (no results) | 1 hour | "No data" marker so retries happen sooner |
| **Supabase** (`comic_metadata`) | Indefinite | Shared cache across users; only serves if `priceSource === "ebay"` |
| **Supabase** (`comics.price_data`) | Indefinite | Per-user snapshot at scan time; stale until re-scanned |
| **Redis** (AI analysis) | 30 days | Image hash → cached AI result (pricing still fetched fresh) |

### Key Files

- `src/lib/ebayBrowse.ts` — eBay Browse API client, search, price calculation
- `src/app/api/analyze/route.ts` — Cover scan route (pricing at lines ~694-765)
- `src/app/api/con-mode-lookup/route.ts` — Key Hunt route (pricing at lines ~118-143)
- `src/app/api/comic-lookup/route.ts` — Manual entry lookup (no pricing)
- `src/app/api/import-lookup/route.ts` — CSV import lookup (no pricing)

---

## Cross-Cutting Subsystems (Session 39)

### Input Validation (Zod)

All 82 API routes validate input via `src/lib/validation.ts`:

- `validateBody(request, schema)` / `validateQuery(request, schema)` / `validateParams(params, schema)` helpers
- Shared `schemas.uuid` / `email` / `url` / `trimmedString` / `positiveInt` / `nonNegativeNumber`
- Standardized error shape: `{error: "Validation failed", details: [{field, issue}]}` with HTTP 400
- `.strict()` opt-in used on `settings/*` routes to reject unknown fields
- Scope: marketplace + money (31 routes), user + social + admin (32 routes), content + scan + lookup (19 routes)

### Auction Audit Log

`auction_audit_log` table (admin-read RLS, service-role insert) captures every state transition in the auction/offer/payment/shipment lifecycle. `auction_audit_event_type` enum covers 20+ event types including `auction_created`, `bid_placed`, `auction_ended`, `payment_received`, `payment_expired`, `second_chance_sent`, `shipped`, `user_flagged`.

- Helper: `src/lib/auditLog.ts` — fire-and-forget single + batch variants
- 17 wire-ups across `src/lib/auctionDb.ts`, `src/app/api/auctions/[id]/mark-shipped/route.ts`, and `src/app/api/webhooks/stripe/route.ts`
- Enables dispute resolution + debugging queries; only admins (via RLS) can read

### Payment-Miss Strike System

Fires inside `expireUnpaidAuctions()`. Each missed payment:

1. Increments `profiles.payment_missed_count` + sets `payment_missed_at`
2. **1st offense:** sends `payment_missed_warning` email
3. **2+ strikes in a 90-day window:** sets `profiles.bid_restricted_at`, inserts a system-generated negative `transaction_feedback` row (idempotent on unique constraint), emails `payment_missed_flagged`, notifies admins via the flagged-users endpoint
4. `/api/auctions/[id]/bid` enforces `bid_restricted_at` at bid placement

### Second Chance Offer System

Seller-initiated re-offer to runner-up after an auction expires unpaid.

- Table: `second_chance_offers` — `auction_id`, `recipient_profile_id`, `offer_price`, `expires_at`, `status`
- **Price:** runner-up's *last actual bid price* (not their max_bid)
- **Window:** 48 hours, enforced by `expireSecondChanceOffers()` cron pass
- **No cascade:** if declined/ignored, the offer simply ends (does not fall to 3rd place)
- 5 new email templates + 7 new notification types
- UI: `SecondChanceOfferButton` (seller side) and `SecondChanceInboxCard` (runner-up side)

### Email Notification Preferences

4 categories toggled at `/settings/notifications`:

| Category | Toggleable | Examples |
|----------|:---:|----------|
| Transactional | No (locked) | Purchase confirmation, payment received, shipped |
| Marketplace | Yes | Outbid, new bid, offer received, listing expired |
| Social | Yes | New follower, new message, mention |
| Marketing | Yes | Newsletter, feature announcements |

`NOTIFICATION_CATEGORY_MAP` in `src/lib/notificationPreferences.ts` covers all 27 notification email types. `sendNotificationEmail` + `sendNotificationEmailsBatch` check preferences before sending; skipped sends are counted and returned to the caller.

### hCaptcha Guest Scan Protection

Invisible hCaptcha gates guest scans 4 & 5 (the last two free scans before the limit).

- Client: `src/components/GuestCaptcha.tsx` via `@hcaptcha/react-hcaptcha`, floating badge
- Server: `src/lib/hcaptcha.ts` siteverify helper, 5s timeout, dev/prod key swap
- Gating: `/api/analyze` requires a valid hCaptcha token on scans 4 & 5

### Service-Role Write Scoping (lesson from sessions 42d + 43)

Any helper that uses `supabaseAdmin` (which bypasses RLS) for an `UPDATE` / `DELETE` on a user-owned table **MUST** scope by the calling user's id explicitly. `.eq('id', rowId)` alone is IDOR. The pattern is `.eq('id', rowId)` + ownership predicate (`.eq('user_id', userId)` for single-owner tables, or `.or('user_a_id.eq.X,user_b_id.eq.X')` for tables with multiple owner columns like `trade_matches`). Helpers should return `Promise<boolean>` (was a row affected) and the calling route should **404 on miss — never 403**, to avoid existence leaks.

Affected helpers:

- `markNotificationRead` / `markAllNotificationsRead` — `notifications` table (fixed Session 42d)
- `dismissMatch` / `markMatchViewed` — `trade_matches` table (fixed Session 43; unused `markMatchTraded` removed Session 50)

---

## Recent Changes — Session 40 (2026-04-23)

Session 40 shipped as five sub-sessions (40a–40e) focused on PROD marketplace testing feedback:

- **Manual FMV refresh** — new `POST /api/comics/[id]/refresh-value` triggers an eBay Browse lookup for an owner's comic and persists `price_data` + `average_price`; honors the 12h Redis cache used by `/api/ebay-prices`.
- **Feedback flow correction** — `rating_request` notification now fires from `/api/auctions/[id]/mark-shipped` (to both buyer and seller) instead of from the Stripe webhook on payment. Server-side eligibility in `checkSaleFeedbackEligibility` requires `shipped_at`, so prompting at payment was premature. `useFeedbackEligibility` now takes a `refreshKey` arg so the client re-queries after shipment or after feedback is submitted.
- **Marketplace checkout hardening** — `/api/checkout` now guards `product_data.images[0]`: only passes a URL when it's `http(s)://` and ≤2048 chars. Catches long Supabase signed URLs and base64 `data:` URIs that were surfacing as Stripe `invalid_request_error` 500s on Buy Now.
- **Sales page display restructure** — `/sales` no longer wraps everything in a single FeatureGate. Sales list + row detail are always visible (all tiers); Cost + Profit columns and the 3 summary cards are now gated on `features.fullStats` with blur + overlay upgrade CTA. Data persistence unchanged — every user's `sales` rows carry `purchase_price + sale_price + profit`, so stats light up instantly on upgrade.
- **Outbid email enrichment** — template now renders "Your max bid: $X" when `BidActivityEmailData.yourMaxBid` is present; wired from `currentWinningBid.max_bid` at the `placeBid` call site in `auctionDb.ts`.
- **Active Bids tab 500 fix** — `/api/transactions?type=bids` was selecting `amount`, but the `bids` table column is `bid_amount`. One-char fix.
- **UX polish** — mobile auction/buy-now modal image heights capped (35vh / 40vh); Ask the Professor FAQ modal locks body scroll and closes on internal link clicks; em dashes removed site-wide (~55 replacements across 10 files in FAQ, email templates, notifications, onboarding copy, etc.).

---

## Mobile/PWA Features

| Feature | Implementation |
|---------|----------------|
| Installable | Web manifest + service worker |
| Offline Mode | Key Hunt cached lookups |
| Camera Access | Live preview + capture |
| Bottom Navigation | Auto-hide on scroll; also hides while `/collection` multi-select mode is active, signalled by the `cc:selection-mode` window `CustomEvent` (`{ active: boolean }`) — a lightweight decoupled channel from the collection page to `MobileNav` (Session 47) |
| Touch-device hover gating | `tailwind.config.ts` sets `future.hoverOnlyWhenSupported: true` so `hover:`/`group-hover:` styles only apply on hover-capable (non-touch) pointers — prevents iOS "double-tap to interact" where the first tap triggers the hover state instead of the action (Session 47) |
| Safe Areas | iOS notch handling |

**Session 45b PWA cleanup:** `public/manifest.json` no longer ships the "Quick Lookup" app shortcut, and `public/sw.js` no longer pre-caches `/api/quick-lookup` — both removed alongside the orphan route.

---

*This document is auto-generated and should be updated when major features are added.*
