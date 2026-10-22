import type { ReactNode } from "react";

import Link from "next/link";

import { MARKETPLACE_ENABLED, getMissionStatement } from "@/lib/features";
import { buildSellerFeeFaqAnswer } from "@/lib/stripeConnect";

/** FAQ content for Ask the Professor (rendered by Navigation). */
export interface Faq {
  question: string;
  answer: ReactNode;
  /** Hidden while the marketplace is disabled (src/lib/features.ts). */
  marketplaceOnly?: boolean;
  /**
   * Shown instead of `answer` while the marketplace is disabled: the same answer
   * with the buying/selling references removed. `answer` stays the original.
   */
  answerWithoutMarketplace?: ReactNode;
}

export const allFaqs: Faq[] = [
  {
    question: "What is Collectors Chest?",
    answer: getMissionStatement(true),
    answerWithoutMarketplace: getMissionStatement(false),
  },
  {
    question: "Is it free to use?",
    answer:
      "Yes! You can create a free account and access most features including collection tracking, cover scanning (limited scans per month), custom lists, and the marketplace. Premium unlocks unlimited scans, Key Hunt, CSV export, advanced stats, and more.",
    answerWithoutMarketplace:
      "Yes! You can create a free account and access most features including collection tracking, cover scanning (limited scans per month), and custom lists. Premium unlocks unlimited scans, Key Hunt, CSV export, advanced stats, and more.",
  },
  {
    question: "Do I need to create an account?",
    answer:
      "Guests can explore the app and try scanning a comic, but to save your collection, track values, use the marketplace, create lists, and access your data across devices, you'll need a free account.",
    answerWithoutMarketplace:
      "Guests can explore the app and try scanning a comic, but to save your collection, track values, create lists, and access your data across devices, you'll need a free account.",
  },
  {
    question: "How do I add a comic to my collection?",
    answer:
      "Go to 'Scan' and either upload a photo of the cover for technopathic recognition or enter details manually. Review the auto-detected title, issue, creator credits, and price estimate, then click 'Add to Collection'.",
  },
  {
    question: "How does cover scanning work?",
    answer:
      "Upload or take a photo of a comic cover and our technopathy identifies the title, issue number, publisher, creators, key info, and estimated value. It works with raw and slabbed comics, and even detects grading labels on slabs.",
  },
  {
    question: "Any tips for getting the best scan results?",
    answer:
      "Good, even lighting makes a huge difference, so avoid harsh shadows and glare, especially on slabbed books. Photograph the full front cover straight-on (no angles or tilting), keep the camera steady, and make sure the image is in focus. A plain background with nothing distracting behind the book helps the technopathy zero in on the cover.",
  },
  {
    question: "How accurate are the price estimates?",
    answer:
      "Prices are based on current eBay listings and may vary from actual sale prices. For the most accurate values, check recent eBay completed sales.",
  },
  {
    question: "What is Key Hunt?",
    answer:
      "Key Hunt is a quick price lookup tool designed for conventions and comic shops. Scan a cover or manually enter a title and issue to instantly see prices across different grades. Perfect for making quick buying decisions on the go.",
  },
  {
    question: "What does 'Slabbed' mean?",
    answer:
      "A 'slabbed' comic has been professionally graded by a service like CGC, CBCS, or PGX and sealed in a protective case with a grade label. When you check 'Professionally Graded' in your comic details, it's automatically added to your Slabbed list.",
  },
  {
    question: "What grades should I use for my comics?",
    answer:
      "For raw (ungraded) comics, use standard terms: NM (Near Mint), VF (Very Fine), FN (Fine), VG (Very Good), G (Good), FR (Fair), PR (Poor). For slabbed comics, enter the numeric grade from the certification label (e.g., 9.8, 9.6, 9.4).",
  },
  {
    question: "Can I buy and sell comics here?",
    marketplaceOnly: true,
    answer:
      "Yes! The Shop features auctions and fixed-price listings. You can list comics from your collection for sale, bid on auctions, make offers on listings, and complete purchases via secure Stripe checkout.",
  },
  {
    question: "What does it cost me to sell on Collectors Chest?",
    marketplaceOnly: true,
    answer: buildSellerFeeFaqAnswer(),
  },
  {
    question: "What happens after I buy a comic?",
    marketplaceOnly: true,
    answer:
      "After your payment clears, the sale is confirmed and the seller is notified to ship. The comic is added to your collection only once the seller marks it as shipped. This protects you if a seller never ships. Once shipped, both you and the seller can leave feedback on each other. You'll get email + in-app notifications at each step: purchase confirmation, shipped with tracking, and a feedback request.",
  },
  {
    question: "Can I trade comics with other collectors?",
    answer:
      "Yes! Mark comics as 'For Trade' in your collection, then browse the Trade tab in the Shop to find matches. The system suggests trades based on your want list and what other collectors have available.",
    answerWithoutMarketplace:
      "Yes! Mark comics as 'For Trade' in your collection, then browse the Trade page to find matches. The system suggests trades based on your want list and what other collectors have available.",
  },
  {
    question: "How do I message another collector?",
    answer:
      "Click 'Message Seller' on any listing, or visit a collector's profile and send them a direct message. You can share images and discuss deals privately. Messages appear in your inbox under the Messages page.",
    answerWithoutMarketplace:
      "Visit a collector's profile and send them a direct message. You can share images and discuss deals privately. Messages appear in your inbox under the Messages page.",
  },
  {
    question: "How do I mark a comic as sold?",
    answer:
      "Open any comic in your collection, tap 'Mark as Sold', and enter the sale price. It moves to your Sales History where you can track profit and loss across all your sales.",
  },
  {
    question: "Can I import my existing collection?",
    answer:
      "Yes! Go to Collection and use the Import feature. Upload a CSV, JSON, or Excel file from other apps like CLZ Comics, League of Comic Geeks, or your own spreadsheet. Map your columns to our fields and import in bulk.",
  },
  {
    question: "Can I create custom lists?",
    answer:
      "Yes! From your Collection page, create lists to organize comics however you like: by series, want list, favorites, reading order, or any category. Comics can belong to multiple lists.",
  },
  {
    question: "What is Key Info and why does it matter?",
    answer:
      "Key Info highlights significant events in a comic: first appearances, origin stories, deaths, team changes, and more. Key issues are typically worth more than regular issues. We maintain a curated database and you can suggest additions for community review.",
  },
  {
    question: "How do I track my collection's value?",
    answer:
      "Your collection page shows total estimated value, cost basis, and profit/loss. Each comic displays its estimated value, and the Stats page (premium) provides detailed breakdowns by publisher, trends over time, and portfolio analysis.",
  },
  {
    question: "Can I use this on my phone?",
    answer:
      "Absolutely! Collectors Chest is fully mobile-responsive and works as a Progressive Web App. Add it to your home screen from your browser for an app-like experience with quick access to scanning, Key Hunt, and your collection.",
  },
  {
    question: "Is my data safe?",
    answer:
      "Your collection data is stored securely in the cloud and synced across all your devices. We use industry-standard encryption, secure authentication via Clerk, and your payment info is handled entirely by Stripe. We never store credit card details.",
  },
  {
    question: "What happens if I want a refund on a marketplace purchase?",
    marketplaceOnly: true,
    answer:
      "Collectors Chest processes refunds and handles chargeback claims for marketplace purchases. Contact our support team to initiate a refund request. Don't go to your bank or card issuer first. We'll review the claim, coordinate with the seller, and resolve the issue.",
  },
  {
    question: "How does Collectors Chest ensure sellers are legitimate?",
    marketplaceOnly: true,
    answer:
      "We review seller accounts and require Stripe identity verification for all sellers before they can list items. We also prohibit counterfeit goods, stolen property, and unauthorized merchandise. Sellers who violate these rules lose access to the marketplace.",
  },
  {
    question: "Who do I contact if I have a payment problem?",
    marketplaceOnly: true,
    answer:
      "Contact Collectors Chest support first. We provide first-line support for all marketplace payment issues and disputes. We respond within two business days and coordinate directly with our payment processor when needed.",
  },
  {
    question: "What happens if my seller account is restricted or under review?",
    marketplaceOnly: true,
    answer:
      "If your seller account is affected by a risk or fraud review, we'll notify you by email and in-app with the reason and any steps required to resolve it. Responding promptly is the fastest way to restore your account.",
  },
  {
    question:
      "Why might Collectors Chest ask me for additional information after I've signed up as a seller?",
    marketplaceOnly: true,
    answer:
      "Our payment processor occasionally requires updated identity or business information to keep seller accounts in good standing. If we ask for additional info, provide it promptly. If you don't respond in time, your payout access may be temporarily paused.",
  },
  {
    question: "How do I set up my Stripe seller account?",
    marketplaceOnly: true,
    answer: (
      <>
        Before you can list comics for sale, you&apos;ll need to complete a short onboarding flow
        with Stripe, our payment processor. This takes about 5 minutes. See our step-by-step{" "}
        <Link href="/seller-onboarding" className="text-pop-blue underline hover:text-pop-red">
          Seller Onboarding Guide
        </Link>{" "}
        for what to expect and what to have ready.
      </>
    ),
  },
];

/**
 * Pure: the FAQ entries visible for a given marketplace flag value. With the
 * marketplace off, marketplace-only entries are dropped and any
 * `answerWithoutMarketplace` replaces the original answer.
 */
export function getFaqs(marketplaceEnabled: boolean): Faq[] {
  if (marketplaceEnabled) return allFaqs;
  return allFaqs
    .filter((f) => !f.marketplaceOnly)
    .map((f) =>
      f.answerWithoutMarketplace === undefined ? f : { ...f, answer: f.answerWithoutMarketplace }
    );
}

/** FAQ entries shown in the app right now. */
export const faqs: Faq[] = getFaqs(MARKETPLACE_ENABLED);
