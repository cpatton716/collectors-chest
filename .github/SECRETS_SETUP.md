# GitHub Secrets Required for Self-Healing Pipeline

Navigate to: Repository Settings > Secrets and variables > Actions

| Secret | Source | Notes |
|--------|--------|-------|
| `ANTHROPIC_API_KEY` | console.anthropic.com | Same key as .env.local |
| `RESEND_API_KEY` | resend.com dashboard | Same key as .env.local |
| `ADMIN_EMAIL` | Your alert email | e.g., chris@collectors-chest.com |
| `CRON_SECRET` | .env.local | Shared secret for health-check endpoint auth |

**Not needed:**
- ~~`NETLIFY_AUTH_TOKEN`~~ — Deployment is handled by Netlify's native git-triggered build
- ~~`NETLIFY_SITE_ID`~~ — No CLI deploy, push to main triggers deploy automatically

**GitHub Actions pinned SHAs (update periodically):**
- `actions/checkout` — `692973e3d937129bcbf40652eb9f2f61becf3332` (v4.1.7)
- `actions/setup-node` — `1e60f620b9541d16bece96c5465dc8ee9832be0b` (v4.0.3)

To update SHAs, check the latest releases at:
- https://github.com/actions/checkout/releases
- https://github.com/actions/setup-node/releases
