import type { Metadata } from "next";

import Link from "next/link";

import { BookOpen, Camera, Mail, Search, ShoppingBag, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "About | Collectors Chest",
  description:
    "Learn about Collectors Chest — the all-in-one platform for comic collectors to scan covers, track value, and connect with other collectors.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1
            className="font-comic text-4xl md:text-5xl text-pop-yellow tracking-wide mb-6"
            style={{
              WebkitTextStroke: "2px black",
              paintOrder: "stroke fill",
              textShadow: "3px 3px 0px #000",
            }}
          >
            ABOUT COLLECTORS CHEST
          </h1>
          <div className="speech-bubble max-w-2xl mx-auto">
            <p className="text-lg font-body text-pop-black">
              Scan any cover. Track every book. Find your people. Collectors Chest is the all-in-one
              platform that helps comic collectors discover value, organize with pride, and buy,
              sell, and trade with confidence.
            </p>
          </div>
        </div>

        {/* Our Story */}
        <div className="mb-16">
          <div className="bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-8 relative overflow-hidden">
            {/* Ben-day dots accent in corner */}
            <div className="absolute top-0 right-0 w-24 h-24 dots-red opacity-30 pointer-events-none" />

            <h2
              className="font-comic text-2xl md:text-3xl text-pop-yellow mb-6"
              style={{
                WebkitTextStroke: "2px black",
                paintOrder: "stroke fill",
                textShadow: "3px 3px 0px #000",
              }}
            >
              OUR STORY
            </h2>
            <p className="font-body text-pop-black/80 text-lg leading-relaxed">
              Every great collection starts with a single issue.{" "}
              <span className="text-pop-red font-bold">
                [Your origin story here — how Collectors Chest came to be, what problem you set out
                to solve, and why you&apos;re passionate about comics.]
              </span>
            </p>
          </div>
        </div>

        {/* What We Offer */}
        <div className="mb-16">
          <h2
            className="font-comic text-2xl md:text-3xl text-pop-yellow text-center mb-8"
            style={{
              WebkitTextStroke: "2px black",
              paintOrder: "stroke fill",
              textShadow: "3px 3px 0px #000",
            }}
          >
            WHAT WE OFFER!
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* AI Cover Scanning */}
            <div className="bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-20 h-20 dots-red opacity-25 pointer-events-none" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-pop-red border-3 border-pop-black shadow-comic-sm flex items-center justify-center flex-shrink-0">
                  <Camera className="w-7 h-7 text-pop-white" />
                </div>
                <h3 className="font-comic text-lg text-pop-black">AI COVER SCANNING</h3>
              </div>
              <p className="font-body text-pop-black/80">
                Snap a photo of any comic cover and instantly identify it, get current values, and
                add it to your collection.
              </p>
            </div>

            {/* Collection Management */}
            <div className="bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-pop-blue border-3 border-pop-black shadow-comic-sm flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-7 h-7 text-pop-white" />
                </div>
                <h3 className="font-comic text-lg text-pop-black">COLLECTION MANAGEMENT</h3>
              </div>
              <p className="font-body text-pop-black/80">
                Organize your entire collection with real-time value tracking, grading details, and
                investment insights.
              </p>
            </div>

            {/* Key Issue Discovery */}
            <div className="bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-6 relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-20 h-20 dots-blue opacity-25 pointer-events-none" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-pop-yellow border-3 border-pop-black shadow-comic-sm flex items-center justify-center flex-shrink-0">
                  <Search className="w-7 h-7 text-pop-black" />
                </div>
                <h3 className="font-comic text-lg text-pop-black">KEY ISSUE DISCOVERY</h3>
              </div>
              <p className="font-body text-pop-black/80">
                Discover which comics in your collection are valuable key issues with our curated
                database.
              </p>
            </div>

            {/* Collector Marketplace */}
            <div className="bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 dots-red opacity-20 pointer-events-none" />
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 bg-pop-green border-3 border-pop-black shadow-comic-sm flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-7 h-7 text-pop-white" />
                </div>
                <h3 className="font-comic text-lg text-pop-black">COLLECTOR MARKETPLACE</h3>
              </div>
              <p className="font-body text-pop-black/80">
                Buy, sell, and trade with confidence in a community built by collectors, for
                collectors.
              </p>
            </div>
          </div>
        </div>

        {/* Meet the Team */}
        <div className="mb-16">
          <h2
            className="font-comic text-2xl md:text-3xl text-pop-yellow text-center mb-8"
            style={{
              WebkitTextStroke: "2px black",
              paintOrder: "stroke fill",
              textShadow: "3px 3px 0px #000",
            }}
          >
            MEET THE TEAM!
          </h2>

          <div className="bg-pop-white border-4 border-pop-black shadow-[6px_6px_0px_#000] p-8 text-center relative">
            <div className="absolute bottom-0 left-0 w-32 h-32 dots-blue opacity-20 pointer-events-none" />

            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 bg-pop-blue border-3 border-pop-black shadow-comic-sm flex items-center justify-center">
                <Users className="w-6 h-6 text-pop-white" />
              </div>
            </div>
            <p className="font-body text-pop-red font-bold text-lg">
              [Team member cards will go here — photo, name, role, short bio]
            </p>
          </div>
        </div>

        {/* Contact / Connect */}
        <div className="mb-16">
          <div className="bg-pop-blue border-4 border-pop-black shadow-[6px_6px_0px_#000] p-8 text-center">
            <h2 className="font-comic text-2xl md:text-3xl text-pop-yellow mb-4">
              GET IN TOUCH!
            </h2>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 bg-pop-red border-3 border-pop-black shadow-comic-sm flex items-center justify-center">
                <Mail className="w-6 h-6 text-pop-white" />
              </div>
            </div>
            <p className="font-body text-pop-white/90 text-lg mb-6">
              Have questions or feedback? We&apos;d love to hear from you. [Contact info / social
              links]
            </p>
            <Link href="/" className="btn-pop btn-pop-yellow">
              BACK TO HOME
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
