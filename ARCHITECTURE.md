# Collectors Chest - System Architecture

> **Comprehensive map of pages, features, and service dependencies**

*Last Updated: April 5, 2026 — Session 31 (Cert-first scan pipeline — slab detection/extraction AI calls, certHelpers.ts, eBay pricing improvements, cert-first analytics migration, slab label color detection)*

---

## Service Legend

| Icon | Service | Purpose |
|------|---------|---------|
| 🔐 | **Clerk** | Authentication |
| 🗄️ | **Supabase** | Database (PostgreSQL) |
| 🤖 | **Anthropic/Claude** | AI analysis (primary) |
| 🤖² | **Google/Gemini** | AI analysis (primary for vision) |
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
| Hottest Books Carousel | 🗄️ 🤖 | Cached 24h, AI-generated trends |
| Guest CTA | 🔐 | "Scan Your First Book" for non-auth |

---

### Scan Page (`/scan`)

| Feature | Services | Notes |
|---------|----------|-------|
| AI Cover Recognition | 🤖 🤖² 🔴 | Multi-provider: Gemini primary, Anthropic fallback |
| Barcode Scanning | 🤖 🗄️ | Barcode catalog lookup, AI fallback |
| Price Estimation | 🏷️ 🗄️ 🔴 | eBay API → Supabase cache → Redis |
| Fallback Status | — | "Taking longer than usual" message when fallback triggers |
| CGC/CBCS Cert Lookup | Web scrape | Verifies graded comic certification |
| Cert-First Scan Pipeline | 🤖 🤖² 🗄️ 🔴 🏷️ | Slab detection → slab detail extraction → cert lookup → eBay pricing (Phases 1-5.5) |
| Slab Label Color Detection | 🤖 | AI detects CGC/CBCS label color (blue, yellow, green, etc.) from slab photo |
| Cover Validation | 🤖² 🗄️ | Gemini-powered cover image validation pipeline |
| Cover Harvest | 🤖 🗄️ | Auto-harvest cover image from scan result; crop, store in Supabase Storage (`cover-images` bucket), insert into `cover_images` with variant support |
| Key Info Lookup | 🗄️ | 402 curated key comics database |
| Suggest Key Info | 🗄️ 🔐 | Community submissions for key facts |
| Scan Limits | 💾 🗄️ | Guest 5, Free 10/mo, Pro unlimited |
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
| Sold Comics List | 💾 🗄️ | View all comics marked as sold |
| Profit/Loss Tracking | 💾 🗄️ | Purchase price vs sale price |

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
| Add to Hunt List | 🗄️ 🔐 | From Hot Books or scan results |

---

### Shop (`/shop`)

| Feature | Services | Notes |
|---------|----------|-------|
| Auction Listings | 🗄️ | eBay-style proxy bidding |
| Fixed-Price Listings | 🗄️ | Buy Now with offer support |
| For Trade Tab | 🗄️ | Browse comics marked for trade by other users |
| Search & Sort | 🗄️ | By price, ending time, bids |
| Watchlist | 🗄️ 🔐 | Track interesting auctions |

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
| Place Bid | 🗄️ 🔐 🔴 | Rate limited, proxy bidding |
| Buy It Now | 🗄️ 💰 | Instant purchase option |
| Payment Processing | 💰 🗄️ | Stripe checkout flow |
| Seller Ratings | 🗄️ 🔐 | Positive/negative reviews (part of Creator Credits system) |
| Notifications | 🗄️ | Outbid, won, sold alerts |
| Auction End Processing | 🗄️ | Cron job marks completed |

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

### Settings (`/settings/notifications`, `/settings/preferences`)

| Feature | Services | Notes |
|---------|----------|-------|
| Push Notifications Toggle | 🗄️ 🔐 | Enable/disable browser push |
| Email Notifications Toggle | 🗄️ 🔐 | Enable/disable email alerts |
| Display Preferences | 🗄️ 🔐 | Show/hide financial data (show_financials toggle) |
| Auto-save | — | Changes saved immediately on toggle |

---

### Hottest Books (`/hottest-books`)

| Feature | Services | Notes |
|---------|----------|-------|
| Trending Comics List | 🗄️ 🤖 | Database-cached, AI fallback |
| Cover Images | 🗄️ | Community DB + Open Library + manual paste |
| Market Analysis | 🤖 | Why it's hot, price trends |
| Database Caching | 🗄️ | hot_books table with seeded data |
| Price Refresh | 🏷️ 🗄️ | eBay API, 24-hour lazy refresh |
| Add to Hunt List | 🗄️ 🔐 | Track comics you want to find |

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

**Note:** Admin pages are protected by database `is_admin` check.

---

## Middleware (`src/middleware.ts`)

Clerk middleware protects specific routes requiring authentication:

| Protected Route Pattern | Notes |
|------------------------|-------|
| `/admin(.*)` | All admin pages |
| `/api/admin(.*)` | All admin API routes |
| `/api/billing(.*)` | All billing API routes |
| `/api/watchlist(.*)` | Watchlist management |
| `/api/notifications(.*)` | Notification management |
| `/api/sharing(.*)` | Collection sharing |
| `/api/key-hunt(.*)` | Hunt list management |
| `/api/auctions/:id/bid(.*)` | Placing bids |
| `/api/auctions/:id/buy-now(.*)` | Buy Now purchases |

All other routes are public (unauthenticated access allowed). Individual API routes may perform their own auth checks internally.

---

## API Routes

### AI & Recognition

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/analyze` | POST | Cover image analysis (multi-provider with fallback) + cover validation | 🤖 🤖² 🗄️ 🔴 🏷️ |
| `/api/quick-lookup` | POST | Fast barcode + pricing | 🗄️ 🤖 |
| `/api/comic-lookup` | POST | Title/issue lookup | 🤖 🗄️ 🔴 |
| `/api/con-mode-lookup` | POST | Key Hunt pricing | 🏷️ 🤖 🗄️ |
| `/api/import-lookup` | POST | CSV enrichment | 🤖 🗄️ |
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
| `/api/hottest-books` | GET | Trending comics | 🤖 🗄️ |

### Auctions & Listings

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/auctions` | GET/POST | List/create auctions | 🗄️ 🔐 |
| `/api/auctions/[id]` | GET/PATCH/DELETE | Auction management | 🗄️ 🔐 |
| `/api/auctions/[id]/bid` | POST | Place bid | 🗄️ 🔐 🔴 |
| `/api/auctions/[id]/bids` | GET | Bid history | 🗄️ |
| `/api/auctions/[id]/buy-now` | POST | Buy It Now | 🗄️ 🔐 |
| `/api/auctions/by-comic/[comicId]` | GET | Check active listing | 🗄️ |
| `/api/listings/[id]/purchase` | POST | Fixed-price purchase | 🗄️ 🔐 |

### Offers

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/offers` | GET/POST | List/create offers | 🗄️ 🔐 |
| `/api/offers/[id]` | GET/PATCH/POST | Offer management | 🗄️ 🔐 |

### Watchlist & Notifications

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/watchlist` | GET/POST/DELETE | Manage watchlist | 🗄️ 🔐 |
| `/api/notifications` | GET/PATCH | User notifications | 🗄️ 🔐 |

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
| `/api/checkout` | POST | Stripe checkout session | 💰 🗄️ 🔐 |
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
| `/api/trades/available` | GET | Get all comics marked for trade | 🗄️ |
| `/api/trades/matches` | GET | Get user's Hunt List matches | 🗄️ 🔐 |
| `/api/trades/matches` | POST | Trigger match finding | 🗄️ 🔐 |
| `/api/trades/matches/[matchId]` | PATCH | Update match (view, dismiss) | 🗄️ 🔐 |
| `/api/comics/for-trade` | GET | Get user's for-trade comics | 🗄️ 🔐 |
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
| `/api/feedback/eligibility` | GET | Check if user can leave feedback | 🗄️ 🔐 |
| `/api/feedback/[id]` | GET/PATCH | Get/update feedback | 🗄️ 🔐 |
| `/api/feedback/[id]/respond` | POST | Seller responds to feedback | 🗄️ 🔐 |

### Comics Management

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/comics/[id]` | GET/PATCH/DELETE | Comic CRUD | 🗄️ 🔐 |
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

### User & Profile

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/username` | GET/POST/PATCH | Username management | 🗄️ 🔐 |
| `/api/username/current` | GET | Get current user's username | 🗄️ 🔐 |
| `/api/key-info/submit` | POST | Submit key info suggestion | 🗄️ 🔐 |
| `/api/email-capture` | POST | Guest email for bonus scans | 📧 🗄️ |
| `/api/email-capture/verify` | POST | Verify email capture token | 📧 🗄️ |

### Utility

| Route | Method | Purpose | Services |
|-------|--------|---------|----------|
| `/api/waitlist` | POST | Email capture | 📧 |
| `/api/test-email` | GET | Dev email testing | 📧 |
| `/api/email-preview` | GET | Dev-only email template preview | 📧 |

---

## Webhooks

| Route | Trigger | Purpose | Services |
|-------|---------|---------|----------|
| `/api/webhooks/clerk` | User deleted | Cascade delete user data | 🔐 🗄️ |
| `/api/webhooks/stripe` | Payment events | Auction payments, subscriptions | 💰 🗄️ |

**Stripe webhook — subscription handling notes:**
- `customer.subscription.updated` / `customer.subscription.created`: writes `trial_start` and `trial_end` directly from `subscription.trial_start` / `subscription.trial_end` (bypasses `startTrial()` helper so promo trials aren't double-applied)
- `invoice.payment_succeeded`: $0 invoice guard — if `invoice.amount_paid === 0` and the subscription status is `trialing`, skips `upgradeToPremium()` to prevent overwriting the trialing status with active
- `upgradeToPremium()` accepts an optional `isTrialing` param; when true, sets `subscription_status: 'trialing'` instead of `'active'`

---

## Cron Jobs & Scheduled Functions

| Route/Function | Schedule | Purpose | Services |
|----------------|----------|---------|----------|
| `/api/cron/process-auctions` | Every 5 min | End auctions, expire offers/listings | 🗄️ |
| `/api/cron/reset-scans` | Monthly | Reset free tier scan counts | 🗄️ |
| `/api/cron/moderate-messages` | Nightly | AI moderation of flagged messages | 🗄️ 🤖 |
| `/api/cron/send-feedback-reminders` | Periodic | Remind users to leave transaction feedback | 🗄️ 📧 |
| `check-usage-alerts` (Netlify) | Daily | Monitor service limits, send alerts | 🗄️ 📧 |

**Automation Logic:**
- Auctions: Mark as `closed` or `sold` when end time passes
- Offers: Expire after 48 hours if no response
- Listings: Expire after 30 days
- Scans: Reset monthly counts on 1st of month
- Alerts: Email admin when approaching service limits
- Message Moderation: Claude analyzes flagged messages, auto-creates reports with 1-10 priority

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
       │ Cover Harvest │  coverHarvestable? → crop with sharp
       │ (async, no-op │  → upload to cover-images bucket
       │  on dup/fail) │  → insert cover_images row w/ variant
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
│  Phase 1: Slab Detection │  executeSlabDetection()
│  "Is this a slabbed      │  Gemini → Anthropic fallback
│   comic?"                │
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

### Auction Purchase Flow

```
┌──────────────────┐
│  Buyer clicks    │
│  Buy Now         │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  Clerk Auth      │
│  Verify User     │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  Create Stripe   │
│  Checkout        │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  User Pays       │
│  on Stripe       │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  Stripe Webhook  │
│  Fires           │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  Update Auction  │
│  Status (Paid)   │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│  Create          │
│  Notifications   │
│  (Buyer/Seller)  │
└──────────────────┘
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
| `useFeedbackEligibility` | Check if user can leave feedback on a transaction | 🗄️ 🔐 |

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
| `src/components/MobileNav.tsx` | Broadcast subscriptions for message badge updates |
| `src/components/creatorCredits/` | Creator Credits UI (CreatorBadge, FeedbackList, FeedbackModal, LeaveFeedbackButton, SellerResponseForm) |
| `src/components/CoverReviewQueue.tsx` | Admin cover image contribution review |
| `src/components/follows/` | Follow system UI (FollowButton, FollowerCount, FollowListModal) |
| `src/components/collection/` | Bulk actions UI (SelectionToolbar, SelectionCheckbox, SelectionHeader, BulkDeleteModal, BulkListPickerModal, UndoToast) |
| `src/components/trading/` | Trading UI (TradeCard, TradeProposalModal, TradeableComicCard) |
| `src/components/auction/` | Auction/listing UI (AuctionCard, AuctionCountdown, AuctionDetailModal, BidForm, BidHistory, CreateAuctionModal, CreateListingModal, ListingCard, ListingDetailModal, ListInShopModal, MakeOfferModal, OfferResponseModal, PaymentButton, PremiumSellerUpsell, SellerBadge, WatchlistButton) |
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
| `src/lib/tradingDb.ts` | Trading system DB helpers (trades, matches) |
| `src/lib/auctionDb.ts` | Auction/listing DB helpers |
| `src/lib/keyComicsDb.ts` | Key comics database management helpers |
| `src/lib/stripeConnect.ts` | Stripe Connect account helpers |
| `src/lib/ageVerification.ts` | Age verification helpers |
| `src/lib/bulkActions.ts` | Bulk collection action helpers |
| `src/lib/certHelpers.ts` | Cert/slab helpers — `normalizeGradingCompany()`, `parseKeyComments()`, `mergeKeyComments()`, `parseArtComments()` |
| `src/lib/metadataCache.ts` | Comic metadata caching helpers; `hasCompleteSlabData()` checks if cached metadata has full slab details |
| `src/lib/contentFilter.ts` | Message content filtering (phone/email detection) |
| `src/lib/adminAuth.ts` | Admin authentication helpers |
| `src/lib/db.ts` | Core database helper functions |
| `src/lib/promoTrial.ts` | localStorage helpers for promo trial flag — `setPromoTrialFlag()`, `getPromoTrialFlag()`, `clearPromoTrialFlag()`; timestamp-based 7-day expiration |
| `src/lib/alertBadgeHelpers.ts` | Admin alert badge helpers |
| `src/lib/aiProvider.ts` | Fallback orchestrator: getProviders(), classifyError(), getRemainingBudget(), executeWithFallback(), executeSlabDetection(), executeSlabDetailExtraction() |
| `src/lib/providers/types.ts` | Provider interface + shared types (AIProvider, CallResult, ScanResponseMeta, SlabDetectionResult, SlabDetailExtractionResult); AICallType includes `slabDetection`/`slabDetailExtraction`; `coverHarvestable` flag and `coverCropCoordinates` in result shape |
| `src/lib/providers/gemini.ts` | GeminiProvider class — primary vision provider (Gemini 2.0 Flash); `detectSlab()`, `extractSlabDetails()` methods; `maxOutputTokens` increased for harvest prompt |
| `src/lib/providers/anthropic.ts` | AnthropicProvider class — fallback provider (Claude); `detectSlab()`, `extractSlabDetails()` methods; new prompts: SLAB_DETECTION_PROMPT, SLAB_DETAIL_EXTRACTION_PROMPT, SLAB_COVER_HARVEST_ONLY_PROMPT; AI prompt includes `coverHarvestable` + `coverCropCoordinates` |
| `src/lib/models.ts` | AI model constants incl. GEMINI_PRIMARY, MODEL_PRIMARY, MODEL_LIGHTWEIGHT, VISION_PROVIDER_ORDER |
| `src/lib/analyticsServer.ts` | Server-side analytics helpers (provider-aware cost estimation via PROVIDER_COSTS lookup); ScanPath type, `scan_path` and `barcode_extracted` fields; `cover_harvested` boolean field |
| `src/lib/coverValidation.ts` | Gemini-powered cover image validation pipeline |
| `src/lib/metronVerify.ts` | Metron API verification for comic metadata |
| `src/lib/choosePlanHelpers.ts` | Choose plan page helpers |
| `src/lib/imageOptimization.ts` | Client-side image compression utilities |
| `src/lib/scanAnalyticsHelpers.ts` | Scan analytics tracking helpers |
| `src/lib/normalizeTitle.ts` | Comic title normalization utilities |
| `src/lib/keyComicsDatabase.ts` | Key comics database management |
| `src/lib/keyInfoHelpers.ts` | Key info display and formatting helpers |
| `src/lib/offlineCache.ts` | Offline caching utilities for Key Hunt |
| `src/lib/emailValidation.ts` | Email validation helpers |
| `src/lib/hotBooksData.ts` | Hot books data seeding and management |
| `src/lib/comicFacts.ts` | Random comic facts for UI display |
| `src/lib/certLookup.ts` | CGC/CBCS certificate lookup logic |
| `src/lib/ebayBrowse.ts` | eBay Browse API integration; `filterIrrelevantListings()` removes non-comic listings; `buildSearchKeywords()` accepts year param for disambiguation; `filterOutliersAndCalculateMedian()` uses Q1 for conservative pricing; grade filtering for slabbed results |
| `src/lib/gradePrice.ts` | Grade-based price calculation logic |
| `src/lib/csvExport.ts` | CSV export generation |
| `src/lib/csvHelpers.ts` | CSV parsing and import helpers |
| `src/lib/email.ts` | Email sending via Resend |
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
| `hot_books` | Cached trending/hot comics |
| `hot_books_history` | Historical hot books data |
| `hot_books_refresh_log` | Hot books refresh tracking |
| `key_hunt_lists` | User hunt/wish lists |
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

**profiles table additions**
- `show_financials` (boolean) - User preference to show/hide financial data in collection

---

## Supabase Storage Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `cover-images` | Auto-harvested cover images from scan results (uploaded by `coverHarvest.ts`) | Public read, service-role write |
| `message-images` | User-uploaded message attachments | Authenticated |

---

## Key npm Dependencies (Non-obvious)

| Package | Purpose |
|---------|---------|
| `sharp` | Server-side image cropping and format conversion for cover harvest; used in `coverHarvest.ts` to crop to AI-returned coordinates before Supabase Storage upload |

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
- `COMIC_VINE_API_KEY` (legacy - used in barcode fallback)
- `EBAY_APP_ID`
- `EBAY_CERT_ID`
- `METRON_USERNAME`
- `METRON_PASSWORD`

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
| Netlify | Personal | $9/mo | 1000 build min |
| Google Gemini | Pay-per-use | ~$0.001/scan | Primary vision AI (Gemini 2.0 Flash) |
| Anthropic | Pay-per-use | ~$0.015/scan | Prepaid credits (fallback AI) |
| Stripe | Standard | 2.9% + $0.30 | Per transaction |
| Supabase | Free (Pro planned) | $0 ($25/mo) | 500MB (8GB Pro) |
| Clerk | Free | $0 | 10K MAU |
| Upstash | Free | $0 | 10K cmd/day |
| Resend | Free | $0 | 3K emails/mo |
| PostHog | Free | $0 | 1M events/mo |
| Sentry | Free | $0 | 5K errors/mo |
| eBay API | Free | $0 | Rate limited |
| Comic Vine | Free | $0 | Barcode fallback in analyze, quick-lookup, con-mode-lookup |
| Metron | Free | $0 | Comic metadata verification |

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
│  ├── gemini.ts             │  Primary (Gemini 2.0 Flash)
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

---

## Self-Healing Model Pipeline (CI/CD)

A GitHub Actions pipeline that monitors `src/lib/models.ts` and auto-updates Anthropic model IDs when they are deprecated. Runs daily at 6 AM UTC.

### Files

| Path | Purpose |
|------|---------|
| `.github/workflows/model-health-check.yml` | GitHub Actions workflow (daily schedule + manual trigger) |
| `.github/scripts/read-models.ts` | Reads `MODEL_PRIMARY` and `MODEL_LIGHTWEIGHT` from `src/lib/models.ts` via regex |
| `.github/scripts/probe-model.ts` | Sends a minimal vision API call (1x1 PNG) to verify a model is alive; outputs `healthy`, `deprecated`, or `transient` |
| `.github/scripts/discover-model.ts` | Queries Anthropic's Models API to find the newest model in the same family as the deprecated one |
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
| `src/lib/subscription.ts` | Server-side subscription logic, scan limits, trial management |
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

## Mobile/PWA Features

| Feature | Implementation |
|---------|----------------|
| Installable | Web manifest + service worker |
| Offline Mode | Key Hunt cached lookups |
| Camera Access | Live preview + capture |
| Bottom Navigation | Auto-hide on scroll |
| Safe Areas | iOS notch handling |

---

*This document is auto-generated and should be updated when major features are added.*
