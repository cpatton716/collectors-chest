"use client";

import Link from "next/link";

import { AlertCircle, Mail, Sparkles } from "lucide-react";

import { useGuestScans } from "@/hooks/useGuestScans";

interface GuestLimitBannerProps {
  variant?: "warning" | "info";
}

export function GuestLimitBanner({ variant = "info" }: GuestLimitBannerProps) {
  const { remaining, isGuest, isLimitReached } = useGuestScans();

  // Don't show for signed-in users
  if (!isGuest) return null;

  if (isLimitReached) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-800">Free Scan Limit Reached</h3>
            <p className="text-sm text-red-700 mt-1">
              You&apos;ve used all 10 free scans. Create a free account to unlock unlimited
              scanning.
            </p>
            <div className="mt-3 flex gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                <Mail className="w-4 h-4" />
                Sign Up Free
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "warning" && remaining <= 3) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-800">
              {remaining} Free Scan{remaining !== 1 ? "s" : ""} Remaining
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              Sign up for a free account to unlock unlimited scanning and cloud sync.
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 mt-2 text-sm font-medium text-amber-800 hover:text-amber-900"
            >
              <Sparkles className="w-4 h-4" />
              Sign Up Free →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Info variant - prominent pop-art style banner
  if (variant === "info") {
    return (
      <div
        className="border-4 border-pop-black p-4 mb-6"
        style={{
          background: "var(--pop-yellow)",
          boxShadow: "4px 4px 0px var(--pop-black)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 border-3 border-pop-black flex items-center justify-center text-2xl font-bold"
              style={{ background: "var(--pop-white)", color: "var(--pop-black)" }}
            >
              {remaining}
            </div>
            <span className="font-comic text-pop-black text-lg">FREE SCANS LEFT</span>
          </div>
          <Link href="/sign-up" className="font-comic text-pop-black hover:underline">
            Sign up free →
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
