"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Check, Crown, Loader2, X, Zap } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

const premiumFeatures = [
  "Unlimited scans",
  "Key Hunt (offline lookups)",
  "CSV import & export",
  "Advanced statistics",
  "Unlimited listings",
  "5% seller fee (save 3%)",
];

const freeFeatures = [
  { name: "10 scans per month", included: true },
  { name: "Cloud collection sync", included: true },
  { name: "Real eBay prices", included: true },
  { name: "Buy & bid in Shop", included: true },
  { name: "Key Hunt", included: false },
  { name: "CSV export", included: false },
  { name: "Advanced stats", included: false },
];

export default function ChoosePlanPage() {
  const router = useRouter();
  const { user } = useUser();
  const { startFreeTrial, startCheckout, trialAvailable, tier, isTrialing, isLoading } =
    useSubscription();
  const [loading, setLoading] = useState<"trial" | "free" | null>(null);

  const firstName = user?.firstName || "there";

  // Guard: redirect if user already has a plan
  useEffect(() => {
    if (!isLoading && (tier === "premium" || isTrialing)) {
      router.replace("/collection");
    }
  }, [isLoading, tier, isTrialing, router]);

  // Show loading spinner while subscription state is loading
  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const handleStartTrial = async () => {
    setLoading("trial");
    try {
      if (trialAvailable) {
        const result = await startFreeTrial();
        if (result.success) {
          router.push("/collection");
          return;
        }
      }
      // Fallback: redirect to Stripe checkout with trial
      const url = await startCheckout("monthly", true);
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error("Failed to start trial/checkout:", err);
      // If all else fails, just go to collection
      router.push("/collection");
    } finally {
      setLoading(null);
    }
  };

  const handleContinueFree = () => {
    setLoading("free");
    router.push("/collection");
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-comic text-pop-black mb-2">
            Welcome, {firstName}!
          </h1>
          <p className="text-gray-600">
            Choose your plan to get started
          </p>
        </div>

        {/* Premium Card — Emphasized */}
        <div className="bg-pop-blue text-white border-4 border-pop-black p-6 mb-4 relative"
             style={{ boxShadow: "6px 6px 0px #000" }}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-pop-yellow text-pop-black text-xs font-comic px-4 py-1 border-2 border-pop-black shadow-[2px_2px_0px_#000]">
              RECOMMENDED
            </span>
          </div>

          <div className="flex items-center gap-2 mb-1 mt-2">
            <Crown className="w-5 h-5 text-amber-300" />
            <span className="text-xl font-comic">PREMIUM</span>
          </div>
          <p className="text-2xl font-comic mb-4">
            $4.99<span className="text-sm font-normal">/month</span>
          </p>

          <ul className="space-y-2 mb-6">
            {premiumFeatures.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-300 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={handleStartTrial}
            disabled={loading !== null || isLoading}
            className="w-full py-3 font-comic text-pop-black bg-pop-green border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
          >
            {loading === "trial" ? "Starting..." : "START 7-DAY FREE TRIAL"}
          </button>
          <p className="text-xs text-blue-100 text-center mt-2">
            No credit card required. Cancel anytime.
          </p>
        </div>

        {/* Free Card */}
        <div className="bg-white border-4 border-pop-black p-6"
             style={{ boxShadow: "4px 4px 0px #000" }}>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-gray-400" />
            <span className="text-xl font-comic text-pop-black">FREE</span>
          </div>
          <p className="text-2xl font-comic text-pop-black mb-4">
            $0<span className="text-sm font-normal text-gray-500">/month</span>
          </p>

          <ul className="space-y-2 mb-6">
            {freeFeatures.map((f) => (
              <li key={f.name} className="flex items-center gap-2 text-sm">
                {f.included ? (
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-gray-300 shrink-0" />
                )}
                <span className={f.included ? "text-gray-700" : "text-gray-400"}>
                  {f.name}
                </span>
              </li>
            ))}
          </ul>

          <button
            onClick={handleContinueFree}
            disabled={loading !== null}
            className="w-full py-3 font-comic text-pop-black bg-pop-yellow border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
          >
            {loading === "free" ? "Loading..." : "CONTINUE WITH FREE"}
          </button>
          <div className="mt-4 p-3 bg-blue-50 border-2 border-blue-200 text-center">
            <p className="text-sm font-comic text-pop-black">
              Need more scans? Buy a 10-pack for just $1.99!
            </p>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-500 mt-6">
          You can change your plan anytime in Account Settings.
        </p>
      </div>
    </div>
  );
}
