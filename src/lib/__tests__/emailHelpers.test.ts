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

describe("trialExpiringTemplate", () => {
  const trialData = { trialEndsAt: "April 4, 2026" };

  beforeEach(() => getMockSend().mockClear());

  it('sends with subject "Your Collectors Chest trial ends in 3 days"', async () => {
    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: trialData,
    });
    const subject = getMockSend().mock.calls[0][0].subject;
    expect(subject).toBe("Your Collectors Chest trial ends in 3 days");
  });

  it("HTML contains logo image in header", async () => {
    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: trialData,
    });
    const html = getMockSend().mock.calls[0][0].html;
    expect(html).toContain("emblem.png");
  });

  it("HTML contains the trial end date", async () => {
    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: trialData,
    });
    const html = getMockSend().mock.calls[0][0].html;
    expect(html).toContain("April 4, 2026");
  });

  it('HTML contains "Unlimited scans"', async () => {
    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: trialData,
    });
    const html = getMockSend().mock.calls[0][0].html;
    expect(html).toContain("Unlimited scans");
  });

  it('HTML contains "Key Hunt"', async () => {
    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: trialData,
    });
    const html = getMockSend().mock.calls[0][0].html;
    expect(html).toContain("Key Hunt");
  });

  it('HTML contains "CSV export"', async () => {
    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: trialData,
    });
    const html = getMockSend().mock.calls[0][0].html;
    expect(html).toContain("CSV export");
  });

  it('HTML contains "$4.99/month"', async () => {
    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: trialData,
    });
    const html = getMockSend().mock.calls[0][0].html;
    expect(html).toContain("$4.99/month");
  });

  it('HTML contains "Save 17%"', async () => {
    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: trialData,
    });
    const html = getMockSend().mock.calls[0][0].html;
    expect(html).toContain("Save 17%");
  });

  it('HTML contains "STAY PREMIUM" CTA text', async () => {
    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: trialData,
    });
    const html = getMockSend().mock.calls[0][0].html;
    expect(html).toContain("STAY PREMIUM");
  });

  it('HTML contains "/choose-plan" link', async () => {
    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: trialData,
    });
    const html = getMockSend().mock.calls[0][0].html;
    expect(html).toContain("/choose-plan");
  });

  it("CTA button uses blue (#0066FF), not red", async () => {
    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: trialData,
    });
    const html = getMockSend().mock.calls[0][0].html;
    // CTA link must contain blue color
    expect(html).toMatch(/choose-plan[^"]*"[^>]*#0066FF|#0066FF[^>]*choose-plan/i);
    // Should not use red (#ED1C24) on the CTA button itself
    const ctaSection = html.match(/STAY PREMIUM[\s\S]{0,200}/)?.[0] ?? "";
    expect(ctaSection).not.toContain("#ED1C24");
  });

  it("plain text version contains key content", async () => {
    await sendNotificationEmail({
      to: "test@example.com",
      type: "trial_expiring",
      data: trialData,
    });
    const text = getMockSend().mock.calls[0][0].text;
    expect(text).toContain("April 4, 2026");
    expect(text).toContain("$4.99/month");
    expect(text).toContain("/choose-plan");
    expect(text).toContain("STAY PREMIUM");
  });
});

describe("emailHeader / emailFooter helpers", () => {
  describe("welcome email", () => {
    beforeEach(() => getMockSend().mockClear());

    it("contains logo image in header", async () => {
      await sendNotificationEmail({
        to: "test@example.com",
        type: "welcome",
        data: { collectionUrl: "https://collectors-chest.com/collection" },
      });
      const html = getMockSend().mock.calls[0][0].html;
      expect(html).toContain("emblem.png");
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

    it("contains logo image in header", async () => {
      await sendNotificationEmail({
        to: "test@example.com",
        type: "feedback_reminder",
        data: feedbackData,
      });
      const html = getMockSend().mock.calls[0][0].html;
      expect(html).toContain("emblem.png");
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
