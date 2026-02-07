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
