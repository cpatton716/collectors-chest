"use client";

import { useEffect, useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { getAlertBadgeColor } from "@/lib/alertBadgeHelpers";

interface AdminAlertBadgeProps {
  variant: "dot" | "count";
}

interface AlertStatus {
  alertCount: number;
  alertLevel: "ok" | "warning" | "critical";
}

export default function AdminAlertBadge({ variant }: AdminAlertBadgeProps) {
  const { isAdmin } = useSubscription();
  const [status, setStatus] = useState<AlertStatus | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    async function loadAlertStatus() {
      try {
        const res = await fetch("/api/admin/usage/alert-status");
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data);
      } catch {
        // Silently ignore fetch errors
      }
    }

    loadAlertStatus();
    const interval = setInterval(loadAlertStatus, 60000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  if (!isAdmin || !status || status.alertLevel === "ok") return null;

  const colorClass = getAlertBadgeColor(status.alertLevel);

  if (variant === "dot") {
    return (
      <span
        className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white ${colorClass}`}
      />
    );
  }

  return (
    <span
      className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white ${colorClass}`}
    >
      {status.alertCount > 9 ? "9+" : status.alertCount}
    </span>
  );
}
