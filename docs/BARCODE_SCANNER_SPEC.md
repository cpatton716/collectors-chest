# Barcode Scanner Specification

> **Status**: Feature removed (Feb 2026)
> **Reason**: External barcode databases have unreliable/unusable UPC data
> **Path Forward**: Build crowd-sourced barcode catalog from verified cover scans

> **Apr 23, 2026 note:** Metron references below are fully obsolete. Metron was removed from the app entirely this session (scan flow, verification, cover pipeline). Any "Try Metron API" path described in this historical doc no longer exists in code.

---

## Table of Contents

1. [How Comic Barcodes Work](#how-comic-barcodes-work)
2. [Original Implementation](#original-implementation)
3. [Challenges Encountered](#challenges-encountered)
4. [Solutions Attempted](#solutions-attempted)
5. [Why We're Removing It](#why-were-removing-it)
6. [Path Forward: Barcode Catalog](#path-forward-barcode-catalog)
7. [Archived Code Reference](#archived-code-reference)

---

## How Comic Barcodes Work

### UPC Structure for Comics

Modern comic books use a specialized UPC barcode format:

```
┌─────────────────────────────────────────────────────────────┐
│  MAIN UPC (12 digits)              │  ADD-ON (5 digits)     │
├─────────────────────────────────────────────────────────────┤
│  76194 1376912                     │  00521                 │
│  ───── ───────                     │  ─── ──               │
│  Prefix Item#  Check               │  Issue Variant         │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

| Component | Digits | Purpose | Example |
|-----------|--------|---------|---------|
| **UPC Prefix** | 5 | Publisher identifier | `76194` = DC Comics |
| **Item Number** | 6 | Series/title identifier | `137691` |
| **Check Digit** | 1 | Validation (mod-10) | `2` |
| **Add-on Issue** | 3 | Issue number (padded) | `005` = Issue #5 |
| **Add-on Variant** | 2 | Cover variant code | `21` = Variant 21 |

### Known Publisher Prefixes

| Prefix | Publisher |
|--------|-----------|
| `76194` | DC Comics |
| `75960` | Marvel |
| `70985` | Image Comics |
| `72513` | Dark Horse |
| `82771` | IDW Publishing |

### Full Barcode Example

```
Barcode: 76194137691200521

Parsed:
- Publisher: DC Comics (76194)
- Series ID: 137691
- Check Digit: 2
- Issue Number: 5 (from 005)
- Variant: 21

Result: DC Comics series #137691, Issue #5, Variant cover 21
```

---

## Original Implementation

### Components

1. **BarcodeScanner.tsx** - React component for camera-based scanning
   - Used native `BarcodeDetector` API (Chrome/Edge)
   - Supported formats: `upc_a`, `upc_e`, `ean_13`, `ean_8`, `code_128`
   - Manual add-on input fallback when 5-digit code not detected

2. **barcode-lookup/route.ts** - API route for database lookup
   - Queried Comic Vine API with various UPC formats
   - Attempted filtering by issue number, publisher, date
   - Caching via Upstash Redis (6-month TTL)

3. **scan/page.tsx** - Integration with scan flow
   - Barcode option in FAB menu
   - Processing states and error handling
   - Add-on input modal for disambiguation

### Detection Flow

```
User opens scanner
       │
       ▼
Camera activates (getUserMedia)
       │
       ▼
BarcodeDetector scans frames (200ms interval)
       │
       ▼
Main UPC detected (12-13 digits)
       │
       ├── Add-on also detected? ──► Full barcode (17 digits)
       │
       └── Add-on NOT detected? ──► Prompt user for manual input
                                           │
                                           ▼
                                    User enters 5 digits
                                           │
                                           ▼
                                    Submit to barcode-lookup API
```

### API Lookup Flow

```
Receive barcode
       │
       ▼
Check Redis cache ──► HIT? Return cached result
       │
       │ MISS
       ▼
Try Metron API (exact match) ──► Found? Return & cache
       │
       │ NOT FOUND
       ▼
Try Comic Vine API
       │
       ├── <10 results? Use first match
       │
       └── >10 results? Filter by:
              │
              ├── Issue number (from add-on)
              ├── Publisher (from UPC prefix)
              └── Date (post-2000 only)
                     │
                     ▼
              Validate result (reject pre-1985 comics)
                     │
                     ▼
              Return result with hints if invalid
```

---

## Challenges Encountered

### 1. Add-on Detection Failure

**Problem**: The native `BarcodeDetector` API does not detect the 5-digit add-on code that's physically separate from the main UPC barcode.

**Impact**: Without the add-on, we can't determine issue number or variant, making identification impossible for series with many issues.

**Attempted Solutions**:
- html5-qrcode library (has `UPC_EAN_EXTENSION` format) - camera access issues on mobile
- @zxing/library - couldn't detect barcodes at all
- Manual input fallback - worked but added friction

### 2. Comic Vine UPC Data is Garbage

**Problem**: Comic Vine's UPC search does wildcard/fuzzy matching instead of exact matching.

**Evidence**:
```bash
# Any UPC query returns 1.1 million results
curl "comicvine.gamespot.com/api/issues/?filter=upc:76194137691200521"
# Returns: 1,101,894 results
# First results: Chamber of Chills Magazine #13 (1952), Tomb of Terror #5 (1952)
```

**Impact**: Every barcode search returns the entire database, starting with 1950s horror comics regardless of the actual UPC.

### 3. Alternative APIs Unavailable

| API | Status | Issue |
|-----|--------|-------|
| **Metron.cloud** | Server refusing connections | Infrastructure down |
| **comiccover.org** | "Error connecting to database" | Database offline |
| **UPCitemdb** | 0 results | No comic book data |
| **Grand Comics Database** | No public barcode API | Feature not implemented |

### 4. UPC Data Not Standardized

- Some databases store UPC with check digit, some without
- Some include add-on, some don't
- No consistent format across the industry

---

## Solutions Attempted

### Solution 1: Multiple UPC Format Searches

```typescript
const searchVariations = [
  mainUpc,                      // 761941376912
  upcWithoutCheckDigit,         // 76194137691
  mainUpc + addOn,              // 76194137691200521
  upcWithoutCheckDigit + addOn, // 7619413769100521
];
```

**Result**: All formats return same garbage from Comic Vine.

### Solution 2: Result Filtering

```typescript
// Filter by issue number from add-on
const issueFromAddOn = parseInt(addOn.slice(0, 3), 10).toString();
filtered = results.filter(issue => issue.issue_number === issueFromAddOn);

// Filter by publisher from UPC prefix
if (upcPrefix === "76194") expectedPublisher = "DC Comics";
filtered = filtered.filter(issue => issue.publisher === expectedPublisher);

// Filter out old comics
filtered = filtered.filter(issue => year >= 2000);
```

**Result**: Still returns wrong comics because Comic Vine's data has incorrect UPCs assigned to random old comics.

### Solution 3: Validation Gate

```typescript
// Reject results older than 1985 (UPC barcodes didn't exist on comics)
if (resultYear < 1985) {
  return {
    error: "Barcode database returned incorrect match...",
    barcodeHints: { publisher, issueNumber }
  };
}
```

**Result**: Properly rejects garbage, but then we have no result to return.

### Solution 4: Alternative APIs (Metron, comiccover.org)

Attempted integration with Metron.cloud which advertises exact UPC matching.

**Result**: Server infrastructure issues - connections refused.

---

## Why We're Removing It

### The Core Problem

**There is no reliable public database with accurate comic book UPC data.**

- Comic Vine: Wildcard matching returns garbage
- Metron: Infrastructure unreliable
- comiccover.org: Database offline
- UPCitemdb: No comic data
- GCD: No barcode API

### User Experience Impact

When barcode scanning returns wrong results, users:
1. Lose trust in the app
2. Have to re-scan with cover anyway
3. May accidentally add wrong comics to collection

### Cost-Benefit Analysis

| Effort | Benefit |
|--------|---------|
| Complex scanner implementation | Unreliable results |
| Multiple API integrations | All APIs have issues |
| Filtering/validation logic | Still can't fix bad data |
| User confusion/frustration | No time savings |

**Conclusion**: Cover scanning with AI is more reliable and provides better UX.

---

## Path Forward: Barcode Catalog

### Strategy: Crowd-Source Our Own Database

Instead of relying on broken external databases, we'll build our own:

1. **AI reads barcodes during cover scans**
   - Claude/Gemini already analyze cover images
   - Barcode detection is included in the AI prompt (implemented)
   - For **slabbed/graded comics**: The prompt explicitly instructs the AI to distinguish between two barcodes — the cert label barcode (on the grading label) and the comic's UPC barcode (on the cover artwork visible through the slab). The UPC is typically in the bottom-left or bottom-right area of the cover art inside the slab and may be partially obscured by the slab frame.
   - For **raw comics**: Standard UPC detection on the front cover
   - Confidence scoring: "high" (clear, fully readable), "medium" (partially visible), "low" (obscured/damaged)
   - Extract all UPC components

2. **Catalog barcodes after verified saves**
   - User scans cover → AI identifies comic + reads barcode
   - User confirms details and saves to collection
   - Barcode automatically cataloged with comic metadata

3. **Quality control via confidence scoring**
   - High confidence → auto-approve entry
   - Low confidence → admin review queue
   - Admin verifies by viewing cover image

4. **Future re-enablement**
   - Once catalog has sufficient coverage
   - Re-enable barcode scanning using our own data
   - Accurate results from verified user submissions

### Database Schema

```sql
CREATE TABLE barcode_catalog (
  id UUID PRIMARY KEY,
  comic_id UUID REFERENCES comics(id),
  raw_barcode TEXT NOT NULL,
  upc_prefix TEXT,        -- 5 digits (publisher)
  item_number TEXT,       -- 6 digits (series)
  check_digit TEXT,       -- 1 digit
  addon_issue TEXT,       -- 3 digits (issue #)
  addon_variant TEXT,     -- 2 digits (variant)
  confidence TEXT,        -- high/medium/low
  status TEXT,            -- auto_approved/pending/approved/rejected
  submitted_by UUID REFERENCES profiles(id),
  reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
);
```

### Advantages

1. **Verified data** - Only from successful cover scans
2. **Variant coverage** - Each cover variant gets its own entry
3. **Self-improving** - Database grows with user base
4. **No external dependency** - We control the data

---

## Archived Code Reference

### BarcodeScanner Component (Key Logic)

```typescript
// Native BarcodeDetector setup
detectorRef.current = new BarcodeDetector({
  formats: ["upc_a", "upc_e", "ean_13", "ean_8", "code_128"],
});

// Frame scanning at 200ms intervals
const scanFrame = useCallback(async () => {
  const barcodes = await detectorRef.current.detect(videoRef.current);

  for (const barcode of barcodes) {
    const cleanValue = barcode.rawValue.replace(/\D/g, "");

    if (cleanValue.length >= 12 && cleanValue.length <= 13) {
      mainCode = cleanValue;  // Main UPC
    } else if (cleanValue.length === 5 || cleanValue.length === 2) {
      addOnCode = cleanValue;  // Add-on supplement
    }
  }

  if (mainCode) {
    const fullBarcode = addOnCode ? mainCode + addOnCode : mainCode;
    processBarcode(fullBarcode);
  }
}, [processBarcode]);
```

### Barcode Parsing Logic

```typescript
// Parse 17-digit comic barcode
if (barcode.length === 17) {
  mainUpc = barcode.slice(0, 12);  // Main UPC with check digit
  addOn = barcode.slice(12);        // 5-digit add-on
}

// Extract components
const upcPrefix = mainUpc.slice(0, 5);      // Publisher (76194 = DC)
const itemNumber = mainUpc.slice(5, 11);    // Series identifier
const checkDigit = mainUpc.slice(11, 12);   // Validation digit
const issueNumber = addOn.slice(0, 3);      // Issue (005 = #5)
const variantCode = addOn.slice(3, 5);      // Variant (21)
```

### Publisher Detection

```typescript
const PUBLISHER_PREFIXES: Record<string, string> = {
  "76194": "DC Comics",
  "75960": "Marvel",
  "70985": "Image Comics",
  "72513": "Dark Horse",
  "82771": "IDW Publishing",
};

const publisher = PUBLISHER_PREFIXES[upcPrefix] || "Unknown";
```

---

## Files Removed

| File | Purpose |
|------|---------|
| `src/components/BarcodeScanner.tsx` | Scanner UI component |
| `src/app/api/barcode-lookup/route.ts` | API lookup route |
| Related state in `src/app/scan/page.tsx` | Barcode handling |

---

## Timeline

| Date | Event |
|------|-------|
| Jan 2026 | Initial barcode scanner implementation |
| Feb 2 2026 | Major rewrite with add-on handling |
| Feb 4 2026 | Discovered Comic Vine UPC data is garbage |
| Feb 4 2026 | Attempted Metron.cloud integration (failed) |
| Feb 4 2026 | Decision to remove feature and build own catalog |

---

## References

- [UPC-A Wikipedia](https://en.wikipedia.org/wiki/Universal_Product_Code)
- [Comic Book UPC Identification](https://www.barcode-us.com/industry-guidance/comic-book-upc-identification)
- [Bar Code Graphics - Comics](https://www.barcode.graphics/guidance-for-upc-barcodes-for-comic-books/)
