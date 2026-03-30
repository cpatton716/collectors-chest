import { SignUp } from "@clerk/nextjs";

import { Camera, Check, DollarSign, LineChart, Tag } from "lucide-react";

import { ChestIcon } from "@/components/icons/ChestIcon";

export default function SignUpPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 py-12">
      <div className="flex flex-col lg:flex-row gap-10 max-w-4xl w-full items-center lg:items-start">
        {/* Left side — branding + benefits */}
        <div className="w-full lg:w-[380px] shrink-0">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <ChestIcon size={72} />
            <h1 className="font-comic text-2xl text-pop-black tracking-wide">
              COLLECTORS CHEST
            </h1>
          </div>

          <p className="font-comic text-sm text-pop-black/70 mb-1">
            SCAN COMICS. TRACK VALUE. COLLECT SMARTER.
          </p>

          <p className="font-body text-pop-black/80 text-sm mb-6">
            Scan any cover. Track every book. Find your people. The all-in-one
            platform that helps comic collectors discover value, organize with
            pride, and buy, sell, and trade with confidence.
          </p>

          {/* Benefits panel */}
          <div className="bg-pop-white border-4 border-pop-black shadow-[4px_4px_0px_#000] p-5">
            <h3 className="font-comic text-pop-black text-sm mb-4">
              WHAT YOU&apos;LL GET:
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 bg-pop-red border-2 border-pop-black flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4 text-pop-white" />
                </div>
                <span className="font-body text-sm text-pop-black/90">
                  AI-powered comic cover recognition
                </span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 bg-pop-blue border-2 border-pop-black flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4 text-pop-white" />
                </div>
                <span className="font-body text-sm text-pop-black/90">
                  Real-time price estimates from eBay
                </span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 bg-pop-green border-2 border-pop-black flex items-center justify-center shrink-0">
                  <LineChart className="w-4 h-4 text-pop-white" />
                </div>
                <span className="font-body text-sm text-pop-black/90">
                  Track your collection value over time
                </span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-8 h-8 bg-pop-yellow border-2 border-pop-black flex items-center justify-center shrink-0">
                  <Tag className="w-4 h-4 text-pop-black" />
                </div>
                <span className="font-body text-sm text-pop-black/90">
                  Buy, sell, and auction comics
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right side — Clerk sign-up */}
        <div className="flex justify-center w-full lg:w-auto">
          <SignUp />
        </div>
      </div>
    </div>
  );
}
