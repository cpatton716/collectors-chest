"use client";

import { useState } from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";

interface AgeVerificationModalProps {
  action: string;
  onVerified: () => void;
  onDismiss: () => void;
}

export default function AgeVerificationModal({
  action,
  onVerified,
  onDismiss,
}: AgeVerificationModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/age-verification", { method: "POST" });
      const data = await res.json();
      if (res.ok && (data.verified || data.alreadyVerified)) {
        onVerified();
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
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
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="font-comic text-xl text-white">AGE VERIFICATION</h3>
              <p className="text-white/80 text-sm">Marketplace requires 18+</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-gray-700">
            To {action}, you must confirm that you are at least <strong>18 years old</strong>.
          </p>

          <div className="bg-gray-50 border-l-4 border-pop-blue rounded-r-md p-3">
            <p className="text-sm text-gray-700 leading-relaxed">
              By confirming, you attest that you are 18 years of age or older, as required by our{" "}
              <a href="/terms" className="text-pop-blue underline hover:no-underline">
                Terms of Service
              </a>
              .
            </p>
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-3 border-pop-black flex gap-3">
          <button
            onClick={onDismiss}
            className="btn-pop btn-pop-white flex-1 py-2 text-sm font-comic"
            disabled={loading}
          >
            NOT NOW
          </button>
          <button
            onClick={handleVerify}
            className="btn-pop btn-pop-green flex-1 py-2 text-sm font-comic flex items-center justify-center gap-2"
            disabled={loading}
          >
            {loading ? "VERIFYING..." : "I CONFIRM I'M 18+"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
