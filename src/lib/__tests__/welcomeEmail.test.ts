/**
 * @jest-environment node
 */

// We need to test the template function directly, but it's not exported.
// We'll test via sendNotificationEmail with a mocked Resend client.

// Mock Resend before importing
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    },
  })),
}));

// Set required env var before importing
process.env.RESEND_API_KEY = "test-key";
process.env.NEXT_PUBLIC_APP_URL = "https://collectors-chest.com";

import { sendNotificationEmail } from "../email";

describe("welcomeTemplate", () => {
  it("sends welcome email with correct subject", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "welcome",
      data: { collectionUrl: "https://collectors-chest.com/collection" },
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toBe("Welcome to Collectors Chest!");
    expect(call.to).toBe("test@example.com");
  });

  it("includes key content in HTML", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "welcome",
      data: { collectionUrl: "https://collectors-chest.com/collection" },
    });

    const html = mockSend.mock.calls[0][0].html;
    expect(html).toContain("WELCOME TO THE CHEST!");
    expect(html).toContain("emblem.png");
    expect(html).toContain("Hey there, Collector!");
    expect(html).toContain("Scan Any Cover");
    expect(html).toContain("Track Your Value");
    expect(html).toContain("Discover Key Issues");
    expect(html).toContain("Organize Everything");
    expect(html).toContain("10 FREE scans");
    expect(html).toContain("START SCANNING");
    expect(html).toContain("https://collectors-chest.com/collection");
    expect(html).toContain("Twisted Jester LLC");
  });

  it("includes plain text version", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "welcome",
      data: { collectionUrl: "https://collectors-chest.com/collection" },
    });

    const text = mockSend.mock.calls[0][0].text;
    expect(text).toContain("Welcome to Collectors Chest!");
    expect(text).toContain("10 free scans");
    expect(text).toContain("https://collectors-chest.com/collection");
  });

  it("uses blue CTA button, not red", async () => {
    const { Resend } = require("resend");
    const mockSend = Resend.mock.results[0].value.emails.send;
    mockSend.mockClear();

    await sendNotificationEmail({
      to: "test@example.com",
      type: "welcome",
      data: { collectionUrl: "https://collectors-chest.com/collection" },
    });

    const html = mockSend.mock.calls[0][0].html;
    // CTA button should be blue (#0066FF), never red
    expect(html).toContain("background: #0066FF");
    // The START SCANNING link should not use red
    expect(html).not.toMatch(/START SCANNING[\s\S]{0,200}#ED1C24/);
  });
});
