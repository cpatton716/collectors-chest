---
description: Run a comprehensive, multi-agent optimization audit of the application (or a scoped feature/area) end-to-end, producing a dated AUDIT_<date>.md with 5-field findings PLUS the standard strategic breakdown — Duration (all + by priority), Executive / Platform-Admin / End-User perspectives, and an Elevator Pitch. Use whenever the owner asks for an audit, deep-dive review, or end-to-end optimization pass.
triggers:
  - "run an audit"
  - "run a full audit"
  - "full audit"
  - "deep dive audit"
  - "deep dive review"
  - "audit the app"
  - "audit the application"
  - "audit our application"
  - "audit the codebase"
  - "do an audit"
  - "optimization audit"
  - "complete review end to end"
  - "review the app feature by feature"
---

# Skill: Full Optimization Audit

Reproduces the exact audit flow the owner approved: **exhaustive multi-agent review → adversarially-verified findings → dated `AUDIT_<date>.md` → strategic breakdown** (effort/duration, three stakeholder perspectives, elevator pitch). Works for a whole-app audit or a single-feature/area audit.

This is NOT for reviewing one PR/diff — use `/code-review` for that. Use this for broad, feature-by-feature optimization sweeps.

---

## Operating Defaults (established with the owner — confirm, don't re-derive)

- **Report-only.** NEVER edit, create, or delete code during an audit. Findings only; the owner greenlights fixes afterward. Agents investigate with Read/Grep/Glob and read-only Bash.
- **Output:** write findings to `AUDIT_<YYYY-MM-DD>.md` at repo root + present an executive summary in chat. Do NOT add to BACKLOG.md unless explicitly asked.
- **Cost scope:** include everything — free fixes, cost-*reducing* wins, and paid-service ideas — each tagged with money impact as **saved / additional / neutral**.
- **Estimates must be realistic, not inflated.** The owner has flagged that hour-estimates often overstate reality. Use the duration methodology below and lean to the honest, parallelized number.

---

## Step 1 — Confirm scope (one quick AskUserQuestion, then proceed)

Confirm only what changes the run; default the rest to the operating defaults above:
- **Scope:** entire application + all docs (default) OR a named feature/area/subsystem.
- (Defaults assumed unless the owner says otherwise: report-only, dated AUDIT doc, all-costs-flagged.)

If scope is the whole app, use the full finder taxonomy. If scoped, subset the finders to the relevant feature area(s) + all cross-cutting dimensions.

## Step 2 — Stop the dev server & scout the work-list

- Free `.next` for the build/bundle analysis: `lsof -ti:3000 | xargs kill 2>/dev/null`.
- Scout to build the inventory (don't read whole files): API routes, pages, components, lib/hooks/types, largest source files by line count, all markdown docs, `package.json`. Use this to scope finder prompts accurately.

## Step 3 — Run the multi-agent audit Workflow (4 phases)

Use the template at **`.claude/skills/full-audit.workflow.js`**. Invoke with:
`Workflow({ scriptPath: ".claude/skills/full-audit.workflow.js", args: { root: "<repo root>", date: "<YYYY-MM-DD>", scope: "<scope description>" } })`

The template runs:
1. **Audit** — parallel auditors: **12 feature-area** auditors (scanning, pricing, collection, auctions, marketplace, payments, social/auth, messaging/notifications, email, admin, cross-cutting libs, frontend/PWA) + **11 cross-cutting dimension** auditors (performance/bundle, database efficiency, **running-cost reduction**, code-quality/dead-code, security, correctness, testing gaps, accessibility/UX, dependencies/build, core docs, plans/specs docs). Dimension auditors actually run `npm run build`, `npm run deadcode` (knip), `npm run circular` (madge), `npm run audit`, `npm test` for hard evidence.
2. **Verify** — every auditor's findings get an adversarial skeptic that tries to refute each, drops false positives, and corrects overstated cost/autonomy claims.
3. **Consolidate** — merge duplicate findings per area.
4. **Report** — a writer agent writes the full `AUDIT_<date>.md` (see structure below) and returns a compact summary.

Adapt the finder list in the template to the audit's scope before running (subset for a scoped audit).

## Step 4 — Verify before presenting (mandatory)

After the workflow completes, **spot-check 5+ headline findings against the real code** (Grep/Read the cited evidence). Confirm the doc is well-formed (`wc -l`, count `#### [H-`/`[M-`/`[L-` blocks). Never present findings you haven't sanity-checked — the adversarial pass is good but not infallible.

## Step 5 — Ensure the doc contains the full structure

`AUDIT_<date>.md` MUST contain, in order:
1. Title + header block (Date, Scope, Mode: Report-only, Auditors line)
2. `## Executive Summary` — totals, High/Med/Low, autonomy yes/partial/no, est. monthly savings range, est. additional cost if all paid ideas adopted, 3-4 sentence health narrative.
3. `## Top Opportunities` — markdown table of ~12 highest-value items: Ref | Title | Area | Severity | Cost Impact | Autonomous.
4. `## Remediation Effort & Impact Analysis` — **the standard breakdown** (Step 6).
5. `## Autonomous Remediation Worklist` — the autonomous=Yes items as 3 tables (High/Med/Low): Ref | Title | Area | Cost Impact | Effort.
6. `## Findings by Priority` — `### 🔴/🟡/🟢` sections; each finding rendered as the 5-field block (below).
7. `## Findings by Area` — index of Refs per area.
8. `## Coverage Notes` — areas/dimensions reviewed, strong areas, caveats.

### Per-finding 5-field block (exact format)
```
#### [Ref] Title
- **Area / Dimension:** <area> · <dimension> · effort S/M/L
- **1. Description:** ...
- **2. Issue identified:** ...
- **3. Recommended optimization:** ...
- **4. Cost analysis:** <costImpact> _(saved / additional / neutral)_
- **5. Can I handle autonomously:** Yes/Partial/No — <note>
- **Evidence:** <file:line>
```
Ref encodes priority (H-*/M-*/L-*) and area (e.g. H-CC1, M-SC3, L-AD2).

### Autonomy classification
- **Yes** = Claude Code can implement fully in-repo, no human/external step.
- **Partial** = code is doable but a human step is required (env var, dashboard config, DB migration, user-facing copy approval).
- **No** = needs product decision/approval, paid signup, native build, or credentials Claude can't perform.

### Cost format
Money only, phrased as **saved / additional / neutral** with a number where possible (e.g. "Saves ~60–70% per-call AI text cost", "Adds ~$25/mo (Supabase Pro)", "$0 — neutral").

## Step 6 — The standard strategic breakdown (ALWAYS produce this)

Compute over the **autonomous = Yes** findings only (the work that can be done without owner input).

### Effort tally
Count S / M / L (from each finding's effort) overall and per priority. Show a breakdown table:
| Size | Count | What these are | Raw per-item (active) |
with S ≈ "~2–5 min", M ≈ "~8–20 min", L ≈ "~30–90 min".

### Duration methodology (realistic, not inflated)
- **Raw sequential minutes** = `S×3.5 + M×14 + L×60` (midpoints). Convert to hours.
- **Realistic, parallelized active execution** ≈ **40–60% of raw sequential** (independent files run in parallel via subagent workflows, offset by shared quality-gate overhead: `typecheck+lint+test+build` ≈ 3–4 min per batch, plus the project's mandatory tests for money/limit/permission changes).
- **Per-priority nuance:** bias 🔴 High toward the higher end (money/security items get careful tests + verification); bias 🟢 Low toward the lower end (mostly trivial doc/dead-code/a11y items, massively parallel).
- Always state BOTH raw and realistic, give a "per-item feel" (most are 2–15 min), and note the real calendar bottleneck is **human review cadence**, not execution.

Present as:
- **1. Duration — All:** raw sequential hrs; realistic parallelized range; per-item feel; review caveat.
- **2. Duration — By Priority:** a table (Priority | Items | Mix S/M/L | Realistic active time | Notes).

### 3–5. Three stakeholder perspectives ("what to expect after these are completed")
Write grounded, audience-appropriate bullets (5-ish each), synthesized from the actual findings:
- **3. As Company Executive** — business outcomes: operating-cost ceilings/margins, revenue protection & financial integrity, risk/security reduction, accurate cost projections, future velocity, compliance posture.
- **4. As Platform Admin** — operational outcomes: trustworthy dashboards/telemetry, secured crons & quotas, audit-log accountability, fewer fire-drills, cleaner moderation, better observability.
- **5. As End User** — experience outcomes: speed, reliable money flows, accessibility/inclusion, fewer bugs/crashes, privacy/security — framed as "same features, friction removed."

### 6. Elevator Pitch — "Why we're doing this"
One punchy blockquote paragraph: this is the pre-launch tune-up that turns "it works" into "production-grade" for (typically) zero added spend — closes money/security gaps, caps operating cost, makes it faster + accessible, pays down tech-debt; highest-ROI work available. Tailor specifics to the actual findings.

## Step 7 — Present in chat & offer next steps

Give the owner: headline numbers, the verification note, the Top Opportunities table, the 3 key themes, the Duration breakdown, the three perspectives, and the elevator pitch. Then offer next steps (start the High autonomous batch / sequence a plan / add selected items to BACKLOG) — but make NO code changes without explicit greenlight. A few "Yes" items may touch money paths; test those thoroughly rather than rush.

---

## Notes
- Keep the finder taxonomy and per-finding format identical across audits so results are comparable over time.
- The workflow spawns ~60 agents for a whole-app audit; that's expected. Scope down for smaller audits.
- If resuming a killed run, use `Workflow({ scriptPath, resumeFromRunId })` — unchanged agents return cached.
