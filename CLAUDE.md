# Comic Tracker - Project-Specific Instructions

> These instructions extend the global `~/.claude/CLAUDE.md` file with Comic Tracker-specific details.

---

## On Session Start (Additional Steps)

In addition to the global session start steps, also:

4. **Start dev server** - Run `npm run dev` in the background so the user can test immediately

5. **Ask about testing context** - Ask ALL 5 questions together using AskUserQuestion:
   - **Platform**: Mobile, Web, or Both
   - **Account type** (multiSelect): Guest (no account), Free (registered, not premium), Premium
   - **Mobile devices** (multiSelect): iPhone, Android
   - **Desktop browsers** (multiSelect): Mac Chrome, Mac Safari, Windows Chrome, Windows Edge
   - **Sounds**: "Do you want sounds today?" — Yes / No. If **No**, share these steps to disable:
     1. Open Terminal Preferences (Cmd+,) → Profiles → your profile → Advanced → uncheck "Audible bell"
     2. Or run: `printf '\e[?1070l'` in the terminal to silence the bell for the current session
     3. Or add `set bell-style none` to `~/.inputrc` for a permanent fix

6. **Show Mobile Dev Server URL** - If platform is **Mobile** or **Both**, display the Network URL from the dev server output (e.g. `http://10.0.0.34:3000`) so the user can open it on their phone. If the dev server output isn't available yet, run `ifconfig | grep 'inet ' | grep -v 127.0.0.1` and construct the URL with the active port.

7. **Log to Testing Results** - After getting answers, append to `TESTING_RESULTS.md`:
   ```markdown
   ## [Date] - Session Start
   - **Platform:** [Mobile/Web]
   - **Account Type:** [Guest/Free/Premium]
   - **Device(s):** [Device list from user]
   - **Focus:** [To be filled as session progresses]
   ```

---

## Test Requirements

**MANDATORY: Every new feature MUST include unit tests.** This is not optional. Tests should be written as part of the feature implementation, not as an afterthought.

### What MUST be tested for every feature:
- Pure helper functions (calculations, formatting, validation)
- Business logic (pricing, limits, permissions, state transitions)
- Database helper functions (transforms, validations)
- Hook logic (state calculations, optimistic updates)
- Constants that affect user experience (scan limits, pricing tiers, thresholds)

### Test file locations:
- `src/types/__tests__/` - Type helper tests (e.g., auction calculations)
- `src/lib/__tests__/` - Library function tests (e.g., subscription logic, followDb)
- `src/hooks/__tests__/` - Hook helper tests (e.g., guest scan tracking)

### Test commands:
```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode during development
npm test -- [file]    # Run specific test file
```

### What to test:
- Edge cases and boundary conditions
- Error states and validation failures
- Happy path scenarios
- Any function that handles money, limits, or permissions
- Self-referential prevention (e.g., can't follow yourself, can't message yourself)
- Optimistic update calculations
- Transform functions (DB rows to types)

### What NOT to test (for now):
- React components (defer to manual testing)
- API routes with database calls (require complex mocking)

### Pre-commit checklist:
Before closing a feature session, verify:
- [ ] New helper functions have tests
- [ ] Business logic is covered
- [ ] Edge cases are tested
- [ ] `npm test` passes

**Example:** When adding a follow system, write tests like:
```typescript
describe('followDb helpers', () => {
  it('builds display name from first and last name', () => { ... });
  it('returns null when names are missing', () => { ... });
  it('prevents self-follow', () => { ... });
  it('never decrements count below zero', () => { ... });
});
```

---

## Design Standards

1. **Mobile responsiveness** - Always keep mobile responsiveness part of all design decisions
2. **Lichtenstein Design Language** - All new pages must follow the site's pop art / Lichtenstein aesthetic. Before creating new UI, review existing components and pages to maintain visual consistency. When in doubt, reference the homepage design patterns.

---

## Environment Variables

When any environment variable needs to be added or updated:
1. Automatically open the .env.local file in TextEdit:
```bash
open -a TextEdit "/Users/chrispatton/Coding for Dummies/Comic Tracker/.env.local"
```
2. **Track the new variable** - Remember that this variable was added during the session
3. **Remind about Netlify** - When deploying, this variable MUST be added to Netlify environment variables first

---

## Close Up Shop Command

When I say **"Close up shop"**, use the `/collectors-chest-close-up-shop` skill.

The skill runs an optimized 6-phase workflow with parallel code checks, documentation updates, and commit. It does NOT deploy.

---

## Available Scripts (Quick Reference)

For ad-hoc use during development:

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `npm run check` | typecheck + lint + test | Quick validation |
| `npm run check:full` | check + build | Before committing |
| `npm run check:all` | All checks (format, circular, deadcode, audit) | Full quality gate |
| `npm run format` | Auto-fix formatting | Fix prettier issues |
| `npm run circular` | Find circular imports | Debug import issues |
| `npm run deadcode` | Find unused exports/files | Cleanup codebase |
| `npm run audit` | Security vulnerability check | Before deploy |
| `npm run build:analyze` | Bundle size analysis | Optimize bundle |

---

## Services & Infrastructure

### Domain & Hosting
| Service | Purpose | Dashboard | Env Variable |
|---------|---------|-----------|--------------|
| **Netlify** | Hosting, domain, DNS, bandwidth | [app.netlify.com](https://app.netlify.com) | `NETLIFY_API_TOKEN` |
| **Domain** | collectors-chest.com | Purchased via Netlify (Jan 2026) | |
| **SSL** | HTTPS certificate | Let's Encrypt (auto-renewed) | |

### Core Services
| Service | Purpose | Dashboard | Env Variable |
|---------|---------|-----------|--------------|
| **Supabase** | Database (Postgres) | [supabase.com/dashboard](https://supabase.com/dashboard) | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Clerk** | Authentication | [dashboard.clerk.com](https://dashboard.clerk.com) | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| **Stripe** | Payments | [dashboard.stripe.com](https://dashboard.stripe.com) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **Anthropic** | AI (Claude) for cover recognition | [console.anthropic.com](https://console.anthropic.com) | `ANTHROPIC_API_KEY` |
| **Google AI (Gemini)** | AI fallback for cover recognition | [aistudio.google.com](https://aistudio.google.com) | `GEMINI_API_KEY` |
| **hCaptcha** | Bot prevention on guest scans (triggered at scans 4–5) | [dashboard.hcaptcha.com](https://dashboard.hcaptcha.com) | `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`, `HCAPTCHA_SECRET_KEY` |

### Supporting Services
| Service | Purpose | Dashboard | Env Variable |
|---------|---------|-----------|--------------|
| **Resend** | Email notifications | [resend.com](https://resend.com) | `RESEND_API_KEY` |
| **Upstash** | Redis caching & rate limiting | [console.upstash.com](https://console.upstash.com) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Sentry** | Error tracking | [sentry.io](https://sentry.io) | `SENTRY_DSN` |
| **PostHog** | Analytics | [app.posthog.com](https://app.posthog.com) | `NEXT_PUBLIC_POSTHOG_KEY` |

### External APIs
| Service | Purpose | Notes |
|---------|---------|-------|
| **GoCollect** | ~~FMV pricing, Hot 50, trends~~ | ~~Pro tier, 100 calls/day~~ — API program discontinued (Feb 2026) |
| **Marvel API** | ~~Comic metadata, covers, creators~~ | ~~Free, 3K calls/day~~ — Developer program deprecated, no longer available (Feb 2026) |
| **eBay Browse API** | Real-time pricing | Free tier, rate limited |
| **CGC/CBCS** | Cert verification | Web scraping for grade details |
| **ZenRows** | Scraping proxy for CGC cert lookup | Env var `ZENROWS_API_KEY` configured — **deferred post-launch** pending ROI review; no current cost |

### Project Costs

**Fixed Costs:**
| Item | Cost | Billing Cycle |
|------|------|---------------|
| Netlify Personal Plan | $9.54/mo | 13th of each month |
| ~~GoCollect Pro~~ | ~~$89/yr~~ | Cancelled — API program discontinued (Feb 2026) |
| Domain (collectors-chest.com) | $13.99/yr | Renews Jan 13, 2027 ($16.99) |

**Variable Costs:**
| Service | Cost | Notes |
|---------|------|-------|
| Anthropic API | ~$0.015/scan | Prepaid credits ($10 loaded) |
| Stripe | 2.9% + $0.30 | Per transaction |

**Free Tiers (current usage):**
- Supabase: 500MB DB, 1GB storage
- Clerk: 10K MAU
- Upstash: 10K commands/day
- Resend: 3K emails/mo
- PostHog: 1M events/mo
- Sentry: 5K errors/mo
- hCaptcha: 1M requests/mo (currently on Pro trial through **May 7, 2026** — no payment info provided; auto-downgrades to free tier after trial; $0 throughout private beta)

---

## Deploy Command

**Hosting Platform:** Netlify (NOT Vercel)

When I say **"Deploy"**, perform the following steps:

1. **Run full quality check:**
   - `npm run check:routes` - Check for dynamic route conflicts
   - `npm run lint` - Check for linting errors
   - `npm test` - Run all tests
   - `npm run build` - Ensure build succeeds
   - `npm run smoke-test` - Verify production server starts and homepage loads

2. **CHECK FOR NEW ENVIRONMENT VARIABLES** ⚠️ CRITICAL:
   - Compare current `.env.local` against known Netlify variables
   - If ANY new variables were added this session, **STOP** and:
     - List all new variables that need to be added to Netlify
     - Copy variable names and values to clipboard for easy pasting
     - Provide direct link: Netlify → Site settings → Environment variables
     - **DO NOT PROCEED** until user confirms they've added the variables to Netlify
   - This prevents production failures from missing env vars
   - **Known Netlify env vars (as of Apr 23, 2026):** `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NETLIFY_API_TOKEN`, `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`, `HCAPTCHA_SECRET_KEY`, `ZENROWS_API_KEY` (configured but feature deferred post-launch)

3. **Review Deploy Checklist** - Confirm with user:
   - [ ] All tests passing
   - [ ] Manual smoke test completed
   - [ ] No console errors
   - [ ] Mobile responsiveness tested
   - [ ] Priority features working as expected
   - [ ] **New environment variables added to Netlify** (if any)

4. **Show "Changes Since Last Deploy"** - Display accumulated changes from DEV_LOG.md so user can confirm it's worth a deploy

5. **Get explicit confirmation** - Ask user to confirm they want to use a deploy

6. **After successful deploy:**
   - Clear the "Changes Since Last Deploy" section in DEV_LOG.md
   - Log the deploy date and summary in DEV_LOG.md
   - **IMPORTANT:** Batch the DEV_LOG update into the same commit OR commit it locally without pushing (to avoid triggering a second Netlify build)

---

## Revert Technopathy Command

When I say **"revert technopathy"**, revert ALL of the following changes back to "AI" terminology:

### Files and Exact Changes to Revert:

**1. `/src/app/layout.tsx` (line ~17 in metadata description)**
- CURRENT: `"Scan covers with technopathic recognition"`
- REVERT TO: `"Scan covers with AI recognition"`

**2. `/src/app/page.tsx` (line ~291 in hero section)**
- CURRENT: `"Scan covers with technopathic recognition"`
- REVERT TO: `"Scan covers with AI recognition"`

**3. `/src/app/sign-up/[[...sign-up]]/page.tsx` (line ~125 in benefits list)**
- CURRENT: `"Technopathic comic cover recognition"`
- REVERT TO: `"AI-powered comic cover recognition"`

**4. `/src/components/Navigation.tsx` - FAQ answers**
- Line ~16: CURRENT: `"technopathic recognition"` → REVERT TO: `"AI recognition"`
- Line ~31: CURRENT: `"using technopathy based on"` → REVERT TO: `"by AI based on"`

**5. `/src/components/AskProfessor.tsx` - FAQ answers**
- Line ~15: CURRENT: `"technopathic recognition"` → REVERT TO: `"AI recognition"`
- Line ~30: CURRENT: `"using technopathy based on"` → REVERT TO: `"by AI based on"`

**6. `/src/components/ComicDetailModal.tsx` (line ~474)**
- CURRENT: `"Technopathic Estimate:</span> No eBay sales data found. This price is a technopathic estimate"`
- REVERT TO: `"AI Estimate:</span> No eBay sales data found. This price is an AI estimate"`

**7. `/src/components/ComicDetailsForm.tsx` (line ~1136)**
- CURRENT: `"Technopathic Estimate:</span> No eBay sales data found for this comic. This price is a technopathic estimate"`
- REVERT TO: `"AI Estimate:</span> No eBay sales data found for this comic. This price is an AI estimate"`

**8. `/src/components/KeyHuntPriceResult.tsx` (line ~193)**
- CURRENT: `"Technopathic Estimate:</span> No eBay sales data found. This price is a technopathic estimate"`
- REVERT TO: `"AI Estimate:</span> No eBay sales data found. This price is an AI estimate"`

**9. `/src/app/key-hunt/page.tsx` - Multiple locations**
- All `"Technopathic Estimate"` → `"AI Estimate"`
- All `"Technopathic estimate"` → `"AI-estimated value"` (in disclaimers)

**10. `/src/hooks/useOffline.ts` - Multiple locations**
- All `"Technopathic Estimate"` → `"AI Estimate"`
- All `"Technopathic estimate"` → `"AI-estimated value"`

**11. `/src/app/api/analyze/route.ts` - 3 occurrences (lines ~755, 760, 765)**
- CURRENT: `disclaimer = "Technopathic estimate - actual prices may vary.";`
- REVERT TO: `disclaimer = "AI estimate - actual prices may vary.";`

**12. `/src/app/api/quick-lookup/route.ts` (line ~207)**
- CURRENT: `disclaimer: "Technopathic estimates based on market knowledge."`
- REVERT TO: `disclaimer: "AI-estimated values based on market knowledge."`

### Revert Process:
1. Read each file listed above
2. Use Edit tool with replace_all where multiple occurrences exist
3. Run `npm run build` to verify changes compile
4. Commit with message: "Revert technopathy branding back to AI terminology"
