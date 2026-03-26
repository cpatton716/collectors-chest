import Link from "next/link";
import PromoTrialActivator from "./PromoTrialActivator";
import PromoTrialCTA from "./PromoTrialCTA";

export default function JoinTrialPage() {
  return (
    <div className="min-h-screen bg-pop-yellow relative overflow-hidden">
      <PromoTrialActivator />

      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, #000 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        <div className="bg-pop-white border-4 border-pop-black shadow-comic-sm max-w-md w-full p-6 sm:p-8 text-center">
          <div className="mb-6">
            <h1 className="text-4xl font-comic text-pop-black uppercase tracking-tight">
              Collectors Chest
            </h1>
            <div className="h-1 bg-pop-red w-24 mx-auto mt-2" />
          </div>

          <div className="mb-6">
            <div className="inline-block bg-pop-red text-white font-bold text-sm px-4 py-1 uppercase tracking-wide mb-4 border-2 border-pop-black">
              Convention Special
            </div>
            <h2 className="text-2xl font-comic text-pop-black mb-2">
              30 Days Free
            </h2>
            <p className="text-gray-700 text-lg">
              Get full Premium access to scan, track, and value your comic
              collection.
            </p>
          </div>

          <ul className="text-left space-y-3 mb-6">
            {[
              "Unlimited comic cover scans",
              "Real-time eBay pricing",
              "Collection stats & insights",
              "Key Issue hunting tools",
              "CSV export your collection",
              "Buy, sell & auction comics",
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-2">
                <span className="text-pop-red font-bold text-lg mt-0.5">
                  POW!
                </span>
                <span className="text-pop-black font-medium">{benefit}</span>
              </li>
            ))}
          </ul>

          <PromoTrialCTA />

          <p className="text-gray-500 text-sm mt-4">
            Credit card required. No charge for 30 days. Then $4.99/mo. Cancel anytime.
          </p>
        </div>

        <p className="mt-6 text-pop-black font-medium">
          Already have an account?{" "}
          <Link href="/sign-in?redirect_url=/choose-plan" className="underline font-bold hover:text-pop-red active:text-pop-red py-3 px-4 inline-block">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
