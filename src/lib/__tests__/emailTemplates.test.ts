/**
 * @jest-environment node
 *
 * M-EM5 coverage: after decomposing src/lib/email.ts into submodules under
 * src/lib/email/, verify the template resolver dispatch (the switch in
 * send.ts, reached through the public `@/lib/email` barrel) maps each
 * NotificationEmailType to the right template, and that a representative
 * template renders its expected subject/HTML/text. resolveNotificationTemplate
 * is internal, so we drive it through the public `sendNotificationEmail`.
 */

// Mock Resend before importing so no live client is constructed and we can
// capture the payload passed to emails.send().
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    },
    batch: {
      send: jest.fn().mockResolvedValue({ data: { data: [] }, error: null }),
    },
  })),
}));

// Required env vars before importing the module.
process.env.RESEND_API_KEY = "test-key";
process.env.NEXT_PUBLIC_APP_URL = "https://collectors-chest.com";

import { sendNotificationEmail } from "../email";
import type { SendNotificationEmailParams } from "../email";

function getMockSend() {
  const { Resend } = require("resend");
  return Resend.mock.results[0].value.emails.send;
}

beforeEach(() => getMockSend().mockClear());

describe("resolveNotificationTemplate dispatch (via sendNotificationEmail)", () => {
  // One representative payload per type, with a substring we expect to appear
  // in the rendered subject for that type. This asserts the resolver switch
  // routes each type to the correct template.
  const cases: Array<{
    type: SendNotificationEmailParams["type"];
    data: SendNotificationEmailParams["data"];
    subjectIncludes: string;
  }> = [
    {
      type: "offer_received",
      data: {
        buyerName: "Buyer",
        sellerName: "Seller",
        comicTitle: "Amazing Spider-Man",
        issueNumber: "300",
        amount: 100,
        listingUrl: "https://x/l",
      },
      subjectIncludes: "New offer on Amazing Spider-Man #300",
    },
    {
      type: "offer_accepted",
      data: {
        buyerName: "Buyer",
        sellerName: "Seller",
        comicTitle: "Hulk",
        issueNumber: "181",
        amount: 50,
        listingUrl: "https://x/l",
      },
      subjectIncludes: "was accepted",
    },
    {
      type: "listing_expiring",
      data: {
        sellerName: "Seller",
        comicTitle: "X-Men",
        issueNumber: "1",
        price: 25,
        listingUrl: "https://x/l",
      },
      subjectIncludes: "expires soon",
    },
    {
      type: "message_received",
      data: {
        senderName: "Sender",
        messagePreview: "hi there",
        messagesUrl: "https://x/m",
      },
      subjectIncludes: "New message from Sender",
    },
    {
      type: "welcome",
      data: { collectionUrl: "https://x/c" },
      subjectIncludes: "Welcome to Collectors Chest!",
    },
    {
      type: "auction_won",
      data: {
        recipientName: "Winner",
        comicTitle: "Daredevil",
        issueNumber: "1",
        finalPrice: 200,
        listingUrl: "https://x/l",
      },
      subjectIncludes: "Congratulations, you won",
    },
    {
      type: "second_chance_available",
      data: {
        recipientName: "Seller",
        comicTitle: "Thor",
        issueNumber: "337",
        runnerUpLastBid: 75,
        offerUrl: "https://x/o",
      },
      subjectIncludes: "offer to runner-up",
    },
    {
      type: "subscription_payment_failed",
      data: { manageBillingUrl: "https://x/b" },
      subjectIncludes: "your Premium payment didn't go through",
    },
    {
      type: "bonus_scan_verify",
      data: { verifyUrl: "https://x/v" },
      subjectIncludes: "Verify your email for 5 bonus scans",
    },
    {
      type: "bonus_scan_granted",
      data: { scanUrl: "https://x/s", signUpUrl: "https://x/u" },
      subjectIncludes: "You unlocked 5 bonus scans!",
    },
  ];

  it.each(cases)(
    "$type resolves to a template with subject containing %p",
    async ({ type, data, subjectIncludes }) => {
      const result = await sendNotificationEmail({ to: "test@example.com", type, data });
      expect(result.success).toBe(true);
      expect(getMockSend()).toHaveBeenCalledTimes(1);
      const payload = getMockSend().mock.calls[0][0];
      expect(payload.subject).toContain(subjectIncludes);
      // Every template renders the branded header + footer.
      expect(payload.html).toContain("emblem.png");
      expect(payload.html).toContain("Twisted Jester LLC");
      expect(typeof payload.text).toBe("string");
      expect(payload.text.length).toBeGreaterThan(0);
    }
  );

  it("returns an error for an unknown email type", async () => {
    const result = await sendNotificationEmail({
      to: "test@example.com",
      // @ts-expect-error - intentionally invalid type to hit the default branch
      type: "not_a_real_type",
      data: { collectionUrl: "https://x/c" },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown email type");
    expect(getMockSend()).not.toHaveBeenCalled();
  });
});

describe("representative template render (offer_received)", () => {
  const data = {
    buyerName: "Peter Parker",
    sellerName: "Tony Stark",
    comicTitle: "Iron Man",
    issueNumber: "55",
    amount: 1250.5,
    listingUrl: "https://collectors-chest.com/listing/abc",
  };

  it("renders subject, escaped values, formatted price, and CTA link", async () => {
    await sendNotificationEmail({ to: "test@example.com", type: "offer_received", data });
    const payload = getMockSend().mock.calls[0][0];

    expect(payload.subject).toBe("New offer on Iron Man #55");
    // formatPrice → 2 decimals with leading $
    expect(payload.html).toContain("$1250.50");
    expect(payload.text).toContain("$1250.50");
    // user-controlled names are interpolated
    expect(payload.html).toContain("Peter Parker");
    expect(payload.html).toContain("Iron Man");
    // CTA link present
    expect(payload.html).toContain("https://collectors-chest.com/listing/abc");
    expect(payload.text).toContain("https://collectors-chest.com/listing/abc");
  });

  it("escapes HTML-significant characters in user-supplied fields", async () => {
    await sendNotificationEmail({
      to: "test@example.com",
      type: "offer_received",
      data: { ...data, buyerName: '<script>alert("x")</script>' },
    });
    const payload = getMockSend().mock.calls[0][0];
    expect(payload.html).toContain("&lt;script&gt;");
    expect(payload.html).not.toContain("<script>alert");
  });
});
