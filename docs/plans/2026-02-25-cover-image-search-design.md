# Cover Image Search — Design Document

> **Date:** February 25, 2026
> **Status:** Approved
> **Scope:** CSV import cover images, community cover database, admin approval

---

## Problem

CSV-imported comics currently have no cover images. The previous Comic Vine API integration was unreliable and removed. Users see placeholder images for all imported books with no efficient way to add covers at scale.

## Solution

A two-layer cover image system:

1. **Claude-powered search** — Claude generates optimized search queries, Google Custom Search returns image candidates, user confirms the right cover
2. **Community cover database** — Approved covers are stored centrally and reused for all future lookups, reducing Claude costs over time

---

## Flow

```
CSV Import
    │
    ▼
For each comic: Check community DB (cover_images table)
    │
    ├── HIT → Auto-set cover (no Claude call)
    │
    └── MISS → Claude generates search query
                    │
                    ▼
              Google Custom Search API
                    │
                    ▼
              Present candidates to user
                    │
                    ├── Single result → User confirms → Auto-approved → Community DB
                    │
                    └── Multiple results → User picks one → Admin approval queue
                                                                │
                                                                ├── Approved → Community DB
                                                                └── Rejected → User keeps their pick privately
```

---

## Detailed Steps

### Step 1: CSV Import
- Import completes as normal (fast, no image blocking)
- Comics get placeholder cover images
- After import, user enters a **Cover Review** queue for comics missing covers

### Step 2: Community DB Check
- Query `cover_images` table by normalized `title + issue_number`
- Only return covers with `status = 'approved'`
- If match found, set `cover_image_url` on the comic automatically

### Step 3: Claude Search Query Generation
- For comics with no community match, call Claude with:
  - Title, issue number, publisher, release year (if known)
- Claude returns an optimized Google search query
  - Example input: `Batman #171, DC Comics`
  - Example output: `"Batman 171 1965 DC Comics silver age comic book cover"`
- Claude's comic knowledge helps craft queries that find the right era, printing, and variant

### Step 4: Google Custom Search
- Use the Claude-generated query against Google Custom Search JSON API
- Filter to image results
- Return top candidates (up to ~8 images)
- Cost: $5 per 1,000 queries

### Step 5: Present Candidates to User
- **Cover Review UI** — post-import screen showing comics with placeholder covers
- For each comic, display image candidates in a selectable grid
- User taps/clicks the correct cover

### Step 6: Conditional Approval

| Scenario | Claude Returns | User Action | Admin Needed? | Community DB |
|----------|---------------|-------------|---------------|--------------|
| Single match | 1 image | Confirm | No | Auto-approved |
| Multiple matches (variants) | 2+ images | Pick one | Yes | After approval |

### Step 7: Admin Approval (Variants Only)
- Admin sees a queue of covers submitted from multi-match scenarios
- Each entry shows: comic title/issue, the cover the user picked, other candidates
- Admin approves or rejects
- Rejected covers stay private to the submitting user

### Step 8: Community Database
- Approved covers stored in `cover_images` table
- Keyed by normalized title + issue number
- Future imports of the same comic skip Claude entirely (Step 2 cache hit)

---

## Cost Model

| Phase | Claude Calls | Google Searches | Cost per Comic |
|-------|-------------|-----------------|----------------|
| Day 1 (cold) | Every comic | Every comic | ~$0.007 |
| Month 1+ | Popular comics cached | Cached comics skip | ~$0.003 avg |
| Long term | ~20% of imports | ~20% of imports | ~$0.001 avg |

- Claude query generation: ~$0.002 per call (Haiku, small prompt)
- Google Custom Search: $0.005 per query
- Community DB lookup: Free (Supabase query)

---

## Database Schema

### `cover_images` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| title_normalized | text | Lowercase, trimmed title |
| issue_number | text | Normalized issue number |
| image_url | text | URL of the cover image |
| submitted_by | uuid | FK to profiles |
| approved_by | uuid | FK to profiles (admin), nullable |
| status | text | `pending`, `approved`, `rejected` |
| source_query | text | The Claude-generated query used |
| created_at | timestamptz | Submission time |
| approved_at | timestamptz | Approval time, nullable |

**Index:** `(title_normalized, issue_number, status)` for fast lookups.

**RLS:** All users can read approved covers. Users can read their own pending covers. Admins can read/write all.

---

## Components to Build

### API Routes
- `POST /api/cover-candidates` — community check → Claude query → Google search → return candidates
- `POST /api/cover-images` — user submits selected cover (auto-approve or queue)
- `GET /api/admin/cover-queue` — admin approval queue
- `POST /api/admin/cover-queue/[id]` — admin approve/reject

### UI Components
- **CoverReviewQueue** — post-import screen for picking covers
- **CoverCandidateGrid** — selectable grid of image candidates
- **AdminCoverQueue** — admin page for reviewing pending covers

### Database
- `cover_images` table + RLS policies
- Migration file

### Integration Points
- `CSVImport.tsx` — after import, prompt user to review covers
- `ComicDetailsForm.tsx` — integrate with existing cover URL field
- Admin layout — add cover queue to admin nav

---

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CSE_API_KEY` | Google Cloud API key (Custom Search JSON API enabled) |
| `GOOGLE_CSE_CX` | Programmable Search Engine ID (domain-restricted) |

### Domain-Restricted Search Configuration

Google deprecated "Search the entire web" for new Programmable Search Engines (Jan 2026).
Our engine searches 14 comic-specific domains (50 max allowed):

| Domain | Content |
|--------|---------|
| www.comics.org | Grand Comics Database |
| www.mycomicshop.com | Large inventory with covers |
| www.midtowncomics.com | Retailer cover images |
| comicbookrealm.com | Cover database |
| leagueofcomicgeeks.com | Community covers |
| www.covrprice.com | FMV site with covers |
| imagecomics.com | Image Comics publisher |
| www.marvel.com | Marvel covers |
| www.dc.com | DC covers |
| comicvine.gamespot.com | Cover images (API removed, images still indexed) |
| www.ebay.com | Listing photos |
| www.amazon.com | Product images |
| gocollect.com | Graded comic covers |

**Free tier:** 100 queries/day. **Paid:** $5 per 1,000 queries after that.

---

## Out of Scope (Future)

- Amazon product image search (add as additional source later)
- GoCollect cover images (pending API access)
- eBay listing images as cover source
- Trust threshold for auto-approving frequent contributors
- Bulk admin approval actions
