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
  MoreHorizontal,
  Shield,
  ShoppingBag,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

import { useSubscription } from "@/hooks/useSubscription";

import { NotificationBell } from "./NotificationBell";
import { ChestIcon } from "./icons/ChestIcon";

// FAQ content for Ask the Professor
const faqs = [
  {
    question: "How do I add a comic to my collection?",
    answer:
      "Click the '+' button or go to 'Scan'. You can either upload a photo of the cover for technopathic recognition, scan a barcode, or enter details manually. After reviewing the details, click 'Add to Collection'.",
  },
  {
    question: "What features are available for guests vs registered users?",
    answer:
      "Guests can explore the app, view the 'How It Works' guide, check out Professor's Hottest Books, and try scanning a comic. However, to save comics to your collection, track values, create custom lists, mark items as sold, and access your data across devices, you'll need to create a free account.",
  },
  {
    question: "What does 'Slabbed' mean?",
    answer:
      "A 'slabbed' comic is one that has been professionally graded by a service like CGC, CBCS, or PGX. The comic is sealed in a protective case with a grade label.",
  },
  {
    question: "How accurate are the price estimates?",
    answer:
      "Price estimates are generated using technopathy based on recent market trends. They provide a general guideline but actual prices can vary based on condition, demand, and where you sell.",
  },
  {
    question: "What is Key Hunt?",
    answer:
      "Key Hunt is a quick price lookup feature designed for finding key comics at conventions. Scan a cover, scan a barcode, or manually enter a title to instantly see the average price for any grade.",
  },
  {
    question: "Can I create custom lists?",
    answer:
      "Yes! Go to your Collection page and look for the option to create a new list. You can organize comics by series, favorites, want list, or any category you choose.",
  },
  {
    question: "How do I mark a comic as sold?",
    answer:
      "View the comic in your collection and look for the 'Mark as Sold' option. Enter the sale price and date, and it will be moved to your sales history.",
  },
];

export function Navigation() {
  const pathname = usePathname();
  const { user, isSignedIn } = useUser();
  const { isAdmin } = useSubscription();
  const [showProfessor, setShowProfessor] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
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

    // Subscribe to new messages for realtime badge updates
    const channel = supabase
      .channel("navigation-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          // If the new message is NOT from the current user, increment count
          // Note: We can't filter by recipient on the channel, so we do it here
          const newMessage = payload.new as { sender_id: string };
          if (user?.id && newMessage.sender_id !== user.id) {
            // Optimistically increment - the actual count may be more accurate
            // on next fetch, but this gives instant feedback
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSignedIn, user?.id]);

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
                      const isActive = pathname === link.href;
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
                  className="btn-pop btn-pop-red flex items-center gap-1.5 px-3 py-1.5 text-sm"
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
                      <span className="font-comic text-pop-black pr-4">{faq.question}</span>
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
