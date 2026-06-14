"use client";

import { useEffect, useState } from "react";

import { Clock } from "lucide-react";

import { calculateTimeRemaining } from "@/types/auction";

interface AuctionCountdownProps {
  endTime: string;
  onEnd?: () => void;
  size?: "sm" | "md" | "lg";
}

export function AuctionCountdown({ endTime, onEnd, size = "md" }: AuctionCountdownProps) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeRemaining(endTime));

  useEffect(() => {
    // Adaptive tick rate: only auctions inside the final hour need a 1s tick
    // for the seconds display. Non-urgent countdowns (>1h) tick once a minute,
    // cutting needless re-renders by ~60x on Shop/Watchlist grids. L-FE25.
    let timer: ReturnType<typeof setInterval>;

    const schedule = () => {
      const initial = calculateTimeRemaining(endTime);
      const intervalMs = initial.isEndingSoon ? 1000 : 60_000;
      timer = setInterval(() => {
        const newTimeLeft = calculateTimeRemaining(endTime);
        setTimeLeft(newTimeLeft);

        if (newTimeLeft.isEnded) {
          clearInterval(timer);
          onEnd?.();
          return;
        }

        // Crossed into the final hour while ticking slowly — re-arm at 1s.
        if (newTimeLeft.isEndingSoon && intervalMs !== 1000) {
          clearInterval(timer);
          schedule();
        }
      }, intervalMs);
    };

    schedule();

    return () => clearInterval(timer);
  }, [endTime, onEnd]);

  if (timeLeft.isEnded) {
    return (
      <div
        className={`flex items-center gap-1 text-gray-500 ${
          size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm"
        }`}
      >
        <Clock className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
        <span>Ended</span>
      </div>
    );
  }

  const urgencyClass = timeLeft.isUrgent
    ? "text-red-600 animate-pulse"
    : timeLeft.isEndingSoon
      ? "text-orange-600"
      : "text-gray-700";

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base font-semibold",
  };

  // Format the time display
  let displayText = "";
  if (timeLeft.days > 0) {
    displayText = `${timeLeft.days}d ${timeLeft.hours}h`;
  } else if (timeLeft.hours > 0) {
    displayText = `${timeLeft.hours}h ${timeLeft.minutes}m`;
  } else if (timeLeft.minutes > 0) {
    displayText = `${timeLeft.minutes}m ${timeLeft.seconds}s`;
  } else {
    displayText = `${timeLeft.seconds}s`;
  }

  return (
    <div className={`flex items-center gap-1 ${urgencyClass} ${sizeClasses[size]}`}>
      <Clock className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      <span>{displayText}</span>
    </div>
  );
}
