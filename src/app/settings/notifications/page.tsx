"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { useUser } from "@clerk/nextjs";

import { AlertCircle, ArrowLeft, Bell, Check, Loader2, Mail, Smartphone } from "lucide-react";

import { useToast } from "@/components/Toast";

interface NotificationSettings {
  msgPushEnabled: boolean;
  msgEmailEnabled: boolean;
}

export default function NotificationSettingsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>({
    msgPushEnabled: true,
    msgEmailEnabled: true,
  });

  // Fetch settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings/notifications");
        if (!response.ok) {
          throw new Error("Failed to fetch settings");
        }
        const data = await response.json();
        setSettings({
          msgPushEnabled: data.msgPushEnabled ?? true,
          msgEmailEnabled: data.msgEmailEnabled ?? true,
        });
      } catch (err) {
        console.error("Failed to load notification settings:", err);
        setError("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }

    if (isSignedIn) {
      fetchSettings();
    } else if (isLoaded) {
      setLoading(false);
    }
  }, [isSignedIn, isLoaded]);

  async function updateSetting(key: keyof NotificationSettings, value: boolean) {
    setSaving(key);
    setError(null);

    // Optimistically update UI
    const previousSettings = { ...settings };
    setSettings((prev) => ({ ...prev, [key]: value }));

    try {
      const response = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      showToast(value ? "Notifications enabled" : "Notifications disabled", "success");
    } catch (err) {
      console.error("Failed to update notification settings:", err);
      // Revert on error
      setSettings(previousSettings);
      setError("Failed to save setting");
      showToast("Failed to save setting", "error");
    } finally {
      setSaving(null);
    }
  }

  // Loading state
  if (!isLoaded || loading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-pop-blue" />
        </div>
      </div>
    );
  }

  // Not signed in
  if (!isSignedIn) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-pop-white border-3 border-pop-black p-8 text-center shadow-[4px_4px_0px_#000]">
          <div className="w-16 h-16 bg-pop-yellow border-3 border-pop-black flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-pop-black" />
          </div>
          <h1 className="text-xl font-comic text-pop-black mb-2">SIGN IN REQUIRED</h1>
          <p className="font-body text-pop-black/70">
            Create an account to customize your notification preferences.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-4 px-4">
      {/* Back link */}
      <Link
        href="/profile"
        className="inline-flex items-center gap-2 px-3 py-2 bg-pop-white border-2 border-pop-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] transition-all mb-6 font-comic text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        BACK TO SETTINGS
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-pop-red border-3 border-pop-black shadow-[3px_3px_0px_#000]">
            <Bell className="w-6 h-6 text-pop-white" />
          </div>
          <div>
            <h1 className="text-2xl font-comic text-pop-black">NOTIFICATION SETTINGS</h1>
            <p className="text-sm font-body text-pop-black/70">
              Control how you receive notifications about messages
            </p>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-4 bg-pop-red/10 border-3 border-pop-red flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-pop-red flex-shrink-0" />
          <span className="font-comic text-pop-red">{error}</span>
        </div>
      )}

      {/* Settings card */}
      <div className="bg-pop-white border-3 border-pop-black shadow-[4px_4px_0px_#000]">
        {/* Push Notifications */}
        <div className="p-6 border-b-3 border-pop-black">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-pop-blue border-2 border-pop-black">
                <Smartphone className="w-5 h-5 text-pop-white" />
              </div>
              <div>
                <h3 className="font-comic text-pop-black">PUSH NOTIFICATIONS</h3>
                <p className="text-sm font-body text-pop-black/70 mt-0.5">
                  Get notified in your browser when you receive new messages
                </p>
              </div>
            </div>
            <ToggleSwitch
              enabled={settings.msgPushEnabled}
              onChange={(value) => updateSetting("msgPushEnabled", value)}
              loading={saving === "msgPushEnabled"}
            />
          </div>
        </div>

        {/* Email Notifications */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-pop-orange border-2 border-pop-black">
                <Mail className="w-5 h-5 text-pop-white" />
              </div>
              <div>
                <h3 className="font-comic text-pop-black">EMAIL NOTIFICATIONS</h3>
                <p className="text-sm font-body text-pop-black/70 mt-0.5">
                  Receive email alerts for new messages when you&apos;re offline
                </p>
              </div>
            </div>
            <ToggleSwitch
              enabled={settings.msgEmailEnabled}
              onChange={(value) => updateSetting("msgEmailEnabled", value)}
              loading={saving === "msgEmailEnabled"}
            />
          </div>
        </div>
      </div>

      {/* Info text */}
      <p className="mt-4 text-xs font-body text-pop-black/50 text-center">
        Changes are saved automatically
      </p>
    </div>
  );
}

// Toggle Switch Component - Comic Style
interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  loading?: boolean;
}

function ToggleSwitch({ enabled, onChange, loading }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      disabled={loading}
      className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer border-3 border-pop-black transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? "bg-pop-green" : "bg-pop-cream"
      }`}
      style={{ boxShadow: "2px 2px 0px #000" }}
      role="switch"
      aria-checked={enabled}
    >
      <span className="sr-only">Toggle notification</span>
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform border-2 border-pop-black bg-pop-white transition duration-200 ease-in-out mt-[1px] ${
          enabled ? "translate-x-6 ml-[1px]" : "translate-x-0 ml-[1px]"
        }`}
      >
        {loading ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-3 h-3 animate-spin text-pop-black" />
          </span>
        ) : enabled ? (
          <span className="absolute inset-0 flex items-center justify-center text-pop-green">
            <Check className="w-4 h-4" strokeWidth={3} />
          </span>
        ) : null}
      </span>
    </button>
  );
}
