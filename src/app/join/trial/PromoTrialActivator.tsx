"use client";
import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { setPromoTrialFlag } from "@/lib/promoTrial";

export default function PromoTrialActivator() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setPromoTrialFlag();
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/choose-plan");
    }
  }, [isLoaded, isSignedIn, router]);

  return null;
}
