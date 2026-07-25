import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookOpen,
  Camera,
  DollarSign,
  Gavel,
  Home,
  Info,
  KeyRound,
  Layers,
  MessageSquare,
  ShoppingBag,
  UserCheck,
  Wallet,
} from "lucide-react";

/**
 * Shared navigation link definitions consumed by both the desktop
 * `Navigation` component and the mobile `MobileNav` component. Keeping a single
 * source of truth prevents the two navs from drifting out of sync (a recurring
 * maintenance hazard before this module existed). See audit ref L-FE18.
 *
 * The desktop and mobile navs surface slightly different subsets (the bottom
 * mobile bar is space-constrained and promotes Key Hunt to its own button), so
 * each nav composes its view from these canonical definitions rather than all
 * sharing one identical list.
 *
 * `icon` is typed loosely as a component accepting a `className` so both navs
 * (which size icons via Tailwind classes) can render the same definitions.
 */
type NavIcon = React.ComponentType<{ className?: string }>;

export interface NavLink {
  href: string;
  label: string;
  icon: NavIcon;
  /** When true, render an unread-message badge on this link. */
  showBadge?: boolean;
  /** When true, the destination requires auth (guest links point at sign-in). */
  requiresAuth?: boolean;
}

// ---- Desktop Navigation link sets -----------------------------------------

/** Desktop primary links shown to signed-out visitors. */
export const guestPrimaryLinks: NavLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/scan", label: "Scan", icon: Camera },
  { href: "/collection", label: "Collection", icon: BookOpen },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
];

/** Desktop "More" links shown to signed-out visitors (all gated behind sign-in). */
export const guestSecondaryLinks: NavLink[] = [
  { href: "/sign-in?redirect=/messages", label: "Messages", icon: MessageSquare, requiresAuth: true },
  { href: "/sign-in?redirect=/transactions", label: "Transactions", icon: Wallet, requiresAuth: true },
  { href: "/sign-in?redirect=/my-auctions", label: "My Listings", icon: Gavel, requiresAuth: true },
  { href: "/sign-in?redirect=/trades", label: "Trades", icon: ArrowLeftRight, requiresAuth: true },
  { href: "/sign-in?redirect=/stats", label: "Stats", icon: BarChart3, requiresAuth: true },
  { href: "/sign-in?redirect=/collection", label: "Lists", icon: Layers, requiresAuth: true },
  { href: "/about", label: "About", icon: Info },
];

/** Desktop primary links shown to signed-in users. */
export const registeredPrimaryLinks: NavLink[] = [
  { href: "/collection", label: "Collection", icon: BookOpen },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

/** Desktop "More" links shown to signed-in users. */
export const registeredSecondaryLinks: NavLink[] = [
  { href: "/notifications", label: "Inbox", icon: Bell },
  { href: "/messages", label: "Messages", icon: MessageSquare, showBadge: true },
  { href: "/transactions", label: "Transactions", icon: Wallet },
  { href: "/sales", label: "Sales", icon: DollarSign },
  { href: "/trades", label: "Trades", icon: ArrowLeftRight },
  { href: "/following", label: "Following", icon: UserCheck },
  { href: "/collection", label: "Lists", icon: Layers },
  { href: "/my-auctions", label: "My Listings", icon: Gavel },
  { href: "/key-hunt", label: "Key Hunt", icon: KeyRound },
  { href: "/about", label: "About", icon: Info },
];

/**
 * Resolve the desktop primary + secondary link sets for the current auth state.
 * Pure function so the nav and tests share identical selection logic.
 */
export function getNavLinks(isSignedIn: boolean): {
  primary: NavLink[];
  secondary: NavLink[];
} {
  return isSignedIn
    ? { primary: registeredPrimaryLinks, secondary: registeredSecondaryLinks }
    : { primary: guestPrimaryLinks, secondary: guestSecondaryLinks };
}

// ---- Mobile bottom-bar link sets ------------------------------------------

/** Mobile bottom-bar primary links shown to signed-out visitors. */
export const mobileGuestNavItems: NavLink[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/collection", label: "Collection", icon: BookOpen },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
];

/** Mobile bottom-bar primary links shown to signed-in users. */
export const mobileRegisteredNavItems: NavLink[] = [
  { href: "/collection", label: "Collection", icon: BookOpen },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
];

/** Mobile drawer ("More") links shown to signed-out visitors. */
export const mobileGuestDrawerItems: NavLink[] = [
  { href: "/sign-in?redirect=/messages", label: "Messages", icon: MessageSquare, requiresAuth: true },
  { href: "/sign-in?redirect=/transactions", label: "Transactions", icon: Wallet, requiresAuth: true },
  { href: "/sign-in?redirect=/my-auctions", label: "My Listings", icon: Gavel, requiresAuth: true },
  { href: "/sign-in?redirect=/trades", label: "Trades", icon: ArrowLeftRight, requiresAuth: true },
  { href: "/sign-in?redirect=/stats", label: "Stats", icon: BarChart3, requiresAuth: true },
  { href: "/sign-in?redirect=/collection", label: "Lists", icon: Layers, requiresAuth: true },
];

/** Mobile drawer ("More") links shown to signed-in users. */
export const mobileRegisteredDrawerItems: NavLink[] = [
  { href: "/notifications", label: "Inbox", icon: Bell },
  { href: "/messages", label: "Messages", icon: MessageSquare, showBadge: true },
  { href: "/transactions", label: "Transactions", icon: Wallet },
  { href: "/sales", label: "Sales", icon: DollarSign },
  { href: "/trades", label: "Trades", icon: ArrowLeftRight },
  { href: "/collection", label: "Lists", icon: Layers },
  { href: "/my-auctions", label: "My Listings", icon: Gavel },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

/** Resolve the mobile bottom-bar + drawer link sets for the current auth state. */
export function getMobileNavItems(isSignedIn: boolean): {
  navItems: NavLink[];
  drawerItems: NavLink[];
} {
  return isSignedIn
    ? { navItems: mobileRegisteredNavItems, drawerItems: mobileRegisteredDrawerItems }
    : { navItems: mobileGuestNavItems, drawerItems: mobileGuestDrawerItems };
}

/**
 * True when `pathname` should mark `href` as the active nav target. The Home
 * link only matches the exact root path; every other link matches an exact
 * pathname. Shared so both navs (and `aria-current`) compute "active" the same
 * way.
 */
export function isNavLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href;
}
