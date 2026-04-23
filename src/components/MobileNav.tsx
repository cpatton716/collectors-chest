"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useUser } from "@clerk/nextjs";

import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  DollarSign,
  Gavel,
  Home,
  KeyRound,
  Layers,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Shield,
  ShoppingBag,
  Wallet,
  X,
} from "lucide-react";

import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/lib/supabase";
import AdminAlertBadge from "@/components/AdminAlertBadge";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  locked?: boolean;
}

interface DrawerItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  requiresAuth?: boolean;
}

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { tier, isTrialing, isAdmin } = useSubscription();
  const [isVisible, setIsVisible] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastScrollY = useRef(0);
  const scrollThreshold = 10;

  const isPremium = tier === "premium" || isTrialing;

  const [profileId, setProfileId] = useState<string | null>(null);

  // Fetch profile ID for broadcast subscription
  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/username/current")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.profileId) setProfileId(data.profileId); })
      .catch(() => {});
  }, [isSignedIn]);

  // Fetch unread message count
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

  // Guest nav items: Home, Collection, Shop, More
  const guestNavItems: NavItem[] = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/collection", icon: BookOpen, label: "Collection" },
    { href: "/shop", icon: ShoppingBag, label: "Shop" },
  ];

  // Registered nav items: Collection, Shop, More, Key Hunt
  const registeredNavItems: NavItem[] = [
    { href: "/collection", icon: BookOpen, label: "Collection" },
    { href: "/shop", icon: ShoppingBag, label: "Shop" },
  ];

  // Guest drawer items (all redirect to sign-in)
  const guestDrawerItems: DrawerItem[] = [
    { href: "/sign-in?redirect=/messages", icon: MessageSquare, label: "Messages", requiresAuth: true },
    { href: "/sign-in?redirect=/transactions", icon: Wallet, label: "Transactions", requiresAuth: true },
    { href: "/sign-in?redirect=/my-auctions", icon: Gavel, label: "My Listings", requiresAuth: true },
    { href: "/sign-in?redirect=/trades", icon: ArrowLeftRight, label: "Trades", requiresAuth: true },
    { href: "/sign-in?redirect=/stats", icon: BarChart3, label: "Stats", requiresAuth: true },
    { href: "/sign-in?redirect=/collection", icon: Layers, label: "Lists", requiresAuth: true },
  ];

  // Registered drawer items
  const registeredDrawerItems: DrawerItem[] = [
    { href: "/messages", icon: MessageSquare, label: "Messages" },
    { href: "/transactions", icon: Wallet, label: "Transactions" },
    { href: "/sales", icon: DollarSign, label: "Sales" },
    { href: "/trades", icon: ArrowLeftRight, label: "Trades" },
    { href: "/collection", icon: Layers, label: "Lists" },
    { href: "/my-auctions", icon: Gavel, label: "My Listings" },
    { href: "/stats", icon: BarChart3, label: "Stats" },
  ];

  const navItems = isSignedIn ? registeredNavItems : guestNavItems;
  const drawerItems = isSignedIn ? registeredDrawerItems : guestDrawerItems;

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
        className={`fixed bottom-0 left-0 right-0 md:hidden z-50 transition-transform duration-300 ease-in-out ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-3 mb-3 bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-around py-2 px-1">
            {/* Regular nav items */}
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href === "/" && pathname === "/");
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-primary-100 text-primary-600"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
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
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                showDrawer
                  ? "bg-primary-100 text-primary-600"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              <div className="relative">
                <MoreHorizontal className="w-5 h-5" />
                {isSignedIn && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
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
                    ? "bg-amber-100 text-amber-600"
                    : isPremium
                      ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                      : "text-gray-400"
                }`}
              >
                <div className="relative">
                  <KeyRound className={`w-5 h-5 ${pathname === "/key-hunt" ? "stroke-[2.5]" : ""}`} />
                  {!isPremium && (
                    <Lock className="w-3 h-3 absolute -top-1 -right-1 text-gray-400" />
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
            className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
            onClick={() => setShowDrawer(false)}
          />

          {/* Drawer */}
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">More</h2>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              {drawerItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const isMessages = item.label === "Messages";

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowDrawer(false)}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      isActive
                        ? "bg-primary-50 text-primary-600"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                    {isMessages && unreadCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                    {item.requiresAuth && (
                      <Lock className="w-4 h-4 ml-auto text-gray-400" />
                    )}
                  </Link>
                );
              })}

              {/* Admin menu item */}
              {isSignedIn && isAdmin && (
                <Link
                  href="/admin/users"
                  onClick={() => setShowDrawer(false)}
                  className={`flex items-center gap-3 px-4 py-3 border-t border-gray-100 transition-colors ${
                    pathname.startsWith("/admin")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Shield className="w-5 h-5" />
                  <span className="font-medium">Admin</span>
                  <AdminAlertBadge variant="count" />
                </Link>
              )}
            </div>

            {/* Sign in prompt for guests */}
            {!isSignedIn && (
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50">
                <p className="text-sm text-gray-600 mb-3">
                  Sign in to access all features
                </p>
                <Link
                  href="/sign-in"
                  onClick={() => setShowDrawer(false)}
                  className="block w-full py-2.5 px-4 bg-primary-600 text-white text-center rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
