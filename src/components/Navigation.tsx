"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignedIn, UserButton, useUser } from "@clerk/nextjs";

import {
  Brain,
  ChevronDown,
  ChevronUp,
  LogIn,
  MoreHorizontal,
  Shield,
  X,
} from "lucide-react";

import { faqs } from "@/lib/faqData";
import { getNavLinks, isNavLinkActive } from "@/lib/navLinks";

import { useSubscription } from "@/hooks/useSubscription";

import AdminAlertBadge from "@/components/AdminAlertBadge";
import { useUnreadMessages } from "@/components/Providers";
import { NotificationBell } from "./NotificationBell";
import { ChestIcon } from "./icons/ChestIcon";

export function Navigation() {
  const pathname = usePathname();
  const { isSignedIn } = useUser();
  const { isAdmin } = useSubscription();
  const unreadCount = useUnreadMessages();
  const [showProfessor, setShowProfessor] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  // Hydration-safe mount flag. Server-render is always auth-unaware, so any
  // className that depends on `isSignedIn` will diverge between SSR and the
  // first client render once Clerk resolves. Gate auth-dependent classNames
  // on this flag so SSR and initial CSR match exactly; the post-mount render
  // applies the auth-aware variant. See BACKLOG "Hydration Mismatch on Ask
  // the Professor Button" (Apr 22, 2026 entry).
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Lock background scroll while the Ask the Professor modal is open so
  // scrolling inside the FAQ list doesn't bleed through to the underlying
  // page. Users reported the background page scrolling when they reached
  // the end of the FAQ list.
  useEffect(() => {
    if (!showProfessor) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showProfessor]);

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

  // Nav link tables are shared with MobileNav via @/lib/navLinks so the two
  // navs can't drift apart (L-FE18). Unread count + realtime are hoisted into
  // the shared UnreadMessagesProvider (M-FE9 / M-MS4).
  const { primary: primaryLinks, secondary: secondaryLinks } = getNavLinks(!!isSignedIn);

  return (
    <>
      <nav
        aria-label="Primary"
        className="bg-pop-yellow border-b-4 border-pop-black shadow-comic"
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" aria-label="Collectors Chest home" className="flex items-center space-x-2 group" style={{ WebkitTapHighlightColor: "transparent" }}>
              <ChestIcon size={56} />
              <span className="font-comic text-xl md:text-2xl text-pop-black tracking-wide md:group-hover:text-pop-red transition-colors whitespace-nowrap">
                COLLECTORS CHEST
              </span>
            </Link>

            {/* Navigation Links - hidden on mobile (MobileNav handles that) */}
            <div className="hidden md:flex items-center space-x-2">
              {/* Primary navigation links */}
              {primaryLinks.map((link) => {
                const Icon = link.icon;
                const isActive = isNavLinkActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
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
                  aria-haspopup="menu"
                  aria-expanded={showMoreMenu}
                  aria-label="More navigation"
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
                      <span aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>
                      <span className="sr-only">{unreadCount} unread messages</span>
                    </span>
                  )}
                </button>

                {/* Dropdown menu */}
                {showMoreMenu && (
                  <div role="menu" className="absolute top-full right-0 mt-2 w-48 bg-pop-white border-3 border-pop-black shadow-comic z-50 max-h-[calc(100vh-120px)] overflow-y-auto">
                    {secondaryLinks.map((link) => {
                      const Icon = link.icon;
                      const isActive = pathname === link.href && !primaryLinks.some((p) => p.href === link.href);
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setShowMoreMenu(false)}
                          role="menuitem"
                          aria-current={isActive ? "page" : undefined}
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
                          {link.showBadge && unreadCount > 0 && (
                            <span className="ml-auto bg-pop-red text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border border-pop-black">
                              <span aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>
                              <span className="sr-only">{unreadCount} unread messages</span>
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
                        role="menuitem"
                        aria-current={pathname.startsWith("/admin") ? "page" : undefined}
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

              {/* Ask the Professor button - hidden on mobile for guests so Sign In takes priority */}
              <button
                onClick={() => setShowProfessor(true)}
                className={`p-2 bg-pop-blue border-2 border-pop-black shadow-comic-sm hover:shadow-comic hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all ${
                  // Default to the guest visibility shape until mount so SSR
                  // and first client render produce identical HTML. The auth
                  // -aware variant only kicks in after `hasMounted` flips true.
                  hasMounted && isSignedIn ? "inline-flex" : "hidden sm:inline-flex"
                }`}
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
              {!isSignedIn && (
                <>
                  {/* Mobile: icon-only sign-in button */}
                  <Link
                    href="/sign-in"
                    className="sm:hidden inline-flex items-center p-2 bg-pop-blue border-2 border-pop-black shadow-comic-sm hover:shadow-comic transition-all"
                    aria-label="Sign In"
                  >
                    <LogIn className="w-5 h-5 text-pop-white" />
                  </Link>
                  {/* Desktop: full SIGN IN button (no btn-pop class - collides with `hidden`) */}
                  <Link
                    href="/sign-in"
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-pop-blue text-pop-white border-2 border-pop-black shadow-comic-sm hover:shadow-comic hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all text-sm"
                  >
                    <LogIn className="w-4 h-4" />
                    <span className="font-comic">SIGN IN</span>
                  </Link>
                </>
              )}
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
            <div
              className="overflow-y-auto max-h-[calc(80vh-120px)] p-4 dots-blue-light"
              onClick={(e) => {
                // Close the modal when the user clicks an internal link inside
                // an FAQ answer - otherwise they navigate but the modal stays
                // open, floating over the destination page.
                const anchor = (e.target as HTMLElement).closest("a");
                if (anchor) setShowProfessor(false);
              }}
            >
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
                      aria-expanded={expandedFAQ === index}
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
