# Collectors Chest — Legal Document Update Briefing

**Prepared:** February 27, 2026
**Purpose:** Update all 4 legal documents to reflect new features added since the original drafts (February 18, 2026)
**Documents Affected:** Terms of Service, Privacy Policy, Acceptable Use Policy, Cookie & Tracking Policy

---

## Summary of Changes Since Feb 18

Three new systems were introduced that require legal coverage:

1. **Creator Credits** — A community contribution reward system
2. **Community Cover Database** — User-submitted comic book cover images with admin moderation
3. **Age Verification Data** — Marketplace age attestation now stores a timestamp

Additionally, one service was removed:
- **Google Custom Search API** — Removed entirely (service is closed to new customers). All references should be removed from legal documents.

---

## 1. Creator Credits System

### What It Is
A gamified contribution system that rewards users for helping build the platform's database. Users earn "Creator Credits" when they submit content that is approved by an administrator.

### How It Works
- A user submits content (currently: cover images; planned: error reports, missing metadata)
- An administrator reviews and approves or rejects the submission
- If approved, the user's contribution count increments by 1
- The user earns a visible badge tier based on total approved contributions:
  - **Contributor** (1–9 approved contributions)
  - **Verified Contributor** (10–25 approved contributions)
  - **Top Contributor** (26+ approved contributions)
- Badges are displayed on the user's public profile
- Each contribution is stored with: user ID, contribution type, reference ID, and timestamp
- Duplicate contributions (same user + same reference) are prevented

### What the Legal Docs Need to Address

**Terms of Service:**
- Creator Credits are non-transferable, have no monetary value, and cannot be redeemed
- Collector's Chest reserves the right to modify tier thresholds or the credit system at any time
- Submissions may be rejected at the sole discretion of administrators
- Content submitted through the Creator Credits system is licensed to Collectors Chest (see Community Cover Database below)

**Privacy Policy:**
- Contribution history is stored (type, timestamp, reference to submitted content)
- Contribution counts and badge tiers are publicly visible on user profiles
- Contribution data is associated with the user's account

**Acceptable Use Policy:**
- Users must not submit fraudulent, spam, or intentionally incorrect contributions to inflate their credit count
- Repeated submission of low-quality or inappropriate content may result in account restrictions

---

## 2. Community Cover Database

### What It Is
A shared database of comic book cover images contributed by users. When a user manually provides a cover image URL for a comic in their collection, that image is automatically submitted to the community database for potential use by all users.

### How It Works
- When a user pastes a cover image URL into the "Set Cover" field on their comic, two things happen:
  1. The image is immediately applied to their comic (existing behavior)
  2. A background submission is sent to the community cover database with status "pending"
- An administrator reviews pending submissions and approves or rejects them
- Approved covers become available to all users searching for covers of that comic
- The submitting user receives a Creator Credit upon approval
- Submissions include: comic title, issue number, image URL, source ("manual-paste"), and submitter's user ID

### What the Legal Docs Need to Address

**Terms of Service:**
- By submitting a cover image URL, the user grants Collectors Chest a non-exclusive, perpetual, royalty-free license to store, display, and distribute the image to other users of the platform
- Users must only submit images they have the right to share (i.e., not copyrighted images they do not have permission to use)
- Collectors Chest is not responsible for the accuracy or legality of user-submitted cover images
- Submissions may be removed or rejected at any time without notice

**Privacy Policy:**
- When a user submits a cover URL, the following is stored: the URL, the comic title/issue it's associated with, the submitting user's internal ID, and the submission timestamp
- Approved cover images are visible to all platform users
- The submitter's identity is not publicly displayed alongside the cover image (only internally tracked for Creator Credits)

**Acceptable Use Policy:**
- Users must not submit inappropriate, offensive, or unrelated images as cover submissions
- Users must not submit images that infringe on third-party copyrights
- Repeated submission of inappropriate content may result in loss of submission privileges or account action

---

## 3. Age Verification Data

### What It Is
The marketplace (buying, selling, bidding, trading) requires users to confirm they are 18 years or older. This is a self-attestation — no date of birth or ID is collected.

### How It Works
- When a user first attempts a marketplace action (list, buy, bid, trade), a modal appears
- The modal states: "By confirming, you attest that you are 18 years of age or older, as required by our Terms of Service"
- The user clicks "I Confirm I'm 18+"
- A timestamp (`age_confirmed_at`) is stored on the user's profile record
- The user is never asked again — the timestamp persists
- No date of birth, government ID, or other age-related personal data is collected

### What the Legal Docs Need to Address

**Privacy Policy:**
- Disclose that an age attestation timestamp is stored on the user's profile when they confirm they are 18+
- Clarify that no date of birth or government identification is collected
- Include `age_confirmed_at` in the types of account information collected

**Terms of Service:**
- Already states 18+ requirement; may want to clarify that the self-attestation is binding and that misrepresentation of age is grounds for account termination

---

## 4. Service Provider Update: Google Custom Search Removed

Google Custom Search API has been completely removed from the platform. It was listed in the original Privacy Policy as a third-party service provider. All references to Google Custom Search should be removed from all legal documents.

**No replacement image search service has been added.** Cover images now come from:
- User-submitted covers (Community Cover Database, described above)
- Open Library API (free, public API for book metadata and covers)
- Direct URL paste by users

### What the Legal Docs Need to Address

**Privacy Policy:**
- Remove Google Custom Search from the list of third-party service providers
- Add **Open Library** (openlibrary.org) as a third-party service: "We query the Open Library API to retrieve book cover images and metadata. No user data is sent to Open Library — only comic title and issue information."

---

## 5. Minor Items

### Guest Scan LocalStorage (Cookie Policy)
Guest users (not logged in) can scan up to 3 comic covers. Their scan results are stored in the browser's `localStorage` (not cookies, not sent to any server). This is already partially covered under "Functional" localStorage usage but could be made more explicit.

**Suggested addition to Cookie Policy:**
- "Guest users' scan results (up to 3) are stored in browser localStorage and are never transmitted to our servers. This data can be cleared by the user at any time through browser settings."

### Netlify (Privacy Policy)
Netlify is the hosting provider and was not listed in the original third-party providers section. It should be added.

**Suggested addition to Privacy Policy third-party providers:**
- **Netlify** — "Website hosting and content delivery. Netlify may process IP addresses and request metadata as part of standard web hosting. See Netlify's privacy policy."

---

## Checklist for Lawyer

| # | Document | Section | Action |
|---|----------|---------|--------|
| 1 | Terms of Service | User Content / Licensing | Add Creator Credits system terms (non-transferable, no monetary value, modifiable) |
| 2 | Terms of Service | User Content / Licensing | Add Community Cover Database content license (non-exclusive, perpetual, royalty-free) |
| 3 | Terms of Service | Eligibility / Age | Strengthen self-attestation language for marketplace 18+ requirement |
| 4 | Privacy Policy | Information We Collect | Add age attestation timestamp (`age_confirmed_at`) disclosure |
| 5 | Privacy Policy | Information We Collect | Add Creator Credits contribution data (type, timestamp, count) |
| 6 | Privacy Policy | Information We Collect | Add Community Cover Database submissions (URL, title, issue, submitter ID) |
| 7 | Privacy Policy | Third-Party Services | Remove Google Custom Search |
| 8 | Privacy Policy | Third-Party Services | Add Open Library API |
| 9 | Privacy Policy | Third-Party Services | Add Netlify (hosting) |
| 10 | Privacy Policy | Public Information | Note that Creator Credit badge/tier is publicly visible on profiles |
| 11 | Acceptable Use Policy | Prohibited Conduct | Add rules against fraudulent Creator Credit submissions |
| 12 | Acceptable Use Policy | Prohibited Conduct | Add rules against inappropriate cover image submissions |
| 13 | Cookie Policy | localStorage | Clarify guest scan data storage (up to 3 scans, never transmitted) |
| 14 | All Documents | Last Updated Date | Update from "February 18, 2026" to new date |

---

*This briefing covers all platform changes from February 18–27, 2026. No other features affecting legal obligations were introduced during this period.*
