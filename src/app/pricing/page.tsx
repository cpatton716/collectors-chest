"use client";

import { useState } from "react";

import Link from "next/link";

import { Check, Crown, Sparkles, X, Zap } from "lucide-react";

import { useSubscription } from "@/hooks/useSubscription";

type BillingInterval = "monthly" | "annual";

export default function PricingPage() {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const { tier, isTrialing, trialAvailable, startFreeTrial, startCheckout, isLoading, isGuest } =
    useSubscription();

  const monthlyPrice = 4.99;
  const annualPrice = 49.99;
  const annualMonthly = (annualPrice / 12).toFixed(2);
  const savings = Math.round(((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12)) * 100);

  const handleUpgrade = async (interval: BillingInterval) => {
    // If trial is available, try direct trial first (works without Stripe)
    if (trialAvailable) {
      const result = await startFreeTrial();
      if (result.success) {
        window.location.reload();
        return;
      }
    }
    // Fall back to Stripe checkout
    const url = await startCheckout(interval, trialAvailable);
    if (url) {
      window.location.href = url;
    }
  };

  const isPremium = tier === "premium";
  const showTrialCTA = !isGuest && tier === "free" && trialAvailable && !isTrialing;

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1
            className="font-comic text-4xl md:text-5xl text-pop-yellow tracking-wide mb-4"
            style={{
              WebkitTextStroke: "2px black",
              paintOrder: "stroke fill",
              textShadow: "3px 3px 0px #000",
            }}
          >
            SIMPLE PRICING!
          </h1>
          <div className="speech-bubble max-w-xl mx-auto">
            <p className="text-lg font-body text-pop-black">
              Start free, upgrade when you need more. No hidden fees!
            </p>
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-pop-white border-3 border-pop-black p-1 inline-flex shadow-[3px_3px_0px_#000]">
            <button
              onClick={() => setBillingInterval("monthly")}
              className={`px-4 py-2 font-comic text-sm transition-all border-2 border-pop-black ${
                billingInterval === "monthly"
                  ? "bg-pop-blue text-pop-white shadow-[2px_2px_0px_#000]"
                  : "bg-pop-white text-pop-black hover:bg-pop-cream"
              }`}
            >
              MONTHLY
            </button>
            <button
              onClick={() => setBillingInterval("annual")}
              className={`px-4 py-2 font-comic text-sm transition-all border-2 border-pop-black flex items-center gap-2 ${
                billingInterval === "annual"
                  ? "bg-pop-blue text-pop-white shadow-[2px_2px_0px_#000]"
                  : "bg-pop-white text-pop-black hover:bg-pop-cream"
              }`}
            >
              ANNUAL
              <span className="text-xs bg-pop-green text-pop-white px-2 py-0.5 border border-pop-black">
                SAVE {savings}%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier */}
          <div className="bg-pop-white border-4 border-pop-black p-8 shadow-[6px_6px_0px_#000] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 dots-red opacity-20 pointer-events-none" />
            <div className="mb-6">
              <h2 className="text-2xl font-comic text-pop-black mb-2">FREE</h2>
              <p className="font-body text-pop-black/70">Perfect for casual collectors</p>
            </div>

            <div className="mb-6">
              <span className="text-5xl font-comic text-pop-black">$0</span>
              <span className="font-body text-pop-black/70">/month</span>
            </div>

            {isGuest ? (
              <Link
                href="/sign-up"
                className="block w-full py-3 px-4 text-center bg-pop-cream border-3 border-pop-black font-comic text-pop-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] transition-all"
              >
                CREATE FREE ACCOUNT
              </Link>
            ) : tier === "free" && !isTrialing ? (
              <div className="py-3 px-4 text-center bg-pop-yellow border-3 border-pop-black font-comic text-pop-black">
                <Check className="w-5 h-5 inline mr-2" />
                CURRENT PLAN
              </div>
            ) : (
              <div className="py-3 px-4 text-center bg-pop-cream border-3 border-pop-black font-comic text-pop-black/50">
                FREE TIER
              </div>
            )}

            <ul className="mt-8 space-y-3">
              <FeatureItem included>10 scans per month</FeatureItem>
              <FeatureItem included>Cloud collection sync</FeatureItem>
              <FeatureItem included>Real eBay prices</FeatureItem>
              <FeatureItem included>Public profile sharing</FeatureItem>
              <FeatureItem included>Buy & bid in Shop</FeatureItem>
              <FeatureItem included>3 active listings</FeatureItem>
              <FeatureItem included>8% seller fee</FeatureItem>
              <FeatureItem included>CSV import</FeatureItem>
              <FeatureItem>Key Hunt (offline lookup)</FeatureItem>
              <FeatureItem>CSV export</FeatureItem>
              <FeatureItem>Advanced statistics</FeatureItem>
              <FeatureItem>Unlimited listings</FeatureItem>
            </ul>
          </div>

          {/* Premium Tier */}
          <div className="bg-pop-blue border-4 border-pop-black p-8 shadow-[6px_6px_0px_#000] relative text-pop-white">
            <div className="absolute bottom-0 right-0 w-24 h-24 dots-red opacity-20 pointer-events-none overflow-hidden" />
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
              <span className="bg-pop-yellow text-pop-black text-xs font-comic px-4 py-1 border-2 border-pop-black shadow-[2px_2px_0px_#000]">
                MOST POPULAR!
              </span>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-6 h-6 text-pop-yellow" />
                <h2 className="text-2xl font-comic">PREMIUM</h2>
              </div>
              <p className="font-body text-pop-white/80">For serious collectors</p>
            </div>

            <div className="mb-6">
              {billingInterval === "monthly" ? (
                <>
                  <span className="text-5xl font-comic">${monthlyPrice}</span>
                  <span className="font-body text-pop-white/80">/month</span>
                </>
              ) : (
                <>
                  <span className="text-5xl font-comic">${annualPrice}</span>
                  <span className="font-body text-pop-white/80">/year</span>
                  <div className="text-sm font-body text-pop-white/70 mt-1">
                    ${annualMonthly}/month billed annually
                  </div>
                </>
              )}
            </div>

            {isPremium ? (
              <div className="py-3 px-4 text-center bg-pop-white/20 border-3 border-pop-black font-comic">
                <Check className="w-5 h-5 inline mr-2" />
                CURRENT PLAN
              </div>
            ) : isTrialing ? (
              <button
                onClick={() => handleUpgrade(billingInterval)}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-pop-green text-pop-white border-3 border-pop-black font-comic shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] transition-all disabled:opacity-50"
              >
                SUBSCRIBE NOW
              </button>
            ) : showTrialCTA ? (
              <button
                onClick={() => handleUpgrade(billingInterval)}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-pop-green text-pop-white border-3 border-pop-black font-comic shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                START 7-DAY FREE TRIAL!
              </button>
            ) : (
              <button
                onClick={() => handleUpgrade(billingInterval)}
                disabled={isLoading}
                className="w-full py-3 px-4 bg-pop-green text-pop-white border-3 border-pop-black font-comic shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] transition-all disabled:opacity-50"
              >
                {isGuest ? "SIGN UP & SUBSCRIBE" : "UPGRADE TO PREMIUM"}
              </button>
            )}

            <ul className="mt-8 space-y-3">
              <FeatureItem included premium>
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-pop-yellow" />
                  Unlimited scans
                </span>
              </FeatureItem>
              <FeatureItem included premium>
                Cloud collection sync
              </FeatureItem>
              <FeatureItem included premium>
                Real eBay prices
              </FeatureItem>
              <FeatureItem included premium>
                Public profile sharing
              </FeatureItem>
              <FeatureItem included premium>
                Buy & bid in Shop
              </FeatureItem>
              <FeatureItem included premium>
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-pop-yellow" />
                  Unlimited listings
                </span>
              </FeatureItem>
              <FeatureItem included premium>
                <span className="font-comic">5% seller fee</span>
                <span className="text-pop-white/70 text-sm ml-1">(save 3%)</span>
              </FeatureItem>
              <FeatureItem included premium>
                CSV import & export
              </FeatureItem>
              <FeatureItem included premium>
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-pop-yellow" />
                  Key Hunt (offline lookup)
                </span>
              </FeatureItem>
              <FeatureItem included premium>
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-pop-yellow" />
                  Advanced statistics
                </span>
              </FeatureItem>
            </ul>
          </div>
        </div>

        {/* Scan Pack Callout */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-pop-yellow border-4 border-pop-black p-6 text-center shadow-[4px_4px_0px_#000] relative overflow-hidden">
            <div className="absolute bottom-0 left-0 w-16 h-16 dots-blue opacity-25 pointer-events-none" />
            <h3 className="text-lg font-comic text-pop-black mb-2">
              NEED MORE SCANS WITHOUT SUBSCRIBING?
            </h3>
            <p className="font-body text-pop-black/80 mb-4">
              Purchase scan packs for $1.99 (10 scans). Great for occasional use!
            </p>
            {!isGuest && tier === "free" && (
              <button
                onClick={async () => {
                  const url = await startCheckout("scan_pack");
                  if (url) window.location.href = url;
                }}
                className="px-6 py-3 bg-pop-green text-pop-white border-3 border-pop-black font-comic shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] transition-all"
              >
                BUY SCAN PACK - $1.99
              </button>
            )}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2
            className="text-2xl md:text-3xl font-comic text-pop-yellow text-center mb-8"
            style={{
              WebkitTextStroke: "2px black",
              paintOrder: "stroke fill",
              textShadow: "3px 3px 0px #000",
            }}
          >
            FREQUENTLY ASKED QUESTIONS
          </h2>

          <div className="space-y-4">
            <FAQ
              question="What happens when my trial ends?"
              answer="After your 7-day trial, you'll be charged for the plan you selected. You can cancel anytime before the trial ends to avoid charges. Any comics you scanned during the trial stay in your collection."
            />
            <FAQ
              question="Can I cancel anytime?"
              answer="Yes! You can cancel your subscription at any time. You'll keep Premium access until the end of your billing period, then revert to the Free tier."
            />
            <FAQ
              question="What's Key Hunt?"
              answer="Key Hunt is a quick price lookup mode designed for conventions. It caches barcode data for offline use, so you can quickly check prices without internet access."
            />
            <FAQ
              question="How does the seller fee work?"
              answer="When you sell a comic in the Shop, we deduct a platform fee from the sale price — 8% on Free, 5% on Premium, with a $0.75 minimum per sale. The rate is set when you create the listing and stays with that listing through to the sale, even if you change tiers afterward. Stripe's payment-processing fee is separate and is paid by Collectors Chest, not by you — for example, on a $100 sale at 8%, you receive exactly $92.00."
            />
            <FAQ
              question="Do purchased scans expire?"
              answer="No! Scan packs never expire. Monthly scan limits reset on the 1st of each month, but purchased scans carry over."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({
  children,
  included = false,
  premium = false,
}: {
  children: React.ReactNode;
  included?: boolean;
  premium?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      {included ? (
        <div
          className={`w-5 h-5 flex items-center justify-center border-2 border-pop-black flex-shrink-0 ${
            premium ? "bg-pop-green" : "bg-pop-green"
          }`}
        >
          <Check className="w-3 h-3 text-pop-white" strokeWidth={3} />
        </div>
      ) : (
        <div className="w-5 h-5 flex items-center justify-center border-2 border-pop-black/30 bg-pop-cream flex-shrink-0">
          <X className="w-3 h-3 text-pop-black/30" strokeWidth={3} />
        </div>
      )}
      <span
        className={`font-body text-sm ${
          premium
            ? included
              ? "text-pop-white"
              : "text-pop-white/50"
            : included
              ? "text-pop-black"
              : "text-pop-black/40"
        }`}
      >
        {children}
      </span>
    </li>
  );
}

function FAQ({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-pop-white border-3 border-pop-black p-6 shadow-[3px_3px_0px_#000]">
      <h3 className="font-comic text-pop-black mb-2">{question.toUpperCase()}</h3>
      <p className="font-body text-pop-black/80">{answer}</p>
    </div>
  );
}
