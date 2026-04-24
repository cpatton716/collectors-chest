"use client";

import { useMemo, useState } from "react";

import Image from "next/image";
import Link from "next/link";

import { Check, Clock, Loader2, X } from "lucide-react";

import { formatPrice } from "@/types/auction";

export interface SecondChanceInboxItem {
  id: string;
  auctionId: string;
  offerPrice: number;
  expiresAt: string;
  comicTitle: string;
  issueNumber: string;
  coverImageUrl: string | null;
}

interface SecondChanceInboxCardProps {
  offer: SecondChanceInboxItem;
  onResolved?: (offerId: string, action: "accept" | "decline") => void;
}

function formatTimeRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h left`;
  }
  if (hours >= 1) {
    return `${hours}h ${minutes}m left`;
  }
  return `${minutes}m left`;
}

/**
 * Card that appears on /transactions when the signed-in user is the runner-up
 * on a pending Second Chance Offer. Shows price + countdown with Accept and
 * Decline buttons.
 */
export function SecondChanceInboxCard({
  offer,
  onResolved,
}: SecondChanceInboxCardProps) {
  const [isLoading, setIsLoading] = useState<null | "accept" | "decline">(null);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<"accept" | "decline" | null>(null);

  const timeLeft = useMemo(() => formatTimeRemaining(offer.expiresAt), [
    offer.expiresAt,
  ]);

  const respond = async (action: "accept" | "decline") => {
    setIsLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/second-chance-offers/${offer.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to respond");
        return;
      }
      setResolved(action);
      onResolved?.(offer.id, action);
    } catch {
      setError("Failed to respond");
    } finally {
      setIsLoading(null);
    }
  };

  if (resolved) {
    return (
      <div className="p-4 bg-white border-2 border-pop-black rounded-lg shadow-[3px_3px_0_#000]">
        <p className="font-bold text-pop-black">
          {resolved === "accept"
            ? "Accepted: complete payment within 48 hours"
            : "Declined"}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-yellow-50 border-2 border-pop-black rounded-lg shadow-[3px_3px_0_#000] space-y-3">
      <div className="flex items-start gap-4">
        <Link
          href={`/shop?listing=${offer.auctionId}`}
          className="flex-shrink-0 w-16 h-24 relative bg-gray-100 border border-gray-200 rounded overflow-hidden"
        >
          {offer.coverImageUrl ? (
            <Image
              src={offer.coverImageUrl}
              alt={offer.comicTitle}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
              No cover
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <p className="uppercase text-xs font-bold text-pop-blue mb-1">
            Second Chance Offer
          </p>
          <h3 className="font-bold text-pop-black">
            {offer.comicTitle} {offer.issueNumber ? `#${offer.issueNumber}` : ""}
          </h3>
          <p className="text-sm text-gray-700 mt-1">
            Offered at <strong>{formatPrice(offer.offerPrice)}</strong>, your
            last bid.
          </p>
          <p className="text-xs text-gray-600 mt-1 inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> {timeLeft}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => respond("decline")}
          disabled={isLoading !== null}
          className="px-4 py-2 border-2 border-pop-black font-semibold rounded-md hover:bg-gray-100 disabled:opacity-50 text-sm inline-flex items-center gap-1"
        >
          {isLoading === "decline" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <X className="w-4 h-4" />
          )}
          Decline
        </button>
        <button
          onClick={() => respond("accept")}
          disabled={isLoading !== null}
          className="px-4 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm inline-flex items-center gap-1"
        >
          {isLoading === "accept" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Accept
        </button>
      </div>
    </div>
  );
}

export default SecondChanceInboxCard;
