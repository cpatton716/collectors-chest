"use client";

import { useEffect } from "react";

import Link from "next/link";

import {
  Infinity,
  AlertTriangle,
  Cloud,
  Mail,
  Shield,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";

import type { MilestoneType } from "@/hooks/useGuestScans";

import { analytics } from "@/components/PostHogProvider";

// Non-null milestone type for the modal (modal should only be shown with a valid milestone)
type ValidMilestone = Exclude<MilestoneType, null>;

interface SignUpPromptModalProps {
  milestone: ValidMilestone;
  scanCount: number;
  onClose: () => void;
}

// Get dynamic subtitle based on milestone and actual scan count
const getSubtitle = (milestone: ValidMilestone, scanCount: number): string => {
  const remaining = Math.max(0, 10 - scanCount);

  switch (milestone) {
    case "fiveRemaining":
      return `You've scanned ${scanCount} comics! Create a free account to unlock unlimited scans.`;
    case "threeRemaining":
      return `Only ${remaining} free scans left! Sign up free to unlock unlimited scanning.`;
    case "finalScan":
      return "This is your final free scan. Sign up free to keep scanning.";
  }
};

// Get dynamic title based on milestone and actual scan count
const getTitle = (milestone: ValidMilestone, scanCount: number): string => {
  const remaining = Math.max(0, 10 - scanCount);

  switch (milestone) {
    case "fiveRemaining":
      return "You're on a roll!";
    case "threeRemaining":
      return `Only ${remaining} free scans left!`;
    case "finalScan":
      return "Last Free Scan!";
  }
};

const milestoneContent: Record<
  ValidMilestone,
  {
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    benefits: { icon: React.ElementType; text: string }[];
    ctaText: string;
    dismissText: string;
  }
> = {
  fiveRemaining: {
    icon: Sparkles,
    iconBg: "bg-primary-100",
    iconColor: "text-primary-600",
    benefits: [
      { icon: Cloud, text: "Sync your collection across all devices" },
      { icon: Infinity, text: "Unlimited comic scans" },
      { icon: Shield, text: "Never lose your collection data" },
    ],
    ctaText: "Sign Up Free",
    dismissText: "Maybe later",
  },
  threeRemaining: {
    icon: AlertTriangle,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    benefits: [
      { icon: Infinity, text: "Unlimited comic scanning" },
      { icon: Cloud, text: "Your collection saved to the cloud" },
      { icon: Smartphone, text: "Access from any device" },
    ],
    ctaText: "Sign Up Free",
    dismissText: "Maybe later",
  },
  finalScan: {
    icon: AlertTriangle,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    benefits: [
      { icon: Infinity, text: "Unlimited comic scanning" },
      { icon: Cloud, text: "Cloud-synced collection" },
      { icon: Shield, text: "Your data is always safe" },
    ],
    ctaText: "Sign Up Free",
    dismissText: "Use my last scan",
  },
};

export function SignUpPromptModal({ milestone, scanCount, onClose }: SignUpPromptModalProps) {
  const content = milestoneContent[milestone];
  const Icon = content.icon;
  const title = getTitle(milestone, scanCount);
  const subtitle = getSubtitle(milestone, scanCount);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Track when milestone modal is shown
  useEffect(() => {
    analytics.trackGuestMilestone(milestone, scanCount);
  }, [milestone, scanCount]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="pt-8 pb-6 px-6 text-center">
          <div
            className={`w-16 h-16 ${content.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}
          >
            <Icon className={`w-8 h-8 ${content.iconColor}`} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-gray-600 mt-2">{subtitle}</p>
        </div>

        {/* Benefits */}
        <div className="px-6 pb-6">
          <p className="text-sm text-gray-500 mb-3">With a free account, you&apos;ll get:</p>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            {content.benefits.map((benefit, index) => {
              const BenefitIcon = benefit.icon;
              return (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <BenefitIcon className="w-4 h-4 text-primary-600" />
                  </div>
                  <span className="text-sm text-gray-700">{benefit.text}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-8 space-y-3">
          <Link
            href="/sign-up"
            onClick={() => analytics.trackSignUpStarted()}
            className="flex items-center justify-center gap-2 w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors"
          >
            <Mail className="w-5 h-5" />
            {content.ctaText}
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors border border-gray-200"
            >
              {content.dismissText}
            </button>
            <Link
              href="/sign-in"
              onClick={() => analytics.trackSignUpStarted()}
              className="flex-1 py-3 text-center text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              Already have an account?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
