"use client";

import { Suspense, useEffect, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@clerk/nextjs";

import { AlertCircle, CheckCircle, Clock, Gavel, Loader2, ShoppingBag, Trophy, Wallet } from "lucide-react";

import type { BidRow, OfferRow, TransactionRow } from "@/app/api/transactions/route";

import PaymentDeadlineCountdown from "@/components/PaymentDeadlineCountdown";
import SecondChanceInboxCard, {
  type SecondChanceInboxItem,
} from "@/components/auction/SecondChanceInboxCard";
import { formatPrice } from "@/types/auction";

type TabKey = "purchases" | "wins" | "bids" | "offers";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "purchases", label: "Purchases", icon: ShoppingBag },
  { key: "wins", label: "Auction Wins", icon: Trophy },
  { key: "bids", label: "Active Bids", icon: Gavel },
  { key: "offers", label: "Offers Made", icon: Wallet },
];

function isValidTab(v: string | null): v is TabKey {
  return v === "purchases" || v === "wins" || v === "bids" || v === "offers";
}

function TransactionsPageContent() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabFromUrl = searchParams.get("tab");
  const initialTab: TabKey = isValidTab(tabFromUrl) ? tabFromUrl : "purchases";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const [items, setItems] = useState<TransactionRow[] | BidRow[] | OfferRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondChanceOffers, setSecondChanceOffers] = useState<
    SecondChanceInboxItem[]
  >([]);

  // Auth redirect
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in?redirect=/transactions");
    }
  }, [isLoaded, isSignedIn, router]);

  // Keep state in sync if URL tab changes (e.g., back/forward navigation)
  useEffect(() => {
    if (isValidTab(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, activeTab]);

  // Load pending second-chance offers (runner-up) once per mount — they
  // live above the Wins tab regardless of which tab is active on load.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    fetch("/api/second-chance-offers")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setSecondChanceOffers(data.offers || []);
      })
      .catch(() => {
        /* non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  // Fetch when tab changes
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch(`/api/transactions?type=${activeTab}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Failed to load transactions");
          setItems([]);
          return;
        }
        const data = await res.json();
        setItems(data.items || []);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load transactions");
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, isSignedIn]);

  const handleTabClick = (key: TabKey) => {
    setActiveTab(key);
    router.replace(`/transactions?tab=${key}`, { scroll: false });
  };

  if (!isLoaded) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-pop-black">Transactions</h1>
        <p className="text-gray-600 mt-1">Your purchases, auction wins, active bids, and offers</p>
      </div>

      {/* Tabs */}
      <div className="border-b-2 border-pop-black mb-6 flex gap-1 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => handleTabClick(key)}
              className={`flex items-center gap-2 px-4 py-2 font-semibold whitespace-nowrap border-b-4 transition-colors ${
                active
                  ? "border-pop-blue text-pop-blue"
                  : "border-transparent text-gray-600 hover:text-pop-black"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Second Chance Offer inbox — visible on the Wins tab whenever the
          user has pending offers as the runner-up. */}
      {activeTab === "wins" && secondChanceOffers.length > 0 && (
        <div className="mb-6 space-y-3">
          <p className="text-sm font-bold text-pop-black uppercase tracking-wide">
            Second Chance Offers
          </p>
          {secondChanceOffers.map((offer) => (
            <SecondChanceInboxCard
              key={offer.id}
              offer={offer}
              onResolved={(offerId) =>
                setSecondChanceOffers((prev) =>
                  prev.filter((o) => o.id !== offerId)
                )
              }
            />
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="py-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
        </div>
      ) : error ? (
        <div className="py-8 flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      ) : items.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : activeTab === "offers" ? (
        <OffersList items={items as OfferRow[]} />
      ) : activeTab === "bids" ? (
        <BidsList items={items as BidRow[]} />
      ) : (
        <PurchasesList items={items as TransactionRow[]} />
      )}
    </div>
  );
}

// ============================================================================
// LIST COMPONENTS
// ============================================================================

function PurchasesList({ items }: { items: TransactionRow[] }) {
  return (
    <ul className="space-y-3">
      {items.map((row) => (
        <TransactionCard key={row.id} row={row} />
      ))}
    </ul>
  );
}

function BidsList({ items }: { items: BidRow[] }) {
  return (
    <ul className="space-y-3">
      {items.map((row) => (
        <TransactionCard
          key={`${row.id}-${row.bidTime}`}
          row={row}
          footer={
            <div className="flex items-center gap-3 text-sm mt-2">
              <span className="text-gray-500">Your bid:</span>
              <span className="font-semibold">{formatPrice(row.bidAmount)}</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  row.isWinning
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {row.isWinning ? "Highest bid" : "Outbid"}
              </span>
            </div>
          }
        />
      ))}
    </ul>
  );
}

function OffersList({ items }: { items: OfferRow[] }) {
  return (
    <ul className="space-y-3">
      {items.map((row) => (
        <TransactionCard
          key={row.offerId}
          row={row.listing}
          footer={
            <div className="flex items-center gap-3 text-sm mt-2">
              <span className="text-gray-500">Your offer:</span>
              <span className="font-semibold">{formatPrice(row.offerAmount)}</span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  row.offerStatus === "accepted"
                    ? "bg-green-100 text-green-700"
                    : row.offerStatus === "rejected" || row.offerStatus === "expired"
                      ? "bg-gray-200 text-gray-700"
                      : row.offerStatus === "countered"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                }`}
              >
                {row.offerStatus}
              </span>
            </div>
          }
        />
      ))}
    </ul>
  );
}

// ============================================================================
// SHARED CARD
// ============================================================================

function TransactionCard({
  row,
  footer,
}: {
  row: TransactionRow;
  footer?: React.ReactNode;
}) {
  const statusPill = getStatusPill(row);
  const pendingPayment =
    (row.status === "sold" || row.status === "ended") &&
    row.paymentStatus === "pending";

  return (
    <li className="flex gap-4 p-4 bg-white border-2 border-pop-black rounded-lg shadow-[3px_3px_0_#000]">
      {/* Cover */}
      <Link
        href={`/shop?listing=${row.id}`}
        className="flex-shrink-0 w-16 h-24 relative bg-gray-100 border border-gray-200 rounded overflow-hidden"
      >
        {row.coverImageUrl ? (
          <Image
            src={row.coverImageUrl}
            alt={row.comicTitle}
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

      {/* Details */}
      <div className="flex-1 min-w-0">
        <Link href={`/shop?listing=${row.id}`} className="block group">
          <h3 className="font-semibold text-pop-black group-hover:underline">
            {row.comicTitle} {row.comicIssue ? `#${row.comicIssue}` : ""}
          </h3>
        </Link>
        <p className="text-sm text-gray-600">
          Sold by{" "}
          {row.sellerUsername ? (
            <span>@{row.sellerUsername}</span>
          ) : (
            <span>{row.sellerDisplayName}</span>
          )}
        </p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="font-semibold text-pop-black">{formatPrice(row.totalPrice)}</span>
          {statusPill}
          {pendingPayment && row.paymentDeadline && (
            <PaymentDeadlineCountdown
              deadline={row.paymentDeadline}
              className="text-xs"
            />
          )}
        </div>
        {footer}
      </div>

      {/* Action */}
      {pendingPayment && (
        <CompletePaymentButton listingId={row.id} />
      )}
    </li>
  );
}

function getStatusPill(row: TransactionRow): React.ReactNode {
  const pendingPayment =
    (row.status === "sold" || row.status === "ended") &&
    row.paymentStatus === "pending";
  const paid = row.paymentStatus === "paid" || row.paymentStatus === "completed";

  if (pendingPayment) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 inline-flex items-center gap-1">
        <Clock className="w-3 h-3" /> Pending Payment
      </span>
    );
  }
  if (paid && row.shippedAt) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700 inline-flex items-center gap-1">
        <CheckCircle className="w-3 h-3" /> Shipped
      </span>
    );
  }
  if (paid) {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 inline-flex items-center gap-1">
        <Clock className="w-3 h-3" /> Awaiting Shipment
      </span>
    );
  }
  if (row.status === "cancelled") {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-700">
        Cancelled
      </span>
    );
  }
  if (row.status === "active") {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
        Active
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-700">
      {row.status}
    </span>
  );
}

function CompletePaymentButton({ listingId }: { listingId: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId: listingId }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Failed to start checkout");
    } catch {
      setError("Failed to start checkout");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-shrink-0 flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm whitespace-nowrap"
      >
        {isLoading ? "Loading..." : "Complete Payment"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

// ============================================================================
// EMPTY STATES
// ============================================================================

function EmptyState({ tab }: { tab: TabKey }) {
  const copy: Record<TabKey, { title: string; subtitle: string }> = {
    purchases: {
      title: "No Buy Now purchases yet",
      subtitle: "Browse the shop and purchase a comic to see it here.",
    },
    wins: {
      title: "No auction wins yet",
      subtitle: "Place winning bids on auctions to see them here.",
    },
    bids: {
      title: "No active bids",
      subtitle: "Your bids will appear here once you start bidding on auctions.",
    },
    offers: {
      title: "No offers made",
      subtitle: "Offers you make on listings will appear here.",
    },
  };
  const { title, subtitle } = copy[tab];
  return (
    <div className="py-12 text-center text-gray-500">
      <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-gray-300" />
      <p className="font-semibold text-gray-700 mb-1">{title}</p>
      <p className="text-sm">{subtitle}</p>
      <Link
        href="/shop"
        className="inline-block mt-4 px-4 py-2 bg-pop-blue text-white font-semibold rounded-md hover:bg-blue-700"
      >
        Browse Shop
      </Link>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>}>
      <TransactionsPageContent />
    </Suspense>
  );
}
