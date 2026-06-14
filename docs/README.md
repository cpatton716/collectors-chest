# Collectors Chest — Documentation Index

> Map of all project documentation. Use this as the entry point to find the right doc.
> Layering convention: **ARCHITECTURE.md** = system overview · **docs/TECHNICAL_FEATURES.md** = feature deep-dives · **docs/features/** = per-feature specs · **docs/engineering-specs/** = design specs · **docs/plans/** + **docs/superpowers/plans/** = implementation plans (mostly historical).

---

## Start Here

| Document | Purpose |
|----------|---------|
| [`/README.md`](../README.md) | Repo overview, tech stack, getting started |
| [`/ARCHITECTURE.md`](../ARCHITECTURE.md) | **System map** — pages, features, API routes, services, data flows, env vars |
| [`/CLAUDE.md`](../CLAUDE.md) | Project instructions, services & infrastructure, costs, deploy/close-up workflows |
| [`TECHNICAL_FEATURES.md`](./TECHNICAL_FEATURES.md) | Feature deep-dives — reference for spec creation |
| [`/EVALUATION.md`](../EVALUATION.md) | Launch-readiness scorecard (strategic health check) |
| [`/BACKLOG.md`](../BACKLOG.md) | Source of truth for open work (bugs, features, enhancements) |
| [`/DEV_LOG.md`](../DEV_LOG.md) | Dated session history (append-only) |
| [`/COST_PROJECTIONS.md`](../COST_PROJECTIONS.md) | Operating-cost projections by scale |

---

## Feature Specs (`docs/features/`)

| Feature | Spec | Status |
|---------|------|--------|
| AI Cover Recognition & Multi-Provider Fallback | [`features/01-ai-cover-recognition.md`](./features/01-ai-cover-recognition.md) | Production |

---

## Design Specs (`docs/engineering-specs/`)

| Topic | Doc | Status |
|-------|-----|--------|
| eBay Browse API | [`engineering-specs/2026-03-18-ebay-browse-api-design.md`](./engineering-specs/2026-03-18-ebay-browse-api-design.md) | Implemented |
| Cover Image Validation Pipeline | [`engineering-specs/2026-03-19-cover-image-validation-design.md`](./engineering-specs/2026-03-19-cover-image-validation-design.md) | Implemented (shipped) |
| Cover Validation Improvements | [`engineering-specs/2026-04-07-cover-validation-improvements-design.md`](./engineering-specs/2026-04-07-cover-validation-improvements-design.md) | Implemented (shipped) |
| Email System Overhaul | [`engineering-specs/2026-04-01-email-overhaul-design.md`](./engineering-specs/2026-04-01-email-overhaul-design.md) | Implemented |
| Welcome Email | [`engineering-specs/2026-04-01-welcome-email-design.md`](./engineering-specs/2026-04-01-welcome-email-design.md) | Implemented (shipped) |
| Cover Image Harvesting | [`engineering-specs/2026-04-02-cover-image-harvesting-design.md`](./engineering-specs/2026-04-02-cover-image-harvesting-design.md) | Implemented |
| Cert-First Scan Pipeline | [`engineering-specs/2026-04-05-cert-first-scan-pipeline-design.md`](./engineering-specs/2026-04-05-cert-first-scan-pipeline-design.md) | Implemented |

---

## Implementation Plans (`docs/plans/` and `docs/superpowers/plans/`)

Implementation/execution plans are **mostly historical** — the features they describe have shipped. See [`plans/README.md`](./plans/README.md) for the full plans index and status. Design docs (not plans) are listed above and remain the canonical reference where applicable.

---

## Research & Partnership Briefs (`docs/`)

| Doc | Purpose |
|-----|---------|
| [`BARCODE_RESEARCH.md`](./BARCODE_RESEARCH.md) | Barcode-scanning research notes |
| [`BARCODE_SCANNER_SPEC.md`](./BARCODE_SCANNER_SPEC.md) | Barcode scanner spec |
| [`CLZ_COMPARISON_BRIEF.md`](./CLZ_COMPARISON_BRIEF.md) | Competitive comparison brief (CLZ) — partner sales material |
| [`DATA_PARTNERS.md`](./DATA_PARTNERS.md) | Data-partnership landscape (CovrPrice, GoCollect, PriceCharting) |
| [`PRICECHARTING_PROPOSAL.md`](./PRICECHARTING_PROPOSAL.md) | PriceCharting tier proposal (stakeholder review) |
| [`stripe-connect-setup.md`](./stripe-connect-setup.md) | Stripe Connect onboarding setup guide |
