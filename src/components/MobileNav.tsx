"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useUser } from "@clerk/nextjs";

import {
  KeyRound,
  Lock,
  MoreHorizontal,
  Shield,
  X,
} from "lucide-react";

import { getMobileNavItems, isNavLinkActive } from "@/lib/navLinks";

import { useSubscription } from "@/hooks/useSubscription";
import AdminAlertBadge from "@/components/AdminAlertBadge";
import { useUnreadMessages } from "@/components/Providers";

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { tier, isTrialing, isAdmin } = useSubscription();
  const unreadCount = useUnreadMessages();
  const [isVisible, setIsVisible] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const lastScrollY = useRef(0);
  const scrollThreshold = 10;

  const isPremium = tier === "premium" || isTrialing;

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY.current;

      if (Math.abs(scrollDelta) < scrollThreshold) return;

      if (currentScrollY < 50) {
        setIsVisible(true);
      } else if (scrollDelta > 0 && currentScrollY > 100) {
        setIsVisible(false);
      } else if (scrollDelta < 0) {
        setIsVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close drawer when route changes
  useEffect(() => {
    setShowDrawer(false);
  }, [pathname]);

  // Hide the bottom nav while a page is in multi-select mode so its action
  // bar (sell/trade/delete/etc.) is never covered by the floating nav.
  useEffect(() => {
    const handleSelectionMode = (e: Event) => {
      setSelectionMode((e as CustomEvent<{ active: boolean }>).detail?.active ?? false);
    };
    window.addEventListener("cc:selection-mode", handleSelectionMode);
    return () => window.removeEventListener("cc:selection-mode", handleSelectionMode);
  }, []);

  // Nav item + drawer tables are shared with the desktop Navigation via
  // @/lib/navLinks so the two navs stay in sync (L-FE18).
  const { navItems, drawerItems } = getMobileNavItems(!!isSignedIn);

  const handleKeyHuntClick = () => {
    if (!isSignedIn) {
      router.push("/sign-in?redirect=/key-hunt");
    } else {
      router.push("/key-hunt");
    }
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        aria-label="Primary"
        className={`fixed bottom-0 left-0 right-0 md:hidden z-50 transition-transform duration-300 ease-in-out ${
          isVisible && !selectionMode ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-3 mb-3 bg-pop-yellow rounded-2xl shadow-comic border-3 border-pop-black">
          <div className="flex items-center justify-around py-2 px-1">
            {/* Regular nav items */}
            {navItems.map((item) => {
              const isActive = isNavLinkActive(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-pop-white text-pop-black border-2 border-pop-black shadow-comic-sm"
                      : "text-pop-black hover:bg-pop-white/50"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                  <span className={`text-[10px] ${isActive ? "font-semibold" : "font-medium"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {/* More button */}
            <button
              onClick={() => setShowDrawer(true)}
              aria-haspopup="menu"
              aria-expanded={showDrawer}
              aria-label="More navigation"
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                showDrawer
                  ? "bg-pop-white text-pop-black border-2 border-pop-black shadow-comic-sm"
                  : "text-pop-black hover:bg-pop-white/50"
              }`}
            >
              <div className="relative">
                <MoreHorizontal className="w-5 h-5" />
                {isSignedIn && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-pop-red text-pop-white text-[8px] font-bold rounded-full h-4 w-4 flex items-center justify-center border border-pop-black">
                    <span aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>
                    <span className="sr-only">{unreadCount} unread messages</span>
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">More</span>
            </button>

            {/* Key Hunt - only for registered users */}
            {isSignedIn && (
              <button
                onClick={handleKeyHuntClick}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                  pathname === "/key-hunt"
                    ? "bg-pop-white text-pop-black border-2 border-pop-black shadow-comic-sm"
                    : isPremium
                      ? "text-pop-orange hover:text-pop-red hover:bg-pop-white/50"
                      : "text-pop-black/60"
                }`}
              >
                <div className="relative">
                  <KeyRound className={`w-5 h-5 ${pathname === "/key-hunt" ? "stroke-[2.5]" : ""}`} />
                  {!isPremium && (
                    <Lock className="w-3 h-3 absolute -top-1 -right-1 text-pop-black/60" />
                  )}
                </div>
                <span className={`text-[10px] ${pathname === "/key-hunt" ? "font-semibold" : "font-medium"}`}>
                  Key Hunt
                </span>
              </button>
            )}
          </div>
        </div>
        {/* Safe area spacer for iOS */}
        <div className="h-safe-area-inset-bottom bg-transparent" />
      </nav>

      {/* Slide-out Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-pop-black/70 animate-in fade-in duration-200"
            onClick={() => setShowDrawer(false)}
          />

          {/* Drawer */}
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-pop-white border-l-4 border-pop-black shadow-comic-lg animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-pop-yellow border-b-4 border-pop-black">
              <h2 className="font-comic text-xl tracking-wide text-pop-black">MORE</h2>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-2 bg-pop-red border-2 border-pop-black shadow-comic-sm hover:shadow-comic transition-all"
              >
                <X className="w-5 h-5 text-pop-white" />
              </button>
            </div>

            {/* Menu Items */}
            <div role="menu" className="py-2">
              {drawerItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowDrawer(false)}
                    role="menuitem"
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors border-b border-pop-black/20 last:border-b-0 ${
                      isActive
                        ? "bg-pop-yellow text-pop-black"
                        : "text-pop-black hover:bg-pop-yellow/30"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-comic text-sm tracking-wide">{item.label.toUpperCase()}</span>
                    {item.showBadge && unreadCount > 0 && (
                      <span className="ml-auto bg-pop-red text-pop-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border border-pop-black">
                        <span aria-hidden="true">{unreadCount > 9 ? "9+" : unreadCount}</span>
                        <span className="sr-only">{unreadCount} unread messages</span>
                      </span>
                    )}
                    {item.requiresAuth && (
                      <Lock className="w-4 h-4 ml-auto text-pop-black/60" />
                    )}
                  </Link>
                );
              })}

              {/* Admin menu item */}
              {isSignedIn && isAdmin && (
                <Link
                  href="/admin/users"
                  onClick={() => setShowDrawer(false)}
                  role="menuitem"
                  aria-current={pathname.startsWith("/admin") ? "page" : undefined}
                  className={`flex items-center gap-3 px-4 py-3 border-t border-pop-black/20 transition-colors ${
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

            {/* Sign in prompt for guests */}
            {!isSignedIn && (
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t-4 border-pop-black bg-pop-cream">
                <p className="text-sm text-pop-black font-body mb-3">
                  Sign in to access all features
                </p>
                <Link
                  href="/sign-in"
                  onClick={() => setShowDrawer(false)}
                  className="block w-full py-2.5 px-4 bg-pop-blue text-pop-white text-center border-2 border-pop-black shadow-comic-sm hover:shadow-comic transition-all font-comic tracking-wide"
                >
                  SIGN IN
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
