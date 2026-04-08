# Deep Dive Review Learnings

Running log of issues found during deep dive reviews, grouped by pattern category.

---

## 2026-04-05 — Cert-First Scan Pipeline Design Spec (Round 1)

**Spec:** `docs/engineering-specs/2026-04-05-cert-first-scan-pipeline-design.md`

### Type System (3 issues)
- **keyComments type mismatch** (Critical): Cert lookup returns `string | null` but spec said "maps to keyInfo array" without defining the transformation. Always verify source and target types match.
- **barcode not in ComicMetadata** (Critical): Cache gate logic referenced a field that doesn't exist in the cache interface. Always verify fields exist in the actual interface before referencing them.
- **AICallType union not updated** (Medium): Added new call types but forgot to update the union type used by `estimateCostCents()`. When adding new enum/union values, grep for all consumers.

### Edge Cases (3 issues)
- **gradingCompany "Other" not handled** (Critical): AI can return "Other" for unknown grading companies, but cert lookup only handles CGC/CBCS/PGX. Always trace enum values through the full call chain.
- **gradingCompany string normalization** (Medium): AI might return "C.G.C." or "cgc" — no normalization defined. When AI returns free-text that maps to an enum, define normalization.
- **artComments ignored** (Medium): Cert lookup returns creator info in `artComments` field that could reduce AI calls. Always audit all fields returned by data sources.

### Error Handling (2 issues)
- **No timeout for Phase 3** (High): Key Info DB lookup hits Supabase with no defined timeout or error behavior. Every external call needs a timeout and failure behavior.
- **No total pipeline timeout** (Medium): Individual phase timeouts defined but no overall budget. Define both per-phase and total timeouts.

### Spec Consistency (2 issues)
- **Edge case table contradicts fallback design** (Medium): Said "primary provider only" in one place but "Gemini → Anthropic fallback" in another. Run consistency checks between narrative and tables.
- **Redundant barcodeNumber + barcode.raw** (High): Two fields carrying the same data without clarifying canonical source. Eliminate redundancy in response schemas.

### Observability (1 issue)
- **Barcode extraction rate unmeasurable** (Low): Success criteria referenced a metric with no tracking infrastructure. Success criteria must have corresponding analytics fields.

### Scope (1 issue)
- **Cover harvest skipped on repeat scans** (High): coverHarvestable not in metadata cache, so repeat scans can never trigger harvest. When gating logic skips a phase, verify the skipped phase's outputs are available from the cache.

## 2026-04-05 — Cert-First Scan Pipeline Design Spec (Round 2)

### Data Model Assumptions (3 issues)
- **barcode_catalog keyed by comic_id, not title/issue** (Critical): Spec assumed lookup by title/issue but table is keyed by comic_id. The comic doesn't exist at scan time. Always verify table schema and key structure before designing queries.
- **catalogBarcode requires comicId** (High): Can't catalog barcode during scan — comic isn't saved yet. Don't assume write operations can happen before the parent record exists.
- **Null barcode in catalog breaks gate logic** (Low): Storing null entries would incorrectly signal "barcode exists". Absence of entry is the correct "not found" signal.

### Timeout/Budget Conflicts (1 issue)
- **15s budget vs 25s hard deadline** (High): New pipeline budget conflicted with existing hard deadline. When adding budgets, check for existing budget mechanisms.

### Interface Gaps (2 issues)
- **Provider method signatures not shown** (High): Added types but forgot to show the actual interface methods. Type definitions need corresponding interface contracts.
- **Phase 5.5 has no call type or result type** (Medium): New phase introduced without corresponding AICallType value. Every AI call needs a type for cost tracking.

### Implementation Specifics (2 issues)
- **artComments parsing is placeholder** (Medium): Function body was a comment with no concrete patterns. Helper functions need real examples and regex patterns, not descriptions.
- **callDetails structure not updated** (Medium): Client-side analytics structure doesn't accommodate new call types. When adding server-side call types, check client-side tracking structures.

### Cost Accuracy (1 issue)
- **Fallback cost for repeat scans** (Medium): Cost estimates only covered primary provider. Always note fallback provider cost scenarios.

### File References (1 issue)
- **Wrong function reference for key info lookup** (Low): Referenced static function instead of DB-backed wrapper. Verify exact function names and which module exports them.

## 2026-04-05 — Cert-First Scan Pipeline Design Spec (Round 3)

**Result: 3 medium+ issues — PASSED (under threshold of 5)**

### File References (1 issue)
- **getComicMetadata lives in db.ts not metadataCache.ts** (High): Phase 4 referenced wrong module. Always grep for the actual function location rather than assuming from the module name.

### Type Reuse (1 issue)
- **GradingCompany type already exists in types/comic.ts** (Medium): Spec re-declared the union inline instead of reusing the existing type. Grep for existing types before defining new ones.

### Analytics Clarity (1 issue)
- **Phase 5 vs 5.5 indistinguishable in callDetails** (Medium): Same call type for two different cost profiles. When reusing a call type for a variant call, add a distinguishing field.

### Regex Patterns (1 issue)
- **artComments regex excludes hyphens/apostrophes in names** (Low): \w doesn't match O'Neil, Perez-Lopez. Use permissive capture groups bounded by keyword anchors.

### Budget Math (1 issue)
- **Phase timeouts sum exceeds 15s budget** (Recommendation): Document degradation: clamp timeouts to remaining budget, skip Phase 5 if budget exhausted, cert data is sufficient for pricing.

## 2026-04-05 — Cert-First Implementation Plan (Round 1)

### Codebase Pattern Matching (4 issues)
- **lookupCertification already uppercases internally** (Critical): Plan lowercased the company before passing it, creating a misleading type cast. Always check what the target function does internally before adding transformations.
- **comicDetails has no `id` field in the route's local interface** (High): Plan added `id: crypto.randomUUID()` but existing pipeline doesn't set it. Always verify local type definitions, not just imported types.
- **barcode parsing used spread instead of direct assignment** (High): Existing pattern is `obj.parsed = parsed`, not spread. Match existing patterns exactly.
- **null vs undefined mismatch for optional fields** (Medium): Plan used `|| null` where existing code uses `|| undefined`. When populating typed objects, match the existing convention.

### Legacy Compatibility (1 issue)
- **barcodeNumber legacy field not populated** (High): Existing barcode catalog lookup uses the legacy field. When adding new code paths, grep for ALL consumers of the data being produced.

### Type Strictness (2 issues)
- **hasCompleteSlabData accepts Partial<ComicMetadata> but called with plain object** (Medium): Function signature was too narrow for actual usage. Design function signatures around how they'll be called, not the ideal type.
- **lookupKeyInfo expects non-null issueNumber** (Medium): Plan passed nullable string to function expecting string. Add null guards before calling functions with stricter signatures.

### Spec Divergence (2 issues)
- **certHelpers.ts vs certLookup.ts location** (Low): Plan improved on spec by separating pure helpers. Justified divergence but spec should be updated.
- **parseArtComments regex handles & but spec doesn't** (Medium): Plan was actually correct here. Spec needs updating to match.

## 2026-04-05 — Cert-First Implementation Plan (Round 2)

### Cache Layer Completeness (1 issue)
- **Phase 4 bypassed Redis metadata cache** (High): Went straight to Supabase instead of using the two-layer cache pattern (Redis → Supabase). When reusing existing data flows, replicate ALL layers, not just the final data source.

### Code Placement Clarity (1 issue)
- **Ambiguous insertion point for cert-first block** (High): Plan said "around line 270" without specifying it goes inside the else branch of the cache check. When inserting code into complex control flow, specify the exact scope/branch.

### Type Safety (3 issues)
- **string vs GradingCompany cast** (Medium): AI returns string but type expects union. Always cast to the target type, not to string.
- **barcode.raw nullable in result but non-nullable in ComicDetails** (Medium): TypeScript narrowing doesn't always propagate through objects after null checks. Use non-null assertions after guards.
- **Missing verificationMeta variable in cert-first path** (Medium): Variable referenced but never declared. Ensure all tracking variables are initialized for both code paths.

### Test Consistency (1 issue)
- **Mixed require/import in test file** (Medium): Used require() inside describe block instead of top-level import. Keep import style consistent within files.

## 2026-04-05 — Cert-First Implementation Plan (Round 3)

**Result: 4 medium+ issues — PASSED (under threshold of 5)**

### Import Completeness (1 issue)
- **GradingCompany not imported in Gemini provider** (High): Type used in cast but never imported. When adding type casts, verify the type is imported in that file.

### Assertion Hygiene (1 issue)
- **Non-null assertion after || null is contradictory** (Medium): `value! || null` is nonsensical. After a truthiness guard, just use the value directly.

### Implementer Guidance (1 issue)
- **Existing imports not called out** (Medium): Plan referenced functions already imported in the route without noting they're available. Note "already imported" to prevent duplicate imports.

### Backward Compatibility (1 issue)
- **Missing barcodeNumber backward-compat assignment** (Medium): Existing pipeline has a fallback that copies barcode.raw to barcodeNumber. Cert-first path needs the same pattern.
