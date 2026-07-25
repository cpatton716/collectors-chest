"use client";

import { MapPin } from "lucide-react";

import { LocationPrivacy } from "@/app/api/location/route";

interface LocationBadgeProps {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  privacy: LocationPrivacy;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

/**
 * Displays a user's location respecting their privacy settings
 */
export function LocationBadge({
  city,
  state,
  country,
  privacy,
  className = "",
  showIcon = true,
  size = "sm",
}: LocationBadgeProps) {
  // If hidden or no location data, don't render
  if (privacy === "hidden") return null;
  if (!city && !state && !country) return null;

  // Build display string based on privacy level
  let displayParts: string[] = [];

  switch (privacy) {
    case "full":
      if (city) displayParts.push(city);
      if (state) displayParts.push(state);
      if (country) displayParts.push(country);
      break;
    case "state_country":
      if (state) displayParts.push(state);
      if (country) displayParts.push(country);
      break;
    case "country_only":
      if (country) displayParts.push(country);
      break;
  }

  // If nothing to display after filtering, return null
  if (displayParts.length === 0) return null;

  const displayText = displayParts.join(", ");
  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1 text-gray-500 ${textSize} ${className}`}
      title={displayText}
    >
      {showIcon && <MapPin className={`${iconSize} flex-shrink-0`} />}
      <span className="truncate">{displayText}</span>
    </span>
  );
}
