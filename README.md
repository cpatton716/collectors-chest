# Collectors Chest

**Scan comics. Track value. Collect smarter.**

Collectors Chest is a comic book collection tracking app with AI-powered cover recognition and a built-in auction/marketplace. Snap a photo of any cover to identify it, track real-time market value, organize your collection, and buy, sell, and trade with other collectors.

The app is currently in **Private Beta** — public registration is disabled and access is waitlist-only. Live at **[collectors-chest.com](https://collectors-chest.com)**.

> Signed-in users persist their collection to a Supabase database; guests can scan a limited number of covers with data held in browser localStorage until they create an account.

---

## Features

**AI Cover Recognition**
- Scan a cover photo to identify title, issue number, publisher, creators, release year, and variant
- Multi-provider AI fallback: **Google Gemini 2.0 Flash** is the primary engine (more accurate for comics and ~5x cheaper); **Anthropic Claude Sonnet 4.5** is the fallback; lightweight text lookups use **Claude Haiku 4.5**
- Barcode scanning with barcode catalog lookup

**Collection Management**
- Grid and list views with search, filtering, and sorting
- Custom lists (Collection, Want List, For Sale, and user-defined)
- Condition tracking for raw books and CGC/CBCS graded slabs
- Mark-as-sold with profit/loss tracking
- CSV import/export and public collection sharing

**Pricing & Valuation**
- Real-time pricing via the **eBay Browse API**, with grade-aware pricing for CGC/CBCS graded slabs
- CGC/CBCS certification lookup
- **Key Hunt** — a convention-optimized, offline price-lookup mode

**Marketplace & Social**
- Auction listings plus fixed-price (Buy Now) listings and offers
- **Stripe Connect** seller payouts
- Book trading, following/social profiles, and peer-to-peer messaging

**Platform**
- Progressive Web App (installable, with offline support)
- Email notifications via Resend
- Subscription billing via Stripe: **$4.99/mo** or **$49.99/yr** premium; free tier includes 10 scans/month; guests get 5 scans

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router), React, TypeScript |
| Styling | Tailwind CSS (Lichtenstein pop-art design language) |
| Database | Supabase (PostgreSQL) with Row-Level Security |
| Auth | Clerk |
| Payments | Stripe + Stripe Connect |
| AI | Google Gemini (primary) + Anthropic Claude (fallback) |
| Caching / Rate Limiting | Upstash Redis |
| Email | Resend |
| Pricing Data | eBay Browse API |
| Error Tracking | Sentry |
| Analytics | PostHog |
| Bot Prevention | hCaptcha |
| Hosting | Netlify |

---

## Getting Started

### Prerequisites
- Node.js 18 or higher

### Installation

```bash
git clone <repository-url>
cd "Comic Tracker"
npm install
```

### Environment Setup

Configuration lives in a `.env.local` file in the project root. The app integrates many services, so a number of keys are required — Supabase, Clerk, Stripe, Anthropic, Gemini, Resend, Upstash, Sentry, PostHog, hCaptcha, and eBay among them.

Create `.env.local` and populate it with the required keys for the services above. (Without third-party credentials, AI scanning, auth, payments, and pricing features will not function.)

### Run the Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the development server |
| `npm test` | Run the Jest test suite |
| `npm run check` | Typecheck + lint + test |
| `npm run check:full` | `check` plus a production build |

Deploys target **Netlify**.

---

## Project Structure

```
src/
├── app/          # Next.js App Router routes, pages, and API endpoints
├── components/   # React UI components
├── lib/          # Service clients, helpers, and business logic
├── hooks/        # Custom React hooks
└── types/        # TypeScript type definitions and helpers
supabase/         # Database schema, migrations, and policies
docs/             # Architecture, technical specs, design docs, and plans
```

---

## Documentation

- **`ARCHITECTURE.md`** — system map and high-level architecture overview
- **`docs/TECHNICAL_FEATURES.md`** — feature deep-dives
- **`docs/`** — design specifications and implementation plans

---

## License

MIT
