"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

import HCaptcha from "@hcaptcha/react-hcaptcha";

const IS_DEV = process.env.NODE_ENV !== "production";

const SITE_KEY = IS_DEV
  ? "10000000-ffff-ffff-ffff-000000000001"
  : (process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? "");

export interface GuestCaptchaHandle {
  /** Trigger invisible CAPTCHA and return token, or null on failure. */
  execute: () => Promise<string | null>;
}

interface GuestCaptchaProps {
  onVerified?: (token: string) => void;
  onError?: (error: string) => void;
}

/**
 * Invisible hCaptcha with floating badge. Host component calls `ref.execute()`
 * to run the challenge; token is returned async.
 *
 * In development, uses hCaptcha's public test keys (always pass). In production,
 * uses the hostname-restricted site key from NEXT_PUBLIC_HCAPTCHA_SITE_KEY.
 */
export const GuestCaptcha = forwardRef<GuestCaptchaHandle, GuestCaptchaProps>(
  function GuestCaptcha({ onVerified, onError }, ref) {
    const widgetRef = useRef<HCaptcha>(null);

    useImperativeHandle(
      ref,
      () => ({
        execute: async () => {
          if (!widgetRef.current) return null;
          try {
            const result = await widgetRef.current.execute({ async: true });
            const token = result?.response ?? null;
            if (token) onVerified?.(token);
            return token;
          } catch {
            onError?.("CAPTCHA failed. Please try again.");
            return null;
          }
        },
      }),
      [onVerified, onError]
    );

    if (!SITE_KEY) {
      return null;
    }

    return <HCaptcha ref={widgetRef} sitekey={SITE_KEY} size="invisible" />;
  }
);
