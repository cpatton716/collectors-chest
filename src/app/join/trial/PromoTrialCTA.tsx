"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PromoTrialCTA() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  return (
    <button
      onClick={() => {
        setLoading(true);
        router.push("/sign-up");
      }}
      disabled={loading}
      className="block w-full bg-pop-red hover:bg-red-600 active:bg-red-700 text-pop-white font-comic text-xl py-4 px-6 border-3 border-pop-black shadow-comic-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all uppercase tracking-wide disabled:opacity-70"
    >
      {loading ? "Loading..." : "Start Your Free Trial"}
    </button>
  );
}
