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
| Scan barcode | Click "Scan Barcode" → Scan comic barcode | Comic looked up by UPC, details populated |
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
| Open Key Hunt | Tap Key Hunt in mobile nav | Bottom sheet opens with 3 entry options |
| Scan cover | Select "Scan Cover" → Take photo | AI identifies comic, grade selector appears for raw |
| Scan barcode | Select "Scan Barcode" → Scan UPC | Comic looked up by barcode, grade selector appears |
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
| Barcode cache | Scan same barcode twice | Second scan returns instantly (6-month cache) |
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

*Last Updated: February 2, 2026*
