import Link from "next/link";
import PromoTrialActivator from "./PromoTrialActivator";
import PromoTrialCTA from "./PromoTrialCTA";

export default function JoinTrialPage() {
  return (
    <div className="min-h-screen bg-pop-yellow relative overflow-hidden">
      <PromoTrialActivator />

      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle, #000 1.5px, transparent 1.5px)",
          backgroundSize: "16px 16px",
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
            <li className="flex items-baseline gap-2">
              <span className="text-pop-red font-bold text-lg">POW!</span>
              <span className="text-pop-black font-medium">Unlimited comic cover scans</span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-pop-red font-bold text-lg">BAM!</span>
              <span className="text-pop-black font-medium">Real-time eBay pricing</span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-pop-red font-bold text-lg">ZAP!</span>
              <span className="text-pop-black font-medium">Collection stats & insights</span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-pop-red font-bold text-lg">BOOM!</span>
              <span className="text-pop-black font-medium">Key Issue hunting tools</span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-pop-red font-bold text-lg">WHAM!</span>
              <span className="text-pop-black font-medium">CSV export your collection</span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-pop-red font-bold text-lg">KAPOW!</span>
              <span className="text-pop-black font-medium">Buy, sell & auction comics</span>
            </li>
          </ul>

          <PromoTrialCTA />

          <p className="text-gray-500 text-sm mt-4">
            Credit card required. No charge for 30 days. Then $4.99/mo. Cancel anytime.
          </p>
        </div>

        <div className="mt-6 bg-pop-white border-2 border-pop-black shadow-comic-sm px-6 py-3 text-center">
          <span className="text-pop-black font-medium">Already have an account? </span>
          <Link href="/sign-in?redirect_url=/choose-plan" className="font-comic font-bold text-pop-red hover:underline active:underline py-1 px-2 inline-block">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
