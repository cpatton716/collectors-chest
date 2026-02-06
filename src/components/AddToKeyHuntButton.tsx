"use client";

import { useState } from "react";

import Link from "next/link";

import { useUser } from "@clerk/nextjs";

import { Check, Loader2, Lock, LogIn, Target } from "lucide-react";

import { AddToKeyHuntParams, useKeyHunt } from "@/hooks/useKeyHunt";
import { useSubscription } from "@/hooks/useSubscription";

interface AddToKeyHuntButtonProps {
  title: string;
  issueNumber: string;
  publisher?: string;
  releaseYear?: string;
  coverImageUrl?: string;
  keyInfo?: string[];
  currentPriceLow?: number;
  currentPriceMid?: number;
  currentPriceHigh?: number;
  addedFrom?: "hot_books" | "scan" | "key_hunt" | "manual";
  variant?: "default" | "compact" | "icon";
  className?: string;
  onAdded?: () => void;
}

export function AddToKeyHuntButton({
  title,
  issueNumber,
  publisher,
  releaseYear,
  coverImageUrl,
  keyInfo,
  currentPriceLow,
  currentPriceMid,
  currentPriceHigh,
  addedFrom = "manual",
  variant = "default",
  className = "",
  onAdded,
}: AddToKeyHuntButtonProps) {
  const { isSignedIn } = useUser();
  const { addToKeyHunt, isInKeyHunt } = useKeyHunt();
  const { features, tier, isTrialing, startFreeTrial, startCheckout } = useSubscription();
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyInList = isInKeyHunt(title, issueNumber);

  const handleAdd = async () => {
    if (alreadyInList || justAdded || isAdding) return;

    setIsAdding(true);
    setError(null);

    const params: AddToKeyHuntParams = {
      title,
      issueNumber,
      publisher,
      releaseYear,
      coverImageUrl,
      keyInfo,
      currentPriceLow,
      currentPriceMid,
      currentPriceHigh,
      addedFrom,
    };

    const result = await addToKeyHunt(params);

    setIsAdding(false);

    if (result.success) {
      setJustAdded(true);
      onAdded?.();
      // Reset after 3 seconds
      setTimeout(() => setJustAdded(false), 3000);
    } else {
      setError(result.error || "Failed to add");
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000);
    }
  };

  // Not signed in - show sign in prompt
  if (!isSignedIn) {
    if (variant === "icon") {
      return (
        <Link
          href="/sign-in"
          className={`p-2 text-gray-400 hover:text-primary-600 transition-colors ${className}`}
          title="Sign in to add to Key Hunt"
        >
          <LogIn className="w-5 h-5" />
        </Link>
      );
    }

    return (
      <Link
        href="/sign-in"
        className={`
          inline-flex items-center gap-2 px-3 py-2
          bg-gray-100 text-gray-600 rounded-lg
          hover:bg-gray-200 transition-colors text-sm
          ${className}
        `}
      >
        <LogIn className="w-4 h-4" />
        {variant === "compact" ? "Sign in" : "Sign in to add to Key Hunt"}
      </Link>
    );
  }

  // Signed in but no premium access - show locked button
  if (isSignedIn && !features.keyHunt) {
    const handleUpgrade = async () => {
      if (tier === "free" && !isTrialing) {
        const result = await startFreeTrial();
        if (result.success) {
          window.location.reload();
          return;
        }
      }
      const url = await startCheckout("monthly", tier === "free" && !isTrialing);
      if (url) {
        window.location.href = url;
      }
    };

    if (variant === "icon") {
      return (
        <button
          onClick={handleUpgrade}
          className={`p-2 text-gray-400 hover:text-indigo-600 transition-colors relative ${className}`}
          title="Premium feature - upgrade to use Key Hunt"
        >
          <Target className="w-5 h-5 opacity-50" />
          <Lock className="w-3 h-3 absolute -top-0.5 -right-0.5 text-indigo-600" />
        </button>
      );
    }

    return (
      <button
        onClick={handleUpgrade}
        className={`
          relative inline-flex items-center gap-2 px-3 py-2
          bg-gray-100 text-gray-500 rounded-lg
          hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-sm
          ${className}
        `}
      >
        <Target className="w-4 h-4" />
        {variant === "compact" ? "Key Hunt" : "Add to Key Hunt"}
        <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
          <Lock className="w-3 h-3" />
          Premium
        </span>
      </button>
    );
  }

  // Already in list
  if (alreadyInList || justAdded) {
    if (variant === "icon") {
      return (
        <button
          disabled
          className={`p-2 text-green-600 cursor-default ${className}`}
          title="In your Key Hunt list"
        >
          <Check className="w-5 h-5" />
        </button>
      );
    }

    return (
      <button
        disabled
        className={`
          inline-flex items-center gap-2 px-3 py-2
          bg-green-100 text-green-700 rounded-lg
          cursor-default text-sm
          ${className}
        `}
      >
        <Check className="w-4 h-4" />
        {variant === "compact" ? "Added" : "In Key Hunt"}
      </button>
    );
  }

  // Error state
  if (error) {
    return (
      <button
        disabled
        className={`
          inline-flex items-center gap-2 px-3 py-2
          bg-red-100 text-red-700 rounded-lg
          cursor-default text-sm
          ${className}
        `}
      >
        {error}
      </button>
    );
  }

  // Default add button
  if (variant === "icon") {
    return (
      <button
        onClick={handleAdd}
        disabled={isAdding}
        className={`
          p-2 text-gray-400 hover:text-amber-600
          transition-colors disabled:opacity-50
          ${className}
        `}
        title="Add to Key Hunt"
      >
        {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
      </button>
    );
  }

  return (
    <button
      onClick={handleAdd}
      disabled={isAdding}
      className={`
        inline-flex items-center gap-2 px-3 py-2
        bg-amber-100 text-amber-700 rounded-lg
        hover:bg-amber-200 transition-colors text-sm
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
    >
      {isAdding ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Adding...
        </>
      ) : (
        <>
          <Target className="w-4 h-4" />
          {variant === "compact" ? "Key Hunt" : "Add to Key Hunt"}
        </>
      )}
    </button>
  );
}
