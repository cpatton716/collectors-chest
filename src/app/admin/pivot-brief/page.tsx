import { redirect } from "next/navigation";

import type { ReactNode } from "react";

import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  DollarSign,
  FileText,
  Rocket,
  Scale,
  ShieldAlert,
  Store,
  Target,
  TrendingDown,
} from "lucide-react";

import { getAdminProfile } from "@/lib/adminAuth";

type PillKind = "yes" | "cond" | "no" | "best";

interface Verdict {
  pill?: { kind: PillKind; label: string };
  text?: string;
}

interface SourceRow {
  source: string;
  gives: string;
  usable: Verdict;
  cost: string;
  fit: Verdict;
}

const topLine: { tag: string; body: ReactNode }[] = [
  {
    tag: "Data",
    body: (
      <>
        No new sales-price source exists. The market got <strong>tighter</strong> in 2026, not
        looser.
      </>
    ),
  },
  {
    tag: "Pitch",
    body: <strong>Track your collection, and know what to pay on the con floor.</strong>,
  },
  {
    tag: "Launch",
    body: (
      <>
        Launch <strong>subscriptions only</strong>. Hold the marketplace back for now.
      </>
    ),
  },
  {
    tag: "Test",
    body: (
      <>
        Break-even is <strong>~4 Premium subscribers</strong>. Test at one convention with a 60-day
        bar.
      </>
    ),
  },
];

const tiers = [
  { name: "Guest", price: "Free", items: ["5 lifetime scans, no account"], premium: false },
  {
    name: "Free account",
    price: "Free",
    items: ["10 scans a month", "Cloud sync", "Buy and bid", "3 listings"],
    premium: false,
  },
  {
    name: "Premium",
    price: "$4.99/mo · $49.99/yr",
    items: [
      "Unlimited scans, Key Hunt, full stats, CSV export",
      "Unlimited selling, lower sale fee (5% vs 8%)",
    ],
    premium: true,
  },
];

const breakEven = [
  { n: "~4", label: "at today's costs" },
  { n: "~15", label: "at $75/month in costs" },
  { n: "~65", label: "at $325/month in costs" },
];

const sources: SourceRow[] = [
  {
    source: "PriceCharting",
    gives: "Values by grade, including raw (2.0–10.0), plus a daily full price file",
    usable: {
      pill: { kind: "cond", label: "With license" },
      text: "Yes, but only with a separate written commercial license. The $49/mo plan alone is for internal use only.",
    },
    cost: "~$49/mo (or ~$499/yr) plus a license fee still to be quoted",
    fit: {
      pill: { kind: "best", label: "Best" },
      text: "The daily file can live on the phone, so lookups are instant and work offline.",
    },
  },
  {
    source: "eBay current listings + AI estimate (what we use now)",
    gives: "Asking prices",
    usable: { pill: { kind: "yes", label: "Yes" } },
    cost: "Free",
    fit: {
      pill: { kind: "cond", label: "OK" },
      text: "Fine if we label it honestly as an “asking range.”",
    },
  },
  {
    source: "eBay sold-comps services (CompSniper, SoldComps, etc.)",
    gives: "Live eBay sold prices",
    usable: {
      pill: { kind: "no", label: "Not recommended" },
      text: "They rely on scraping, which eBay now bans. All of them broke at once in Aug 2026.",
    },
    cost: "$9–29/mo",
    fit: {
      pill: { kind: "no", label: "Poor" },
      text: "4–6 seconds per lookup, and needs signal.",
    },
  },
  {
    source: "CovrPrice",
    gives: "Raw and graded values",
    usable: {
      pill: { kind: "cond", label: "Partner only" },
      text: "Partner deals only (CLZ is the only partner). Targeting 2027.",
    },
    cost: "Unknown",
    fit: { text: "Depends on the deal" },
  },
  {
    source: "GPA (GPAnalysis)",
    gives: "Sales history for graded slabs",
    usable: {
      pill: { kind: "no", label: "No license offered" },
      text: "We would have to ask.",
    },
    cost: "Unknown",
    fit: {
      pill: { kind: "cond", label: "Slabs only" },
      text: "No help with raw books at cons.",
    },
  },
  {
    source: "GoCollect",
    gives: "Values and sales history",
    usable: { pill: { kind: "no", label: "Enterprise only" } },
    cost: "Custom, likely high",
    fit: { text: "Unknown" },
  },
];

const priceCompare = [
  { price: "~$10.94", label: "CLZ $1.99/mo + CovrPrice $8.95/mo to see values", us: false },
  { price: "$3.99", label: "Key Collector", us: false },
  { price: "~$5", label: "CovrPrice per month", us: false },
  { price: "$4.99", label: "Us, with scanning and offline key lookup", us: true },
];

const pillClasses: Record<PillKind, string> = {
  yes: "bg-green-50 border-green-300 text-green-900",
  cond: "bg-amber-50 border-amber-300 text-amber-900",
  no: "bg-red-50 border-red-300 text-red-900",
  best: "bg-indigo-50 border-indigo-300 text-indigo-900",
};

function Pill({ kind, label }: { kind: PillKind; label: string }) {
  return (
    <span
      className={`inline-block rounded-full border-2 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${pillClasses[kind]}`}
    >
      {label}
    </span>
  );
}

function VerdictCell({ verdict }: { verdict: Verdict }) {
  return (
    <div className="space-y-1">
      {verdict.pill && (
        <div>
          <Pill kind={verdict.pill.kind} label={verdict.pill.label} />
        </div>
      )}
      {verdict.text && <div>{verdict.text}</div>}
    </div>
  );
}

function SectionHeading({ n, title, icon }: { n: number; title: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="flex-shrink-0 w-9 h-9 rounded-full bg-black text-white flex items-center justify-center font-bold text-base">
        {n}
      </span>
      {icon}
      <h2 className="text-xl md:text-2xl font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
        {title}
      </h2>
    </div>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h3
      className="text-lg md:text-xl font-bold mt-6 mb-3"
      style={{ fontFamily: "var(--font-bangers)" }}
    >
      {children}
    </h3>
  );
}

export default async function PivotBriefPage() {
  // Server-side admin gate (M-AD1): defense-in-depth with the admin layout and
  // middleware. Non-admins (incl. unauthenticated) never receive this page.
  const adminProfile = await getAdminProfile();
  if (!adminProfile) {
    redirect("/collection");
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      {/* Top line */}
      <section className="rounded-2xl border-4 border-black bg-yellow-50 p-6 md:p-8 shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
          Collectors Chest · Partner briefing for Aponte · Oct 4, 2026
        </p>
        <div className="flex items-start gap-2 mb-4">
          <FileText className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
          <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
            Ship it as the collector&apos;s <span className="text-red-600">convention companion</span>,
            and find out if people will pay.
          </h1>
        </div>
        <ul className="space-y-2">
          {topLine.map(({ tag, body }) => (
            <li key={tag} className="flex items-start gap-3 text-base md:text-lg text-gray-900">
              <span className="flex-shrink-0 w-16 text-center rounded-md bg-black text-white text-xs font-bold uppercase tracking-wide py-1 mt-0.5">
                {tag}
              </span>
              <span className="leading-relaxed">{body}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-xl border-2 border-black bg-white p-4 md:p-5">
          <h2 className="text-lg md:text-xl font-bold mb-2" style={{ fontFamily: "var(--font-bangers)" }}>
            Decisions we need from you
          </h2>
          <ol className="list-[lower-alpha] pl-5 space-y-2 text-sm md:text-base text-gray-800">
            <li>
              <strong>Approve a subscriptions-only launch</strong>, with the marketplace held back.
            </li>
            <li>
              <strong>PriceCharting ($499/yr):</strong> the subscription alone doesn&apos;t let us
              show their prices; we also need a separate commercial license. Agree that we{" "}
              <strong>request license terms now</strong>, but only buy once trial users tell us
              pricing is what&apos;s stopping them.
            </li>
            <li>
              <strong>Agree the success bar:</strong> 10+ paying users in 60 days means keep
              investing. Fewer than 3 means stop spending.
            </li>
          </ol>
        </div>
      </section>

      <div
        className="border-t-4 border-black pt-3 text-center text-xl md:text-2xl tracking-wide text-gray-600"
        style={{ fontFamily: "var(--font-bangers)" }}
      >
        The details
      </div>

      {/* 1. Where we are today */}
      <section>
        <SectionHeading n={1} title="Where we are today" icon={<Building2 className="w-6 h-6 text-indigo-600" />} />
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-4 md:p-5">
            <h3 className="text-base font-bold text-indigo-900 mb-2">Live, but behind a velvet rope</h3>
            <ul className="space-y-1.5 text-sm text-gray-800 list-disc pl-4">
              <li>
                The site is live at collectors-chest.com, in <strong>private beta</strong>. Public
                sign-up is off (waitlist only). Guests get 5 free scans.
              </li>
              <li>
                <strong>No live Premium purchase has ever been recorded.</strong>
              </li>
              <li>
                Production was last updated <strong>May 27, 2026</strong>. About 4 months of
                improvements (security, fixes) are waiting on a device test pass before they go out.
              </li>
            </ul>
          </div>
          <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4 md:p-5">
            <h3 className="text-base font-bold text-green-900 mb-2">Cheap to run</h3>
            <ul className="space-y-1.5 text-sm text-gray-800 list-disc pl-4">
              <li>
                About <strong>$13–25/month</strong> today: hosting ~$9.54/mo, the domain, and AI
                scans at ~1.5¢ each. Everything else is on free tiers.
              </li>
              <li>
                Rises to roughly <strong>$35–55/month</strong> around 500 users, when the database
                needs an upgrade.
              </li>
            </ul>
          </div>
        </div>

        <SubHeading>What we charge today</SubHeading>
        <div className="grid md:grid-cols-3 gap-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`rounded-xl p-4 md:p-5 ${
                t.premium
                  ? "border-4 border-green-400 bg-green-50 ring-4 ring-green-200"
                  : "border-2 border-gray-200 bg-white"
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-gray-600">{t.name}</p>
              <p className={`text-lg font-bold mt-1 ${t.premium ? "text-green-700" : "text-gray-900"}`}>
                {t.price}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-gray-800 list-disc pl-4">
                {t.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm md:text-base text-gray-800">
          Premium has a 7-day trial, and a 30-day convention promo trial is already built. Scan
          packs are $1.99 for 10 scans.
        </p>

        <SubHeading>Break-even (Premium subscribers needed)</SubHeading>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {breakEven.map((b) => (
            <div
              key={b.n}
              className="rounded-xl border-2 border-gray-200 bg-gray-50 p-3 md:p-4 text-center"
            >
              <div
                className="text-3xl md:text-4xl text-blue-600 leading-none"
                style={{ fontFamily: "var(--font-bangers)" }}
              >
                {b.n}
              </div>
              <div className="text-xs md:text-sm text-gray-600 mt-1">{b.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. The pricing-data problem */}
      <section>
        <SectionHeading n={2} title="The pricing-data problem" icon={<TrendingDown className="w-6 h-6 text-red-600" />} />
        <p className="text-sm text-gray-600 mb-4 italic">Why values are our weak spot</p>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 md:p-5">
            <h3 className="text-base font-bold text-red-900 mb-2">What we show today</h3>
            <p className="text-sm text-gray-800">
              Values come from current eBay <strong>asking</strong> prices, not sold prices, with an
              AI estimate when there aren&apos;t enough listings. Rare and key books at unusual
              grades often come back with no real data. Example: <strong>Hulk #181 in CGC 2.5</strong>.
            </p>
          </div>
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 md:p-5">
            <h3 className="text-base font-bold text-amber-900 mb-2">GoCollect: treat as unavailable</h3>
            <ul className="space-y-1.5 text-sm text-gray-800 list-disc pl-4">
              <li>Their API shut down in Feb 2026.</li>
              <li>Our support ticket was quietly closed with no reply.</li>
              <li>
                Their site now offers &ldquo;customized API access&rdquo; only on a custom-priced
                Enterprise plan.
              </li>
              <li>
                The &ldquo;API tokens&rdquo; on free accounts are for uploading your sales to
                GoCollect, not reading prices.
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-3 rounded-xl border-4 border-black bg-white p-4 md:p-5 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          <h3 className="text-base font-bold mb-2">What changed in 2026 (all of it worse)</h3>
          <ul className="space-y-1.5 text-sm text-gray-800 list-disc pl-4">
            <li>eBay put sold listings behind a login (Jul–Aug 2026).</li>
            <li>eBay&apos;s Feb 2026 user agreement explicitly bans scraping and bots.</li>
            <li>
              eBay&apos;s official sold-data access is closed to new developers. A small developer
              was refused in Sept 2026.
            </li>
            <li>
              eBay launched its own price guide, but it covers trading cards in the UK only. No
              comics.
            </li>
          </ul>
        </div>

        <SubHeading>Source scorecard</SubHeading>
        {/* Desktop table */}
        <div className="hidden md:block rounded-xl border-2 border-amber-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-amber-50 border-b border-amber-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Source</th>
                <th className="text-left px-3 py-2 font-semibold">What it gives</th>
                <th className="text-left px-3 py-2 font-semibold">Can we use it?</th>
                <th className="text-left px-3 py-2 font-semibold">Cost</th>
                <th className="text-left px-3 py-2 font-semibold">Convention-floor fit</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((row) => (
                <tr key={row.source} className="border-b border-gray-100 last:border-0 align-top">
                  <td className="px-3 py-2.5 font-medium">{row.source}</td>
                  <td className="px-3 py-2.5 text-gray-700">{row.gives}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    <VerdictCell verdict={row.usable} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{row.cost}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    <VerdictCell verdict={row.fit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile stacked cards */}
        <div className="md:hidden space-y-3">
          {sources.map((row) => (
            <div key={row.source} className="rounded-xl border-2 border-amber-200 bg-white p-4">
              <h4 className="font-bold text-gray-900 mb-2">{row.source}</h4>
              <dl className="space-y-2 text-xs text-gray-700">
                <div>
                  <dt className="font-semibold text-gray-900">What it gives</dt>
                  <dd>{row.gives}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">Can we use it?</dt>
                  <dd>
                    <VerdictCell verdict={row.usable} />
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">Cost</dt>
                  <dd>{row.cost}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-gray-900">Convention-floor fit</dt>
                  <dd>
                    <VerdictCell verdict={row.fit} />
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-gray-700">
          <strong>Also checked, nothing usable:</strong> Heritage, ComicLink, ComicConnect and
          MyComicShop (no APIs); 130point; League of Comic Geeks; Key Collector; Comics Price
          Guide; CLZ; the new apps Zap-Kapow and ComicValue (no APIs); and card-only tools such as
          Card Ladder and Market Movers.
        </p>

        <div className="mt-4 rounded-xl border-4 border-black bg-amber-50 p-5 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-amber-700" />
            <h3 className="text-lg font-bold text-amber-900" style={{ fontFamily: "var(--font-bangers)" }}>
              The PriceCharting catch
            </h3>
          </div>
          <ul className="space-y-1.5 text-sm md:text-base text-gray-800 list-disc pl-4">
            <li>
              <strong>A subscription alone does not let us show their prices to our users.</strong>{" "}
              We need written permission (a commercial license) first.
            </li>
            <li>They give current values only, with no list of recent sales.</li>
            <li>Their graded tiers don&apos;t separate CGC from CBCS.</li>
            <li>
              Their data itself comes from eBay, so it isn&apos;t immune if eBay tightens further.
            </li>
          </ul>
        </div>
      </section>

      {/* 3. The pivot */}
      <section>
        <SectionHeading n={3} title="The pivot: your convention companion" icon={<Target className="w-6 h-6 text-blue-600" />} />
        <div className="mb-4 rounded-2xl border-4 border-black bg-blue-50 p-5 shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
          <p className="text-lg md:text-xl font-bold italic text-gray-900">
            &ldquo;Track your collection, and know what to pay on the con floor.&rdquo;
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4 md:p-5">
            <h3 className="text-base font-bold text-green-900 mb-2">
              Why it fits what we&apos;ve already built
            </h3>
            <ul className="space-y-1.5 text-sm text-gray-800 list-disc pl-4">
              <li>
                Cover-photo scan identifies a book in about <strong>3 seconds</strong>. Competitors
                don&apos;t do this.
              </li>
              <li>
                Key Hunt works <strong>offline</strong>, with 1,130 curated key issues.
              </li>
              <li>Your own cover photos in your collection.</li>
              <li>Collection stats, plus a sales and profit page.</li>
              <li>Spreadsheet import and export.</li>
              <li>A shareable public profile.</li>
              <li>Installs on the phone like an app, with our pop-art look.</li>
            </ul>
          </div>
          <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-4 md:p-5">
            <h3 className="text-base font-bold text-indigo-900 mb-2">Honest price framing</h3>
            <div className="space-y-2 text-sm text-gray-800">
              <p>
                Show <strong>&ldquo;eBay asking range: $X–$Y&rdquo;</strong> instead of &ldquo;fair
                market value.&rdquo;
              </p>
              <p>
                At a con, &ldquo;is this dealer above what eBay sellers are asking?&rdquo; is a
                genuinely useful question, and an honest one. The AI number appears only as a
                clearly marked estimate.
              </p>
            </div>
          </div>
        </div>

        <SubHeading>How we stack up on price</SubHeading>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {priceCompare.map((p) => (
            <div
              key={p.price}
              className={`rounded-xl p-4 text-center ${
                p.us
                  ? "border-4 border-green-400 bg-green-50 ring-4 ring-green-200"
                  : "border-2 border-gray-200 bg-white"
              }`}
            >
              <div
                className={`text-2xl md:text-3xl leading-none ${p.us ? "text-green-700" : "text-gray-900"}`}
                style={{ fontFamily: "var(--font-bangers)" }}
              >
                {p.price}
              </div>
              <div className="text-xs md:text-sm text-gray-600 mt-2">{p.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-red-100 border border-red-300 rounded-md">
          <AlertCircle className="w-4 h-4 text-red-700 mt-0.5 flex-shrink-0" />
          <p className="text-xs md:text-sm text-red-900">
            <strong>Don&apos;t lead with &ldquo;cheaper than CLZ.&rdquo;</strong> CLZ&apos;s headline
            price is $1.99. Lead with scanning and the offline con-floor use.
          </p>
        </div>
      </section>

      {/* 4. Marketplace */}
      <section>
        <SectionHeading n={4} title="Why hold the marketplace back" icon={<Store className="w-6 h-6 text-red-600" />} />
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 md:p-5">
          <ul className="space-y-1.5 text-sm text-gray-800 list-disc pl-4">
            <li>Its payment flow was rewritten and has only been tested with fake money.</li>
            <li>No real seller payout to a bank account has been done since.</li>
            <li>
              There are no dispute or refund tools, even though we&apos;d be first in line for
              refunds and chargebacks.
            </li>
            <li>Shipping isn&apos;t verified.</li>
          </ul>
        </div>
        <p className="mt-3 text-sm md:text-base text-gray-800">
          <strong>Plan:</strong> keep it founders-only for now, and revisit once subscriptions prove
          out.
        </p>
      </section>

      {/* 5. Launch plan */}
      <section>
        <SectionHeading n={5} title="Launch plan" icon={<Rocket className="w-6 h-6 text-blue-600" />} />
        <p className="text-sm text-gray-600 mb-4 italic">About 1–2 work sessions of cleanup</p>
        <ol className="space-y-3">
          {[
            <>
              Run the device test pass, add the new hosting settings, and ship the 4 months of
              waiting improvements.
            </>,
            <>
              Make one real <strong>$1 Premium purchase</strong> to prove billing works end to end.
            </>,
            <>
              Hide or limit the marketplace to founders, and change the price wording to
              &ldquo;asking range.&rdquo;
            </>,
            <>Turn public sign-up back on, and confirm the support inbox works.</>,
          ].map((step, i) => (
            <li key={i} className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">
                  {i + 1}
                </span>
                <p className="flex-1 min-w-0 text-sm md:text-base text-gray-800 pt-1">{step}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 6. Willingness-to-pay test */}
      <section>
        <SectionHeading n={6} title="The willingness-to-pay test" icon={<Scale className="w-6 h-6 text-green-600" />} />
        <ul className="space-y-1.5 text-sm md:text-base text-gray-800 list-disc pl-5">
          <li>
            Pick <strong>one convention</strong>. A QR code at the table starts a 30-day Premium
            trial (already built).
          </li>
          <li>Track how many trials turn into paying subscribers.</li>
        </ul>
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-700" />
              <span className="text-lg font-bold text-green-900">10+ paying</span>
            </div>
            <p className="text-sm text-gray-800 mt-1">in 60 days: keep investing</p>
          </div>
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
              <span className="text-lg font-bold text-amber-900">3 to 9</span>
            </div>
            <p className="text-sm text-gray-800 mt-1">adjust the pitch or price, and retest</p>
          </div>
          <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-700" />
              <span className="text-lg font-bold text-red-900">Fewer than 3</span>
            </div>
            <p className="text-sm text-gray-800 mt-1">stop spending on it</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border-2 border-yellow-300 bg-yellow-50 p-4 md:p-5">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-yellow-700" />
            <h3 className="text-base font-bold text-yellow-900">PriceCharting timing</h3>
          </div>
          <p className="text-sm text-gray-800">
            Hold off on the spend (it takes about 10 more subscribers to cover $49/mo) until trial
            users say pricing is why they won&apos;t pay. <strong>Request license terms now</strong>,
            since that&apos;s free, so we&apos;re ready. In the request, emphasize the offline
            convention use.
          </p>
        </div>
      </section>

      {/* 7. Risks */}
      <section>
        <SectionHeading n={7} title="Risks, and what we're not doing" icon={<ShieldAlert className="w-6 h-6 text-amber-600" />} />
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 md:p-5">
            <div className="flex items-center gap-2 mb-2">
              <Ban className="w-5 h-5 text-red-700" />
              <h3 className="text-base font-bold text-red-900">Not doing</h3>
            </div>
            <ul className="space-y-1.5 text-sm text-gray-800 list-disc pl-4">
              <li>
                <strong>Not scraping eBay.</strong> It carries legal and account risk, and it breaks
                easily.
              </li>
            </ul>
          </div>
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 md:p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
              <h3 className="text-base font-bold text-amber-900">Risks we&apos;re watching</h3>
            </div>
            <ul className="space-y-1.5 text-sm text-gray-800 list-disc pl-4">
              <li>Single-source risk if we later rely on PriceCharting.</li>
              <li>
                On Android phones low on memory, the camera can crash when scanning from the
                installed app. Workaround: upload the photo from the gallery.
              </li>
              <li>Variant detection from barcodes isn&apos;t working yet.</li>
            </ul>
            <p className="text-sm text-gray-700 mt-2">
              Both known issues are not launch blockers for the test.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="text-xs text-gray-500 text-center pt-4 pb-8">
        <p>Prepared October 4, 2026.</p>
      </section>
    </div>
  );
}
