import { redirect } from "next/navigation";

import { Check, X, Minus, Trophy, Shield, AlertCircle, Sparkles, Network, MessageCircle, Building2 } from "lucide-react";

import { getAdminProfile } from "@/lib/adminAuth";

interface FeatureRow {
  feature: string;
  cc: "win" | "loss" | "tie" | "partial";
  clz: "win" | "loss" | "tie" | "partial";
  ccNote?: string;
  clzNote?: string;
}

const wins: FeatureRow[] = [
  { feature: "AI cover recognition", cc: "win", clz: "loss", ccNote: "Scan front cover; works on vintage pre-1973 books with no barcode", clzNote: "Barcode-first; their cover scan matches against database not AI" },
  { feature: "Real-time eBay pricing included", cc: "win", clz: "loss", ccNote: "Built-in to Premium $4.99/mo", clzNote: "Requires CovrPrice add-on at +$8.95/mo" },
  { feature: "Marketplace / auctions", cc: "win", clz: "loss", ccNote: "Full eBay-style auctions + Buy Now + offers; Stripe Connect", clzNote: "Not present" },
  { feature: "Trade matching (P2P)", cc: "win", clz: "loss" },
  { feature: "Free tier (no payment)", cc: "win", clz: "loss", ccNote: "5 guest scans + 10/mo free tier", clzNote: "Subscription required after 7-day trial" },
  { feature: "Public collection profile", cc: "win", clz: "partial", ccNote: "Shareable profile at username URL", clzNote: "Cloud viewing only; no profile-as-identity" },
  { feature: "Following / social graph", cc: "win", clz: "loss" },
  { feature: "Notifications inbox", cc: "win", clz: "loss" },
  { feature: "Modern PWA / mobile-first", cc: "win", clz: "partial", clzNote: "Native apps but 2010-era port" },
  { feature: "Your actual cover photo", cc: "win", clz: "loss", clzNote: "Stock catalog image only" },
  { feature: "Built-in CGC/CBCS cert lookup", cc: "win", clz: "partial", ccNote: "Auto-detect grade from slab label", clzNote: "Manual mark; cosmetic slab frame" },
];

const losses: FeatureRow[] = [
  { feature: "Barcode scanning accuracy", cc: "partial", clz: "win", ccNote: "Basic; AI cover scan is the moat for vintage", clzNote: "99% - their hero feature, 15+ yrs of DB" },
  { feature: "Native desktop app (macOS/Windows)", cc: "loss", clz: "win", ccNote: "Web-first; Mac Chrome works fine", clzNote: "CLZ Comics Web $39.95/yr" },
  { feature: "Custom fields per comic", cc: "loss", clz: "win", ccNote: "Fixed schema today", clzNote: "Users define metadata fields" },
  { feature: "Storage box location field", cc: "partial", clz: "win", ccNote: "Notes field today", clzNote: "Dedicated field" },
  { feature: "Multiple collections (tabs)", cc: "partial", clz: "win", ccNote: "Lists exist, no tabs", clzNote: "Mine vs spouse vs sales tabs" },
  { feature: "Front + back cover uploads", cc: "partial", clz: "win", ccNote: "Front only", clzNote: "Both faces stored" },
  { feature: "Signature tracking field", cc: "loss", clz: "win", ccNote: "Notes-only" },
  { feature: "iOS native app", cc: "partial", clz: "win", ccNote: "Pre-Launch Blocker; on roadmap" },
  { feature: "Android native app", cc: "loss", clz: "win", ccNote: "Post-Launch on roadmap" },
];

const ties: string[] = [
  "Cloud sync across devices",
  "CSV import / export",
  "Wishlist / Want list",
  "Multiple grade tracking",
  "Variant cover support",
  "Duplicate detection",
  "Statistics dashboard",
  "eBay deep links",
  "CGC graded valuation data",
];

const talkingPoints = [
  {
    n: 1,
    title: "Design & Feel",
    headline: "Modern PWA + pop-art aesthetic vs CLZ's legacy desktop port.",
    pitch: "Open both apps side-by-side. Within 5 seconds, people see the difference.",
    color: "blue",
  },
  {
    n: 2,
    title: "Cost (the apples-to-apples reframe)",
    headline: "Roughly half the price for the same outcome.",
    pitch:
      "They're cheaper if you only want a list of titles. The second you want to know what your books are actually worth, you're paying CovrPrice on top - and that's where they get more expensive than us.",
    warning:
      "Don't say 'we're cheaper than CLZ' without context. A savvy collector will check $1.99 vs $4.99 and walk. Lead with the apples-to-apples reframe.",
    color: "green",
  },
  {
    n: 3,
    title: "Authenticity",
    headline: "Your real cover photo. Their stock catalog image.",
    pitch:
      "Pull up someone's collection on each app. You see their actual books in ours. You see Marvel's marketing-department cover in CLZ's. Which feels more like YOUR collection?",
    color: "purple",
  },
  {
    n: 4,
    title: "Free Tier + Extended Trial",
    headline: "5 free guest scans + 10/mo free tier + 30-day trial. CLZ has 7-day trial only.",
    pitch:
      "Take out your phone right now. I'll show you 5 scans, no signup. You decide if you want to keep going. CLZ won't let you do that.",
    color: "yellow",
  },
  {
    n: 5,
    title: "No-Account Scanning",
    headline: "Guest scans on first launch. CLZ requires subscription dialog.",
    pitch:
      "How often have you downloaded an app, hit a paywall on launch, and just deleted it? Most people just delete. We don't make you commit until you've already gotten value out of us.",
    color: "red",
  },
];

const objections = [
  {
    q: "CLZ has 99% barcode scan accuracy, you don't have that yet.",
    a: "True - they've spent 15+ years on a barcode database, and we're not there yet on barcode-only. But we don't need to be: our cover-recognition AI scans the FRONT of the book, which means we work on every comic ever printed - including the silver/bronze keys CLZ's barcode lookup misses entirely because barcodes didn't exist before 1973. If you're scanning new books only, CLZ wins. If you're scanning a vintage collection, we win.",
  },
  {
    q: "I already paid for CLZ. Why switch?",
    a: "Don't switch - try us alongside it. Our free tier gives you 10 scans a month at no cost. Test our cover recognition on a book CLZ misses. If we save you time, the switch will make sense on its own. If not, you've lost nothing.",
  },
  {
    q: "I need a desktop app, not just mobile.",
    a: "We're web-first - runs on any browser, including desktop Chrome. We don't have a native macOS/Windows app today. CLZ has that and it's their best feature for power users. We're betting most collectors will catalog from the phone they already have. If you live at a desk, CLZ's desktop tool may be a better fit right now - but we're getting to native apps soon.",
  },
  {
    q: "Aren't you new? What if you go out of business?",
    a: "Fair question. Two answers: (1) CSV export in three clicks - your data is portable, never locked in. (2) We're not a side project: live in beta, real revenue, full marketplace shipped. We're not going anywhere - but if we did, your collection data leaves with you in the same format you'd import to any competitor.",
  },
  {
    q: "Why don't you have CGC slab pricing?",
    a: "We do - graded books are auto-detected by our scanner reading the slab label, and our pricing engine pulls grade-aware comps from eBay's actual sales data. CLZ's CovrPrice add-on does graded values too, but you're paying $8.95/mo extra for it. Ours is included in the $4.99 Premium.",
  },
  {
    q: "Does it work offline at conventions?",
    a: "Key Hunt mode works offline. Once you've scanned a book, the result caches locally, so even when convention WiFi dies you can re-check prices instantly. CLZ's cloud sync needs a connection. We're built for the convention floor.",
  },
];

function VerdictIcon({ verdict }: { verdict: FeatureRow["cc"] }) {
  if (verdict === "win") return <Check className="w-5 h-5 text-green-600" strokeWidth={3} />;
  if (verdict === "loss") return <X className="w-5 h-5 text-red-500" strokeWidth={3} />;
  if (verdict === "partial") return <Minus className="w-5 h-5 text-amber-500" strokeWidth={3} />;
  return <Minus className="w-5 h-5 text-gray-400" strokeWidth={3} />;
}

const colorClasses: Record<string, { bg: string; border: string; ring: string; text: string }> = {
  blue: { bg: "bg-blue-50", border: "border-blue-300", ring: "ring-blue-200", text: "text-blue-900" },
  green: { bg: "bg-green-50", border: "border-green-300", ring: "ring-green-200", text: "text-green-900" },
  purple: { bg: "bg-purple-50", border: "border-purple-300", ring: "ring-purple-200", text: "text-purple-900" },
  yellow: { bg: "bg-yellow-50", border: "border-yellow-300", ring: "ring-yellow-200", text: "text-yellow-900" },
  red: { bg: "bg-red-50", border: "border-red-300", ring: "ring-red-200", text: "text-red-900" },
};

export default async function CLZComparisonPage() {
  // Server-side admin gate (M-AD1): defense-in-depth with the admin layout and
  // middleware. Non-admins (incl. unauthenticated) never receive this page.
  const adminProfile = await getAdminProfile();
  if (!adminProfile) {
    redirect("/collection");
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      {/* Hero - 30-second pitch */}
      <section className="rounded-2xl border-4 border-black bg-yellow-50 p-6 md:p-8 shadow-[6px_6px_0_0_rgba(0,0,0,1)]">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-6 h-6 text-yellow-600" />
          <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
            Collectors Chest vs CLZ - The Pitch
          </h1>
        </div>
        <p className="text-base md:text-lg leading-relaxed text-gray-900">
          <em>
            &ldquo;CLZ has been around forever and they&apos;re the legacy choice - but they were
            built before AI, before mobile-first PWAs, and before collectors expected to scan a
            cover and get a real-time eBay value back in three seconds. We built Collectors Chest
            from the ground up for what collectors actually want now: scan the cover (not the
            barcode), see what your book is actually worth (not a static catalog value), pay one
            subscription that includes pricing (not two), and get five free scans before you ever
            create an account.
          </em>{" "}
          <strong>
            We&apos;re cheaper, we&apos;re faster, and your collection actually looks like YOUR
            collection - your real covers, your real books - not stock photos.&rdquo;
          </strong>
        </p>
      </section>

      {/* Pricing comparison */}
      <section>
        <h2 className="text-xl md:text-2xl font-bold mb-4" style={{ fontFamily: "var(--font-bangers)" }}>
          Pricing - Apples-to-Apples
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border-4 border-red-300 bg-red-50 p-5">
            <h3 className="text-lg font-bold mb-2 text-red-900">CLZ - Catalog + Pricing</h3>
            <ul className="space-y-1.5 text-sm text-gray-800">
              <li>CLZ Comics Mobile: <strong>$1.99/mo</strong> (catalog only)</li>
              <li>+ CovrPrice Premium: <strong>+$8.95/mo</strong> (required to see comic values)</li>
              <li className="pt-2 border-t border-red-200 mt-2 text-base">
                Total: <strong className="text-red-700 text-xl">$10.94/mo</strong>
              </li>
              <li className="text-xs text-gray-600 mt-1">7-day trial</li>
            </ul>
          </div>
          <div className="rounded-xl border-4 border-green-400 bg-green-50 p-5 ring-4 ring-green-200">
            <h3 className="text-lg font-bold mb-2 text-green-900">Collectors Chest Premium</h3>
            <ul className="space-y-1.5 text-sm text-gray-800">
              <li>Premium (everything included): <strong>$4.99/mo</strong></li>
              <li>Pricing data - included</li>
              <li>Marketplace selling - included</li>
              <li>Unlimited scans - included</li>
              <li className="pt-2 border-t border-green-200 mt-2 text-base">
                Total: <strong className="text-green-700 text-xl">$4.99/mo</strong>
              </li>
              <li className="text-xs text-gray-600 mt-1">30-day trial · 5 free guest scans · 10/mo free tier</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-center text-base md:text-lg font-semibold text-gray-900">
          Roughly <span className="text-green-700">half the price</span> for the same outcome.
        </p>
      </section>

      {/* 5 talking points */}
      <section>
        <h2 className="text-xl md:text-2xl font-bold mb-4" style={{ fontFamily: "var(--font-bangers)" }}>
          The 5 Talking Points
        </h2>
        <div className="space-y-3">
          {talkingPoints.map((tp) => {
            const c = colorClasses[tp.color];
            return (
              <div
                key={tp.n}
                className={`rounded-xl border-2 ${c.border} ${c.bg} p-4 md:p-5`}
              >
                <div className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-9 h-9 rounded-full bg-black text-white flex items-center justify-center font-bold text-base`}>
                    {tp.n}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-lg font-bold ${c.text}`}>{tp.title}</h3>
                    <p className="text-sm md:text-base text-gray-800 mt-1">{tp.headline}</p>
                    <p className="text-sm italic text-gray-700 mt-2 leading-relaxed">
                      <strong className="not-italic">Floor pitch:</strong> &ldquo;{tp.pitch}&rdquo;
                    </p>
                    {tp.warning && (
                      <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-red-100 border border-red-300 rounded-md">
                        <AlertCircle className="w-4 h-4 text-red-700 mt-0.5 flex-shrink-0" />
                        <p className="text-xs md:text-sm text-red-900">
                          <strong>Avoid:</strong> {tp.warning}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Where we win */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-6 h-6 text-green-600" />
          <h2 className="text-xl md:text-2xl font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
            Where Collectors Chest Wins
          </h2>
        </div>
        <div className="rounded-xl border-2 border-green-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-green-50 border-b border-green-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Feature</th>
                <th className="px-3 py-2 font-semibold w-16">CC</th>
                <th className="px-3 py-2 font-semibold w-16">CLZ</th>
                <th className="text-left px-3 py-2 font-semibold hidden md:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody>
              {wins.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2.5 font-medium">{row.feature}</td>
                  <td className="px-3 py-2.5 text-center"><div className="flex justify-center"><VerdictIcon verdict={row.cc} /></div></td>
                  <td className="px-3 py-2.5 text-center"><div className="flex justify-center"><VerdictIcon verdict={row.clz} /></div></td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 hidden md:table-cell">
                    {row.ccNote && <div><strong>CC:</strong> {row.ccNote}</div>}
                    {row.clzNote && <div className="text-gray-500"><strong>CLZ:</strong> {row.clzNote}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Where they win */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-6 h-6 text-amber-600" />
          <h2 className="text-xl md:text-2xl font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
            Where CLZ Wins (Acknowledge Honestly)
          </h2>
        </div>
        <div className="rounded-xl border-2 border-amber-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-amber-50 border-b border-amber-200">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Feature</th>
                <th className="px-3 py-2 font-semibold w-16">CC</th>
                <th className="px-3 py-2 font-semibold w-16">CLZ</th>
                <th className="text-left px-3 py-2 font-semibold hidden md:table-cell">Notes / Gap-closing</th>
              </tr>
            </thead>
            <tbody>
              {losses.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2.5 font-medium">{row.feature}</td>
                  <td className="px-3 py-2.5 text-center"><div className="flex justify-center"><VerdictIcon verdict={row.cc} /></div></td>
                  <td className="px-3 py-2.5 text-center"><div className="flex justify-center"><VerdictIcon verdict={row.clz} /></div></td>
                  <td className="px-3 py-2.5 text-xs text-gray-600 hidden md:table-cell">
                    {row.ccNote && <div><strong>CC:</strong> {row.ccNote}</div>}
                    {row.clzNote && <div className="text-gray-500"><strong>CLZ:</strong> {row.clzNote}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Both have */}
      <section>
        <h2 className="text-xl md:text-2xl font-bold mb-3" style={{ fontFamily: "var(--font-bangers)" }}>
          Both Have
        </h2>
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4 md:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            {ties.map((tie) => (
              <div key={tie} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-gray-500 flex-shrink-0" strokeWidth={3} />
                <span className="text-gray-700">{tie}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data partnerships & industry context */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Network className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl md:text-2xl font-bold" style={{ fontFamily: "var(--font-bangers)" }}>
            Data Partnerships & Industry Context
          </h2>
        </div>
        <p className="text-sm text-gray-600 mb-4 italic">
          Came up repeatedly at the May 3-4 show. Customers want to know where pricing data comes
          from and whether we&apos;re built to last. Honest framing here is a real differentiator.
        </p>

        <div className="grid md:grid-cols-2 gap-3">
          {/* Active conversations card */}
          <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50 p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-5 h-5 text-indigo-700" />
              <h3 className="text-base font-bold text-indigo-900">What We&apos;re Doing - Actively</h3>
            </div>
            <div className="space-y-3 text-sm text-gray-800">
              <div>
                <p className="font-semibold">CovrPrice - early in their partner pipeline (API targets 2027)</p>
                <p className="text-xs text-gray-700 mt-1">
                  CovrPrice confirmed their public API is on the <strong>2027 roadmap</strong>.
                  We&apos;re queued as an early beta tester and have surfaced our users&apos; #1 ask
                  (accurate sales pricing data). Same data CLZ users pay <strong>+$8.95/mo</strong> for
                  - would be included in our $4.99 Premium if we land it post-2027.
                </p>
                <p className="text-xs text-gray-500 italic mt-1">Nothing signed; nothing imminent. On their radar.</p>
              </div>
              <div className="pt-3 border-t border-indigo-200">
                <p className="font-semibold">CovrPrice - key issue / first-appearance details (same pipeline)</p>
                <p className="text-xs text-gray-700 mt-1">
                  The same future API would expose 15+ years of curated key-issue data. Layering
                  on top of our 1,130-entry hand-curated DB would expand niche/variant coverage.
                  Same 2027 timing.
                </p>
              </div>
            </div>
          </div>

          {/* Industry consolidation card */}
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5 text-amber-700" />
              <h3 className="text-base font-bold text-amber-900">Industry Consolidation (Context, Not Gossip)</h3>
            </div>
            <div className="space-y-3 text-sm text-gray-800">
              <div>
                <p className="font-semibold">GoCollect API - shut down (Feb 2026)</p>
                <p className="text-xs text-gray-700 mt-1">
                  Ran a Pro-tier API (100 calls/day, FMV pricing, Hot 50 lists). Closed the program
                  to new partners - including us. Affects every tracker that depended on it.
                </p>
              </div>
              <div className="pt-3 border-t border-amber-200">
                <p className="font-semibold">Marvel Developer API - deprecated (Feb 2026)</p>
                <p className="text-xs text-gray-700 mt-1">
                  Free tier (3K calls/day for covers + metadata) officially deprecated same window.
                  Apps relying on Marvel&apos;s API are scrambling.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* The resilience pitch */}
        <div className="mt-4 rounded-xl border-4 border-black bg-blue-50 p-5 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          <h3 className="text-base font-bold mb-2" style={{ fontFamily: "var(--font-bangers)" }}>
            The Resilience Pitch
          </h3>
          <p className="text-sm md:text-base text-gray-900 leading-relaxed italic">
            &ldquo;The whole comics-data industry is consolidating right now. Marvel pulled their
            API. GoCollect shut their API program down. CLZ depends entirely on their CovrPrice
            partnership - that&apos;s currently the only one of those still working for them.
            CovrPrice told us their public API is on their 2027 roadmap, and we&apos;ve been
            positioned as an early beta tester for when it launches.{" "}
            <strong className="not-italic">
              But the bigger story is we built our own AI scanning, pricing, and curated key-info
              pipeline from day one. We&apos;re not dependent on any one data source. That&apos;s
              why we&apos;ll still be here in five years.&rdquo;
            </strong>
          </p>
        </div>

        {/* Safe to say / NOT to say */}
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          <div className="rounded-lg border-2 border-green-300 bg-green-50 p-4">
            <h4 className="text-sm font-bold text-green-900 mb-2 flex items-center gap-1.5">
              <Check className="w-4 h-4" strokeWidth={3} />
              Safe to say
            </h4>
            <ul className="space-y-1.5 text-xs md:text-sm text-gray-800 list-disc pl-4">
              <li>&ldquo;CovrPrice told us their public API is on their 2027 roadmap, and we&apos;ve been positioned as an early beta tester for when it launches.&rdquo;</li>
              <li>&ldquo;GoCollect closed their API program in February - that affects everyone in this space.&rdquo;</li>
              <li>&ldquo;We built our own AI scanning and pricing pipeline so we&apos;re not dependent on any single data provider.&rdquo;</li>
              <li>&ldquo;Whatever happens with future partnerships, your scans still work, your collection still syncs, and your data is still exportable.&rdquo;</li>
            </ul>
          </div>
          <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
            <h4 className="text-sm font-bold text-red-900 mb-2 flex items-center gap-1.5">
              <X className="w-4 h-4" strokeWidth={3} />
              Don&apos;t say
            </h4>
            <ul className="space-y-1.5 text-xs md:text-sm text-gray-800 list-disc pl-4">
              <li>Don&apos;t say &ldquo;active conversations&rdquo; or &ldquo;in discussions.&rdquo; The honest line is &ldquo;on their 2027 roadmap; we&apos;re queued as a beta tester.&rdquo;</li>
              <li>Don&apos;t claim a CovrPrice deal is <strong>signed or imminent</strong>. No public API exists yet.</li>
              <li>Don&apos;t disparage GoCollect - state facts neutrally.</li>
              <li>Don&apos;t promise integration timelines beyond their 2027 target.</li>
              <li>Don&apos;t share email contents, contact names, or partner correspondence specifics.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Common objections */}
      <section>
        <h2 className="text-xl md:text-2xl font-bold mb-4" style={{ fontFamily: "var(--font-bangers)" }}>
          Common Objections + Responses
        </h2>
        <div className="space-y-3">
          {objections.map((o, i) => (
            <details
              key={i}
              className="group rounded-xl border-2 border-gray-200 bg-white overflow-hidden open:border-gray-400 open:shadow-sm"
            >
              <summary className="cursor-pointer p-4 font-semibold text-gray-900 hover:bg-gray-50 list-none flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-bold group-open:bg-black group-open:text-white">
                  Q
                </span>
                <span className="flex-1 italic">&ldquo;{o.q}&rdquo;</span>
              </summary>
              <div className="px-4 pb-4 pt-1 pl-14">
                <p className="text-sm md:text-base text-gray-800 leading-relaxed">{o.a}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Pocket cheat sheet */}
      <section>
        <h2 className="text-xl md:text-2xl font-bold mb-3" style={{ fontFamily: "var(--font-bangers)" }}>
          Pocket Cheat Sheet
        </h2>
        <div className="rounded-xl border-4 border-black bg-white p-5 font-mono text-xs md:text-sm leading-relaxed shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          <div className="font-bold text-base mb-3" style={{ fontFamily: "var(--font-bangers)" }}>
            COLLECTORS CHEST vs CLZ - CON-FLOOR TALKING POINTS
          </div>
          <div className="space-y-2 text-gray-800">
            <p>
              <strong>COST:</strong> CLZ catalog $1.99/mo BUT pricing requires CovrPrice +$8.95/mo
              = <strong>$10.94/mo</strong>. We&apos;re <strong>$4.99/mo all-in</strong>. ~Half the price.
            </p>
            <p>
              <strong>TRIAL:</strong> Us <strong>30 days</strong>. CLZ <strong>7 days</strong>. ~4x longer.
            </p>
            <p>
              <strong>ACCOUNT:</strong> Us <strong>5 free scans, no signup</strong>. CLZ trial subscription dialog at first launch.
            </p>
            <p>
              <strong>COVERS:</strong> Us <strong>YOUR actual photo</strong>. CLZ stock catalog image.
            </p>
            <p>
              <strong>DESIGN:</strong> Modern PWA, pop-art aesthetic, phone-first. CLZ = legacy desktop port.
            </p>
            <div className="pt-3 mt-3 border-t-2 border-dashed border-gray-300 text-center">
              <strong>DEMO MOVE:</strong> &ldquo;Hand me your phone, I&apos;ll scan a book in 5 sec.&rdquo;
              <br />
              <em className="text-gray-600">Show value, not a brochure.</em>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <section className="text-xs text-gray-500 text-center pt-4 pb-8">
        <p>
          Pricing verified May 5, 2026 from clz.com. Re-verify before any external publication -
          competitor pricing changes without notice. Internal-use only.
        </p>
      </section>
    </div>
  );
}
