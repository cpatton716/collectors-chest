import {
  PROMO_TRIAL_DAYS,
  PROMO_TRIAL_STORAGE_KEY,
  setPromoTrialFlag,
  getPromoTrialFlag,
  clearPromoTrialFlag,
} from "../promoTrial";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
});

describe("promoTrial constants", () => {
  it("has a 30-day trial period", () => {
    expect(PROMO_TRIAL_DAYS).toBe(30);
  });

  it("has a stable storage key", () => {
    expect(PROMO_TRIAL_STORAGE_KEY).toBe("cc_promo_trial");
  });
});

describe("setPromoTrialFlag", () => {
  it("sets a timestamp in localStorage", () => {
    const before = Date.now();
    setPromoTrialFlag();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "cc_promo_trial",
      expect.any(String)
    );
    const storedValue = parseInt(localStorageMock.getItem("cc_promo_trial"), 10);
    expect(storedValue).toBeGreaterThanOrEqual(before);
    expect(storedValue).toBeLessThanOrEqual(Date.now());
  });
});

describe("getPromoTrialFlag", () => {
  it("returns true when flag is recent (within 7 days)", () => {
    setPromoTrialFlag();
    expect(getPromoTrialFlag()).toBe(true);
  });

  it("returns false when flag is not set", () => {
    expect(getPromoTrialFlag()).toBe(false);
  });

  it("returns false when flag is expired (older than 7 days)", () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorageMock.setItem("cc_promo_trial", eightDaysAgo.toString());
    expect(getPromoTrialFlag()).toBe(false);
  });

  it("returns false for non-timestamp string values", () => {
    localStorageMock.setItem("cc_promo_trial", "true");
    expect(getPromoTrialFlag()).toBe(false);
  });
});

describe("clearPromoTrialFlag", () => {
  it("removes the flag from localStorage", () => {
    localStorageMock.setItem("cc_promo_trial", "true");
    clearPromoTrialFlag();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("cc_promo_trial");
  });
});
