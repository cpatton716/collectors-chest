# Implementation Plans — Index & Status

> **These are historical implementation/execution plans.** The features they describe are, with few exceptions, **completed and shipped to production**. Plans are retained for reference — do not re-execute them. For the canonical *design* docs and the live system map, see [`docs/README.md`](../README.md), [`docs/TECHNICAL_FEATURES.md`](../TECHNICAL_FEATURES.md), and [`/ARCHITECTURE.md`](../../ARCHITECTURE.md).

Many features have a paired **design** doc (the canonical architecture) and an **implementation** doc (the task list). Where both exist, the design doc is authoritative.

---

## `docs/plans/`

| Plan | Feature | Status |
|------|---------|--------|
| `2026-01-27-peer-to-peer-messaging-design.md` | Messaging (design) | Canonical design |
| `2026-01-27-messaging-phase1-implementation.md` | Messaging Phase 1 | ✅ Completed & shipped |
| `2026-01-27-messaging-phases-2-7.md` | Messaging Phases 2–7 | ✅ Completed & shipped |
| `2026-01-28-book-trading-design.md` / `2026-01-28-book-trading.md` | Book trading | ✅ Completed & shipped |
| `2026-01-30-follow-system-design.md` / `2026-01-30-follow-system.md` | Follow system | ✅ Completed & shipped |
| `2026-01-30-reputation-system-design.md` / `2026-01-30-reputation-system.md` | Reputation / Creator Credits | ✅ Completed & shipped |
| `2026-02-02-bulk-actions-design.md` / `2026-02-02-bulk-actions-implementation.md` | Multi-select bulk actions | ✅ Completed & shipped |
| `2026-02-05-feb5-feedback-fixes.md` | Feb 5 feedback fixes | ✅ Completed |
| `2026-02-13-admin-key-info-management-design.md` | Admin key-info moderation | ✅ Completed & shipped |
| `2026-02-19-age-gate-listing-cap-design.md` / `2026-02-19-age-gate-listing-cap-plan.md` | Age gate + listing cap | ✅ Completed & shipped |
| `2026-02-19-cost-monitoring-api-optimization.md` | Cost monitoring / API optimization | ✅ Completed & shipped |
| `2026-02-19-stripe-connect-marketplace-design.md` / `2026-02-19-stripe-connect-implementation.md` | Stripe Connect marketplace | ✅ Completed & shipped |
| `2026-02-25-beta-mode-planning.md` | Private beta mode | ✅ Completed |
| `2026-02-25-cover-image-harvesting-design.md` | Cover harvesting (design) | Superseded by `engineering-specs/2026-04-02-cover-image-harvesting-design.md` |
| `2026-02-25-cover-image-search-design.md` / `2026-02-25-cover-image-search-plan.md` | External cover image search | ⚠️ Superseded (not shipped) |
| `2026-02-26-bing-image-search-design.md` | Bing image search evaluation | ⚠️ Not adopted — decision: skip external image search |
| `2026-02-27-scan-resilience-design.md` | Scan resilience (multi-provider) | **Canonical design** |
| `2026-03-01-scan-resilience-plan.md` / `2026-03-03-finish-scan-resilience.md` | Scan resilience (implementation) | ✅ Completed & shipped (Mar 3, 2026) |
| `2026-03-01-scan-cost-dashboard-design.md` / `2026-03-01-scan-cost-dashboard-plan.md` | Scan cost dashboard | ✅ Completed & shipped |
| `2026-03-06-self-healing-model-pipeline.md` | Self-healing model pipeline | ✅ Completed & shipped |

---

## `docs/superpowers/plans/`

| Plan | Feature | Status |
|------|---------|--------|
| `2026-03-18-ebay-browse-api.md` | eBay Browse API | ✅ Completed & shipped |
| `2026-03-20-cover-image-validation.md` | Cover image validation | ✅ Completed & shipped |
| `2026-03-25-choose-plan-page.md` | Choose-plan page | ✅ Completed & shipped |
| `2026-03-26-promo-trial-link.md` | Promo trial link / QR sign-up | ✅ Completed & shipped |
| `2026-04-01-email-overhaul.md` | Email system overhaul | ✅ Completed & shipped |
| `2026-04-01-welcome-email.md` | Welcome email | ✅ Completed & shipped (archived) |
| `2026-04-02-cover-image-harvesting.md` | Cover image harvesting | ✅ Completed & shipped |
| `2026-04-05-cert-first-scan-pipeline.md` | Cert-first scan pipeline | ✅ Completed & shipped |
| `2026-04-07-cover-validation-improvements.md` | Cover validation improvements | ✅ Completed & shipped |
