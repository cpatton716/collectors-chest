"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { useUser } from "@clerk/nextjs";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Database,
  DollarSign,
  ExternalLink,
  Loader2,
  RefreshCw,
  Server,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

interface UsageMetric {
  name: string;
  current: number;
  limit: number;
  unit: string;
  percentage: number;
  status: "ok" | "warning" | "critical";
  dashboard?: string;
}

interface UsageData {
  metrics: UsageMetric[];
  errors?: string[];
  overallStatus: "ok" | "warning" | "critical";
  thresholds: { warning: number; critical: number };
  checkedAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatValue(value: number, unit: string): string {
  if (unit === "bytes") return formatBytes(value);
  if (unit === "USD") return `$${value.toFixed(2)}`;
  return value.toLocaleString();
}

function getIcon(name: string) {
  if (name.includes("Database")) return Database;
  if (name.includes("Redis") || name.includes("Upstash")) return Zap;
  if (name.includes("Cost") || name.includes("USD")) return DollarSign;
  if (name.includes("User") || name.includes("Profile")) return Users;
  if (name.includes("Scan")) return BarChart3;
  return Server;
}

function StatusBadge({ status }: { status: "ok" | "warning" | "critical" }) {
  if (status === "critical") {
    return (
      <span className="badge-pop badge-pop-red">
        <XCircle className="w-3 h-3" />
        Critical
      </span>
    );
  }
  if (status === "warning") {
    return (
      <span className="badge-pop badge-pop-yellow">
        <AlertTriangle className="w-3 h-3" />
        Warning
      </span>
    );
  }
  return (
    <span className="badge-pop badge-pop-green">
      <CheckCircle className="w-3 h-3" />
      OK
    </span>
  );
}

function ProgressBar({ percentage, status }: { percentage: number; status: string }) {
  const width = Math.min(percentage * 100, 100);
  const color =
    status === "critical" ? "var(--pop-red)" : status === "warning" ? "#d97706" : "var(--pop-green)";

  return (
    <div className="w-full h-3 border-2 border-black overflow-hidden" style={{ background: "var(--pop-cream)" }}>
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${width}%`, background: color }}
      />
    </div>
  );
}

export default function AdminUsagePage() {
  const { isLoaded, isSignedIn } = useUser();
  const [data, setData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/usage");
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied. Admin privileges required.");
        }
        throw new Error("Failed to fetch usage data");
      }
      const result = await response.json();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchUsage();
    }
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--pop-blue)" }} />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="comic-panel p-8 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--pop-red)" }} />
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-bangers)" }}>
            Sign In Required
          </h1>
          <p className="mb-6">Please sign in to access the admin dashboard.</p>
          <Link href="/sign-in" className="btn-pop btn-pop-red">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <header className="border-b-4 border-black mb-6" style={{ background: "var(--pop-yellow)" }}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8" />
              <h1
                className="text-2xl font-bold tracking-wide"
                style={{ fontFamily: "var(--font-bangers)" }}
              >
                Service Usage Monitor
              </h1>
            </div>
            <button
              onClick={fetchUsage}
              disabled={isLoading}
              className="btn-pop btn-pop-white text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4">
        {error && (
          <div
            className="comic-panel p-4 mb-6"
            style={{ borderColor: "var(--pop-red)", background: "#fff0f0" }}
          >
            <div className="flex items-center gap-2" style={{ color: "var(--pop-red)" }}>
              <AlertTriangle className="w-5 h-5" />
              <p className="font-bold">{error}</p>
            </div>
          </div>
        )}

        {isLoading && !data ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--pop-blue)" }} />
          </div>
        ) : data ? (
          <>
            {/* Overall Status Card */}
            <div className="comic-panel p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className="text-xl font-bold mb-1"
                    style={{ fontFamily: "var(--font-bangers)" }}
                  >
                    Overall System Status
                  </h2>
                  <p className="text-sm text-gray-500">
                    Last checked: {new Date(data.checkedAt).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={data.overallStatus} />
              </div>
              {data.overallStatus !== "ok" && (
                <div
                  className="mt-4 p-3 border-2 border-black"
                  style={{ background: data.overallStatus === "critical" ? "#fff0f0" : "#fffbeb" }}
                >
                  <p className="text-sm font-medium">
                    {data.overallStatus === "critical"
                      ? "One or more services are at critical usage levels. Immediate attention recommended."
                      : "Some services are approaching their limits. Consider upgrading or optimizing usage."}
                  </p>
                </div>
              )}
            </div>

            {/* Threshold Info */}
            <div className="mb-6 flex gap-4 text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-black" style={{ background: "var(--pop-green)" }} />
                OK: &lt; {data.thresholds.warning * 100}%
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-black" style={{ background: "#d97706" }} />
                Warning: {data.thresholds.warning * 100}% - {data.thresholds.critical * 100}%
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-black" style={{ background: "var(--pop-red)" }} />
                Critical: &gt; {data.thresholds.critical * 100}%
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.metrics.map((metric) => {
                const Icon = getIcon(metric.name);
                return (
                  <div key={metric.name} className="comic-panel p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="p-2 border-2 border-black"
                          style={{ background: "var(--pop-cream)" }}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-sm">{metric.name}</h3>
                      </div>
                      {metric.dashboard && (
                        <a
                          href={metric.dashboard}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:opacity-70 transition-opacity"
                          title="Open Dashboard"
                          style={{ color: "var(--pop-blue)" }}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    <div className="mb-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold">
                          {formatValue(metric.current, metric.unit)}
                        </span>
                        <span className="text-sm text-gray-500">
                          / {formatValue(metric.limit, metric.unit)}
                        </span>
                      </div>
                    </div>

                    {metric.percentage > 0 && (
                      <>
                        <ProgressBar percentage={metric.percentage} status={metric.status} />
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm text-gray-500">
                            {(metric.percentage * 100).toFixed(1)}% used
                          </span>
                          <StatusBadge status={metric.status} />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Errors Section */}
            {data.errors && data.errors.length > 0 && (
              <div
                className="comic-panel mt-8 p-4"
                style={{ borderColor: "var(--pop-red)", background: "#fff0f0" }}
              >
                <h3 className="font-bold mb-2" style={{ color: "var(--pop-red)" }}>
                  Errors fetching some metrics:
                </h3>
                <ul className="list-disc list-inside text-sm" style={{ color: "var(--pop-red)" }}>
                  {data.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick Links */}
            <div className="comic-panel mt-8 p-6">
              <h3
                className="text-xl font-bold mb-4"
                style={{ fontFamily: "var(--font-bangers)" }}
              >
                Service Dashboards
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { name: "Supabase", url: "https://supabase.com/dashboard", icon: Database },
                  { name: "Upstash", url: "https://console.upstash.com", icon: Zap },
                  { name: "Anthropic", url: "https://console.anthropic.com", icon: BarChart3 },
                  { name: "Clerk", url: "https://dashboard.clerk.com", icon: Users },
                ].map((service) => (
                  <a
                    key={service.name}
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 border-2 border-black hover:translate-x-0.5 hover:-translate-y-0.5 transition-transform"
                    style={{ background: "var(--pop-cream)" }}
                  >
                    <service.icon className="w-5 h-5" />
                    <span className="font-bold">{service.name}</span>
                    <ExternalLink className="w-4 h-4 text-gray-400 ml-auto" />
                  </a>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
