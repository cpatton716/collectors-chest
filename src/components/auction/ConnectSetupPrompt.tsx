"use client";

import { useState } from "react";
import { CreditCard, ArrowRight, ShieldCheck } from "lucide-react";

export default function ConnectSetupPrompt({
  onClose,
}: {
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/connect/create-account", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.alreadyComplete) {
        onClose();
        window.location.reload();
      }
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-pop-white border-3 border-pop-black shadow-[6px_6px_0px_#000] rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="bg-pop-blue border-b-3 border-pop-black p-4 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-comic text-xl text-white">SET UP SELLER PAYMENTS</h2>
              <p className="text-white/80 text-sm">One-time setup to start selling</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-pop-black font-body">
            Before you can list items for sale, you need to connect a bank account
            so you can receive payments from buyers.
          </p>

          <div className="bg-pop-yellow/20 border-2 border-pop-black rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-pop-blue" />
              <span className="font-comic text-sm">SECURE & SIMPLE</span>
            </div>
            <ul className="text-sm font-body space-y-1 ml-7">
              <li>Powered by Stripe — trusted by millions</li>
              <li>Link your bank account or debit card</li>
              <li>Get paid automatically when items sell</li>
              <li>Takes about 5 minutes</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t-3 border-pop-black flex gap-3">
          <button
            onClick={onClose}
            className="btn-pop btn-pop-white flex-1 py-2 text-sm font-comic"
          >
            CANCEL
          </button>
          <button
            onClick={handleSetup}
            disabled={loading}
            className="btn-pop btn-pop-green flex-1 py-2 text-sm font-comic flex items-center justify-center gap-2"
          >
            {loading ? "CONNECTING..." : "SET UP PAYMENTS"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
