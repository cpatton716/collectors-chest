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

*Last Updated: March 25, 2026*
