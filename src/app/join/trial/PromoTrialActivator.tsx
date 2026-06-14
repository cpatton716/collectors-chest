"use client";
import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { setPromoTrialFlag, setPromoTrialToken } from "@/lib/promoTrial";

export default function PromoTrialActivator({
  promoTrialToken,
}: {
  /** Server-minted signed token carried into checkout (L-PAY17). */
  promoTrialToken?: string;
}) {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setPromoTrialFlag();
    if (promoTrialToken) setPromoTrialToken(promoTrialToken);
  }, [promoTrialToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/choose-plan");
    }
  }, [isLoaded, isSignedIn, router]);

  return null;
}
