import {
  getMobileNavItems,
  getNavLinks,
  guestPrimaryLinks,
  guestSecondaryLinks,
  isNavLinkActive,
  mobileGuestDrawerItems,
  mobileGuestNavItems,
  mobileRegisteredDrawerItems,
  mobileRegisteredNavItems,
  registeredPrimaryLinks,
  registeredSecondaryLinks,
} from "../navLinks";

describe("getNavLinks (desktop)", () => {
  it("returns guest link sets when signed out", () => {
    const { primary, secondary } = getNavLinks(false);
    expect(primary).toBe(guestPrimaryLinks);
    expect(secondary).toBe(guestSecondaryLinks);
  });

  it("returns registered link sets when signed in", () => {
    const { primary, secondary } = getNavLinks(true);
    expect(primary).toBe(registeredPrimaryLinks);
    expect(secondary).toBe(registeredSecondaryLinks);
  });

  it("guest secondary links all gate behind sign-in except About", () => {
    for (const link of guestSecondaryLinks) {
      if (link.href === "/about") {
        expect(link.requiresAuth).toBeFalsy();
      } else {
        expect(link.requiresAuth).toBe(true);
        expect(link.href).toContain("/sign-in?redirect=");
      }
    }
  });

  it("only the registered Messages link carries the unread badge", () => {
    const badged = registeredSecondaryLinks.filter((l) => l.showBadge);
    expect(badged).toHaveLength(1);
    expect(badged[0].href).toBe("/messages");
  });

  it("every link has a non-empty href, label, and icon", () => {
    const all = [
      ...guestPrimaryLinks,
      ...guestSecondaryLinks,
      ...registeredPrimaryLinks,
      ...registeredSecondaryLinks,
      ...mobileGuestNavItems,
      ...mobileGuestDrawerItems,
      ...mobileRegisteredNavItems,
      ...mobileRegisteredDrawerItems,
    ];
    for (const link of all) {
      expect(link.href.length).toBeGreaterThan(0);
      expect(link.label.length).toBeGreaterThan(0);
      expect(link.icon).toBeDefined();
    }
  });
});

describe("getMobileNavItems (mobile)", () => {
  it("returns guest sets when signed out", () => {
    const { navItems, drawerItems } = getMobileNavItems(false);
    expect(navItems).toBe(mobileGuestNavItems);
    expect(drawerItems).toBe(mobileGuestDrawerItems);
  });

  it("returns registered sets when signed in", () => {
    const { navItems, drawerItems } = getMobileNavItems(true);
    expect(navItems).toBe(mobileRegisteredNavItems);
    expect(drawerItems).toBe(mobileRegisteredDrawerItems);
  });

  it("guest drawer items all require auth", () => {
    for (const link of mobileGuestDrawerItems) {
      expect(link.requiresAuth).toBe(true);
    }
  });
});

describe("isNavLinkActive", () => {
  it("matches Home only on the exact root path", () => {
    expect(isNavLinkActive("/", "/")).toBe(true);
    expect(isNavLinkActive("/collection", "/")).toBe(false);
  });

  it("matches non-home links on exact pathname only", () => {
    expect(isNavLinkActive("/collection", "/collection")).toBe(true);
    expect(isNavLinkActive("/collection/123", "/collection")).toBe(false);
    expect(isNavLinkActive("/shop", "/collection")).toBe(false);
  });
});
