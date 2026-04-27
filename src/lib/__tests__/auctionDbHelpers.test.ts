/**
 * @jest-environment node
 */

// Stub external clients before importing auctionDb so the helper test
// doesn't require live env config.
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn() },
  })),
}));
process.env.RESEND_API_KEY = "test-key";
process.env.NEXT_PUBLIC_APP_URL = "https://collectors-chest.com";

import { formatDeadlineForEmail } from "../auctionDb";

describe("formatDeadlineForEmail", () => {
  it("renders a DST-period deadline as Eastern Daylight Time", () => {
    // Apr 26 2026 14:20 UTC = 10:20 AM EDT
    const date = new Date("2026-04-26T14:20:00Z");
    const result = formatDeadlineForEmail(date);
    expect(result).toContain("April 26, 2026");
    expect(result).toContain("10:20");
    expect(result).toContain("AM");
    expect(result).toContain("EDT");
  });

  it("renders a standard-time deadline as Eastern Standard Time", () => {
    // Jan 10 2026 20:00 UTC = 3:00 PM EST
    const date = new Date("2026-01-10T20:00:00Z");
    const result = formatDeadlineForEmail(date);
    expect(result).toContain("January 10, 2026");
    expect(result).toContain("3:00");
    expect(result).toContain("PM");
    expect(result).toContain("EST");
  });

  it("never renders without a timezone label (regression test for Apr 26 UTC bug)", () => {
    // The bug shipped a deadline like "April 26, 2026, 2:20 PM" with no
    // timezone label, because the server runs UTC and toLocaleString() with
    // no timeZone option used the server TZ. Buyers misread it as ET.
    const date = new Date("2026-06-15T18:00:00Z");
    const result = formatDeadlineForEmail(date);
    expect(result).toMatch(/E[DS]T$/);
  });
});
