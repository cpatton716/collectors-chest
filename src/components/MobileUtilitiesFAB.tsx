"use client";

import { useEffect, useState } from "react";

import { usePathname, useRouter } from "next/navigation";

import { Plus } from "lucide-react";

export function MobileUtilitiesFAB() {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  // Only show on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Don't show on scan page (already there) or key-hunt page
  if (!isMobile || pathname === "/scan" || pathname === "/key-hunt") {
    return null;
  }

  const handleScan = () => {
    router.push("/scan");
  };

  return (
    <button
      onClick={handleScan}
      className="fixed bottom-24 right-8 z-40 w-14 h-14 bg-pop-blue hover:bg-pop-blueDark rounded-full border-3 border-pop-black shadow-comic flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
      aria-label="Add comic"
    >
      <Plus className="w-7 h-7 text-pop-white" />
    </button>
  );
}
