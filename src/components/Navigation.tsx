"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs";

import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Brain,
  Camera,
  ChevronDown,
  ChevronUp,
  DollarSign,
  UserCheck,
  Flame,
  Gavel,
  Home,
  KeyRound,
  Layers,
  LogIn,
  MessageSquare,
  Info,
  MoreHorizontal,
  Shield,
  ShoppingBag,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

import { useSubscription } from "@/hooks/useSubscription";

import AdminAlertBadge from "@/components/AdminAlertBadge";
import { NotificationBell } from "./NotificationBell";
import { ChestIcon } from "./icons/ChestIcon";

// FAQ content for Ask the Professor
const faqs = [
  {
    question: "What is Collectors Chest?",
    answer:
      "Scan any cover. Track every book. Find your people. Collectors Chest is the all-in-one platform that helps comic collectors discover value, organize with pride, and buy, sell, and trade with confidence.",
  },
  {
    question: "Is it free to use?",
    answer:
      "Yes! You can create a free account and access most features including collection tracking, cover scanning (limited scans per month), custom lists, and the marketplace. Premium unlocks unlimited scans, Key Hunt, CSV export, advanced stats, and more.",
  },
  {
    question: "Do I need to create an account?",
    answer:
      "Guests can explore the app and try scanning a comic, but to save your collection, track values, use the marketplace, create lists, and access your data across devices, you'll need a free account.",
  },
  {
    question: "How do I add a comic to my collection?",
    answer:
      "Go to 'Scan' and either upload a photo of the cover for AI recognition or enter details manually. Review the auto-detected title, issue, creator credits, and price estimate, then click 'Add to Collection'.",
  },
  {
    question: "How does cover scanning work?",
    answer:
      "Upload or take a photo of a comic cover and our AI identifies the title, issue number, publisher, creators, key info, and estimated value. It works with raw and slabbed comics, and even detects grading labels on slabs.",
  },
  {
    question: "Any tips for getting the best scan results?",
    answer:
      "Good, even lighting makes a huge difference — avoid harsh shadows and glare, especially on slabbed books. Photograph the full front cover straight-on (no angles or tilting), keep the camera steady, and make sure the image is in focus. A plain background with nothing distracting behind the book helps the AI zero in on the cover.",
  },
  {
    question: "How accurate are the price estimates?",
    answer:
      "Prices are AI estimates based on recent market trends and eBay sold listings. They provide a solid guideline but actual prices vary based on condition, demand, and where you sell. For the most accurate values, check recent eBay completed sales.",
  },
  {
    question: "What is Key Hunt?",
    answer:
      "Key Hunt is a quick price lookup tool designed for conventions and comic shops. Scan a cover or manually enter a title and issue to instantly see prices across different grades. Perfect for making quick buying decisions on the go.",
  },
  {
    question: "What does 'Slabbed' mean?",
    answer:
      "A 'slabbed' comic has been professionally graded by a service like CGC, CBCS, or PGX and sealed in a protective case with a grade label. When you check 'Professionally Graded' in your comic details, it's automatically added to your Slabbed list.",
  },
  {
    question: "What grades should I use for my comics?",
    answer:
      "For raw (ungraded) comics, use standard terms: NM (Near Mint), VF (Very Fine), FN (Fine), VG (Very Good), G (Good), FR (Fair), PR (Poor). For slabbed comics, enter the numeric grade from the certification label (e.g., 9.8, 9.6, 9.4).",
  },
  {
    question: "Can I buy and sell comics here?",
    answer:
      "Yes! The Shop features auctions and fixed-price listings. You can list comics from your collection for sale, bid on auctions, make offers on listings, and complete purchases via secure Stripe checkout.",
  },
  {
    question: "Can I trade comics with other collectors?",
    answer:
      "Yes! Mark comics as 'For Trade' in your collection, then browse the Trade tab in the Shop to find matches. The system suggests trades based on your want list and what other collectors have available.",
  },
  {
    question: "How do I message another collector?",
    answer:
      "Click 'Message Seller' on any listing, or visit a collector's profile and send them a direct message. You can share images and discuss deals privately. Messages appear in your inbox under the Messages page.",
  },
  {
    question: "How do I mark a comic as sold?",
    answer:
      "Open any comic in your collection, tap 'Mark as Sold', and enter the sale price. It moves to your Sales History where you can track profit and loss across all your sales.",
  },
  {
    question: "Can I import my existing collection?",
    answer:
      "Yes! Go to Collection and use the Import feature. Upload a CSV, JSON, or Excel file from other apps like CLZ Comics, League of Comic Geeks, or your own spreadsheet. Map your columns to our fields and import in bulk.",
  },
  {
    question: "Can I create custom lists?",
    answer:
      "Yes! From your Collection page, create lists to organize comics however you like \u2014 by series, want list, favorites, reading order, or any category. Comics can belong to multiple lists.",
  },
  {
    question: "What is the Hottest Books feature?",
    answer:
      "Professor's Hottest Books is a weekly market analysis showing the top trending comics based on recent sales activity. It includes key facts about each book, why it's hot, and current price ranges to help you spot opportunities.",
  },
  {
    question: "What is Key Info and why does it matter?",
    answer:
      "Key Info highlights significant events in a comic \u2014 first appearances, origin stories, deaths, team changes, and more. Key issues are typically worth more than regular issues. We maintain a curated database and you can suggest additions for community review.",
  },
  {
    question: "How do I track my collection's value?",
    answer:
      "Your collection page shows total estimated value, cost basis, and profit/loss. Each comic displays its estimated value, and the Stats page (premium) provides detailed breakdowns by publisher, trends over time, and portfolio analysis.",
  },
  {
    question: "Can I use this on my phone?",
    answer:
      "Absolutely! Collectors Chest is fully mobile-responsive and works as a Progressive Web App. Add it to your home screen from your browser for an app-like experience with quick access to scanning, Key Hunt, and your collection.",
  },
  {
    question: "Is my data safe?",
    answer:
      "Your collection data is stored securely in the cloud and synced across all your devices. We use industry-standard encryption, secure authentication via Clerk, and your payment info is handled entirely by Stripe \u2014 we never store credit card details.",
  },
];

export function Navigation() {
  const pathname = usePathname();
  const { user, isSignedIn } = useUser();
  const { isAdmin } = useSubscription();
  const [showProfessor, setShowProfessor] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Click-outside handler for More menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };

    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMoreMenu]);

  // Fetch profile ID for broadcast subscription
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/username/current")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.profileId) setProfileId(data.profileId); })
      .catch(() => {});
  }, [isSignedIn]);

  // Fetch initial unread count
  useEffect(() => {
    if (!isSignedIn) return;

    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/messages/unread-count");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count);
        }
      } catch {
        // Ignore errors silently
      }
    };

    fetchUnread();
  }, [isSignedIn]);

  // Subscribe to broadcast for unread message updates
  useEffect(() => {
    if (!profileId) return;

    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/messages/unread-count");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count);
        }
      } catch {
        // Ignore errors silently
      }
    };

    const channel = supabase
      .channel(`user:${profileId}:messages`)
      .on("broadcast", { event: "unread-update" }, () => {
        fetchUnread();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  // Guest primary nav links
  const guestPrimaryLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/scan", label: "Scan", icon: Camera },
    { href: "/collection", label: "Collection", icon: BookOpen },
    { href: "/shop", label: "Shop", icon: ShoppingBag },
  ];

  // Guest "More" dropdown - all redirect to sign-in
  const guestSecondaryLinks = [
    { href: "/sign-in?redirect=/messages", label: "Messages", icon: MessageSquare },
    { href: "/sign-in?redirect=/my-auctions", label: "My Listings", icon: Gavel },
    { href: "/sign-in?redirect=/trades", label: "Trades", icon: ArrowLeftRight },
    { href: "/sign-in?redirect=/stats", label: "Stats", icon: BarChart3 },
    { href: "/sign-in?redirect=/collection", label: "Lists", icon: Layers },
    { href: "/about", label: "About", icon: Info },
  ];

  // Registered user primary nav links
  const registeredPrimaryLinks = [
    { href: "/collection", label: "Collection", icon: BookOpen },
    { href: "/shop", label: "Shop", icon: ShoppingBag },
    { href: "/stats", label: "Stats", icon: BarChart3 },
  ];

  // Registered user "More" dropdown
  const registeredSecondaryLinks = [
    { href: "/messages", label: "Messages", icon: MessageSquare, showBadge: true },
    { href: "/sales", label: "Sales", icon: DollarSign },
    { href: "/trades", label: "Trades", icon: ArrowLeftRight },
    { href: "/following", label: "Following", icon: UserCheck },
    { href: "/collection", label: "Lists", icon: Layers },
    { href: "/my-auctions", label: "My Listings", icon: Gavel },
    { href: "/hottest-books", label: "Hottest Books", icon: Flame },
    { href: "/key-hunt", label: "Key Hunt", icon: KeyRound },
    { href: "/about", label: "About", icon: Info },
  ];

  // Use appropriate links based on auth state
  const primaryLinks = isSignedIn ? registeredPrimaryLinks : guestPrimaryLinks;
  const secondaryLinks = isSignedIn ? registeredSecondaryLinks : guestSecondaryLinks;

  return (
    <>
      <nav className="bg-pop-yellow border-b-4 border-pop-black shadow-comic">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 group">
              <ChestIcon size={36} />
              <span className="font-comic text-2xl text-pop-black tracking-wide group-hover:text-pop-red transition-colors">
                COLLECTORS CHEST
              </span>
            </Link>

            {/* Navigation Links - hidden on mobile (MobileNav handles that) */}
            <div className="hidden md:flex items-center space-x-2">
              {/* Primary navigation links */}
              {primaryLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || (link.href === "/" && pathname === "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`nav-link-pop flex items-center space-x-2 px-3 py-1.5 transition-all ${
                      isActive
                        ? "bg-pop-white text-pop-black border-2 border-pop-black shadow-comic-sm"
                        : "text-pop-black hover:bg-pop-white/50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-comic text-sm tracking-wide">
                      {link.label.toUpperCase()}
                    </span>
                  </Link>
                );
              })}

              {/* More dropdown - for all users */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className={`nav-link-pop flex items-center space-x-2 px-3 py-1.5 transition-all ${
                    secondaryLinks.some((l) => pathname === l.href && !primaryLinks.some((p) => p.href === l.href)) || pathname.startsWith("/admin")
                      ? "bg-pop-white text-pop-black border-2 border-pop-black shadow-comic-sm"
                      : "text-pop-black hover:bg-pop-white/50"
                  }`}
                >
                  <MoreHorizontal className="w-5 h-5" />
                  <span className="font-comic text-sm tracking-wide">MORE</span>
                  {isSignedIn && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-pop-red text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border border-pop-black">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown menu */}
                {showMoreMenu && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-pop-white border-3 border-pop-black shadow-comic z-50">
                    {secondaryLinks.map((link) => {
                      const Icon = link.icon;
                      const isActive = pathname === link.href && !primaryLinks.some((p) => p.href === link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setShowMoreMenu(false)}
                          className={`relative flex items-center space-x-3 px-4 py-3 transition-all border-b border-pop-black/20 last:border-b-0 ${
                            isActive
                              ? "bg-pop-yellow text-pop-black"
                              : "text-pop-black hover:bg-pop-yellow/30"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-comic text-sm tracking-wide">
                            {link.label.toUpperCase()}
                          </span>
                          {"showBadge" in link && (link as { showBadge?: boolean }).showBadge && unreadCount > 0 && (
                            <span className="ml-auto bg-pop-red text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border border-pop-black">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                    {/* Admin - inside More dropdown for signed-in admin users */}
                    {isSignedIn && isAdmin && (
                      <Link
                        href="/admin/users"
                        onClick={() => setShowMoreMenu(false)}
                        className={`relative flex items-center space-x-3 px-4 py-3 transition-all border-t border-pop-black/20 ${
                          pathname.startsWith("/admin")
                            ? "bg-pop-red text-pop-white"
                            : "text-pop-black hover:bg-pop-red/20"
                        }`}
                      >
                        <Shield className="w-5 h-5" />
                        <span className="font-comic text-sm tracking-wide">ADMIN</span>
                        <AdminAlertBadge variant="count" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Notifications + Professor + Auth */}
            <div className="flex items-center gap-2">
              {/* Notifications (signed in only) */}
              <SignedIn>
                <NotificationBell />
              </SignedIn>

              {/* Ask the Professor button */}
              <button
                onClick={() => setShowProfessor(true)}
                className="p-2 mr-4 bg-pop-blue border-2 border-pop-black shadow-comic-sm hover:shadow-comic hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
                aria-label="Ask the Professor"
              >
                <Brain className="w-5 h-5 text-pop-yellow" />
              </button>

              {/* Auth */}
              <SignedIn>
                <UserButton
                  afterSignOutUrl="/"
                  userProfileUrl="/profile"
                  userProfileMode="navigation"
                  appearance={{
                    elements: {
                      avatarBox: "w-9 h-9 border-2 border-pop-black shadow-comic-sm",
                    },
                  }}
                />
              </SignedIn>
              <SignedOut>
                <Link
                  href="/sign-in"
                  className="btn-pop btn-pop-blue flex items-center gap-1.5 px-3 py-1.5 text-sm"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline font-comic">SIGN IN</span>
                </Link>
              </SignedOut>
            </div>
          </div>
        </div>
      </nav>

      {/* Ask the Professor Modal */}
      {showProfessor && (
        <div
          className="fixed inset-0 z-50 bg-pop-black/70 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowProfessor(false)}
        >
          <div
            className="speech-bubble bg-pop-white w-full max-w-lg max-h-[80vh] overflow-hidden !rounded-none border-4 border-pop-black"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-pop-blue p-6 border-b-4 border-pop-black">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pop-yellow border-2 border-pop-black shadow-comic-sm">
                    <Brain className="w-6 h-6 text-pop-black" />
                  </div>
                  <div>
                    <h2 className="font-comic text-2xl text-pop-yellow tracking-wide">
                      ASK THE PROFESSOR!
                    </h2>
                    <p className="text-pop-white text-sm font-body">
                      Your guide to Collectors Chest
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProfessor(false)}
                  className="p-2 bg-pop-red border-2 border-pop-black shadow-comic-sm hover:shadow-comic transition-all"
                >
                  <X className="w-5 h-5 text-pop-white" />
                </button>
              </div>
            </div>

            {/* FAQ List */}
            <div className="overflow-y-auto max-h-[calc(80vh-120px)] p-4 dots-blue-light">
              <p className="text-pop-black font-body mb-4 bg-pop-white p-2 border-2 border-pop-black inline-block shadow-comic-sm">
                Welcome, collector! Here are answers to commonly asked questions.
              </p>
              <div className="space-y-3">
                {faqs.map((faq, index) => (
                  <div
                    key={index}
                    className="bg-pop-white border-3 border-pop-black shadow-comic-sm overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-pop-yellow/20 transition-colors"
                    >
                      <span className="font-sans font-medium text-pop-black pr-4 normal-case">{faq.question}</span>
                      {expandedFAQ === index ? (
                        <ChevronUp className="w-5 h-5 text-pop-blue flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-pop-blue flex-shrink-0" />
                      )}
                    </button>
                    {expandedFAQ === index && (
                      <div className="px-4 pb-4 text-pop-black font-body text-sm border-t-2 border-pop-black pt-3 bg-pop-cream">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
