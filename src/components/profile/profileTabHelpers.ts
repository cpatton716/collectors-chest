// Shared helpers + types for the Account Settings profile tabs.
// Extracted verbatim from CustomProfilePage during the M-FE13 decomposition so
// the tab components can be code-split via next/dynamic. No logic changes.

// Tab types
export type TabId = "profile" | "security" | "billing";

export interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

// Username availability state
export interface UsernameAvailability {
  available: boolean;
  error?: string;
  display?: string;
}

// Connect status state
export interface ConnectStatus {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  completedSales: number;
}

// Session shape used by the Security tab's active-sessions list.
export interface ProfileSession {
  id: string;
  device: string;
  browser: string;
  lastActive: Date;
  isCurrent: boolean;
}

// Target square dimension (px) for uploaded avatars. Clerk renders avatars at
// small sizes, so anything larger than this is wasted bytes. (L-SO10)
export const AVATAR_TARGET_SIZE = 256;
export const AVATAR_JPEG_QUALITY = 0.85;

/**
 * Downscale + center-crop an image file to a square AVATAR_TARGET_SIZE canvas
 * and re-encode as JPEG before upload. Falls back to the original file if the
 * browser canvas pipeline is unavailable or the image fails to decode. (L-SO10)
 */
export async function downscaleAvatar(file: File): Promise<File> {
  try {
    const bitmapUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = bitmapUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_TARGET_SIZE;
      canvas.height = AVATAR_TARGET_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;

      // Center-crop to a square, then scale into the target canvas.
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_TARGET_SIZE, AVATAR_TARGET_SIZE);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", AVATAR_JPEG_QUALITY)
      );
      if (!blob) return file;

      const name = file.name.replace(/\.[^.]+$/, "") || "avatar";
      return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
    } finally {
      URL.revokeObjectURL(bitmapUrl);
    }
  } catch (error) {
    console.error("Avatar downscale failed, uploading original:", error);
    return file;
  }
}

/**
 * Billing date formatter shared by the Billing tab. Returns "" for a null date.
 * Extracted verbatim from CustomProfilePage (M-FE13).
 */
export const formatBillingDate = (date: Date | null): string => {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};
