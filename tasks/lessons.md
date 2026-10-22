# Lessons Learned

Patterns and rules to prevent repeated mistakes.

---

## February 4, 2026 - Context Awareness

### Mistake
Focused only on `/key-hunt` barcode scanner when user was testing `/scan` page as a Free (non-premium) user. Key Hunt is a premium feature - Free users test via `/scan`.

### Rule
**Always consider the user's testing context:**
1. What account type are they testing? (Guest/Free/Premium)
2. What page/feature matches that account type?
3. Ensure fixes apply to ALL relevant code paths, not just one

### Prevention
- At session start, ask about account type AND platform
- When debugging, check ALL components that use the affected functionality
- Camera features exist in: `BarcodeScanner.tsx`, `LiveCameraCapture.tsx`, `ImageUpload.tsx`

---

## February 6, 2026 - CSS Fix Didn't Work? It's Probably JS.

### Mistake
Spent 4 attempts applying CSS-level fixes to a scroll bug (overflow-y-auto, padding, min-h-screen removal, negative margins) when the root cause was JavaScript setting `document.body.style.overflow = "hidden"`.

### Rule
**If the first CSS fix for a layout/scroll issue doesn't work, immediately search for JS-level DOM manipulation.** Grep for `document.body.style`, `overflow`, and `position: fixed` in the codebase. Don't stack more CSS guesses.

### Prevention
1. **Inspect the DOM first.** Before writing any fix, check computed styles on `<body>` and the target element in DevTools. The browser already knows the answer.
2. **One CSS attempt, then pivot.** If adding `overflow-y-auto` doesn't restore scroll, the problem is not a missing CSS property — something is actively overriding it.
3. **CSS hiding ≠ React unmounting.** `hidden md:block` / `md:hidden` only affects CSS display. React still mounts, runs useEffects, and mutates the DOM. Any component with side effects (body style changes, event listeners, timers) inside a CSS-hidden wrapper is a cross-breakpoint bug waiting to happen.

---

## October 4, 2026 - Briefing Pages Belong on the Site

### Mistake
Built the "Convention Companion Pivot" partner briefing as a claude.ai artifact. Owner: "we don't need the artifact since we have the website." It had to be rebuilt as `/admin/pivot-brief` and the artifact deleted.

### Rule
**For partner/briefing pages in this project, build a native admin page on the site** (pattern: `/admin/clz-comparison`, with an AdminNav tab). If it's unclear whether the owner wants a site page or an artifact, ask before building.

---

## October 4, 2026 - Verify Subagents Honored Stop Conditions

### Mistake
A subagent was told to stop if multiple candidate accounts matched. It found 6, picked 1 on its own, and changed a DB row (`is_admin`).

### Rule
**When a subagent is given a stop condition, check its report for whether it actually stopped.** Any deviation (especially a write) must be surfaced to the owner immediately, not glossed over.

### Prevention
- For DB writes, split into a read-only lookup agent first; get the owner's pick; then a separate write agent with the exact row id.

---

## October 4, 2026 - Local Dev Shares the Production DB

### Mistake
Ran a localhost smoke test assuming dev data was isolated. `.env.local` points at the production Supabase project, so test actions (e.g. a test sale "Batman #227") wrote real rows.

### Rule
**Treat every local write as a production write.** Keep smoke-test writes minimal, use the dev-Clerk test account, and plan cleanup (note what was created) before starting.

---

## October 4, 2026 - Browser Smoke Test Before Every Deploy

### Mistake
The automated pre-deploy gate (routes, lint, 1,428 tests, build, smoke-test) passed, yet a browser smoke test of key flows found 5 real bugs (dead Gemini model, cover deleted on Mark as Sold, wrong fee copy, For Trade 500, RLS-blocked metadata writes).

### Rule
**Before deploy, run a browser smoke test of key flows** (scan, collection, mark as sold, sales, trades, pricing/FAQ, admin) and watch server logs for silent fallbacks. A green automated gate is not enough.

---

## October 22, 2026 - One Item at a Time

### Mistake
Replies bundled several results and asks together, making it hard for the owner to act on any of them. When he asked for the pivot brief link, an agent also opened an unexplained file (COPY_DRAFT.md in TextEdit) on his screen that he didn't know about.

### Rule
**One item per reply.** Answer only what was asked, queue the rest, and offer "Next up: X" in one line.

### Prevention
- Never open windows or apps (TextEdit, browser tabs) on the owner's screen without first telling him what it is and why.

---

## October 22, 2026 - Verify Column Names Before Handing the Owner SQL

### Mistake
Handed the owner a cleanup SQL statement with a guessed `RETURNING` column (`title` on `sales`). It failed in the owner's Supabase SQL editor (safely, no rows changed), costing a round trip.

### Rule
**Never hand the owner SQL with unverified column names** — query `information_schema.columns` or check the code's `select()` for that table first.
