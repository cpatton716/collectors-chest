"use client";

import { useState } from "react";

import { Brain, ChevronDown, ChevronUp, X } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "What is Collectors Chest?",
    answer:
      "Collectors Chest is an all-in-one comic book collection manager. Scan covers with AI recognition, track your collection's value, discover key issues, buy and sell in the marketplace, and connect with fellow collectors.",
  },
  {
    question: "Is it free to use?",
    answer:
      "Yes! You can create a free account and access most features including collection tracking, cover scanning (limited scans per month), custom lists, and the marketplace. Premium unlocks unlimited scans, Key Hunt, CSV export, advanced stats, and more.",
  },
  {
    question: "Do I need to create an account?",
    answer:
      "Guests can explore the app and try scanning a comic, but to save your collection, track values, use the marketplace, create lists, and access your data across devices, you'll need a free account.",
  },
  {
    question: "How do I add a comic to my collection?",
    answer:
      "Go to 'Scan' and either upload a photo of the cover for AI recognition or enter details manually. Review the auto-detected title, issue, creator credits, and price estimate, then click 'Add to Collection'.",
  },
  {
    question: "How does cover scanning work?",
    answer:
      "Upload or take a photo of a comic cover and our AI identifies the title, issue number, publisher, creators, key info, and estimated value. It works with raw and slabbed comics, and even detects grading labels on slabs.",
  },
  {
    question: "How accurate are the price estimates?",
    answer:
      "Prices are AI estimates based on recent market trends and eBay sold listings. They provide a solid guideline but actual prices vary based on condition, demand, and where you sell. For the most accurate values, check recent eBay completed sales.",
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
    answer:
      "Yes! The Shop features auctions and fixed-price listings. You can list comics from your collection for sale, bid on auctions, make offers on listings, and complete purchases via secure Stripe checkout.",
  },
  {
    question: "Can I trade comics with other collectors?",
    answer:
      "Yes! Mark comics as 'For Trade' in your collection, then browse the Trade tab in the Shop to find matches. The system suggests trades based on your want list and what other collectors have available.",
  },
  {
    question: "How do I message another collector?",
    answer:
      "Click 'Message Seller' on any listing, or visit a collector's profile and send them a direct message. You can share images and discuss deals privately. Messages appear in your inbox under the Messages page.",
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
      "Yes! From your Collection page, create lists to organize comics however you like — by series, want list, favorites, reading order, or any category. Comics can belong to multiple lists.",
  },
  {
    question: "What is the Hottest Books feature?",
    answer:
      "Professor's Hottest Books is a weekly market analysis showing the top trending comics based on recent sales activity. It includes key facts about each book, why it's hot, and current price ranges to help you spot opportunities.",
  },
  {
    question: "What is Key Info and why does it matter?",
    answer:
      "Key Info highlights significant events in a comic — first appearances, origin stories, deaths, team changes, and more. Key issues are typically worth more than regular issues. We maintain a curated database and you can suggest additions for community review.",
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
      "Your collection data is stored securely in the cloud and synced across all your devices. We use industry-standard encryption, secure authentication via Clerk, and your payment info is handled entirely by Stripe — we never store credit card details.",
  },
];

export default function AskProfessor() {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 md:bottom-6 right-6 z-40 group"
        aria-label="Ask the Professor"
      >
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-yellow-400 rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity animate-pulse" />
          {/* Button */}
          <div className="relative w-14 h-14 bg-gradient-to-br from-blue-700 to-blue-900 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 ring-2 ring-yellow-400">
            <Brain className="w-7 h-7 text-yellow-400" />
          </div>
          {/* Floating ring animation */}
          <div className="absolute inset-0 rounded-full border-2 border-yellow-400 animate-ping opacity-20" />
        </div>
        {/* Tooltip */}
        <span className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-blue-900 text-yellow-400 text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-medium">
          Ask the Professor
        </span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Content */}
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-700 to-blue-900 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-400/20 rounded-xl">
                    <Brain className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-yellow-400">Ask the Professor</h2>
                    <p className="text-blue-200 text-sm">Your guide to Collectors Chest</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-yellow-400/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-yellow-400" />
                </button>
              </div>
            </div>

            {/* FAQ List */}
            <div className="overflow-y-auto max-h-[calc(80vh-120px)] p-4">
              <p className="text-gray-600 text-sm mb-4">
                Welcome, collector! Here are answers to commonly asked questions. Can&apos;t find
                what you need? We&apos;re always adding more.
              </p>
              <div className="space-y-2">
                {faqs.map((faq, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleFAQ(index)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-medium text-gray-900 pr-4 font-sans normal-case">{faq.question}</span>
                      {expandedIndex === index ? (
                        <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      )}
                    </button>
                    {expandedIndex === index && (
                      <div className="px-4 pb-4 text-gray-600 text-sm border-t border-gray-100 pt-3">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
