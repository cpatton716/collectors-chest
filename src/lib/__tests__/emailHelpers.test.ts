/**
 * @jest-environment node
 */

// Mock Resend before importing
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    },
  })),
}));

// Set required env vars before importing
process.env.RESEND_API_KEY = "test-key";
process.env.NEXT_PUBLIC_APP_URL = "https://collectors-chest.com";

import { sendNotificationEmail } from "../email";

function getMockSend() {
  const { Resend } = require("resend");
  return Resend.mock.results[0].value.emails.send;
}

describe("emailHeader / emailFooter helpers", () => {
  describe("welcome email", () => {
    beforeEach(() => getMockSend().mockClear());

    it('contains "POW!" sound effect in header', async () => {
      await sendNotificationEmail({
        to: "test@example.com",
        type: "welcome",
        data: { collectionUrl: "https://collectors-chest.com/collection" },
      });
      const html = getMockSend().mock.calls[0][0].html;
      expect(html).toContain("POW!");
    });

    it('contains "COLLECTORS CHEST" badge in header', async () => {
      await sendNotificationEmail({
        to: "test@example.com",
        type: "welcome",
        data: { collectionUrl: "https://collectors-chest.com/collection" },
      });
      const html = getMockSend().mock.calls[0][0].html;
      expect(html).toContain("COLLECTORS CHEST");
    });

    it("uses #0066FF blue header background", async () => {
      await sendNotificationEmail({
        to: "test@example.com",
        type: "welcome",
        data: { collectionUrl: "https://collectors-chest.com/collection" },
      });
      const html = getMockSend().mock.calls[0][0].html;
      expect(html).toContain("#0066FF");
    });
  });

  describe("feedback reminder email", () => {
    const feedbackData = {
      recipientName: "Chris",
      otherPartyName: "Bob",
      transactionType: "sale" as const,
      comicTitle: "Amazing Spider-Man",
      issueNumber: "300",
      feedbackUrl: "https://collectors-chest.com/feedback/123",
    };

    beforeEach(() => getMockSend().mockClear());

    it('contains "PSST!" sound effect', async () => {
      await sendNotificationEmail({
        to: "test@example.com",
        type: "feedback_reminder",
        data: feedbackData,
      });
      const html = getMockSend().mock.calls[0][0].html;
      expect(html).toContain("PSST!");
    });

    it('contains "COLLECTORS CHEST" badge', async () => {
      await sendNotificationEmail({
        to: "test@example.com",
        type: "feedback_reminder",
        data: feedbackData,
      });
      const html = getMockSend().mock.calls[0][0].html;
      expect(html).toContain("COLLECTORS CHEST");
    });
  });

  describe("shared footer", () => {
    const sharedFooterTests = [
      {
        label: "welcome email",
        type: "welcome" as const,
        data: { collectionUrl: "https://collectors-chest.com/collection" },
      },
      {
        label: "feedback reminder email",
        type: "feedback_reminder" as const,
        data: {
          recipientName: "Chris",
          otherPartyName: "Bob",
          transactionType: "sale" as const,
          comicTitle: "Amazing Spider-Man",
          issueNumber: "300",
          feedbackUrl: "https://collectors-chest.com/feedback/123",
        },
      },
    ];

    for (const { label, type, data } of sharedFooterTests) {
      describe(label, () => {
        beforeEach(() => getMockSend().mockClear());

        it('contains tagline "Scan comics. Track value. Collect smarter."', async () => {
          await sendNotificationEmail({ to: "test@example.com", type, data });
          const html = getMockSend().mock.calls[0][0].html;
          expect(html).toContain("Scan comics. Track value. Collect smarter.");
        });

        it('contains "Twisted Jester LLC"', async () => {
          await sendNotificationEmail({ to: "test@example.com", type, data });
          const html = getMockSend().mock.calls[0][0].html;
          expect(html).toContain("Twisted Jester LLC");
        });

        it("contains privacy policy link", async () => {
          await sendNotificationEmail({ to: "test@example.com", type, data });
          const html = getMockSend().mock.calls[0][0].html;
          expect(html).toContain("Privacy Policy");
          expect(html).toContain("/privacy");
        });

        it("contains terms of service link", async () => {
          await sendNotificationEmail({ to: "test@example.com", type, data });
          const html = getMockSend().mock.calls[0][0].html;
          expect(html).toContain("Terms of Service");
          expect(html).toContain("/terms");
        });
      });
    }
  });
});
