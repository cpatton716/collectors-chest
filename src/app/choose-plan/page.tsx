"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Check, Crown, Loader2, X, Zap } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { getPromoTrialFlag, clearPromoTrialFlag } from "@/lib/promoTrial";
import { getPromoTrialAction } from "@/lib/choosePlanHelpers";

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
  const { startFreeTrial, startCheckout, trialAvailable, trialUsed, tier, isTrialing, isLoading } =
    useSubscription();
  const [loading, setLoading] = useState<"trial" | "free" | null>(null);
  const promoCheckoutStarted = useRef(false);
  const [promoError, setPromoError] = useState(false);
  const [promoResolved, setPromoResolved] = useState(false);
  const [hasPromoFlag] = useState(() => getPromoTrialFlag());

  const firstName = user?.firstName || "there";

  // Guard: redirect if user already has a plan
  useEffect(() => {
    if (!isLoading && (tier === "premium" || isTrialing)) {
      clearPromoTrialFlag(); // Clean up stale promo flag
      router.replace("/collection");
    }
  }, [isLoading, tier, isTrialing, router]);

  // Promo auto-checkout effect
  useEffect(() => {
    if (!hasPromoFlag || isLoading || promoCheckoutStarted.current) return;

    // Check if user just returned from Stripe cancel — prevent infinite loop
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "cancelled") {
      clearPromoTrialFlag();
      setPromoResolved(true);
      return;
    }

    const promoAction = getPromoTrialAction(hasPromoFlag, trialUsed, tier === "premium");

    // Clear stale promo flag if user can't use it
    if (promoAction === "none") {
      clearPromoTrialFlag();
      setPromoResolved(true);
      return;
    }

    promoCheckoutStarted.current = true;
    startCheckout("monthly", false, true)
      .then((url) => {
        if (url) window.location.href = url;
      })
      .catch(() => {
        setPromoError(true);
        promoCheckoutStarted.current = false;
      });
  }, [hasPromoFlag, isLoading, trialUsed, tier, startCheckout]);

  // Show loading spinner while subscription state is loading
  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Promo loading state
  if (hasPromoFlag && !promoError && !promoResolved) {
    return (
      <div className="min-h-screen bg-pop-yellow flex items-center justify-center">
        <div className="bg-white border-4 border-pop-black shadow-comic-sm p-6 sm:p-8 text-center max-w-md">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-pop-red" />
          <h2 className="text-xl font-comic font-bold text-pop-black">Setting up your 30-day free trial...</h2>
          <p className="text-gray-600 mt-2">You&apos;ll be redirected to enter your payment info.</p>
        </div>
      </div>
    );
  }

  // Promo error state
  if (hasPromoFlag && promoError) {
    return (
      <div className="min-h-screen bg-pop-yellow flex items-center justify-center">
        <div className="bg-white border-4 border-pop-black shadow-comic-sm p-6 sm:p-8 text-center max-w-md">
          <h2 className="text-xl font-comic font-bold text-pop-black">Something went wrong</h2>
          <p className="text-gray-600 mt-2">We couldn&apos;t start your trial. Let&apos;s try again.</p>
          <button
            onClick={() => {
              setPromoError(false);
              promoCheckoutStarted.current = false;
            }}
            className="mt-4 bg-pop-red text-white font-bold py-3 px-6 border-2 border-pop-black shadow-comic-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
          >
            Try Again
          </button>
        </div>
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
            Cancel anytime. No charge until trial ends.
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
          <button
            className="w-full mt-4 py-3 font-comic text-pop-black bg-pop-green border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            NEED MORE SCANS? BUY A 10-PACK FOR JUST $1.99!
          </button>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-500 mt-6">
          You can change your plan anytime in Account Settings.
        </p>
      </div>
    </div>
  );
}
