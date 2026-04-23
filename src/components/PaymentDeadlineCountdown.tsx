"use client";

import { useEffect, useState } from "react";

interface PaymentDeadlineCountdownProps {
  /** ISO string or Date representing the payment deadline. */
  deadline: string | Date | null;
  /** Text to render when the deadline has passed. Defaults to "Expired". */
  expiredLabel?: string;
  /** Caller-supplied layout/sizing classes. */
  className?: string;
}

interface Remaining {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
}

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const SIX_HOURS_MS = 6 * ONE_HOUR_MS;

function computeRemaining(deadline: Date): Remaining {
  const totalMs = deadline.getTime() - Date.now();
  if (totalMs <= 0) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0 };
  }
  const days = Math.floor(totalMs / ONE_DAY_MS);
  const hours = Math.floor((totalMs % ONE_DAY_MS) / ONE_HOUR_MS);
  // Round up remaining minutes so we never show "0m" while time still remains.
  const minutes = Math.max(1, Math.ceil((totalMs % ONE_HOUR_MS) / ONE_MINUTE_MS));
  return { totalMs, days, hours, minutes };
}

function formatRemaining(r: Remaining): string {
  if (r.totalMs >= ONE_DAY_MS) {
    return `Pay within ${r.days}d ${r.hours}h`;
  }
  if (r.totalMs >= ONE_HOUR_MS) {
    return `Pay within ${r.hours}h ${r.minutes}m`;
  }
  return `Pay within ${r.minutes}m`;
}

/**
 * Live-updating countdown to a payment deadline. Uses a 60s interval,
 * and defers first render of the actual countdown to the client via
 * `useEffect` to avoid hydration mismatches from server/client clock skew.
 *
 * Returns `null` when `deadline` is missing.
 */
export default function PaymentDeadlineCountdown({
  deadline,
  expiredLabel = "Expired",
  className,
}: PaymentDeadlineCountdownProps) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    if (!deadline) return;
    const deadlineDate = deadline instanceof Date ? deadline : new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime())) return;

    // Compute once immediately on mount so the user sees the countdown
    // right away rather than waiting for the first interval tick.
    setRemaining(computeRemaining(deadlineDate));

    const interval = setInterval(() => {
      setRemaining(computeRemaining(deadlineDate));
    }, ONE_MINUTE_MS);

    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  // Hydration-safe: on the server and on the initial client render we
  // render an invisible placeholder so the markup matches. The
  // useEffect above then swaps in the real countdown on the client.
  if (remaining === null) {
    return (
      <span
        className={className}
        aria-hidden="true"
        suppressHydrationWarning
        style={{ visibility: "hidden" }}
      >
        Pay within --
      </span>
    );
  }

  if (remaining.totalMs <= 0) {
    return (
      <span
        className={`font-semibold text-pop-red ${className ?? ""}`.trim()}
        suppressHydrationWarning
      >
        {expiredLabel}
      </span>
    );
  }

  let colorClass = "text-pop-black";
  if (remaining.totalMs <= SIX_HOURS_MS) {
    colorClass = "text-pop-red";
  } else if (remaining.totalMs <= ONE_DAY_MS) {
    colorClass = "text-pop-orange";
  }

  return (
    <span
      className={`font-semibold ${colorClass} ${className ?? ""}`.trim()}
      suppressHydrationWarning
    >
      {formatRemaining(remaining)}
    </span>
  );
}
