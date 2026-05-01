# Collectors Chest - Test Cases

A guide for testing the main and secondary features of the application.

---

## Getting Started

**Test URL:** [Your Netlify URL]

**Test Accounts:**
- Guest (no account required)
- Registered user (create via Sign Up or use Google/Apple login)

---

## Primary Features

### 1. AI-Powered Comic Scanning

**Location:** Home → "Scan Your First Book" / "Scan a Book"

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Upload comic cover photo | Click upload area → Select comic cover image | AI analyzes and identifies title, issue #, publisher, creators, key info |
| Mobile camera capture | On mobile, tap upload → Use camera | Camera opens, photo captured and analyzed |
| Review detected details | After scan completes | Form shows detected details with confidence indicator |
| Edit detected details | Modify any field in the form | Changes save correctly |
| Fun facts during scan | Upload image and wait | Rotating comic facts display while analyzing |

### 2. Collection Management

**Location:** Navigation → "Collection"

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View collection | Navigate to Collection page | All saved comics display in grid or list view |
| Toggle grid/list view | Click view toggle buttons | View switches between grid cards and list rows |
| Search collection | Type in search box | Results filter by title, issue, publisher |
| Filter by publisher | Select publisher from dropdown | Only comics from that publisher show |
| Filter by title | Select title from dropdown | Only comics with that title show |
| Filter by list | Select list from dropdown | Only comics in that list show |
| Sort collection | Change sort dropdown | Comics reorder by date/title/value/issue |
| Star a comic | Click star icon on comic card | Comic marked as starred, filter works |

### 2a. Bulk Actions (Multi-Select)

**Location:** Collection → "Select" button in header

#### Selection Mode Entry/Exit

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Enter selection mode | Click "Select" button in header | Checkboxes appear on all comics, selection header appears, bottom toolbar slides up |
| Exit via Cancel | In selection mode → Click "Cancel" | Selection mode exits, checkboxes/toolbar disappear |
| Exit via action | Perform any bulk action | Selection mode exits after action completes |

#### Selection Behavior

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Select single comic | In selection mode → Tap comic card | Checkbox toggles, card shows yellow ring highlight |
| Select via checkbox | Tap checkbox directly | Comic selected/deselected |
| Selection count | Select multiple comics | Header shows "X SELECTED" count updating in real-time |
| Select All | Click "Select All" button | All visible comics selected |
| Clear selection | Click "Clear" button | All comics deselected |
| Select All toggle | With all selected → Click "Select All" | Button shows "ALL SELECTED" state |

#### Bulk Delete

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Delete < 10 comics | Select 1-9 comics → Tap "Delete" | Comics deleted immediately, undo toast appears |
| Delete 10+ comics | Select 10+ comics → Tap "Delete" | Confirmation modal appears first |
| Confirmation modal content | Trigger modal with 10+ comics | Shows first 5 titles + "...and X more" count |
| Confirm delete | In modal → Click "Delete" | Comics deleted, undo toast appears |
| Cancel delete | In modal → Click "Cancel" | Modal closes, no deletion |

#### Undo Toast

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Toast appears | Complete bulk delete | Toast shows "X comics deleted" with UNDO button |
| Progress countdown | Watch toast | 10-second progress bar counts down |
| Undo action | Click "UNDO" before timer expires | Comics restored, toast disappears |
| Toast auto-dismiss | Wait 10 seconds | Toast disappears, delete is permanent |

#### Bulk Mark for Trade

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Mark for trade | Select comics → Tap "Trade" | Comics' for_trade status set to true |
| Toggle trade status | Select already-for-trade comics → Tap "Trade" | Status toggles (implementation dependent) |

#### Bulk Add to List

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Open list picker | Select comics → Tap "Add to List" | List picker modal opens |
| Modal shows lists | View modal | All user lists displayed (except "collection") |
| Select existing list | Click a list name | Comics added to list, selection clears |
| Create new list | Click "Create New List" → Enter name → Create | New list created, comics added |
| Skip duplicates | Add comics already in list | Shows added/skipped counts |

#### Bulk Mark as Sold

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Mark as sold | Select comics → Tap "Sold" | Comics' is_sold status set to true, sold_at timestamp set |

#### Mobile Responsiveness

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Toolbar on mobile | View on mobile viewport | Toolbar buttons show icons only (no text labels) |
| Touch targets | Tap buttons on mobile | All buttons have adequate touch target size (44px+) |
| Content not obscured | Scroll collection in selection mode | Bottom padding prevents toolbar from hiding content |

### 3. Comic Details & Editing

**Location:** Collection → Click any comic

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View comic details | Click comic in collection | Detail modal opens with all info |
| View cover lightbox | Click cover image in modal | Full-screen lightbox opens |
| Close lightbox | Click X or outside image | Lightbox closes |
| Edit comic details | Click "Edit Details" → Modify → Save | Changes persist |
| View variants | If "View Variants (X)" link shows, click it | Variants modal opens showing all variants of same title/issue |
| Search variants | In variants modal, type in search | Filters variants by name |

### 4. User Authentication (Private Beta Mode)

**Location:** Navigation → "Sign In" / "Join Waitlist"

**Note:** Public registration is currently DISABLED. Sign-up page shows waitlist form.

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Waitlist signup | Click "Join Waitlist" → Enter email | Success message "You're on the list!", email added to Resend audience |
| Waitlist duplicate | Enter same email twice | Shows "Already on waitlist" message |
| Waitlist invalid email | Enter invalid email format | Shows validation error |
| Sign in (existing user) | Click Sign In → Enter credentials | Logged in, see user avatar in nav |
| Sign out | Click avatar → Sign Out | Logged out, returned to guest state |
| View profile | Click avatar → "Manage Account" | Profile page opens |
| Guest limit banner | As guest, hit scan limit | Banner shows "Join Waitlist" instead of "Create Account" |

#### Password Reset Flow (Clerk-powered)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Request password reset | Sign In → "Forgot password?" → Enter email | "Check your email" confirmation message |
| Reset email received | Check inbox after requesting reset | Email from Clerk with reset link arrives |
| Invalid email for reset | Enter non-existent email → Request reset | Generic success message (no user enumeration) |
| Reset link works | Click link in reset email | Redirected to password reset page |
| Set new password | Enter new password → Confirm → Submit | Success message, redirected to sign in |
| Password requirements | Enter weak password (e.g., "123") | Error showing password requirements |
| Login with new password | Sign in with new password | Successfully logged in |
| Old password rejected | Try to sign in with old password | Authentication fails |
| Expired reset link | Click reset link after 24+ hours | Error: "Link expired, request a new one" |
| New device sign-in email | Sign in from a new device or browser | Clerk sends "new device" notification email | Pending |
| New device email content | Open new device email | Shows device/browser info, location, and timestamp | Pending |

### 5. Guest vs Registered Experience

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Guest home page | Visit home while logged out | See "Scan Your First Book", "How It Works" section, no "View Collection" button |
| Guest scan limit (initial) | As guest, use 5 scans | After 5 scans, email capture modal appears offering 5 bonus scans |
| Guest bonus scans | Verify email for bonus scans | 5 additional scans granted (10 total possible) |
| Guest final limit | Use all 10 scans (5 initial + 5 bonus) | Sign-up prompt, no more bonus option available |
| Registered home page | Log in → Visit home | See "Scan a Book", "View Collection" button, no "How It Works" |
| Guest collection | Visit /collection while logged out | Empty collection, prompt to sign up |

---

## Secondary Features

### 6. Custom Lists

**Location:** Collection → Comic Detail → "Add to List"

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Add to existing list | Click "Add to List" → Select list | Comic added, success toast shows |
| Create new list | Click "Add to List" → "Create New" → Enter name | New list created, comic added |
| Remove from list | Click "Add to List" → Click checkmark on list | Comic removed from that list |
| Slabbed auto-list | Add comic marked as "Professionally Graded" | Automatically added to "Slabbed" list |

### 7. Legal Pages

**Location:** Footer links or direct URLs

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View Privacy Policy | Click "Privacy Policy" in footer or visit /privacy | Privacy Policy page loads with all sections |
| View Terms of Service | Click "Terms of Service" in footer or visit /terms | Terms of Service page loads with all sections |
| Navigate back from Privacy | On Privacy page, click "Back to Home" | Returns to homepage |
| Navigate back from Terms | On Terms page, click "Back to Home" | Returns to homepage |
| Cross-link between legal pages | On Privacy page, click "Terms of Service" in footer | Navigates to Terms page |
| Cross-link between legal pages | On Terms page, click "Privacy Policy" in footer | Navigates to Privacy page |

### 8. Mark as Sold

**Location:** Collection → Comic Detail → "Mark as Sold"

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Mark any comic sold | Open ANY comic (not just "For Sale") → Click "Mark as Sold" | Sale modal appears with price input |
| Mark comic sold | Click "Mark as Sold" → Enter price → Confirm | Comic moved to sales history, removed from collection |
| Profit/loss display | Enter sale price → View confirmation | Shows profit or loss vs purchase price |
| Comic with no purchase price | Mark sold a comic without purchase price | Sale records, profit shown as full sale price |
| View sales stats | Check home page stats | Sales count, revenue, profit updated |

### 8a. Sales History Page

**Location:** Collection → "Sales" button, or direct via `/sales`

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Navigate to sales | Collection → Click "Sales" button | Sales History page opens |
| View sales summary | On Sales page | Shows total sales, total profit, average profit cards |
| Empty sales state | New user with no sales | Shows "No sales yet" message with guidance |
| View sales table | With recorded sales | Table shows comic, cost, sale price, profit, date |
| Mobile detail expansion | On mobile, tap a sale row | Additional details expand below |
| Profit color coding | View profit column | Green for profit, red for loss |
| Cover images display | View sales table | Comic cover thumbnails display correctly |
| Sort by date | Sales should be ordered | Most recent sales appear first |

### 8b. Platform Sales Auto-Recording

**Location:** Shop → Complete a purchase (Stripe checkout)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Auction win payment | Win auction → Complete Stripe payment | Sale recorded to seller's sales history |
| Fixed-price purchase | Buy Now → Complete Stripe payment | Sale recorded to seller's sales history |
| Accepted offer payment | Offer accepted → Complete payment | Sale recorded to seller's sales history |
| Seller sees sale in history | After buyer completes payment | Seller can view sale at /sales with correct price/profit |
| Comic info preserved | Complete platform sale | Sales record shows comic title, issue, variant, cover image |
| Purchase price tracked | Comic had purchase price set | Profit calculated correctly (sale price - purchase price) |

### 9. Professor's Hottest Books

**Location:** Home → Orange "Professor's Hottest Books" banner

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View hottest books | Click banner | Page shows top 10 trending comics |
| View book details | Review each entry | Shows title, key facts, price ranges, cover image |
| Back navigation | Click back button | Returns to home page |

### 10. Ask the Professor (FAQ)

**Location:** Floating brain icon (bottom-right corner)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Open FAQ | Click brain icon | FAQ modal opens |
| Expand question | Click any question | Answer expands below |
| Collapse question | Click expanded question | Answer collapses |
| Close FAQ | Click X or outside modal | Modal closes |

### 11. CSV Import (Desktop Only, Registered Users)

**Location:** Scan page → "Import CSV" button

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Download template | Click "Download sample CSV template" | CSV file downloads |
| Upload CSV | Click upload area → Select CSV file | File parsed, preview shows |
| Preview import | Review preview table | Shows title, issue (publisher/year on desktop) |
| Import comics | Click "Import X Comics" | Progress bar shows, comics import with price lookups |
| Import complete | Wait for completion | Success message, redirected to collection |
| Mobile CSV import | View scan page on mobile | Import CSV button visible and functional ✅ |
| Not visible for guests | View scan page while logged out | Import CSV button hidden |

### 12. Alternative Add Methods

**Location:** Scan page → "Other ways to add your books"

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Manual entry | Click "Enter Manually" | Empty form opens for manual data entry |

### 13. Price Estimates & Key Info

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View estimated value | Check comic detail modal | Shows estimated value |
| View key info | Check comic detail modal | Shows key facts (first appearances, etc.) |
| Profit/loss tracking | Add purchase price to comic | Home page shows profit/loss calculation |
| View grade breakdown | Click "Value By Grade" in comic details | Expandable table shows prices for 6 grades (9.8 to 2.0) |
| Raw vs slabbed prices | View grade breakdown | Shows both raw and slabbed values per grade |

### 13a. eBay Price Integration

**Price data now comes from eBay sold listings when available, with AI fallback.**

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| eBay price lookup | Scan a popular comic (e.g., Amazing Spider-Man #300) | Console shows "[ebay-finding] Searching for..." and returns price data |
| eBay source indicator | View price on comic with eBay data | Should show "eBay Data" badge or similar indicator |
| AI fallback | Scan an obscure comic with no eBay sales | Console shows "Falling back to AI price estimates", price shows with AI warning |
| AI price warning | View price from AI fallback | Yellow/orange alert: "Price estimate based on AI - may not reflect current market" |
| For Sale Now link | View Key Hunt result | "For Sale Now on eBay" button opens eBay search |
| Key Hunt eBay first | Use Key Hunt to look up a comic | eBay data attempted first, AI fallback if no results |
| Add Book eBay first | Use Add Book to scan a comic | eBay data attempted first, AI fallback if no results |

**Debugging eBay Issues:**
- Check browser console for `[ebay-finding]` log messages
- Verify `EBAY_APP_ID` is set in `.env.local`
- Ensure `EBAY_SANDBOX` is NOT set (or set to "false") for production
- Check that comic has title AND issue number (required for price lookup)

### 14. Key Hunt (Mobile Quick Lookup)

**Location:** Mobile → Key Hunt icon in bottom nav, or direct via `/key-hunt`

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Open Key Hunt | Tap Key Hunt in mobile nav | Bottom sheet opens with 2 entry options |
| Scan cover | Select "Scan Cover" → Take photo | AI identifies comic, grade selector appears for raw |
| Manual entry | Select "Manual Entry" | Title autocomplete + issue number + grade fields |
| Grade selection (raw) | Complete lookup for raw comic | Grade picker shows 6 options (9.8 to 2.0) |
| Slabbed detection | Scan cover of slabbed comic | Auto-detects grade from CGC/CBCS label |
| Price result | Complete any lookup | Shows average price and most recent sale |
| Recent sale highlighting | View result with recent sale | Red = market cooling (20%+ above avg), Green = deal (20%+ below) |
| Add to collection | Tap "Add to Collection" on result | Comic added, confirmation shown |
| New lookup | Tap "New Lookup" | Returns to entry selection |

### 15. Title Autocomplete & Auto-Refresh

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Title autocomplete | Type partial title (e.g., "Spider") | Suggestions appear containing search term |
| Contains-search | Type "Spider" | Shows "Amazing Spider-Man", "Spider-Woman", etc. (not just prefix matches) |
| Clear stale suggestions | Type "Batman" → clear → type "Spider" | Only Spider results show, no Batman |
| Auto-refresh on change | Enter "Hulk 181" → change to "180" | Details automatically refresh for issue 180 |
| Preserve user data on refresh | Enter notes/price → change issue | Notes and purchase price preserved, comic details updated |

### 16. Database Caching (Performance)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| First lookup (cache miss) | Look up a comic never searched before | Takes 1-2 seconds (AI lookup), console shows "Database miss" |
| Repeat lookup (cache hit) | Look up same comic again | Near-instant response (~50ms), console shows "Database hit" |
| CSV import seeds database | Import CSV with new comics → search one | Second search is fast (database hit) |

### 16a. Redis Caching (Phase 2-4 Optimizations)

**Location:** Various API endpoints - verify via browser console or network tab

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Title autocomplete cache | Type "Spider" in title field → Clear → Type "Spider" again | Second request returns faster (Redis hit) |
| Cert lookup cache | Look up same CGC cert number twice | Second lookup returns instantly (1-year cache) |
| Profile cache | Make multiple API calls as logged-in user | Profile fetched once, cached 5 minutes |
| AI image cache | Scan exact same image twice | Second scan skips AI call (30-day cache) |
| eBay price cache | View price for same comic twice | Second view uses cached price (24-hour cache) |

**Debugging Redis Cache:**
- Check browser Network tab for response times
- First requests: 500-2000ms (API/AI call)
- Cached requests: 50-200ms (Redis hit)
- Verify `UPSTASH_REDIS_REST_URL` is set in environment

### 16b. Hot Books ISR (Incremental Static Regeneration)

**Location:** `/hottest-books` page

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Initial page load | Navigate to /hottest-books | Page loads instantly (pre-rendered) |
| Server-rendered content | View page source | Hot books data present in HTML |
| Hourly revalidation | Check build output | Shows "1h" revalidate interval |
| Book selection | Click on different books | Detail panel updates client-side |
| Navigation | Use prev/next buttons or swipe | Navigates between books smoothly |

### 17. Auctions

**Location:** Navigation → "Shop" → Auctions tab, or "My Auctions"

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View active auctions | Navigate to Shop → Auctions tab | List of active auctions displays with current bid, time remaining |
| View auction details | Click on any auction | Detail page shows comic info, bid history, current bid, time left |
| Place a bid | Enter bid amount → Click "Place Bid" | Bid accepted, shown as current high bid (proxy bidding applies) |
| Bid too low | Enter bid below current + increment | Error message: "Bid must be at least $X" |
| Outbid notification | Get outbid by another user | Notification appears in bell icon |
| Watch auction | Click "Watch" button on auction | Auction added to watchlist |
| View watchlist | Navigate to Watchlist page | Shows all watched auctions with status |
| Create auction | My Auctions → "Create Auction" → Fill form | Auction created, appears in Shop |
| Set reserve price | When creating, set reserve price | Auction shows "Reserve not met" until bid exceeds reserve |
| Set Buy Now price | When creating, set Buy Now price | "Buy Now" button appears on auction |
| End auction (seller) | My Auctions → End auction early | Auction ends, highest bidder wins (if reserve met) |
| Auction timer | Watch auction with < 1 hour remaining | Timer shows minutes/seconds, updates live |

### 17a. Auction & Listing Cancellation Policy

**Location:** My Auctions → Manage listing

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Cancel auction without bids | Create auction → Cancel before any bids | Auction cancelled successfully |
| Cannot cancel auction with bids | Create auction → Receive bid → Try to cancel | Error: "Cannot cancel auction with bids" |
| Cancel fixed-price listing | Create fixed-price listing → Cancel | Listing cancelled successfully |
| Cancel listing with pending offers | Create fixed-price → Receive offer → Cancel | Listing cancelled, offer-maker notified |
| Offer-maker notification | Have pending offer → Seller cancels listing | Receive "listing_cancelled" notification |
| Offer auto-rejected on cancel | Have pending offer → Seller cancels | Offer status changes to "auto_rejected" |
| Duplicate listing prevented | List comic → Try to list same comic again | Error: "This comic already has an active listing" |
| Can relist after cancel | List comic → Cancel → List again | Second listing created successfully |
| Can relist after sold | Sell comic → Try to list again | N/A - comic removed from collection |

### 18. Buy Now (Fixed-Price Listings)

**Location:** Navigation → "Shop" → Buy Now tab

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View Buy Now listings | Navigate to Shop → Buy Now tab | List of fixed-price listings displays |
| View listing details | Click on any listing | Detail page shows comic info, price, seller info |
| Purchase item | Click "Buy Now" → Confirm | Stripe checkout opens |
| Complete purchase | Complete Stripe payment | Success page, item removed from shop |
| Seller receives notification | After purchase completes | Seller gets notification of sale |
| List from collection | Collection → Comic → "List in Shop" | Modal opens, can create fixed-price listing |
| View active listing | Collection → Comic with active listing | Button shows "View Listing" instead of "List in Shop" |
| Seller name displays | View any listing | Seller name shows (username or email prefix, not just "Seller") |
| Listing image sizing | View listing with large cover image | Image constrained to modal, not oversized |
| Bid input visible | View auction → Bid form | Bid amount input text is dark/visible (not white) |

### 18a. Stripe Connect Seller Onboarding (Added Apr 21, 2026 - Session 36)

**Location:** Settings → Seller Payments, or Shop → Create Listing gate

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| New seller clicks "Set up seller payments" | Signed-in user without Connect account → click CTA | Redirects to Stripe Express hosted onboarding page | Test mode: ✅ Apr 21, 2026 |
| Complete Express onboarding (test) | Use `address_full_match`, SSN `0000`, bank `110000000/000123456789` | Redirects to `/api/connect/onboarding-return?account_id=...` → success page | Test mode: ✅ Apr 21, 2026 |
| Complete Express onboarding (live) | Use real legal name, real SSN last-4, real bank info | Redirects back to app, profile shows "Payment setup complete" | Live: ⏳ Pending real-money test |
| DB state after onboarding | Check `profiles.stripe_connect_account_id`, `profiles.stripe_connect_onboarding_complete` | Both fields populated; `onboarding_complete = true` | Test mode: ✅ Apr 21, 2026 |
| Express Dashboard access | After onboarding, click "View Payout Dashboard" | Opens Stripe Express dashboard for seller's connected account | Test mode: ✅ Apr 21, 2026 |
| Listing gate enforcement | User without Connect tries to create listing | UI blocks with "Set up seller payments" prompt | Pending |
| Onboarding resume (abandoned) | Start onboarding, close tab before completing | Return to app, status shows incomplete, can click again to resume | Pending |

### 18b. Marketplace Payment Flow (Added Apr 21, 2026 - Session 36)

**Location:** Shop → Listing modal → "Pay $X" button (post-claim or post-auction-win)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Buy Now: claim reserves listing | Buyer clicks "Buy Now" on fixed-price listing | Listing status=sold, payment_status=pending, buyer notified "Purchase reserved" | Test mode: ✅ Apr 21, 2026 |
| Buy Now: Payment UI appears | Buyer returns to listing (or stays on modal) | Amber "Payment required to complete your purchase" banner + green "Pay $X" button render | Test mode: ✅ Apr 21, 2026 |
| Auction: winner Payment UI | Auction ends → winner visits `/shop?listing=<id>&tab=auctions` | Amber "You won! Complete payment to finalize your purchase" + "Pay $X" button | Test mode: ✅ Apr 21, 2026 |
| Click "Pay $X" → Stripe Checkout | Buyer clicks Pay button | Redirects to Stripe hosted Checkout with correct total (bid + shipping) | Test mode: ✅ Apr 21, 2026 |
| Complete payment | Test card `4242 4242 4242 4242` | Success redirect to `/collection?purchase=success&auction=<id>` | Test mode: ✅ Apr 21, 2026 |
| Webhook: checkout.session.completed | Watch `stripe listen` terminal | Event fires, 200 OK response from local webhook handler | Test mode: ✅ Apr 21, 2026 |
| Webhook: transfer.created | Same terminal | Event fires with correct transfer amount to seller's Connect account | Test mode: ✅ Apr 21, 2026 |
| Fee split (Premium seller) | $6.00 total, seller is Premium | Transfer amount = `$5.70` (Math.floor(600 × 0.95)), platform keeps $0.30 | Test mode: ✅ Apr 21, 2026 |
| Fee split (Free seller) | $X total, seller is Free tier | Transfer amount = `Math.floor(X × 0.92)`, platform keeps 8% | ⏳ Pending (free-tier path not yet tested) |
| Sales record created | After payment completes | Seller's /sales page shows the sale with correct sale price + profit | Test mode: ✅ Apr 21, 2026 |
| Payment cancellation | Start Stripe Checkout → click Cancel | Redirects to `/shop?listing=<id>&payment=cancelled`, listing still accessible | ⏳ Pending |

### 18c. Multi-Bidder Auction Flow (Added Apr 21, 2026 - Session 36)

**Location:** Shop → Auctions tab → auction listing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| First bid sets current_bid to starting_price | Bidder 1 places max bid of $3 on $2 start | current_bid displays as $2.00, Bidder 1 winning with max_bid=$3 | Test mode: ✅ Apr 21, 2026 |
| New bidder under existing max | Bidder 2 places max $3 when Bidder 1 has max $3 | Tie goes to first bidder (Bidder 1 stays winning) | Pending |
| New bidder exceeds existing max | Bidder 2 places max $4 when Bidder 1 has max $3 | current_bid = $4 ($3 + $1 increment capped at Bidder 2's max), Bidder 2 winning | Test mode: ✅ Apr 21, 2026 |
| Outbid notification to previous winner | After someone places higher max | Previous high bidder receives "You've been outbid!" notification | Test mode: ✅ Apr 21, 2026 |
| Self-bid prevention | Seller tries to bid on own auction | Error: "You cannot bid on your own auction" | Pending |
| Bid history display | View auction after multiple bids | Shows all bids in reverse chronological order with Bidder 1, Bidder 2, etc. (anonymized) | Test mode: ✅ Apr 21, 2026 |
| Original bidder increases max | Bidder 1 places higher max after being outbid | max_bid updated on existing bid record; wins if new max exceeds current winner's | Test mode: ✅ Apr 21, 2026 |

### 18d. Auction End Processing (Added Apr 21, 2026 - Session 36)

**Location:** Automatic via cron (`/api/cron/process-auctions`, runs every 5 min in prod)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Auction with bids ends | Auction passes end_time with at least one bid | Status → "ended", winner_id set to highest max bidder, winning_bid set, payment_status = "pending" | Test mode: ✅ Apr 21, 2026 |
| Winner notification | After auction ends | Winner receives "You won! Complete payment within 48 hours" notification | Test mode: ✅ Apr 21, 2026 |
| Seller notification | After auction ends | Seller receives "Your item sold!" notification | Test mode: ✅ Apr 21, 2026 |
| Watcher notifications | Watchers (non-winner, non-seller) after auction ends | Each watcher receives "Auction ended" notification | Pending |
| Auction with no bids ends | Auction passes end_time with zero bids | Status → "ended", no winner_id, no payment_status | Pending |
| Payment deadline set | After auction ends with winner | payment_deadline = now + 48 hours | Test mode: ✅ Apr 21, 2026 |
| Feedback reminders created | After auction ends with winner | Both winner and seller queued for feedback reminders | Test mode: ✅ Apr 21, 2026 |

### 19. Seller Ratings & Reputation

**Location:** Shop → Any listing → Seller info, or Profile

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View seller rating | Click seller name on listing | Shows positive %, total ratings, member since |
| Leave positive rating | After purchase, rate seller positive | Rating recorded, seller % updates |
| Leave negative rating | After purchase, rate seller negative | Rating recorded, seller % updates |
| View rating breakdown | On seller profile | Shows positive/negative counts |

### 20. CGC/CBCS/PGX Cert Lookup

**Location:** Scan page (graded comic) or Edit comic → Certification Number

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Auto-detect graded comic | Scan photo of slabbed comic | Detects grading company, grade, cert number |
| Manual cert lookup | Enter cert number → Click "Lookup" | Fetches data from CGC/CBCS/PGX website |
| Cert verification link | After lookup, click verification link | Opens grading company website with cert details |
| View grading details | Check comic detail modal for graded book | Shows Page Quality, Grade Date, Grader Notes (if available) |
| Signatures detected | Scan/lookup signed comic | "Signed By" field populated, Signature Series checked |
| Key comments captured | Lookup comic with key info on cert | Key Info populated from cert data |
| CBCS alphanumeric cert | Enter CBCS cert like "20-1F9AC96-004" | Correctly identified as CBCS, lookup succeeds |

### 21. Con Mode (Convention Quick Lookup)

**Location:** Key Hunt → Toggle "Con Mode" or Settings

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Enable Con Mode | Toggle Con Mode switch | Interface optimized for speed |
| Quick price check | Scan comic in Con Mode | Shows price immediately, minimal UI |
| Grade selector | After scan, select grade | Price updates for selected grade |
| Offline capability | Enable Con Mode while online, go offline | Previously cached lookups still work |
| Add to collection | Tap "Add" on Con Mode result | Comic queued for sync when online |

### 22. Notifications

**Location:** Bell icon in navigation header

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View notifications | Click bell icon | Dropdown shows recent notifications |
| Unread indicator | Have unread notifications | Bell shows red dot/count |
| Mark as read | Click notification | Notification marked as read |
| Outbid notification | Get outbid on auction | "You've been outbid" notification appears |
| Auction won notification | Win an auction | "You won!" notification appears |
| Sale notification (seller) | Someone buys your item | "Your item sold" notification appears |

### 23. Guest Bonus Scans (Email Verification Flow)

**Location:** Scan page → After using all 5 guest scans → "Get 5 More Scans" modal

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Modal appears at limit | Use all 5 guest scans | Email capture modal appears offering 5 bonus scans |
| Valid email submission | Enter valid email → Click "Send Verification Email" | Success state shows "Check your email!" message |
| Invalid email format | Enter "notanemail" → Submit | Error: "Please enter a valid email address" |
| Disposable email rejected | Enter email from temp-mail.org or similar | Error: "Please use a non-disposable email address" |
| Invalid domain (no MX) | Enter email with non-existent domain | Error: "This email domain doesn't appear to accept emails" |
| Honeypot triggers | (Bot fills hidden field) | Request silently rejected (returns fake success to confuse bot) |
| Duplicate email rejected | Enter email that already claimed bonus | Error: "This email has already been used for bonus scans" |
| Duplicate IP rejected | Same device claims bonus with different email | Error: "Bonus scans have already been claimed from this device" |
| Verification email received | Submit valid email | Email arrives with "Verify Email & Get Bonus Scans" button |
| Click verification link | Click link in email | Redirected to /scan with success toast, bonus scans granted |
| Expired verification link | Click link after 24 hours | Error message: "This verification link has expired" |
| Already verified link | Click verification link twice | Message: "Your bonus scans have already been activated!" |
| Bonus scans persist | Verify email → Close browser → Reopen | Bonus scans still available in localStorage |
| Rate limit on requests | Submit email 6+ times in 1 minute | Error: "Too many requests. Please try again later." |

### 24. Peer-to-Peer Messaging (Phases 1-7)

**Location:** Shop → Listing Detail → "Message Seller" / Navigation → "Messages"

#### Starting a Conversation

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Message seller from listing | View listing detail → Click "Message Seller" | Creates conversation, redirects to /messages |
| Message from AuctionCard | Hover AuctionCard → Click message icon | Creates conversation with seller |
| Message from SellerBadge | Click message icon on SellerBadge | Creates conversation with seller |
| Initial message sent | Click Message Seller on a listing | Automatic "Hi! I'm interested in your listing." message sent |
| Can't message yourself | View your own listing | "Message Seller" button not shown |
| Guest user blocked | Click Message Seller while logged out | Redirected to sign-in |

#### Messages Inbox

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View inbox | Navigate to /messages | Conversation list shows on left, empty state or thread on right |
| Conversation preview | View inbox with existing conversations | Shows other user's name, last message preview, time ago, unread count |
| Select conversation | Click a conversation in list | Thread loads on right, messages marked as read |
| Empty inbox | New user with no conversations | Shows "No conversations yet" message |
| Mobile view - list | On mobile, view /messages | Full-width conversation list |
| Mobile view - thread | On mobile, select conversation | Thread shows with back button |

#### Sending Messages

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Send text message | Type message → Press Enter or click Send | Message appears in thread, sent to recipient |
| Shift+Enter for newline | Press Shift+Enter while typing | Creates new line, doesn't send |
| Empty message blocked | Try to send empty/whitespace message | Send button disabled |
| Long message | Type 2000+ characters | Truncated at 2000 limit |
| Message with listing context | Send from listing detail | Message shows "Re: [Listing Title]" context |

#### Image Attachments (Phase 2)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Add image to message | Click image icon → Select image | Preview appears below composer |
| Remove image before send | Click X on image preview | Image removed from pending message |
| Send message with images | Add images → Send | Message shows images in bubble |
| View image full size | Click image in message bubble | Opens image in lightbox |
| Max 4 images per message | Try to add 5+ images | Only 4 allowed, error shown |
| Image size limit | Upload image > 5MB | Error: "Image too large" |

#### Embedded Listings (Phase 2)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Embed listing in message | Click listing icon → Select from your listings | Listing card embedded in message |
| View embedded listing | See message with embedded listing | Shows cover, title, price, status |
| Click embedded listing | Click embedded listing card | Opens listing detail modal |

#### Unread Count & Realtime (Phase 2, 5)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Unread badge shows | Receive message, don't open conversation | Unread count badge shows on conversation |
| Unread clears on read | Open conversation with unread messages | Badge disappears, messages marked as read |
| Navigation badge | Have unread messages | Badge shows on Messages link in nav |
| Realtime message delivery | Partner sends message while viewing thread | Message appears instantly without refresh |
| Realtime badge update | Receive message while on another page | Badge increments instantly |

#### Block User (Phase 3)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Block user from thread | In thread → Click ⋮ menu → Block User | Confirmation modal appears |
| Confirm block | Click "Block" in modal | User blocked, redirected to /messages |
| Blocked user can't message | Blocked user tries to send message | Error: "You cannot message this user" |
| View blocked users | Settings → Blocked Users | List of blocked users shown |
| Unblock user | Click Unblock on blocked user | User unblocked, can message again |

#### Report Message (Phase 3)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Report from thread | In thread → Click ⋮ menu → Report | Report modal opens |
| Select report reason | Choose reason from dropdown | Reason selected |
| Submit report | Fill reason → Click Report | Report submitted, confirmation shown |
| Report with details | Add optional details to report | Details saved with report |

#### Content Filtering (Phase 3)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Phone number blocked | Try to send "Call me at 555-1234" | Error: "Phone numbers not allowed in messages" |
| Email blocked | Try to send "Email me at test@example.com" | Error: "Email addresses not allowed in messages" |
| Payment mention flagged | Send "Pay via Venmo" | Message sends but flagged for review |

#### Notification Settings (Phase 4)

**Location:** Settings → Notifications or /settings/notifications

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View notification settings | Navigate to /settings/notifications | Toggle switches for push and email |
| Toggle push notifications | Toggle push switch | Setting saves immediately |
| Toggle email notifications | Toggle email switch | Setting saves immediately |
| Email sent when enabled | Receive message with email enabled | Email notification arrives |
| No email when disabled | Receive message with email disabled | No email sent |

#### Admin Moderation (Phase 6)

**Location:** /admin/moderation (admin only)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View reports dashboard | Navigate to /admin/moderation | Stats cards and report queue display |
| Filter by status | Select status filter | List filters to that status |
| Dismiss report | Click Dismiss on pending report | Report marked as dismissed |
| Warn user action | Click Warn User → Add notes → Submit | Report marked as actioned |
| Admin notes saved | Add notes when taking action | Notes visible on report |
| Non-admin blocked | Non-admin tries to access | Redirected or 403 error |

---

### 25. Security & Abuse Prevention

**Location:** Various API endpoints (test via browser dev tools or API client)

#### Rate Limiting

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Quick-lookup rate limit | Make 20+ barcode lookups in 1 minute | After limit hit, returns 429 "Too many requests" |
| Email capture rate limit | Submit 6+ email requests in 1 minute | After limit hit, returns 429 error |
| Rate limit resets | Wait 1 minute after hitting limit | Requests work again |

#### Admin-Only Endpoints

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Trial reset requires admin | Call /api/billing/reset-trial without admin auth | Returns 401/403 error |
| Trial reset with admin | Admin user calls endpoint with targetUserId | Trial reset succeeds, action logged |
| Cron requires secret | Call /api/cron/process-auctions without Bearer token | Returns 401 "Unauthorized" |
| Cron with valid secret | Call with correct CRON_SECRET | Endpoint processes normally |
| Cron missing secret | CRON_SECRET env var not set | Returns 401 (fails closed, not open) |

#### User Suspension Checks

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Suspended user - watchlist | Suspended user calls /api/watchlist | Returns 403 "Account suspended" |
| Suspended user - notifications | Suspended user calls /api/notifications | Returns 403 "Account suspended" |
| Suspended user - sharing | Suspended user calls /api/sharing | Returns 403 "Account suspended" |
| Active user - all routes | Non-suspended user uses app normally | All features work |

#### Webhook Security

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Stripe webhook signature | Send webhook without valid signature | Returns 400 "Webhook error" |
| Duplicate webhook handling | Same Stripe event ID sent twice | Second request returns { duplicate: true }, no double-processing |
| Invalid webhook payload | Send malformed JSON | Returns 400 error |

#### Protected Routes (Middleware)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Admin routes require auth | Visit /admin while logged out | Redirected to sign-in |
| Billing routes require auth | Call /api/billing/* without auth | Returns 401 |
| Watchlist requires auth | Call /api/watchlist without auth | Returns 401 |
| Auction bid requires auth | Call /api/auctions/:id/bid without auth | Returns 401 |

### 26. Book Trading

**Location:** Collection → Comic Detail → "For Trade" toggle / Navigation → "Trades" / Shop → "For Trade" tab

#### For Trade Toggle

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Mark comic for trade | Collection → Comic Detail → Click "For Trade" toggle | Toggle turns orange, comic marked as for_trade |
| Unmark comic for trade | Comic Detail → Click "For Trade" toggle again | Toggle turns off, comic no longer for_trade |
| For Trade filter | Collection → Filter by "For Trade" | Only comics marked for trade display |
| Match finding triggered | Mark comic as for trade | System checks for Hunt List matches |

#### Shop - For Trade Tab

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View For Trade tab | Shop → Click "For Trade" tab | Tab displays with comics from other users |
| Own comics excluded | Mark your comic for trade → View For Trade tab | Your own comics do not appear in the list |
| Hunt List demand badge | View comic wanted by multiple users | Shows "X users want this" badge |
| Click to view details | Click a for-trade comic | Opens detail view/modal |

#### Trade Matches

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View matches tab | Navigate to /trades → Matches tab | Shows Hunt List matches with your for-trade comics |
| Matches grouped by comic | Have multiple matches | Matches organized by your comic being requested |
| Quality score ranking | View match list | Higher-rated users appear first |
| Dismiss match | Click dismiss on unwanted match | Match removed from list |
| Message from match | Click message button on match | Opens conversation with that user |

#### Trade Proposal

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Open trade modal | Click "Propose Trade" from match | TradeProposalModal opens with recipient info |
| View your comics | In modal, view left side | Shows your for-trade comics |
| View their comics | In modal, view right side | Shows their for-trade comics |
| Select multiple comics | Select comics from each side | Multiple selections allowed |
| Submit without both sides | Try to submit with only one side selected | Submit button disabled or error shown |
| Create trade proposal | Select comics from both sides → Submit | Trade created with status "proposed" |

#### Trade Workflow - Recipient

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View incoming trade | Receive trade → Active tab | Trade proposal appears in Active tab |
| Accept trade | Click "Accept" on proposal | Status becomes "accepted" |
| Decline trade | Click "Decline" on proposal | Status becomes "declined" |
| Cancel trade | Click "Cancel" before shipping | Trade cancelled |

#### Trade Workflow - Shipping

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Mark as Shipped appears | Accept trade | "Mark as Shipped" button appears for both parties |
| Enter shipping info | Click "Mark as Shipped" → Enter carrier/tracking | Shipping info saved (tracking optional) |
| Shipping status displayed | One party ships | Status shows who has shipped |
| Both shipped status | Both parties mark as shipped | Status becomes "shipped" |

#### Trade Workflow - Completion

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Confirm Received appears | Other party marks shipped | "Confirm Received" button appears |
| Trade completes | Both parties confirm receipt | Trade status becomes "completed" |
| Ownership swaps | Trade completes | Comics transfer to new owners' collections |
| Acquired via trade | Check swapped comic | Shows acquired_via: "trade" |
| Removed from Hunt List | Trade completes | Comics removed from new owners' Hunt Lists |
| For Trade unmarked | Trade completes | Comics no longer marked as for_trade |

#### Trade History

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View completed trades | /trades → History tab | Completed trades appear |
| View cancelled trades | /trades → History tab | Cancelled/Declined trades appear |
| View trade details | Click on past trade | Full trade details shown |

#### Navigation

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Desktop nav link | View desktop navigation | "Trades" link visible |
| Mobile nav link | View mobile navigation | "Trades" link visible |
| Pending matches badge | Have pending matches | Badge shows count (if implemented) |

---

## Cover Image Search (CSV Import)

### Automated Tests
- [x] normalizeTitle lowercases and trims
- [x] normalizeTitle removes special characters except hyphens
- [x] normalizeTitle collapses multiple spaces
- [x] normalizeIssueNumber strips leading hash
- [x] normalizeIssueNumber preserves decimals and letters
- [x] buildCoverLookupKey combines normalized title and issue

### Manual Tests
- [ ] CSV import triggers Cover Review Queue for comics without covers
- [ ] Community DB hit returns cached cover (skips Claude + Google)
- [ ] Single-match auto-approves to community DB
- [ ] Multiple matches go to admin approval queue
- [ ] Admin can approve a pending cover
- [ ] Admin can reject a pending cover
- [ ] Rejected cover stays visible to submitting user only
- [ ] Skip button advances to next comic without setting cover
- [ ] Cancel exits Cover Review Queue gracefully
- [ ] Cover Review Queue shows progress (X of Y comics)
- [ ] Broken image URLs are filtered out of candidate grid
- [ ] Admin cover queue page accessible at /admin/cover-queue
- [ ] Admin nav shows "Covers" link

---

## Cover Image Harvesting — Slabbed Scans

**Location:** Home → Scan a Book (with graded/slabbed comics)

**Overview:** Auto-harvest cover artwork from graded/slabbed comic scans. When AI determines cover is harvestable (clear, well-lit, minimal glare), system auto-crops, uploads to Supabase Storage, and submits to community database.

| # | Test Case | Steps | Expected Result | Status |
|---|-----------|-------|-----------------|--------|
| 1 | Successful harvest (slabbed CGC) | Scan a CGC-graded comic with clear, well-lit cover visible | Check server logs for `[harvest] success` message → Verify image in Supabase Storage `cover-images` bucket → Verify row in `cover_images` table with `source_query = 'scan-harvest'` | Pending |
| 2 | Skip duplicate harvest | Scan the same slabbed comic again | Server logs show `[harvest] skipped: cover exists` → No duplicate entry in Supabase Storage or `cover_images` table | Pending |
| 3 | No harvest for raw comics | Scan a raw (non-slabbed) comic | No `[harvest]` log messages → No new entries in `cover_images` table or Storage → Comic imports normally | Pending |
| 4 | Glare/reflection prevents harvest | Scan a slabbed comic with heavy glare or reflection on slab | AI returns `coverHarvestable: false` → No harvest attempt → No entries created in logs/DB/Storage | Pending |
| 5 | Partial success (CBCS variant) | Scan a CBCS-graded comic with clear cover | Same behavior as #1 (success, storage, DB entry) | Pending |
| 6 | Poor lighting prevents harvest | Scan a slabbed comic with dim lighting or shadows on cover | AI returns `coverHarvestable: false` → No harvest attempt | Pending |
| 7 | Harvest with variant cover | Scan a slabbed variant cover edition | AI determines harvestable variant → Image harvested and stored → DB entry with correct variant metadata | Pending |
| 8 | Database integrity check | After 5+ successful harvests | Verify all rows have: `id`, `source_query = 'scan-harvest'`, `created_at`, valid image URL in Storage | Pending |

---

## Mobile Responsiveness

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Home page mobile | View on mobile device | Layout adjusts, features stack vertically |
| Collection mobile | View collection on mobile | Filter labels hidden, dropdowns work |
| Comic detail mobile | Open comic detail on mobile | Modal scrollable, all info accessible |
| Navigation mobile | View nav on mobile | Bottom navigation bar appears |
| CSV import on mobile | View scan page on mobile | Import CSV button visible and modal works ✅ |

---

## Edge Cases

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Poor image quality | Upload blurry/dark comic photo | AI attempts recognition, may show lower confidence |
| Unknown comic | Upload obscure/indie comic | AI provides best guess or prompts manual entry |
| Duplicate comic | Add same comic twice | Both copies saved (variants feature helps manage) |
| Empty collection | New user views collection | Empty state with prompt to add comics |
| Large CSV import | Import 50+ comics via CSV | Progress bar tracks, all comics import |

### PWA Install Prompts

**Location:** Visit site on mobile device

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Android install prompt | Visit site on Android Chrome | After 2 seconds, install prompt appears with "Install" button |
| Android install action | Tap "Install" on prompt | Native browser install dialog appears |
| iOS Safari install prompt | Visit site on iOS Safari | After 2 seconds, prompt shows Safari share instructions |
| iOS Chrome redirect | Visit site on iOS Chrome | Prompt shows "Open in Safari to Install" instructions |
| Dismiss prompt | Tap "Not now" or "Got it" | Prompt hides, doesn't reappear for 7 days |
| Already installed | Visit site after PWA installed | No install prompt shown |
| Android app icon | Install PWA on Android | App icon shows blue background with chest (no white border) |
| Android shortcuts | Long-press app icon on Android | Shows "Collection" and "Lookup" shortcuts with blue icons |

---

## Known Limitations

1. **eBay prices require title + issue** - Price lookup needs both fields; AI fallback used otherwise
2. **CSV import desktop only** - Better UX on larger screens for file management
3. **Guest scan limit** - Guests get 5 initial scans + 5 bonus scans (via email verification) = 10 total
4. **Email verification required for bonus** - Bonus scans require clicking verification link in email; not granted immediately
5. **One bonus claim per device** - IP tracking prevents multiple bonus claims from same device
6. **First lookups are slower** - Comics not in database require AI lookup (~1-2s); subsequent lookups are fast (~50ms)
7. **Database caching is shared** - All users benefit from lookups made by other users
8. **eBay may have no results** - Obscure comics may not have recent sales; AI fallback provides estimate

---

## Reporting Issues

If you encounter bugs or unexpected behavior:
1. Note the steps to reproduce
2. Screenshot any error messages
3. Note your device/browser
4. Report at: [GitHub Issues URL]

---

---

## Feb 5 Feedback Fixes

> See `FEEDBACK_FEB_5.md` for full test cases per item. Summary of key tests below.

### CSV Import Enhancements

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Dollar signs in price | Import CSV with `purchasePrice: $8.00` | Shows $8.00 in edit details |
| Commas in price | Import CSV with `purchasePrice: $1,000.00` | Shows $1,000 in edit details |
| Publisher alias mapping | Import CSV with publisher "DC" | Maps to "DC Comics" in edit dropdown |
| Unknown publisher | Import CSV with unknown publisher | Dropdown shows "Other", "Suggest Publisher" button appears |

### Admin UX

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Search icon spacing | Admin → Users → view search | Placeholder text doesn't overlap magnifying glass |
| No results message | Admin → Users → search "zzzzz@fake.com" | Shows "No users found matching..." |
| Admin nav bar | Visit any admin page | Yellow pop-art nav bar with all 5 sections |

### Key Hunt Premium Gate

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Free user sees lock | As free user, view "Add to Key Hunt" button | Button shows with "Premium" lock badge |
| Lock triggers upgrade | Click locked button | Triggers free trial or Stripe checkout |
| Premium user normal | As premium user, view button | Button works normally (no lock) |

### Community Features

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Key info approval notification | Admin approves key info | Submitter sees "Key info approved!" notification |
| Key info rejection notification | Admin rejects key info | Submitter sees "Key info not accepted" notification |
| Reputation increment | Admin approves key info | Submitter's contribution count increments |
| Follow on public page | Visit another user's public page while logged in | Follow button visible in profile header |
| Public profile name | Visit /u/[slug] | Header shows username or display name, not "A Collector" |

### Sort & Value

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Sort by value | Collection → sort by "Value" | Books sort by grade-aware value (matches displayed values) |
| Raw/slabbed toggle | Toggle slabbed on book with grade | Value updates immediately |

### Following Page

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| View following list | Navigate to /following while signed in | See list of users you follow with avatars and names |
| View followers list | Click "Followers" tab | See list of users following you |
| Follow/unfollow from list | Click Follow/Following button on a user row | Toggle follow state in place |
| Navigate to user profile | Click a user row | Navigates to /u/{username} |
| Load more pagination | Scroll to bottom of long list | "Load more" button loads next 20 users |
| Empty state | Visit /following with no follows | Shows "You're not following anyone yet" message |
| Auth redirect | Visit /following while signed out | Redirects to /sign-in |
| Navigation link | Open "More" dropdown in nav | "Following" link visible |

### CSV Import Facts

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Cycling facts during import | Upload CSV and watch progress | Comic facts cycle every 7 seconds below progress bar |
| Mobile fact display | Import CSV on mobile | Facts show without "Did you know?" prefix |

### Admin Search No Results

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| No results message | Admin → Users → search non-existent email | Red bold "No users found matching '...'" message |
| Default state | Admin → Users → before any search | Gray "Search for users by email" message |

### Feb 8 Fixes

#### Real-Time Messaging (#17)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Conversation list refreshes | Open messages on two accounts, send from one | Other account's conversation list updates without refresh |
| Loading spinner only on initial | Open /messages → wait for load → receive new message | Full spinner on first load only, no spinner on real-time updates |
| Mark as read endpoint | Open conversation with unread messages | Messages marked as read via POST /api/messages/{id}/read |
| Nav unread badge accurate | Receive message from another user | Badge increments; sending own message does NOT increment |

#### Key Hunt Trial Access (#12)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Trial user Key Hunt access | As trial user (isTrialing=true), tap Key Hunt in mobile nav | Navigates to /key-hunt (not /pricing) |
| Trial user Key Hunt styling | As trial user, view bottom nav | Key Hunt shows amber color (not gray/locked) |
| Free user Key Hunt locked | As free non-trial user, tap Key Hunt | Redirects to /pricing?feature=key-hunt |

#### Tappable @Username

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| MessageThread username | Open a conversation | @username next to "Message @username" is a link to /u/{username} |
| SellerBadge username | View listing detail in Shop | @username in seller badge links to /u/{username} |
| No public profile tooltip | View user without public profile | @username not tappable, hover shows "hasn't set up public collection" |

#### Shop Following Button

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Following button color | On Shop page, click Follow on a seller | Button is blue (bg-pop-blue), not pink |

#### Message Scroll Fix

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Messages stay in container | Send/receive many messages | All messages render within the message box, scrollable |
| Back to conversations | In mobile thread view, tap "← Back to conversations" | Returns to conversation list (does not refresh same thread) |

### Feb 10 Fixes

#### Mobile Share Modal (#1)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Copy button visible on mobile | Open share modal on mobile | Copy button fully visible without horizontal scroll |
| URL truncates properly | View long share URL on mobile | URL text truncates with ellipsis, copy button accessible |

#### Mobile Message Badge (#3)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Unread badge on mobile More | Receive message, view mobile nav | Red badge on "More" button shows unread count |
| Badge on Messages in drawer | Open "More" drawer | Messages item shows red unread count badge |
| Real-time badge update | Receive message while app is open | Badge updates without page refresh |

#### Messages Landing Page (#4)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| No auto-select on mobile | Open /messages on mobile | Conversation list shows, no thread auto-selected |
| URL param selects thread | Open /messages?conversation=xxx | That specific conversation selected |

#### Inquiry Messages (#5)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Rich inquiry message | Tap "Message Seller" on a listing | Message includes title, issue #, grade, and shop URL |
| URL is clickable | View message with shop URL | URL renders as tappable blue link |
| Link opens listing | Tap the URL in message | Opens the shop listing page |

#### Admin Mobile Nav (#7)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Admin link in mobile drawer | As admin, open "More" drawer | "Admin" link with shield icon visible |
| Admin nav tabs mobile | Visit admin page on mobile | Tabs on separate row below header, horizontally scrollable |

#### Collection Filters Mobile (#8)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Two-row filter layout | View collection on mobile | Row 1: Starred/Trade/List/Clear, Row 2: Publisher/Title/Sort/CSV |
| All filters accessible | Tap each filter on mobile | All dropdowns work correctly |

#### Shop Tab Buttons (#11)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Tab button sizing | View shop on mobile | Buy Now/Auctions/For Trade buttons compact (not oversized) |
| Sort dropdown chevrons | View sort dropdowns | Native chevron visible on all sort dropdowns |

#### Account Settings (#12)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Pop-art styling | View account settings | Comic fonts, bold borders, pop-art color scheme |
| Tabs styled consistently | Click between settings tabs | Active tab uses pop-blue color, comic font |

#### Key Hunt Routing (#13)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Free user Key Hunt | As free user, tap Key Hunt in mobile nav | Goes to /key-hunt (FeatureGate shows premium gate) |
| Premium user Key Hunt | As premium user, tap Key Hunt | Goes to /key-hunt with full access |

---

### Admin Key Info Management (Feb 13, 2026)

#### Custom Key Info Sandboxing

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Custom key info hidden when pending | As User 2, edit a comic and add custom key info | Custom key info shows on user's own comic but NOT in shop/auctions/trades |
| Custom key info visible when approved | As admin, approve the custom key info | Custom key info now visible in shop/auctions/trades |
| Custom key info hidden when rejected | As admin, reject the custom key info | Custom key info hidden from public views |

#### Admin Review Tab

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Unified review list | Navigate to Admin > Key Info | Single "Review" tab shows items from both sources |
| Source badges | View review items | "Suggestion" badge (purple) and "From Comic" badge (blue) visible |
| Approve suggestion | Click Approve on a suggestion item | Item removed from list, approved count increments |
| Reject suggestion | Click Reject, enter reason, confirm | Item removed from list, rejected count increments |
| Approve custom key info | Click Approve on a "From Comic" item | Item removed from list, approved count increments |
| Combined stats | View stats cards | Pending/Approved/Rejected counts combine both sources |

#### Admin Database Tab

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Search key comics | Switch to DB tab, type title, click Search | Filtered results shown with match count |
| Create key comic | Click "+ Add Entry", fill form, Create | New entry appears in list |
| Edit key comic | Click pencil icon, modify fields, Save | Entry updated with new values |
| Delete key comic | Click trash icon, confirm deletion | Entry removed from list |
| Source filter | Select "Curated" or "Community" filter | Results filtered by source |

### Fuzzy Matching / Abbreviation Expansion (Feb 18, 2026)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Abbreviation expansion - ASM | Type "ASM" in title autocomplete | Shows "Amazing Spider-Man" results with "Searching for..." hint |
| Abbreviation expansion - tec | Type "tec" in title autocomplete | Shows "Detective Comics" results |
| Abbreviation expansion - FF | Type "FF" in title autocomplete | Shows "Fantastic Four" results |
| Regular title unaffected | Type "Batman" in title autocomplete | Works as before with no expansion hint |

### Popularity-Based Suggestions (Feb 18, 2026)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Popular titles on focus | Focus the title autocomplete with empty input | Shows "Popular" section with trending titles (if data exists in comic_metadata) |
| Popular section disappears | Start typing in title autocomplete | Popular section disappears after 2 characters |
| Click popular title | Click a title in the Popular section | Populates the search and triggers autocomplete |

### Batch CSV Import Optimizations (Feb 18, 2026)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Duplicate title dedup | Import CSV with duplicate titles (e.g., 5 copies of Amazing Spider-Man #1) | Shows "Looking up X unique titles (Y total)" and completes faster |
| Quick Import toggle | Import with Quick Import toggle ON | Skips lookups entirely (same as before) |
| Partial lookup failures | Import with some failed lookups | Comics still import with CSV-only data |

### Real-Time Messaging via Supabase Broadcast (Feb 18, 2026)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Instant message delivery | Send message from User A to User B | User B sees it instantly without refresh |
| Real-time nav badge | Send message to User B | User B's nav bar badge updates in real-time |
| Bidirectional real-time | User B replies to User A | User A sees the reply instantly |
| Read receipt badge update | Mark messages as read | Badge count decreases |

### Notifications - Key Info Approval (Feb 18, 2026)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Approval notification | Submit custom key info, have admin approve it | Notification appears in bell icon |
| Click notification | Click on the approval notification | Marks notification as read |
| Mark all as read | Click "Mark all as read" | Badge clears |

### Age Gate (18+ Verification) (Feb 19, 2026)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Age modal on list | Attempt to create a listing without age confirmation | Age verification modal appears with pop-art styling |
| Age modal on bid | Attempt to place a bid without age confirmation | Age verification modal appears |
| Age modal on buy | Attempt to buy now without age confirmation | Age verification modal appears |
| Age modal on trade | Attempt to propose a trade without age confirmation | Age verification modal appears |
| Confirm age dismisses modal | Click "I confirm I am 18+" in modal | Modal dismisses and retries the original action |
| Dismiss modal prevents action | Click "Cancel" or close the age verification modal | Action is prevented, user stays on current page |
| Age-verified user bypasses | Complete age verification once, then attempt marketplace actions | No further age prompts; marketplace actions proceed normally |

### Cost Monitoring (Feb 19, 2026)

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Admin alert badge appears | As admin, trigger usage above threshold | Alert badge appears on Usage tab (dot) and Admin nav link (count) |
| Alert badge on Usage tab | As admin, navigate to Admin dashboard | Dot-style alert badge visible on Usage tab when thresholds exceeded |
| Alert badge on Admin nav | As admin, view desktop/mobile nav | Count-style alert badge visible on Admin link when thresholds exceeded |
| Non-admin no badge | As non-admin user, view navigation | No alert badges visible anywhere |

### Multi-Provider Scan Fallback (Mar 1, 2026)

**Location:** Home → "Scan a Book" / Upload comic cover

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Scan succeeds with Anthropic | Upload a comic cover under normal conditions | Scan completes successfully using Anthropic provider |
| Anthropic 500/503 triggers fallback | Simulate Anthropic server error (500/503) | Scan falls back to OpenAI and returns results successfully |
| Anthropic 429 triggers fallback | Simulate Anthropic rate limit (429) | Scan falls back to OpenAI and returns results successfully |
| Anthropic 404 triggers fallback | Simulate Anthropic model not found (404) | Scan falls back to OpenAI and returns results successfully |
| Both providers fail | Simulate both Anthropic and OpenAI failing | User sees clear error message with no provider names exposed |
| Slow scan message | Upload image and wait 5+ seconds for response | "Taking a bit longer than usual" message appears after 5 seconds |
| Provider info hidden from user | Complete a scan (any provider) | No provider name shown in UI; provider info only in _meta (internal) |
| Only Anthropic key configured | Remove OpenAI API key, upload comic cover | Scan works normally with Anthropic; no fallback attempted if it succeeds |
| Budget management for optional calls | Trigger a scan where timeout budget is low | Optional API calls (e.g., supplemental lookups) are skipped to preserve budget |

### Scan Cost Dashboard - Admin (Mar 1, 2026)

**Location:** Admin → Usage

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Scan cost metrics visible | As admin, navigate to Admin → Usage | Scan cost metrics display for the last 30 days |
| Per-scan average cost | View scan cost breakdown section | Shows average cost per scan calculated from recent usage |
| Cost alert thresholds | Trigger scan costs exceeding configured threshold | Alert notification appears on Usage tab indicating threshold exceeded |

### About Page (Mar 9, 2026)

**Location:** Navigation → "More" → About, or direct navigation to /about

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | About page loads | Navigate to /about | Page renders with mission statement, feature cards, and placeholder sections | Pending |
| 2 | About page mobile responsive | View /about on mobile | All sections stack properly, text readable, cards responsive | Pending |
| 3 | About nav link (guest) | Open More menu as guest | About link visible and navigates to /about | Pending |
| 4 | About nav link (registered) | Open More menu as registered user | About link visible and navigates to /about | Pending |

### Show/Hide Financials Toggle - Collection Page (Mar 11, 2026)

**Location:** Collection Page

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Toggle button visible | Navigate to Collection page | Show/Hide financials toggle button is visible | Pending |
| 2 | Hide financials | Click the toggle to hide | Cost, Sales, Profit/Loss cards are hidden | Pending |
| 3 | Show financials | Click the toggle again to show | Cost, Sales, Profit/Loss cards reappear | Pending |
| 4 | Persists after refresh | Hide financials, refresh the page | Financials remain hidden after page reload | Pending |
| 5 | Syncs with Account Settings | Toggle financials on collection page | Account Settings Display Preferences toggle reflects the same state | Pending |

### Show/Hide Financials Toggle - Account Settings (Mar 11, 2026)

**Location:** Account Settings → Profile → Display Preferences

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Toggle visible in settings | Navigate to Account Settings → Profile → Display Preferences | Show/Hide financials toggle is visible | Pending |
| 2 | Toggle updates collection page | Toggle financials off in settings, navigate to Collection | Financial cards are hidden on collection page | Pending |
| 3 | Persists across sessions | Toggle setting, sign out and sign back in | Setting persists across sessions | Pending |

### Grade Sort - Collection Page (Mar 11, 2026)

**Location:** Collection Page → Sort Dropdown

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Grade sort option available | Open sort dropdown on Collection page | "Grade (High to Low)" option is visible | Pending |
| 2 | Sort by grade descending | Select "Grade (High to Low)" | Comics sorted by numeric grade in descending order | Pending |
| 3 | Ungraded at bottom | Sort by grade with mix of graded and ungraded comics | Ungraded comics appear at the bottom of the list | Pending |

### Grading Company Filter - Collection Page (Mar 11, 2026)

**Location:** Collection Page → Filter Dropdowns

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Grader dropdown visible | Navigate to Collection page | "All Graders" dropdown is visible in filter row | Pending |
| 2 | Filter by CGC | Select CGC from grader dropdown | Only CGC-graded comics shown | Pending |
| 3 | Filter by CBCS | Select CBCS from grader dropdown | Only CBCS-graded comics shown | Pending |
| 4 | Combined with other filters | Select a grader AND a publisher filter | Both filters apply correctly together | Pending |

### Grade Multiselect Pills - Stats Page (Mar 11, 2026)

**Location:** Stats Page → Grade Distribution Section

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Grade pills clickable | Navigate to Stats page, view grade distribution | Grade pills are clickable/selectable | Pending |
| 2 | Multiple selection | Click multiple grade pills | Multiple grades can be selected simultaneously, shown as solid indigo when selected | Pending |
| 3 | View button appears | Select one or more grade pills | "View X Grade(s)" button appears | Pending |
| 4 | Navigate to filtered collection | Click "View X Grade(s)" button | Navigates to collection page filtered by the selected grades | Pending |

### Grading Company Clickable Counts - Stats Page (Mar 11, 2026)

**Location:** Stats Page → Grading Company Section

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Counts are clickable | Navigate to Stats page, view grading company counts | Grading company counts are displayed as clickable elements | Pending |
| 2 | Navigate to filtered collection | Click a grading company count | Navigates to collection page filtered by that grading company | Pending |

### Age Verification - Marketplace (Mar 11, 2026)

**Location:** Shop / Marketplace Actions

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Modal appears for unverified user | As unverified user, attempt a marketplace action | Age confirmation modal appears | Pending |
| 2 | Confirm dismisses modal | Click confirm in age modal | age_confirmed_at is set, modal dismisses | Pending |
| 3 | No re-prompt after confirmation | After confirming age, attempt another marketplace action | Modal does NOT loop/reappear | Pending |
| 4 | Subsequent actions work | After age confirmation, perform marketplace actions | All marketplace actions proceed without re-prompting | Pending |

### AI Estimate - Recent Sales Hidden (Mar 11, 2026)

**Location:** Comic Detail Modal / Comic Details Form

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Recent Sales hidden for AI estimate | View a comic with AI-estimated price (no eBay data) | "Recent Sales" section is not displayed | Pending |
| 2 | AI Estimate disclaimer shows | View a comic with AI-estimated price | "AI Estimate" disclaimer text is still visible | Pending |
| 3 | Recent Sales shown for real data | View a comic with actual eBay sales data | "Recent Sales" section displays normally | Pending |

### CONNECT_REQUIRED Error Message (Mar 11, 2026)

**Location:** Shop → Create Listing (without Stripe Connect)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Friendly error message | Attempt to list an item without Stripe Connect account | Shows "Please connect your Stripe account before proceeding." | Pending |
| 2 | No raw error code | Attempt to list without Stripe Connect | Does NOT display raw "CONNECT_REQUIRED" error code | Pending |

### Scanner - Foil/Vintage Covers (Mar 18, 2026)

**Location:** Home → Scan a Book

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Foil cover detection | Scan a comic with a foil/holographic cover | Scanner detects foil cover, UI tip displays | Pending |
| 2 | Vintage cover recognition | Scan a pre-1980 comic cover | Scanner correctly identifies vintage book without defaulting to wrong issue | Pending |
| 3 | Variant detection | Scan a variant cover | Variant details populated in scan results | Pending |

### Scanner - Gemini Fallback (Mar 18, 2026)

**Location:** Home → Scan a Book

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Low confidence triggers Gemini | Scan a book that Claude identifies with low confidence | Gemini fallback fires, "Cerebro" badge appears on result | Pending |
| 2 | Gemini improves result | Compare result quality when Gemini fallback activates | Gemini result should be equal or better than low-confidence Claude result | Pending |
| 3 | Claude high confidence skips Gemini | Scan a well-known comic (e.g., Amazing Spider-Man #300) | No Gemini fallback, no "Cerebro" badge | Pending |

### Scanner - Metron Verification (Mar 18, 2026)

**Location:** Home → Scan a Book (background verification)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Metron verifies scan result | Scan a comic and check result details | Metron verification runs non-blocking, enriches data if match found | Pending |
| 2 | Metron no-match graceful | Scan an obscure comic not in Metron DB | Scan completes normally without Metron data, no errors | Pending |

### Key Info - Badges & Year Disambiguation (Mar 18, 2026)

**Location:** Comic Detail Modal / Scan Results

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Verified badge on curated key info | View a comic with curated key info (e.g., Amazing Spider-Man #300) | "Verified" badge displays next to key info | Pending |
| 2 | AI badge on AI-generated key info | View a comic with AI-generated key info | "AI" badge displays instead of "Verified" | Pending |
| 3 | Year disambiguation | Scan Avengers #54 (1968 vs 2002 volume) | Correct volume identified based on year, correct cover art displayed | Pending |

### Signatures - Raw Books (Mar 18, 2026)

**Location:** Comic Detail Modal → Edit

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Add signature to raw book | Edit a raw (non-slabbed) comic, add a signature | Signature saves and displays correctly | Pending |
| 2 | Multiple signatures | Add 2+ signatures to a raw book | All signatures display correctly | Pending |
| 3 | Remove signature | Remove a signature from a raw book | Signature removed, others remain | Pending |

### Scan Limit - Atomic Enforcement (Mar 18, 2026)

**Location:** Home → Scan (as free user)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Exactly 10 scans allowed | As free user, perform 10 scans in a month | All 10 scans succeed | Pending |
| 2 | 11th scan blocked | Attempt an 11th scan as free user | User-friendly limit message displayed (not raw error code) | Pending |
| 3 | No race condition | Rapidly tap scan multiple times near limit | Exactly 10 scans recorded, no extras slip through | Pending |

### eBay Button - Sold Listings (Mar 18, 2026)

**Location:** Key Hunt → Scan Result → "Check eBay Listings"

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Links to sold listings | Scan a comic in Key Hunt, tap "Check eBay Listings" | Opens eBay filtered to SOLD/completed listings for that comic | Pending |
| 2 | Search terms accurate | Check the eBay URL parameters | Title, issue number, and relevant details included in search | Pending |

### Stripe Checkout Flow (Mar 25, 2026)

**Location:** Profile → Billing Tab / Pricing Page

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Purchase scan pack via pricing page | Navigate to pricing page → Click "Buy Scan Pack" → Complete Stripe checkout | Redirected to billing tab with success banner confirming purchase | Pending |
| 2 | Scan count increases after purchase | Purchase one scan pack → Check scan counter | Scan count reflects new balance (e.g., 0/20 after one pack) | Pending |
| 3 | Upgrade to Premium checkout | Click "Upgrade to Premium" → Verify Stripe checkout | Stripe checkout opens with correct premium subscription details | Pending |
| 4 | Complete premium subscription | Complete premium subscription via Stripe | Billing tab shows "Premium" status with "Manage Plan" button | Pending |

### Choose Your Plan Page (Mar 25, 2026)

**Location:** /choose-plan (after sign-up)

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Redirect after sign-up | Create a new account via sign-up flow | Redirected to /choose-plan page | Pending |
| 2 | Start free trial | On /choose-plan, click "Start 7-Day Free Trial" | Trial starts and user redirected to collection page | Pending |
| 3 | Continue with free tier | On /choose-plan, click "Continue with Free" | User redirected to collection page with free tier active | Pending |
| 4 | Premium user redirect | As a premium user, navigate to /choose-plan | Automatically redirected to collection page (cannot re-choose) | Pending |

### Publisher Clickable on Stats (Mar 25, 2026)

**Location:** Profile → Stats Tab → Publishers Section

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | Click publisher filters collection | On Stats page, click a publisher name | Navigates to collection page filtered by that publisher | Pending |

---

## Promo Trial Link (/join/trial)

### Landing Page

| Test | Steps | Expected | Status |
|------|-------|----------|--------|
| Page loads for unauthenticated user | Visit /join/trial in incognito | See landing page with Convention Special, benefits, CTA | |
| Signed-in user redirects | Visit /join/trial while logged in | Redirect to /choose-plan | |
| CTA shows loading state | Tap "Start Your Free Trial" | Button shows "Loading..." then navigates to /sign-up | |
| Sign-in link works | Tap "Sign in" link | Navigate to /sign-in with redirect to /choose-plan | |
| Ben-day dots visible | Check background on mobile and desktop | Dot pattern visible on both | |
| Promo flag expires | Visit /join/trial, wait 7+ days, visit /choose-plan | Normal plan selection shown (no auto-checkout) | |

### Promo Checkout Flow

| Test | Steps | Expected | Status |
|------|-------|----------|--------|
| Full flow (new user) | /join/trial → sign up → choose-plan → Stripe → collection | Auto-checkout, 30-day trial, lands on /collection?welcome=promo | |
| Stripe shows trial info | Complete checkout with test card | Stripe page shows "30-day free trial" and "$4.99/month after" | |
| Card declined retry | Enter failing test card, then retry | Stripe shows inline error, user can retry | |
| Back from Stripe | Hit back on Stripe checkout | Returns to /choose-plan with normal plan selection (no loop) | |
| One trial per user | Complete promo trial, cancel, scan QR again | No trial offered, charged immediately | |
| Existing 7-day trial user | User who used 7-day trial scans QR | No promo trial, sees normal choose-plan page | |
| Existing premium user | Premium user scans QR | Redirects to /collection | |

### Webhook & Subscription

| Test | Steps | Expected | Status |
|------|-------|----------|--------|
| Trial dates recorded | Complete promo checkout, check Supabase | trial_started_at and trial_ends_at set correctly | |
| Trial converts to paid | Wait for trial to end (or use Stripe test clock) | Status changes from trialing to active, $4.99 charged | |
| Cancel during trial | Cancel subscription in Stripe portal | Downgraded to free, trial_ends_at cleared | |
| Google/Apple Pay available | Open Stripe checkout on mobile | Wallet payment options shown | |

---

### Email Notifications - Welcome (Apr 6, 2026)

**Location:** Triggered by Clerk webhook on user.created

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Welcome email sent on signup | Sign up with a new account | Email received with subject "Welcome to Collectors Chest!" | Pending |
| Sound effect displays | Open email | "POW!" speech bubble in header | Pending |
| Feature list complete | Check email body | 4 features: Scan Any Cover, Track Your Value, Discover Key Issues, Organize Everything | Pending |
| Free scan callout | Check email body | "You get 10 FREE scans every month!" callout box | Pending |
| CTA button works | Click "START SCANNING" | Redirects to /collection | Pending |
| Emoji icons centered | Check feature icons | Emojis centered in colored circles | Pending |
| Footer content | Scroll to bottom | Tagline, Twisted Jester LLC, Privacy Policy & Terms links | Pending |

### Email Notifications - Trial Expiring (Apr 6, 2026)

**Location:** Cron job /api/cron/send-trial-reminders (3 days before trial ends)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Trial reminder sent | Have active trial ending within 3 days | Email: "Your Collectors Chest trial ends in 3 days" | Pending |
| Sound effect | Open email | "TICK TOCK!" speech bubble | Pending |
| Loss list shown | Check email body | Lists: unlimited scans, Key Hunt, CSV export, advanced stats, priority scan queue | Pending |
| Pricing info | Check email body | "$4.99/month" and "Save 17% with the annual plan" | Pending |
| CTA button | Click "STAY PREMIUM" | Redirects to /choose-plan | Pending |
| Idempotency | Trigger cron twice for same user | Only one email sent | Pending |
| Stripe-managed excluded | User with stripe_subscription_id | No email sent (only app-managed trials) | Pending |

### Email Notifications - Offer Received (Apr 6, 2026)

**Location:** Triggered when buyer submits offer on fixed-price listing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Seller notified | Submit offer on a listing | Seller receives: "New offer on [Comic] #[Issue]" | Pending |
| Sound effect | Open email | "KA-CHING!" speech bubble | Pending |
| Offer details | Check email body | Shows buyer name, offer amount, comic title/issue | Pending |
| Response deadline | Check email body | "You have 48 hours to respond to this offer." | Pending |
| CTA button | Click "VIEW OFFER" | Redirects to /shop/[listingId] | Pending |

### Email Notifications - Offer Accepted (Apr 6, 2026)

**Location:** Triggered when seller accepts offer or buyer accepts counter-offer

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Buyer notified (seller accepts) | As Seller, accept a pending offer | Buyer receives: "Your offer on [Comic] #[Issue] was accepted!" | Pending |
| Seller notified (buyer accepts counter) | As Buyer, accept a counter-offer | Seller receives acceptance email | Pending |
| Sound effect | Open email | "WHAM!" speech bubble | Pending |
| Payment reminder | Check email body | "Please complete your payment within 48 hours" | Pending |
| CTA button | Click "COMPLETE PAYMENT" | Redirects to /shop/[listingId] | Pending |
| Correct amount on counter | Accept a counter-offer | Email shows counter amount, not original | Pending |

### Email Notifications - Offer Rejected (Apr 6, 2026)

**Location:** Triggered when seller rejects offer or buyer rejects counter-offer

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Buyer notified (seller rejects) | As Seller, reject a pending offer | Buyer receives: "Update on your offer for [Comic] #[Issue]" | Pending |
| Seller notified (buyer rejects counter) | As Buyer, reject a counter-offer | Seller receives rejection email | Pending |
| Sound effect | Open email | "HEY!" speech bubble | Pending |
| Rejection message | Check email body | "[Name] has declined your offer of [amount]" | Pending |
| Next steps | Check email body | "You can submit a new offer or browse other listings" | Pending |
| CTA button | Click "VIEW LISTING" | Redirects to /shop/[listingId] | Pending |

### Email Notifications - Offer Countered (Apr 6, 2026)

**Location:** Triggered when seller counters buyer's offer

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Buyer notified | As Seller, counter an offer | Buyer receives: "Counter-offer on [Comic] #[Issue]" | Pending |
| Sound effect | Open email | "ZAP!" speech bubble | Pending |
| Both amounts shown | Check email body | "Your offer: [original]" and "Counter-offer: [counter]" | Pending |
| Response deadline | Check email body | "You have 48 hours to respond" | Pending |
| CTA button | Click "RESPOND TO OFFER" | Redirects to /shop/[listingId] | Pending |

### Email Notifications - Offer Expired (Apr 6, 2026)

**Location:** Cron job /api/cron/process-auctions (offers pending 48+ hours)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Buyer notified | Let offer go 48 hours without response | Buyer receives: "Your offer on [Comic] #[Issue] has expired" | Pending |
| Sound effect | Open email | "POOF!" speech bubble | Pending |
| Expiration reason | Check email body | "The seller did not respond within 48 hours" | Pending |
| Re-offer option | Check email body | "You can submit a new offer if the listing is still active" | Pending |
| CTA button style | Check CTA button | Gray button (not blue) — "VIEW LISTING" | Pending |

### Email Notifications - Listing Expiring (Apr 6, 2026)

**Location:** Cron job /api/cron/process-auctions (listing expires within 24 hours)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Seller notified | Have listing expiring within 24 hours | Seller receives: "Your listing for [Comic] #[Issue] expires soon" | Pending |
| Sound effect | Open email | "HEADS UP!" speech bubble | Pending |
| Listing details | Check email body | Shows comic title, issue, and price | Pending |
| Relist suggestion | Check email body | "You can relist it before it expires" | Pending |
| CTA button | Click "VIEW LISTING" | Redirects to /shop/[listingId] | Pending |
| No duplicate reminders | Trigger cron twice for same listing | Only one expiring notification sent | Pending |

### Email Notifications - Listing Expired (Apr 6, 2026)

**Location:** Cron job /api/cron/process-auctions (listing past expiration)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Seller notified | Let a listing expire | Seller receives: "Your listing for [Comic] #[Issue] has expired" | Pending |
| Sound effect | Open email | "TIME'S UP!" speech bubble | Pending |
| Expired message | Check email body | "Your listing has expired and is no longer visible in the shop" | Pending |
| Relist suggestion | Check email body | "You can relist this item from your collection" | Pending |
| CTA button | Click "VIEW COLLECTION" | Redirects to /collection (gray button) | Pending |

### Email Notifications - Message Received (Apr 6, 2026)

**Location:** Triggered when another user sends you a message

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Recipient notified | As User A, send message to User B | User B receives: "New message from [User A]" | Pending |
| Sound effect | Open email | "BAM!" speech bubble | Pending |
| Message preview | Check email body | Blockquote with message text (truncated to 100 chars) | Pending |
| Image-only message | Send message with only an image | Email preview shows "[Image]" | Pending |
| CTA button | Click "VIEW MESSAGE" | Redirects to /messages | Pending |
| Email preference off | Disable email notifications, receive message | No email sent | Pending |
| Email preference on | Enable email notifications, receive message | Email sent | Pending |

### Email Notifications - Feedback Reminder (Apr 6, 2026)

**Location:** Cron job /api/cron/send-feedback-reminders (14 days after transaction)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| First reminder sent | Complete a sale, wait 14+ days | Both parties receive: "How was your purchase? Leave feedback for [Name]" | Pending |
| Sound effect | Open email | "PSST!" speech bubble | Pending |
| Transaction details | Check email body | Shows comic title, issue, other party name, transaction type | Pending |
| CTA button | Click "Leave Feedback" | Redirects to /feedback?txn=[id]&type=[type] | Pending |
| Ignore notice | Check email body | "If you've already left feedback, you can ignore this email." | Pending |
| Final reminder | Wait 21+ days (7+ after first) | Second and final reminder sent | Pending |
| No reminder after feedback | Leave feedback before reminder | No email sent | Pending |
| Max 2 reminders | After 2 reminders sent | No additional reminders | Pending |

### Email Notifications - New Listing from Followed User (Apr 6, 2026)

**Location:** Triggered when a user you follow creates a new listing

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Follower notified | Follow User A, User A creates listing | Receive: "New listing from @[username]" | Pending |
| Sound effect | Open email | "HOT!" speech bubble | Pending |
| Listing details | Check email body | Shows seller name, comic title, price | Pending |
| Cover image displayed | Listing has a cover image | Cover image shown in email | Pending |
| CTA button | Click "VIEW LISTING" | Redirects to /shop/[listingId] | Pending |
| Follow attribution | Check email footer area | "You're receiving this because you follow @[username]" | Pending |
| Email preference off | Disable email notifications | No email sent | Pending |
| Multiple followers notified | 3 users follow seller, seller lists | All 3 receive email | Pending |

### Email Notifications - General Quality (Apr 6, 2026)

**Location:** Applies to all email types

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Sender address correct | Check From field on any email | "Collectors Chest <notifications@collectors-chest.com>" | Pending |
| Pop-art header | Open any email | Blue header with halftone dots, COLLECTORS CHEST badge, speech bubble | Pending |
| Speech bubble shape | Check header graphic | Looks like speech bubble with tail, not a square | Pending |
| Footer tagline | Scroll to bottom | "Scan comics. Track value. Collect smarter." | Pending |
| Footer company | Check footer | "Twisted Jester LLC · collectors-chest.com" | Pending |
| Footer links work | Click Privacy Policy and Terms | Both links load correctly | Pending |
| Mobile rendering | Open email on phone | Layout readable, buttons tappable | Pending |
| Dark mode | View email in dark mode client | Text readable, images display correctly | Pending |
| Gmail rendering | View in Gmail | No clipping, styles render properly | Pending |
| No broken images | Check all emails | No broken image icons | Pending |

### Auction Flow E2E (Apr 22, 2026)

**Scope:** Full auction path from listing creation through feedback, validated in localhost + Stripe sandbox with 3 test accounts (Session 37).

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Bid increment is $1 | Place bids at any price level (e.g., $10, $200, $2000) | Prefill and increment always $1, regardless of tier | Completed |
| Raise your own max bid | As high bidder, reopen bid form | Label reads "Raise your max bid"; prefill is currentMax + 1 | Completed |
| Buy It Now hidden when exceeded | Bid above BIN price, reopen listing | Buy It Now button is not rendered | Completed |
| Buy It Now hidden for seller | As seller, view own listing | No Buy It Now button visible | Completed |
| Friendly DB error message | As bidder, submit maxBid ≤ current max | Red-pill "Your max bid must be at least the current bid plus the increment" — no raw Postgres errors | Completed |
| Outbid email sends | Bidder A places high bid, Bidder B bids higher | Bidder A receives outbid email in inbox; Resend dashboard shows delivered | Completed |
| Auction end processes idempotently | Trigger `/api/cron/process-auctions` twice | Second call skips (logs "already finalized"); no duplicate notifications or emails | Completed |
| Auction won email | As winner, after auction ends | Receive `auction_won` email with final price, payment deadline, Transactions deep link | Completed |
| Auction sold email | As seller, after auction ends | Receive `auction_sold` email with buyer info and final price | Completed |
| Bid auction lost email | As losing bidder (not winner) | Receive `bid_auction_lost` email + in-app notification | Completed |
| Payment flow from won notification | Click "Congratulations! You won!" notification | Opens listing modal with Complete Payment CTA → Stripe Checkout → success redirect to /transactions?tab=wins | Completed |
| Mark as shipped flow | As seller on paid-unshipped auction, fill carrier + tracking, submit | `shipped_at` set; buyer receives shipped notification; comic cloned to buyer's collection | Completed |
| Feedback eligibility unlocks on ship | As buyer, after seller marks shipped | "Leave Feedback" button renders in listing modal | Completed |
| Submit feedback | Choose Positive/Negative, optional comment, Submit | Inserts row; refresh shows "Feedback submitted on {date}" instead of button | Completed |
| Seller reputation badge | View seller info in modal after feedback | Shows patton+test2 (100%) with shield icon | Completed |

### Notification Routing (Apr 22, 2026)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| "You won!" click | Click notification in bell | Opens listing modal via router.push('/shop?listing=<id>') | Completed |
| "Item sold!" click (seller) | Click notification | Opens listing modal; seller sees MarkAsShippedForm if paid-unshipped | Completed |
| "Payment received" click (seller) | Click notification | Opens listing modal | Completed |
| "Shipped" click (buyer) | Click notification | Opens listing modal; buyer sees tracking details + Leave Feedback if eligible | Completed |
| "Leave Feedback" click (rating_request) | Click notification | Opens listing modal with feedback form focus — `?leave-feedback=true` query param | Completed |
| No duplicate notifications | End auction via cron once | Single win + single sold notification (idempotency guard) | Completed |

### Transactions Page (Apr 22, 2026)

**Location:** Nav → Wallet icon → Transactions

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Tab: Wins | Navigate with `tab=wins` | Lists auctions where user is winner, with status pills | Completed |
| Tab: Purchases | Navigate with `tab=purchases` | Lists Buy Now purchases | Completed |
| Tab: Bids | Navigate with `tab=bids` | Lists most-recent bid per auction with bidAmount + isWinning | Completed |
| Tab: Offers | Navigate with `tab=offers` | Lists user's submitted offers | Completed |
| Status pill: Awaiting Shipment | Paid but not shipped | Pill shows "Awaiting Shipment" | Completed |
| Status pill: Shipped | `shipped_at` set | Pill shows "Shipped" with tracking | Completed |
| Status pill: Pending Payment | Winner, payment pending | Pill shows "Pending Payment" with Complete Payment CTA | Completed |
| Deep link after Stripe success | After paying, redirect URL | Lands on /transactions?tab=(purchases|wins)&purchased=<id> | Completed |

### Clerk Profile Email Sync (Apr 22, 2026)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| New user via email sign-up | Create account with email/password | Webhook creates profile row with email populated | Pending |
| New user via Google OAuth | Sign in with Google | Webhook creates profile row with Google email populated | Pending |
| User changes primary email in Clerk | Update email in Clerk-hosted profile | `user.updated` webhook syncs new email to profiles.email | Pending |
| Pre-existing null-email profile | Lazy `getOrCreateProfile` call with email | Existing profile row backfilled with email | Pending |

### Payment Deadline Enforcement (Apr 23, 2026)

**Scope:** Validates what currently happens when an auction winner misses the 48-hour payment deadline. Bundled with the first real-money Stripe Connect test.

**Audit summary (what code does TODAY):**
- Deadline is **48 hours** from auction end / Buy-It-Now / offer-accept (`PAYMENT_WINDOW_HOURS = 48` in `src/types/auction.ts:560`; deadline is computed inline at `auctionDb.ts:872`, `1179`, `1355`, `1901`).
- Payment deadline is **stored only** on the `auctions.payment_deadline` column and displayed to the buyer via the `auction_won` email (`src/lib/email.ts:632`). It is **surfaced to the buyer as plain text** — no countdown on the Transactions page.
- **No cron / webhook / on-load check enforces the deadline.** `processEndedAuctions()` only transitions `active → ended`. `expireListings()` in `auctionDb.ts:2276` is filtered to `listing_type = 'fixed_price'` and only cancels unsold listings — it does not touch `ended` auctions with unpaid winners.
- **No second-highest-bidder promotion logic exists** anywhere in the codebase (grep for "second", "runner_up", "next_highest", "promote" returns nothing).
- **No `payment_reminder` email is wired.** The notification type string exists in `auctionDb.ts:1516/1543` and in the `NotificationType` union (`auction.ts:17`), but nothing ever calls `createNotification(..., "payment_reminder", ...)`.
- The only deadline-adjacent gate is `src/app/api/checkout/route.ts:97`, which blocks checkout when `paymentStatus !== "pending"` — this is a duplicate-payment guard, **not** a deadline guard. A winner CAN still pay days/weeks after the deadline today.

> **Expected behavior under current code:** deadline lapses silently. Auction stays `status='ended'` + `payment_status='pending'` forever. Seller cannot relist. Winner can still click Complete Payment and pay whenever they want.

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| **Scenario 1 — Winner never pays (deadline lapses)** | Preconditions: auction (status=active) with winner bid placed; seller has Stripe Connect onboarded. Steps: (1) Wait for auction end OR manually set `end_time` to `NOW() - 1 minute` in Supabase. (2) Hit `GET /api/cron/process-auctions` (dev) or wait up to 5 min for Netlify cron. (3) Confirm `status=ended`, `winner_id` set, `payment_status=pending`, `payment_deadline` = end + 48h. (4) Do NOT pay. (5) Manually set `payment_deadline` to `NOW() - 1 minute` in Supabase. (6) Hit the cron endpoint again. | **DOCUMENTS CURRENT BUG:** Auction row stays `status=ended`, `payment_status=pending` forever. No notification/email fires to either party. No auto-cancel. Row is effectively stuck. Verify by querying `SELECT status, payment_status, payment_deadline FROM auctions WHERE id=<id>;` — should be unchanged. | Pending |
| **Scenario 2 — Payment attempted after deadline** | Preconditions: completed Scenario 1 (deadline past, `payment_status=pending`, auction not cancelled). Steps: (1) As winner, open `/transactions?tab=wins`, locate the stale auction. (2) Click "Complete Payment" → Stripe checkout. (3) Complete payment with a test card. | **DOCUMENTS CURRENT BUG:** Stripe checkout succeeds. Payment goes through. Buyer is charged post-deadline. Seller receives `auction_sold` payout via Stripe Connect. Verify: Stripe dashboard shows successful charge; `auctions.payment_status='paid'`; no error surfaced anywhere. This confirms the deadline is cosmetic-only today. | Pending |
| **Scenario 3 — Second-highest bidder fallback** | N/A — feature does not exist. | **NO CODE EXISTS** for promoting a second-highest bidder. Confirmed by grep across `src/`. If/when this is prioritized, add a backlog item; for now, the test is "verify that no such behavior occurs": losing bidders remain at `is_winning=false`, receive only the original `bid_auction_lost` notification, and are never automatically promoted when a deadline lapses. Verify by running Scenario 1 with a 2nd-place bidder and confirming that bidder's `bids` row is unchanged and they receive no new notification. | Pending |
| **Scenario 4 — Notifications fire correctly** | Preconditions: same as Scenario 1. Steps: (1) Monitor the winner's email inbox + in-app notifications for the full 48h window. (2) Monitor seller's inbox/notifications after deadline lapses. (3) Query `SELECT * FROM notifications WHERE auction_id=<id> ORDER BY created_at;`. | **DOCUMENTS CURRENT GAPS:** (a) **No reminder email** is sent to the winner at any point during the 48h window (no cron wired). (b) **No cancellation email** is sent to seller after deadline lapses (no enforcement logic). (c) **No cancellation email** is sent to buyer. Only the initial `auction_won` email (with deadline text) and `auction_sold` email fire at auction end. The `payment_reminder` NotificationType string is declared but never emitted. | Pending |

### Payment Deadline Enforcement — After Gap 1 + 3 + 6 Fix (Apr 23, 2026)

**Scope:** Validates the new `sendPaymentReminders()` + `expireUnpaidAuctions()` cron passes. Supersedes Scenarios 1 and 4 above — those documented the pre-fix behavior; these verify the fix works.

**What changed:**
- New DB columns: `auctions.payment_reminder_sent_at`, `auctions.payment_expired_at` (migration `20260423_payment_reminder_tracking.sql`)
- Two new cron functions in `src/lib/auctionDb.ts`: `sendPaymentReminders()` (fires at T-24h), `expireUnpaidAuctions()` (transitions to `status='cancelled'` post-deadline)
- Three new email templates in `src/lib/email.ts`: `payment_reminder`, `auction_payment_expired` (buyer), `auction_payment_expired_seller`
- Two new NotificationTypes: `auction_payment_expired`, `auction_payment_expired_seller` (`payment_reminder` already existed)
- Four hardcoded `48`s in `auctionDb.ts` replaced with `calculatePaymentDeadline()` helper
- Cron route wires all three passes: `processEndedAuctions` → `sendPaymentReminders` → `expireUnpaidAuctions` → existing offer/listing expiry

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| **Scenario 5 — Reminder fires at T-24h mark** | Preconditions: auction with `status='ended'`, `payment_status='pending'`, `payment_deadline` within the next 24 hours, `payment_reminder_sent_at IS NULL`. Steps: (1) In dev, set `payment_deadline` to `NOW() + 20 hours` in Supabase. (2) Hit `GET /api/cron/process-auctions`. (3) Inspect response JSON for `paymentReminders.reminded >= 1`. (4) Query `SELECT payment_reminder_sent_at FROM auctions WHERE id=<id>;` — should be stamped. (5) Check winner's inbox for `payment_reminder` email (subject: "Payment due soon — [comic] #[issue]"). (6) Query `SELECT * FROM notifications WHERE auction_id=<id> AND type='payment_reminder';` — one row. | Reminder email delivered with correct hours-remaining copy and a working "COMPLETE PAYMENT" CTA linking to `/transactions?tab=wins`. In-app notification row created. `payment_reminder_sent_at` stamped. | Pending |
| **Scenario 6 — Expiry transitions ended → cancelled** | Preconditions: auction past deadline, `status='ended'`, `payment_status='pending'`, `payment_expired_at IS NULL`. Steps: (1) Set `payment_deadline` to `NOW() - 1 minute`. (2) Hit `GET /api/cron/process-auctions`. (3) Inspect response JSON for `unpaidAuctions.expired >= 1`. (4) Query `SELECT status, payment_expired_at FROM auctions WHERE id=<id>;` — `status='cancelled'`, `payment_expired_at` stamped. (5) Check winner's inbox for `auction_payment_expired` email ("Payment window closed"). (6) Check seller's inbox for `auction_payment_expired_seller` email ("Buyer did not pay"). (7) Confirm via Stripe dashboard that NO charge was created. | Auction flipped to `cancelled`. Both parties notified in-app + by email. No Stripe charge. Comic ready for re-list (seller sees `RE-LIST COMIC` CTA linking to `/collection`). | Pending |
| **Scenario 7 — Idempotency on both cron passes** | Preconditions: Scenario 5 + 6 both completed on the same auction (i.e., it's already cancelled; reminder already sent). Steps: (1) Hit `GET /api/cron/process-auctions` a second time. (2) Inspect JSON response. (3) Query notifications table for duplicates. (4) Check inbox for duplicate emails. | `paymentReminders.reminded = 0`, `unpaidAuctions.expired = 0`. No duplicate notifications. No duplicate emails. Logs include `[sendPaymentReminders] processed 0, skipped N` and `[expireUnpaidAuctions] processed 0, skipped N`. | Pending |
| **Scenario 8 — Race-safety (simultaneous cron runs)** | Preconditions: unpaid auction past deadline. Steps: (1) Trigger the cron endpoint twice in parallel (e.g., two concurrent `curl` requests). (2) Query notifications table. | Exactly one `auction_payment_expired` and one `auction_payment_expired_seller` notification row. Exactly one email sent to each party. `payment_expired_at` stamped exactly once. The conditional `.eq("status","ended").eq("payment_status","pending").is("payment_expired_at",null)` UPDATE with `.select("id")` ensures only one of the two parallel runs wins. | Pending |
| **Scenario 9 — Reminder not re-sent on cron after expiry** | Preconditions: auction where reminder was sent but payment still not made, deadline now past. Steps: (1) Verify `payment_reminder_sent_at` is set and `payment_deadline < NOW()`. (2) Hit cron. | Reminder pass filters out the row (deadline already passed). Expiry pass catches it. Winner receives `auction_payment_expired`, NOT a duplicate `payment_reminder`. | Pending |

**Gaps / bugs surfaced by this audit (add to BACKLOG before real-money test):**
1. **No payment deadline enforcement** — winners can abandon auctions and the seller has no automated recourse. Recommend: add `expireUnpaidAuctions()` to `processEndedAuctions` cron that cancels `status=ended AND payment_status=pending AND payment_deadline < NOW()`, notifies both parties, and optionally re-activates the listing.
2. **No post-deadline checkout guard** — `src/app/api/checkout/route.ts:89–103` should also check `payment_deadline > NOW()` and reject with a clear error.
3. **`payment_reminder` notification type is declared but never emitted** — either wire it (e.g., send at T-12h) or remove the dead type from the union.
4. **Second-highest-bidder promotion is not implemented** — decision required: is this a product goal, or should sellers just relist?
5. **Buyer has no UI warning the deadline is approaching** — transactions page shows "Pending Payment" pill but no countdown; buyers may not realize a deadline exists after the email is buried.

### hCaptcha Guest Scan Protection (Apr 23, 2026)

**Scope:** Validates the new hCaptcha gate on guest scans 4-5 of the free-tier scan limit. Authenticated users should never see CAPTCHA. Also validates the siteverify timeout guard.

**What changed (Session 39 follow-up):**
- New client component `GuestCaptcha` renders invisible hCaptcha + floating badge
- Gated on `guestScansCompleted >= 3` (scans 4 and 5 only)
- Server-side siteverify in `/api/analyze` via new `src/lib/hcaptcha.ts` helper
- 5s AbortSignal timeout on siteverify fetch with user-friendly error copy
- Dev/prod key swap via `NODE_ENV`
- hCaptcha plan: Pro Publisher trial until May 7, 2026 → auto-downgrade to free

**Preconditions:**
- Guest session (no Clerk sign-in, localStorage `guestScansCompleted` reset to 0 via DevTools if needed)
- `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` + `HCAPTCHA_SECRET` set in env
- Dev server running

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Scans 1-3: no CAPTCHA rendered | As guest, scan 3 comics back-to-back | No hCaptcha badge visible; no CAPTCHA token required; server-side siteverify skipped | Pending |
| Scan 4: invisible CAPTCHA runs | As guest with `guestScansCompleted=3`, upload a 4th scan | Invisible CAPTCHA challenge runs silently for valid traffic; scan proceeds normally. Floating hCaptcha badge visible bottom-right | Pending |
| Scan 4: suspicious traffic sees challenge | Use a VPN / Tor / known-bot UA, scan 4th comic | hCaptcha presents visible challenge (image puzzle); must solve before scan executes | Pending |
| Scan 5: same CAPTCHA gate as scan 4 | As guest with `guestScansCompleted=4`, scan a 5th comic | Same behavior as scan 4 — invisible for clean traffic, challenge for suspicious | Pending |
| Scan 6+: blocked by existing limit | As guest with `guestScansCompleted=5`, attempt scan 6 | Existing scan-limit upgrade prompt fires; CAPTCHA never runs (upstream block) | Pending |
| Authenticated user: no CAPTCHA ever | Sign in, scan 10 comics | No CAPTCHA badge at any scan; no CAPTCHA token sent in request; server-side siteverify skipped for authenticated users | Pending |
| hCaptcha outage — siteverify timeout | Block `hcaptcha.com/siteverify` in DevTools → Network → "Block request URL". As guest, attempt scan 4 | Within ~5 seconds, user sees friendly error "CAPTCHA verification is slow right now. Please try again in a moment." No 30-second hang. Scan slot released. | Pending |
| Widget rendering — scans 1-3 | Observe page at scans 1-3 | No hCaptcha floating badge visible | Pending |
| Widget rendering — scans 4+ | Observe page at scan 4+ start | Floating hCaptcha badge visible at bottom-right of viewport | Pending |
| Missing CAPTCHA token on scan 4 | Manipulate client to send `/api/analyze` request without CAPTCHA token (via DevTools or curl) | Server responds HTTP 400 "CAPTCHA required" with failure reason `captcha_missing`. Scan slot released. | Pending |
| Invalid CAPTCHA token on scan 4 | Send scan 4 request with garbage `captchaToken` value | Server responds with "CAPTCHA verification failed"; scan slot released. | Pending |

### Second Chance Offer — Seller-Initiated (Apr 23, 2026)

**Scope:** When an auction expires unpaid and a runner-up (second-highest bidder) exists, seller can offer the item to the runner-up at their last actual bid price. Runner-up has 48 hours to accept.

**What changed (Session 39):**
- New table `second_chance_offers` (migration `20260423_second_chance_offers.sql`)
- New cron pass `expireSecondChanceOffers` in `/api/cron/process-auctions`
- 5 new email templates, 7 new notification types
- UI: `SecondChanceOfferButton` (seller), `SecondChanceInboxCard` (runner-up)
- Routes: `/api/auctions/[id]/second-chance`, `/api/second-chance-offers`, `/api/second-chance-offers/[id]`

**Preconditions:**
- Completed auction with at least 2 distinct bidders (winner + runner-up)
- Winner misses 48h payment deadline → auction transitions to `status=cancelled`, `payment_expired_at` stamped
- Seller has Stripe Connect active
- Runner-up still has active account

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Seller notification on expiry with runner-up | Let auction expire unpaid with runner-up. Wait for cron `expireUnpaidAuctions` to run. | Seller receives email + in-app notification: "Offer to runner-up?" with CTA. Email includes comic + runner-up bid amount. | Pending |
| Seller clicks "Offer to runner-up" CTA | From notification or transaction page, click CTA → confirm | New row in `second_chance_offers` with `status='pending'`, 48h expiry. Runner-up receives notification + email ("Second chance offer for [comic]"). | Pending |
| Runner-up accepts within 48h | As runner-up, open second-chance inbox card → click Accept → Stripe checkout → pay | Auction transitions to paid state for runner-up. Second-chance offer `status='accepted'`. Standard post-payment flow (transfer, shipping notification, etc.). | Pending |
| Runner-up declines | As runner-up, click Decline on inbox card | Offer `status='declined'`. Seller notified. Offer ends (no cascade). Seller can re-list manually. | Pending |
| Runner-up ignores (48h timeout) | Do not act on offer. Let cron `expireSecondChanceOffers` run. | Offer `status='expired'` after 48h. Seller receives "Offer expired — consider re-listing" notification. Runner-up does NOT receive a penalty strike. | Pending |
| No runner-up exists | Auction ends with only 1 bidder. Winner misses payment. | Seller receives standard payment-expired notification but NO "Offer to runner-up" CTA. No second-chance offer is created. | Pending |
| Idempotency — double CTA tap | Seller taps "Offer to runner-up" twice rapidly | Exactly ONE `second_chance_offers` row created. Second tap either hits existing-offer error or returns same offer ID. No duplicate notifications/emails to runner-up. | Pending |
| Audit log entries | After any of the above flows | `auction_audit_log` contains rows for `second_chance_offered`, `second_chance_accepted`/`declined`/`expired` as appropriate | Pending |
| **(Session 42) Mutex — only ONE seller email at expiry** | Auction expires unpaid with runner-up. Wait for cron. | Seller receives ONLY the "Second Chance Available" email/notification. **Does NOT receive** the "Buyer didn't pay: cancelled, relist ready" email. | Pending |
| **(Session 42) Cancellation email after runner-up flow exhausted** | Runner-up accepts offer, then runner-up doesn't pay within their 48h window. Wait for cron. | Seller receives the standard "Buyer didn't pay: cancelled, relist ready" email/notification on the runner-up's expiry (because the `second_chance_offers` row already exists, suppression logic falls through). | Pending |
| **(Session 42) Seller CTA in AuctionDetailModal** | As seller, open `/shop?listing=<auctionId>` for a cancelled auction with runner-up, no offer yet sent | Modal shows "Buyer Did Not Pay" section with "Offer to Runner-up for $X.XX" button. Click → confirm dialog → POST creates offer; section flips to "Second chance offer sent. The runner-up has 48 hours…" without a hard reload. | Pending |
| **(Session 42) Modal copy reflects offer state** | Cycle through all 4 second-chance states for a cancelled auction the seller owns | Pending → "offer sent, 48h to respond"; Accepted → "awaiting payment"; Declined → "back in collection, ready to re-list"; Expired → "didn't respond in 48h, ready to re-list"; no-runner-up → "no runner-up bid was placed". | Pending |
| **(Session 42) Email deadline shows ET timezone** | Win an auction or trigger payment_reminder cron | "Complete payment by April 26, 2026 at 10:20 AM EDT" (or "EST" in winter). NEVER an unlabeled time. Verify in DST and standard-time periods. | Pending |
| **(Session 42) Second-chance email shows ET expiry** | Trigger second-chance offer to runner-up | Runner-up email reads "You have until April 28, 2026 at 10:20 AM EDT (48 hours)…" | Pending |

### Payment-Miss Strike System (Apr 23, 2026)

**Scope:** Tracks missed payments on a rolling 90-day window. First miss → warning email. Second miss within 90 days → user flagged (bid restriction + reputation hit + admin notification).

**What changed (Session 39):**
- Migration `20260423_payment_miss_tracking.sql` adds 4 profile columns + `user_flagged` audit enum value
- Bid placement route checks `is_flagged` and returns HTTP 403
- Reputation hit via system-inserted negative rating (idempotent on unique constraint)
- New admin endpoint `/api/admin/flagged-users`

**Preconditions:**
- Fresh guest account (`payment_miss_count=0`, `is_flagged=false`)
- Active auction with bid placed on it

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| First miss — warning only | Winner misses 48h deadline on one auction. Wait for `expireUnpaidAuctions`. | `profiles.payment_miss_count = 1`, `last_payment_miss_at` stamped. Winner receives warning email ("Please pay on time — one strike"). NO bid restriction. NO reputation hit. NO admin notification. | Pending |
| Second miss within 90 days — flagged | Same user misses a 2nd payment within 90 days of the first | `payment_miss_count = 2`, `is_flagged = true`, `flagged_at` stamped. Negative rating row inserted in ratings table (1-star, system-attributed). Admin receives notification. Flagged user receives `payment_missed_flagged` email. | Pending |
| Flagged user attempts new bid | As flagged user, try to place a bid on any auction | HTTP 403 response with `{error: "Bidding restricted"}`. No bid row created. Friendly UI message surfaces. | Pending |
| Strike outside 90-day window counts as first | User missed payment 91+ days ago (only 1 miss ever). They miss a second payment. | Treated as FIRST offense (rolling window). Warning email sent. `payment_miss_count` increments to 2 but `is_flagged` stays false because the first miss is outside the window. (Or: implementation may reset count — verify behavior matches spec.) | Pending |
| Admin queries flagged-users endpoint | As admin, `GET /api/admin/flagged-users` | Returns JSON array of flagged profiles with `payment_miss_count`, `flagged_at`, reputation score. Non-admin users receive 403. | Pending |
| Idempotent negative rating | Manually trigger flagging logic twice on same user | Only ONE negative rating row exists (unique constraint prevents duplicate). | Pending |
| Audit log entries | After any flag event | `auction_audit_log` contains `user_flagged` row with user ID + strike counts | Pending |

### Email Notification Preferences (Apr 23, 2026)

**Scope:** 4-category toggle system. Transactional is always-on (locked). Marketplace / Social / Marketing each togglable per user on `/settings/notifications`.

**What changed (Session 39):**
- Migration `20260423_notification_preferences.sql` adds 3 boolean columns on profiles
- `NOTIFICATION_CATEGORY_MAP` in `src/types/notificationPreferences.ts` covers all 27 notification email types
- `sendNotificationEmail` + `sendNotificationEmailsBatch` gate on preferences before dispatch
- GET/PATCH `/api/settings/notifications` extended
- UI at `/settings/notifications`

**Preconditions:**
- Signed-in user
- At least one other account to trigger notifications from

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Transactional always sends | Disable all togglable categories on `/settings/notifications`. Trigger `auction_won` (win an auction) and `payment_received` (receive payment) | Both emails deliver regardless of toggle state. Transactional cannot be disabled. | Pending |
| Marketplace off → no outbid/offer emails | Toggle Marketplace OFF. Get outbid by another user. Receive an offer. Receive a second-chance offer. | No outbid email. No offer-received email. No second-chance email. In-app notifications still appear (toggles gate email only). | Pending |
| Marketplace off → transactional still works | With Marketplace OFF, win an auction and pay | `auction_won` + `payment_received` + `purchase_confirmation` emails all deliver (transactional category) | Pending |
| Social off → no follow/message emails | Toggle Social OFF. Have another user follow you. Have another user send a message. | No new-follower email. No new-message email. | Pending |
| Marketing off → no product updates | Toggle Marketing OFF. Trigger any marketing email (product update, re-engagement, newsletter) | No marketing emails deliver. | Pending |
| Batch send respects per-recipient prefs | Trigger cron path that calls `sendNotificationEmailsBatch` to a mix of recipients with different preferences (e.g., auction expiry to buyer + seller where seller has Marketplace OFF) | Seller's email is skipped. Buyer's email sends. Logs show skipped-count reporting per category. | Pending |
| Preference UI persists across sessions | Toggle Marketplace OFF on `/settings/notifications` → sign out → sign back in | Toggle state persists (reads from `profiles`, not localStorage). | Pending |
| GET /api/settings/notifications | As signed-in user, GET the endpoint | Returns JSON `{transactional: true, marketplace: bool, social: bool, marketing: bool}`. `transactional` is always `true`. | Pending |
| PATCH with unknown fields rejected | PATCH with `{foo: true}` | HTTP 400 validation error (strict schema) | Pending |

### Input Validation Sweep (Apr 23, 2026)

**Scope:** Spot-check that the Zod validation sweep across 82 API routes rejects malformed input with a consistent error shape.

**What changed (Session 39):**
- New shared helper `src/lib/validation.ts` with `validateBody`/`validateQuery`/`validateParams`
- Standardized error shape: `{error: string, details: [{field, issue}]}` with HTTP 400
- Strict schema used on settings routes to reject unknown fields

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| POST /api/auctions with missing required fields | `curl -X POST /api/auctions -d '{}'` (authenticated) | HTTP 400 with `{error, details: [{field, issue}, ...]}` listing required fields | Pending |
| POST /api/username with dash | `curl -X POST /api/username -d '{"username":"my-name"}'` | HTTP 400 with details array, regex-violation message | Pending |
| POST /api/analyze without `image` field | POST to analyze with no image | HTTP 400 before any scan-slot reservation or AI call. Scan count not incremented. | Pending |
| GET /api/transactions with invalid `type` query | `GET /api/transactions?type=garbage` | HTTP 400 with enum-validation details | Pending |
| Consistent error shape across routes | Trigger validation errors on 3-5 different routes | All responses match `{error, details:[{field, issue}]}` shape. HTTP status always 400. | Pending |

### Auction Audit Log (Apr 23, 2026)

**Scope:** New `auction_audit_log` table + 17 wire-ups across auction/offer/payment/shipment/bid lifecycle. Admin-only read via RLS.

**What changed (Session 39):**
- Migration `20260423_auction_audit_log.sql` creates table + enum + indexes + RLS
- `src/lib/auditLog.ts` with fire-and-forget single + batch variants
- Stripe webhook integration logs payment events

**Preconditions:**
- Admin account (`is_admin = true` on profile)
- Non-admin account for RLS verification

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Auction state transition generates audit row | Create auction, wait for it to end, let cron process it | `auction_audit_log` contains rows for `auction_created`, `auction_ended`, `auction_finalized` (or equivalent event types) | Pending |
| Bid placement generates `bid_placed` | Place a valid bid | `auction_audit_log` row inserted with event_type `bid_placed`, actor_id = bidder, auction_id correct | Pending |
| Successful payment generates `payment_succeeded` | Complete a Stripe Checkout for an auction or Buy Now | Stripe webhook inserts `payment_succeeded` row with transfer amount in metadata | Pending |
| Shipment generates `shipment_created` | Seller marks auction as shipped with carrier + tracking | `auction_audit_log` row for `shipment_created` with tracking metadata | Pending |
| Non-admin cannot read audit table | As non-admin user, query `SELECT * FROM auction_audit_log` via Supabase client | RLS blocks query (empty result or 403, depending on client). Direct REST call returns 401/403. | Pending |
| Admin can read audit table | As admin user, query the table | Full rows returned | Pending |
| Offer events logged | Create, accept, and decline an offer | Audit rows for `offer_created`, `offer_accepted`, `offer_declined` | Pending |
| User flag event logged | Trigger payment-miss strike flagging | Audit row for `user_flagged` with strike count + timestamp | Pending |

### Session 40 — Marketplace PROD Testing (Apr 23, 2026)

**Scope:** Full end-to-end marketplace testing session with three accounts running concurrently in PROD: **collector-patton** (buyer, Mac Chrome, Free), **patton716** (seller, Android Chrome, Free), **pattonrt** (bidder, iOS Chrome, Free). Spanned 5 deploys (40a → 40e) covering Buy Now checkout, mobile modal layout, feedback flow timing, FMV lookup fallback, email copy polish, FAQ modal polish, Active Bids fix, sales page gating, and site-wide em dash sweep.

**What changed this session (all files cited in DEV_LOG):**
- `src/app/api/checkout/route.ts` — defensive `cover_image_url` guard (http(s) only, ≤2048 chars)
- `src/components/auction/AuctionDetailModal.tsx` — mobile cover `max-h-[35vh]`
- `src/components/auction/ListingDetailModal.tsx` — mobile cover `max-h-[40vh]` + feedback refresh tick
- `src/app/api/webhooks/stripe/route.ts` — removed premature `rating_request`
- `src/app/api/auctions/[id]/mark-shipped/route.ts` — `rating_request` for both buyer + seller at shipment
- `src/hooks/useFeedbackEligibility.ts` — `refreshKey` arg
- `src/app/api/comics/[id]/refresh-value/route.ts` — new FMV lookup endpoint
- `src/components/ComicDetailModal.tsx` — "Look Up Market Value" CTA + optimistic state update
- `src/lib/email.ts` — purchase confirmation copy fix + outbid `yourMaxBid` render + em dash sweep
- `src/lib/auctionDb.ts` — pass `yourMaxBid` at outbid call site + em dashes
- `src/components/Navigation.tsx` — new FAQ entry, body scroll lock on modal, link-close delegation, em dashes
- `src/app/api/transactions/route.ts` — `bid_amount` column fix
- `src/app/sales/page.tsx` — restructured gating: list always visible, 3 stat cards blurred with upgrade CTA for free users, Cost + Profit columns hidden entirely for free tier
- `src/app/seller-onboarding/page.tsx` — "continue to" spacing typo + em dashes
- Em dash site-wide sweep across 10 files (~55 replacements in user-facing copy only)

**Preconditions:**
- Three distinct test accounts with established relationships (collector-patton following / bidding on patton716's listings)
- patton716 has completed Stripe Connect onboarding
- Active auction + active Buy Now listing seeded by patton716
- Test card `4242 4242 4242 4242` for real Stripe PROD charges (kept at $2 test amounts)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| **Buy Now — full end-to-end (happy path)** | (1) patton716 lists a comic as fixed_price via seller flow. (2) collector-patton opens listing, clicks "Buy Now" → Stripe Checkout → pays with test card. (3) Verify success redirect to `/collection?purchase=success`. (4) Both parties receive payment confirmation emails. (5) patton716 opens the listing → "Mark as Shipped" → enters carrier + tracking. (6) Verify comic clones to collector-patton's collection at this step. (7) Both parties receive shipping notification + rating_request. | Checkout completes without 500. Payment emails deliver to both parties. Comic appears in buyer's collection only after shipment marked. Both parties receive shipping notification + rating_request + "Leave Feedback" button surfaces. | Completed 2026-04-23 |
| **Buy Now — overlong / data: cover URL does not 500** | (1) Create a listing whose `cover_image_url` is either a base64 `data:` URL or a Supabase signed URL >2048 chars. (2) As buyer, click "Buy Now" → Stripe Checkout. | Checkout session creates successfully. Stripe Checkout page renders WITHOUT the cover image (gracefully omitted) rather than returning 500 `invalid_request_error`. No image means no crash. | Completed 2026-04-23 |
| **Mobile AuctionDetailModal — cover height cap** | On a phone (or mobile viewport), open an auction listing from `/shop`. | Cover image occupies at most ~35vh of viewport height. Bid details / input / history section is visible and scrollable below the cover without awkward zoom or scroll. | Completed 2026-04-23 |
| **Mobile ListingDetailModal (Buy Now) — cover height cap** | On a phone, open a fixed_price listing from `/shop`. | Cover image occupies at most ~40vh. Price, Buy Now button, and seller details visible without scrolling past a dominating portrait cover. | Completed 2026-04-23 |
| **Auction bidding — outbid notification + email contents** | (1) pattonrt places max bid $5. (2) collector-patton places max bid $10. (3) Check pattonrt's in-app notifications + inbox. | pattonrt receives in-app outbid notification AND email. Email renders both "Current bid: $X" AND "Your max bid: $5" line. "View listing" CTA in email deep-links to the auction page. | Completed 2026-04-23 |
| **FMV / Look Up Market Value — happy path** | (1) As buyer, add a comic to collection manually (no scan, so `price_data: null`). (2) Open the comic's detail modal. (3) Click the blue "Look Up Market Value" CTA. | CTA card renders when `effectivePriceData?.estimatedValue` is falsy. On click: either value populates from eBay Browse (optimistically, no reload) OR "No eBay sales data found" banner surfaces gracefully (the latter is a known limitation at rare-key-at-exact-grade — tracked in BACKLOG as "FMV fallback"). No 500. | Completed 2026-04-23 |
| **Feedback flow — no premature prompt after payment** | Complete a Buy Now purchase as buyer. Immediately check buyer's notifications / email inbox. | Buyer does NOT receive a `rating_request` notification at payment time. No "Leave Feedback" button is rendered in the listing modal yet. (Regression check for 40b fix.) | Completed 2026-04-23 |
| **Feedback flow — prompts fire at shipment for both parties** | After Buy Now payment, as seller click "Mark as Shipped" with tracking. | BOTH buyer and seller receive `rating_request` notification + email. "Leave Feedback" button renders on the listing modal for both parties (buyer rates seller, seller rates buyer). | Completed 2026-04-23 |
| **Feedback flow — button disappears after submit (no refresh)** | With Leave Feedback button visible, submit a rating. Stay on the listing modal. | Button swaps to "Feedback submitted on MM/DD/YYYY" WITHOUT requiring a hard page refresh. Eligibility hook re-fires via `feedbackRefreshTick` state bump. | Pending — 2026-04-24 auction close |
| **Sales page — free tier column + stats gating** | As a free-tier seller (patton716) with at least one completed sale, visit `/sales` on desktop. | Sales list + per-row detail visible. Columns shown: Comic, Sale Price, Date ONLY. Cost column and Profit column are NOT rendered. 3 summary stat cards (Total Sales / Total Profit / Avg. Profit) at top are blurred (`filter blur-sm pointer-events-none select-none`) with an "Unlock your Sales Stats" overlay card containing "Start 7-Day Free Trial" + "View Pricing" buttons. Overlay copy says "Your sale data is still being saved". | Completed 2026-04-23 |
| **Sales page — retroactive unlock on upgrade** | Upgrade patton716 from free → trialing/premium while they have existing sales. Reload `/sales`. | Cost + Profit columns now render on every row. Summary stat cards are unblurred and populated with real numbers. No data loss — `sales` table already stored `purchase_price` + `profit` regardless of tier. | Pending — 2026-04-24 auction close |
| **Active Bids tab — loads without 500** | As pattonrt (current winning bidder on an active auction), visit `/transactions?tab=bids`. | Tab loads. Active bids render with current bid amount. No "Failed to fetch transactions" error. (Regression check: Supabase `select` uses `bid_amount` not `amount`.) | Completed 2026-04-23 |
| **Ask the Professor — modal scroll lock** | Open the FAQ modal. Scroll to the bottom of the FAQ list. Continue scrolling / flick past the end. | Underlying page does NOT scroll while the modal is open. `document.body.style.overflow` is locked to `hidden` for the modal's lifetime and restored on close. | Completed 2026-04-23 |
| **Ask the Professor — internal link closes modal + navigates** | In the FAQ modal, expand "How do I set up my Stripe seller account?". Click the Seller Onboarding link inside the answer. | Modal closes AND browser navigates to `/seller-onboarding` in the same click (delegated `<a>` click handler on the FAQ container fires `setShowProfessor(false)`). Target page is not covered by a lingering modal overlay. | Completed 2026-04-23 |
| **Ask the Professor — "What happens after I buy a comic?" entry** | Open the FAQ modal. Scroll the list and look for the new entry. | Entry "What happens after I buy a comic?" is present. Answer explains: payment → seller notified → ships → comic added to your collection → feedback window opens. | Completed 2026-04-23 |
| **Seller Onboarding — Link step copy spacing** | Visit `/seller-onboarding`. Scroll to the "Link" step section. | The phrase reads "Agree and continue to use Link" with a proper single space between `continue` and `to`. No "continueto" run-together. (JSX forces space via explicit `{" "}`.) | Completed 2026-04-23 |
| **Em dash sweep — FAQ answers** | Open Ask the Professor modal. Read through every FAQ answer. | No `—` (em dash, U+2014) characters visible anywhere in answer text. Separators replaced with commas, periods, colons, or hyphens as appropriate. | Completed 2026-04-23 |
| **Em dash sweep — email templates** | Trigger a purchase confirmation, an outbid email, an item-sold email, and a payment-reminder email. Open each in an email client (HTML + plain-text variants). | No em dashes in subject, body, CTAs, or footer. Both HTML and text variants clean. | Completed 2026-04-23 |
| **Em dash sweep — seller onboarding guide** | Visit `/seller-onboarding` top-to-bottom on desktop + mobile. | No em dashes in any step text, headings, or disclaimers. | Completed 2026-04-23 |
| **Em dash sweep — about / terms / settings pages** | Visit `/about`, `/terms`, `/settings/notifications`. | No em dashes in user-facing copy. (Code comments untouched — not part of scope.) | Pending |
| **Purchase confirmation email — ownership timing copy** | Complete a Buy Now purchase. Open the "Order confirmation" email in your inbox. | Email body reads: "The comic will be added to your collection once the seller marks it as shipped." It does NOT say "has been added to your collection." Matches actual ownership-transfer timing (gates on ship, not payment). | Completed 2026-04-23 |
| **Auction close → winner flow (pending tomorrow)** | On 2026-04-24 at 10:30, the active auction closes with collector-patton as winner. Verify: (1) Winner receives `auction_won` email + notification. (2) Seller receives `item_sold` email + notification. (3) Winner clicks "Complete Payment" → Stripe Checkout → pays. (4) After payment, seller marks shipped. (5) Both parties receive rating_request. (6) Both leave feedback. (7) Feedback button disappears without page refresh on both sides. | Full winner path executes. Feedback button auto-refreshes post-submit. Ownership transfers only after shipment. | Pending — 2026-04-24 auction close |

---

### Notifications Inbox v1 (Session 42d, Apr 27 2026)

**Scope:** New `/notifications` full-page inbox under the More submenu. Bell continues to show last-50 preview with "View all →" footer. Auto-prune: read >30d and unread >90d hard-deleted by cron. Truck icon for `shipped` type. Pre-existing IDOR in `markNotificationRead` patched.

**Preconditions:**
- Migrations `20260427_add_shipped_notification_type.sql` and `20260427_notifications_inbox.sql` run in Supabase BEFORE deploy
- Signed-in account with at least 5 notifications (mix of auction-targeted + system-only)

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| **Inbox accessible from More submenu** | Sign in. Open the More dropdown. | "Inbox" entry visible at top of the menu with a Bell icon. Tap → lands on `/notifications`. | Pending |
| **Inbox renders full message text** | Open `/notifications` with at least one notification whose message exceeds 100 chars (e.g., a `second_chance_offered` row). | Message renders in 3-line clamp at most, full text NOT truncated mid-word. Min row height 88px, Lichtenstein bordered card layout. | Pending |
| **Bell footer "View all →" link** | Open the bell dropdown. | Footer shows "View all notifications →" link on the left, "Close" on the right. Tapping the link closes the dropdown and navigates to `/notifications`. | Pending |
| **Bell shows ALL notifications** | Have a `payment_missed_warning` (system-only) and an `outbid` (auction-targeted) in the inbox. Open the bell. | Both rows visible. The system-only row is dimmed (opacity-70), non-clickable, and shows the "· View in inbox for details" hint. Badge count includes both. | Pending |
| **System-only row tap is no-op in bell** | Tap the dimmed `payment_missed_warning` row in the bell. | Nothing happens — no navigation, no marking-read. (Open the inbox to interact with it.) | Pending |
| **Cursor pagination — load more** | Have >50 notifications. Open `/notifications`. Scroll to the bottom. | Sentinel triggers; next page of up to 50 loads automatically. "Loading more…" indicator briefly visible. New rows appended below. | Pending |
| **Composite cursor handles batch-inserted ties** | Have 51+ notifications where rows 50–52 share a `created_at` (batch insert from `processEndedAuctions`). Page through inbox. | Every row visible exactly once across page boundary. No duplicates, no drops. | Pending |
| **Per-row dismiss (X button)** | Tap the X on a normal-lifecycle notification (e.g., `outbid`). | Row disappears immediately (optimistic). Badge decrements if it was unread. After ~1s, no rollback toast (server confirmed). Refresh page → row stays gone. | Pending |
| **Dismiss network failure → rollback** | Block network in DevTools. Tap X on a notification. | Row disappears optimistically, then reappears within ~1s. Toast "Couldn't delete — try again." appears at bottom. | Pending |
| **Non-deletable types hide X icon** | Find a `payment_missed_warning` in your inbox. | NO X icon visible on that row. Tapping the row marks-read + navigates as normal (or for system-only types, marks read + scrolls). | Pending |
| **Non-deletable types reject DELETE API** | Get the id of a `payment_missed_warning` from DB. `curl -X DELETE /api/notifications/<id>` with valid auth cookie. | HTTP 403 with body `{"error": "This notification can't be dismissed. It contains account-safety information."}`. Row remains in DB. | Pending |
| **Mark all as read** | Have 3+ unread notifications. Open `/notifications`. | Sticky "Mark all as read" button visible at top. Tap → all unread rows visually swap to read state, badge clears, button disappears. Refresh → state persists. | Pending |
| **Mark all as read button hidden when 0 unread** | Open `/notifications` with all notifications already read. | "Mark all as read" button NOT rendered. Page still functional. | Pending |
| **Mark all as read race-safe (asOf clamp)** | Have 5 unread. Click "Mark all as read." Immediately trigger a new notification (e.g., place a bid as another user that outbids you). Refresh inbox. | The 5 original notifications are read. The new outbid (created after the click) is still UNREAD. Badge shows 1. | Pending |
| **`?focus=<id>` deep-link — row in current page** | Visit `/notifications?focus=<id-of-row-3>`. | Page scrolls row 3 into view + flashes a blue ring outline for ~1.5s. URL retains `?focus`. | Pending |
| **`?focus=<id>` deep-link — row was pruned** | Visit `/notifications?focus=00000000-0000-0000-0000-000000000000` (any UUID not in DB). | Toast "Notification not found — it may have been cleared." appears at bottom. URL is `router.replace`d to `/notifications` (no `?focus` param). Page renders normally. | Pending |
| **Empty state** | Sign in with an account that has zero notifications. Visit `/notifications`. | Centered Bell icon + "You're all caught up." headline + "New notifications will appear here." subhead. NO "Mark all as read" button. | Pending |
| **Offline cache — hydration banner** | Open `/notifications` once online to populate cache. Disable network. Refresh page. | Page renders cached notifications immediately. Yellow banner across top: "Showing cached notifications. Tap to refresh →". | Pending |
| **Sign-out clears cache** | Sign in as user A, open inbox to populate cache. Sign out. Sign in as user B (or open in incognito). | User A's cached notifications NOT visible to user B. Confirm `localStorage.cc_notifications_inbox_<userA-id>` is removed (DevTools → Application → Local Storage). | Pending |
| **Auto-prune — read >30d** | Insert a test notification with `read_at = NOW() - INTERVAL '31 days'` directly in Supabase. Wait for next cron pass (or trigger via dev GET). | Row deleted from `notifications`. Cron logs `[prune] notifications: deletedRead=1`. | Pending |
| **Auto-prune — unread >90d** | Insert a test notification with `is_read = false, created_at = NOW() - INTERVAL '91 days'`. Trigger cron. | Row deleted. Cron logs `[prune] notifications: deletedUnread=1`. | Pending |
| **Auto-prune is idempotent** | Run cron 3 times in a row with no fresh notifications older than the cutoff. | All three runs return `deletedRead=0, deletedUnread=0`. No errors. | Pending |
| **Truck icon on shipped notification** | Mark an auction as shipped via `/api/auctions/[id]/mark-shipped`. Open the bell. | "Your comic has shipped!" notification renders with a blue Truck icon (NOT the gray Clock that previously showed). | Pending |
| **IDOR fix — markNotificationRead scoped** | As user A, find user B's notification id (via DB query in dev). `curl -X PATCH /api/notifications -H 'Content-Type: application/json' -d '{"notificationId":"<userB-notif-id>"}'` while authenticated as user A. | API returns success (200) BUT user B's notification is NOT marked read in the DB. (The `.eq("user_id", userId)` clause silently filters the UPDATE.) | Pending |
| **Suspended user — DELETE returns 403** | Mark a test user as suspended. Sign in as that user. Try to dismiss a notification via `/api/notifications/[id]` DELETE. | API returns HTTP 403 with body `{"error": "Your account has been suspended."}`. Notification remains in DB. | Pending |
| **Capacitor push tap (post-iOS-launch only)** | When iOS native ships, send a push notification with payload referencing a system-only type (e.g., `payment_missed_warning`). Tap it from lock screen. | App opens to `/notifications?focus=<id>` and scrolls/highlights the row. (Defer this test until Capacitor build exists.) | Deferred |
| **Mobile bottom-bar safe-area on inbox** | Open `/notifications` on iPhone via PWA "Add to Home Screen." | Bottom of the inbox content respects iOS safe area; nothing hidden behind home indicator. Toast notification renders above safe area. | Pending |
| **Android Chrome PWA — pull-to-refresh disabled** | Open `/notifications` on Android Chrome PWA. Pull down at the top of the inbox list. | No custom pull-to-refresh fires (we use the "tap to refresh" pill instead). Native browser overscroll bounce is acceptable. | Pending |

---

### Session 43 — trade_matches IDOR Fix + My Collection Filter Refactor (Apr 28, 2026)

**Scope:** Three sets of changes shipped together:
1. **Security:** `/api/trades/matches/[matchId]` PATCH route + `tradingDb.ts` helpers now require user scoping (closes a pre-existing IDOR where any authenticated user could mutate any other user's trade match by id).
2. **Filter Phase 1 (desktop):** My Collection page reorganized — list selector tabs deleted, list dropdown gets per-list counts, CSV moved to page actions row, "Viewing:" label, and a list-tagging bug fix for cloud users (`isPrimaryList()` helper distinguishes "My Collection" from other auto-seeded `isDefault: true` lists like Want List / For Sale).
3. **Filter Phase 2 (mobile):** Bottom-sheet drawer for filters + active-filter chips bar with one-tap removal.

**What changed (cited in DEV_LOG):**
- `src/app/api/trades/matches/[matchId]/route.ts` — PATCH now validates `userId` ownership before mutating
- `src/lib/tradingDb.ts` — helpers (`dismissMatch`, `markMatchViewed`, etc.) now take a `userId` param and scope updates with `.eq("user_id", userId)`
- `src/app/collection/page.tsx` — page-actions row, filter card layout, `isPrimaryList()` helper, list dropdown counts, "Viewing:" label
- Mobile filter drawer + chips components under `src/components/collection/`

**Preconditions:**
- Two distinct authenticated test accounts (call them user A and user B)
- User B has at least one open trade match in the `trade_matches` table
- Test account with at least one comic tagged to a Want List and one tagged to a custom list (for filter coverage)
- Cloud-synced account (not local-only) — needed to reproduce the Phase 1 list-tagging bug regression check

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| **IDOR — PATCH another user's match returns 404** | As authenticated user A, find a `trade_matches` row owned by user B (via DB query). `curl -X PATCH /api/trades/matches/<matchId-belonging-to-userB> -H 'Content-Type: application/json' -d '{"action":"dismiss"}'` with user A's session cookie. | HTTP 404 (not 200, not 403). User B's match row is unchanged in the DB. The `.eq("user_id", userId)` scoping filter silently misses the row, returning not-found rather than leaking existence/permission detail. | Pending |
| **IDOR — PATCH own match returns 200 + status flips** | As user A, PATCH `/api/trades/matches/<matchId-owned-by-userA>` with `{"action":"dismiss"}`. | HTTP 200. The match's `status` column flips to `dismissed` (or equivalent). Row is correctly mutated in DB. | Pending |
| **IDOR — mark-viewed on another user's match returns 404** | As user A, PATCH `/api/trades/matches/<matchId-owned-by-userB>` with `{"action":"mark_viewed"}`. | HTTP 404. User B's match `viewed_at` remains null in DB. | Pending |
| **IDOR — suspended user blocked per existing flow** | Mark a test user as suspended in `profiles`. Sign in as that user. PATCH any trade match (own or otherwise). | HTTP 401 or 403 per existing suspension middleware. No DB mutation. | Pending |
| **Phase 1 desktop — page-actions row layout** | On Mac Chrome desktop, sign in and visit `/collection`. Look at the page-actions row (above the filter card). | CSV export button is visible between Share and "+ Add Book". For free-tier users the CSV button is Premium-gated (locked icon or upgrade prompt). For Premium users CSV downloads work. | Pending |
| **Phase 1 desktop — filter card layout** | Same as above. Inspect the filter card. | Filter card renders 3 rows: (1) search box + view toggle + Select button, (2) "Viewing:" label + list dropdown, (3) inline filter chips (Starred / For Trade / Publisher / Title / Grader). | Pending |
| **Phase 1 desktop — old List Selector Tabs row removed** | Same as above. Look above the filter card for any "List" tab strip. | NO list selector tabs row renders. The list-switching UI lives only inside the filter card's list dropdown. | Pending |
| **Phase 1 desktop — "Viewing:" label** | Same as above. | "Viewing:" label is visible directly above (or to the left of) the list dropdown, providing visual context for the dropdown. | Pending |
| **Phase 1 desktop — list dropdown shows counts** | Open the list dropdown. | Each option renders its count: "My Collection (N)" / "Want List (N)" / "For Sale (N)" / custom lists with their counts. Counts reflect actual tagged comics. | Pending |
| **Phase 1 — Want List count is accurate** | With at least 5 comics in the collection but only 2 tagged to Want List, open the list dropdown. | "Want List (2)" — only items actually tagged to Want List, NOT the full collection length. | Pending |
| **Phase 1 — My Collection count equals total** | With N comics total in the collection. | "My Collection (N)" matches the full collection length (every comic counts as in My Collection regardless of tags). | Pending |
| **Phase 1 cloud-user regression — My Collection → Want List → My Collection** | As a cloud-synced (signed-in) user, visit `/collection`. Switch list dropdown to "Want List" and confirm Want List items render. Switch back to "My Collection". | Collection grid renders all items in My Collection both times. No empty grid, no missing books on the second view. (This was the Phase 1 bug — `isPrimaryList()` now correctly distinguishes My Collection from Want List/For Sale even though both are `isDefault: true`.) | Pending |
| **Phase 1 — custom list filters to its tagged items only** | Create a custom list (e.g., "Faves"). Tag 3 specific comics to it. Switch list dropdown to "Faves". | Grid shows ONLY the 3 tagged comics. No other collection items leak through. | Pending |
| **Phase 2 mobile — filter card layout** | On a real iPhone/Android (or DevTools mobile emulator), visit `/collection`. | Filter card on mobile shows: search box / Viewing dropdown / row with [Filters (N)] button + [Sort ▼] dropdown. No inline filter chips on mobile (those live in the drawer). | Pending |
| **Phase 2 mobile — open filter drawer** | Tap the [Filters] button. | Bottom-sheet drawer slides up from the bottom with a darkened backdrop overlay. Page content behind is non-interactive. | Pending |
| **Phase 2 mobile — drawer header** | With drawer open, look at the top. | Header shows "Filters (N)" title (N = active filter count) and a close × button on the right. | Pending |
| **Phase 2 mobile — drawer body content** | With drawer open, scroll body. | Body shows: Starred + For Trade buttons in a split row at top, then Publisher / Title / Grader (Grader only when applicable to the visible list) dropdowns stacked below. | Pending |
| **Phase 2 mobile — drawer footer buttons** | With drawer open, look at the bottom. | Footer has [Clear All] (disabled/gray when no filters active) + [Show N Comics] (live count, blue). N updates as filters are toggled inside the drawer. | Pending |
| **Phase 2 mobile — drawer dismiss methods** | Open the drawer. Test three close paths: (a) tap the backdrop outside the drawer, (b) tap the close × in the header, (c) tap [Show N Comics] in the footer. | Each method closes the drawer and returns focus to the trigger row. | Pending |
| **Phase 2 mobile — active-filter chips appear after picking** | Open drawer, pick (e.g.) Starred + Publisher: Marvel. Close the drawer. | "Active:" label + chip bar appears below the filter card. Chips: [Starred ×] [Publisher: Marvel ×]. Each chip shows the value + an × icon. | Pending |
| **Phase 2 mobile — tap chip × removes filter** | With chips visible, tap the × on the [Starred] chip. | Starred filter clears immediately. The chip disappears from the bar. The [Filters (N)] count badge decrements by 1. Grid updates to show non-starred items. | Pending |
| **Phase 2 mobile — chip bar hidden when no filters** | Clear all filters (via Clear All in drawer or by tapping every chip ×). | Active-filter chip bar is NOT rendered. Filter card collapses back to baseline height. | Pending |
| **Phase 2 mobile — Sort dropdown is OUTSIDE the drawer** | On the filter card trigger row, tap the [Sort ▼] dropdown. | Sort options open in-place (native select or popover) WITHOUT the filter drawer opening. Sort can be changed independently of filters. Confirms Sort is a peer of [Filters], not nested inside the drawer. | Pending |

---

*Last Updated: April 28, 2026*
