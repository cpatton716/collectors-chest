import { allFaqs, faqs, getFaqs } from "../faqData";

const SELLER_FEE_Q = "What does it cost me to sell on Collectors Chest?";

describe("faqData", () => {
  it("shown FAQs have no seller-fee or other marketplace-only entry while the marketplace is off", () => {
    expect(faqs.some((f) => f.question === SELLER_FEE_Q)).toBe(false);
    expect(faqs.some((f) => f.marketplaceOnly)).toBe(false);
  });

  it("getFaqs(false) drops every marketplace-only entry but keeps the rest", () => {
    const visible = getFaqs(false);
    expect(visible).toHaveLength(allFaqs.filter((f) => !f.marketplaceOnly).length);
    expect(visible.some((f) => f.question === "Can I trade comics with other collectors?")).toBe(
      true
    );
    expect(visible.some((f) => f.question === "How do I mark a comic as sold?")).toBe(true);
  });

  it("getFaqs(true) restores the full list including the seller-fee entry", () => {
    const all = getFaqs(true);
    expect(all).toBe(allFaqs);
    expect(all.some((f) => f.question === SELLER_FEE_Q)).toBe(true);
  });

  it("getFaqs(false) swaps in marketplace-free answers with no buy/sell/marketplace wording", () => {
    const visible = getFaqs(false);
    for (const f of visible) {
      if (typeof f.answer === "string") {
        expect(f.answer).not.toMatch(/marketplace|\bShop\b|Message Seller|\bbuy, sell\b/i);
      }
    }
    const what = visible.find((f) => f.question === "What is Collectors Chest?");
    expect(what?.answer).toContain("organize with pride, and trade with confidence.");
    const trade = visible.find((f) => f.question === "Can I trade comics with other collectors?");
    expect(trade?.answer).toContain("browse the Trade page");
  });

  it("getFaqs(true) keeps every original answer (marketplace wording restored)", () => {
    const all = getFaqs(true);
    const what = all.find((f) => f.question === "What is Collectors Chest?");
    expect(what?.answer).toContain("buy, sell, and trade with confidence.");
    const free = all.find((f) => f.question === "Is it free to use?");
    expect(free?.answer).toContain("and the marketplace");
    const msg = all.find((f) => f.question === "How do I message another collector?");
    expect(msg?.answer).toContain("Message Seller");
  });

  it("every entry with an off-version is not marketplace-only (off-versions must be reachable)", () => {
    for (const f of allFaqs) {
      if (f.answerWithoutMarketplace !== undefined) expect(f.marketplaceOnly).toBeFalsy();
    }
  });
});
