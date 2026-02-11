"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { useUser } from "@clerk/nextjs";

import { Loader2, MessageCircle } from "lucide-react";

interface MessageButtonProps {
  sellerId: string;
  sellerName?: string;
  listingId?: string;
  listingTitle?: string;
  listingIssue?: string;
  listingGrade?: string;
  listingGradingCompany?: string;
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "button";
  className?: string;
}

export function MessageButton({
  sellerId,
  sellerName,
  listingId,
  listingTitle,
  listingIssue,
  listingGrade,
  listingGradingCompany,
  size = "md",
  variant = "button",
  className = "",
}: MessageButtonProps) {
  const { user } = useUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const sizeClasses = {
    sm: variant === "icon" ? "h-7 w-7" : "px-2 py-1 text-xs",
    md: variant === "icon" ? "h-8 w-8" : "px-3 py-1.5 text-sm",
    lg: variant === "icon" ? "h-10 w-10" : "px-4 py-2 text-base",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const handleClick = async () => {
    if (!user) {
      router.push("/sign-in");
      return;
    }

    setIsLoading(true);
    try {
      // Build message with listing details if available
      let content = listingId
        ? "Hi! I'm interested in your listing."
        : "Hi! I'd like to chat with you.";

      if (listingId && listingTitle) {
        const parts = [listingTitle];
        if (listingIssue) parts.push(`#${listingIssue}`);
        if (listingGradingCompany && listingGrade)
          parts.push(`(${listingGradingCompany} ${listingGrade})`);
        const bookInfo = parts.join(" ");
        const listingUrl = `${window.location.origin}/shop?listing=${listingId}`;
        content = `Hi! I'm interested in your listing: ${bookInfo}\n${listingUrl}`;
      }

      // Send an initial message to create the conversation
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: sellerId,
          content,
          listingId,
        }),
      });

      if (response.ok) {
        const { message } = await response.json();
        // Navigate to the conversation
        router.push(`/messages?id=${message.conversationId}`);
      } else {
        const data = await response.json();
        console.error("Failed to start conversation:", data.error);
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        disabled={isLoading}
        title={`Message ${sellerName || "seller"}`}
        className={`flex items-center justify-center rounded-full border-2 border-pop-black bg-pop-white transition-all hover:bg-pop-blue hover:text-white disabled:opacity-50 ${sizeClasses[size]} ${className}`}
      >
        {isLoading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : (
          <MessageCircle className={iconSizes[size]} />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 rounded-lg border-2 border-pop-black bg-pop-white font-bold transition-all hover:shadow-[2px_2px_0px_#000] disabled:opacity-50 ${sizeClasses[size]} ${className}`}
    >
      {isLoading ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : (
        <MessageCircle className={iconSizes[size]} />
      )}
      <span>Message {sellerName || "Seller"}</span>
    </button>
  );
}
