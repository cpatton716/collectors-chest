"use client";

import { useEffect, useState } from "react";

import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Share2,
  X,
} from "lucide-react";

interface ShareCollectionModalProps {
  onClose: () => void;
}

interface SharingSettings {
  isPublic: boolean;
  publicSlug: string | null;
  publicDisplayName: string | null;
  publicBio: string | null;
  shareUrl: string | null;
}

export function ShareCollectionModal({ onClose }: ShareCollectionModalProps) {
  const [settings, setSettings] = useState<SharingSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetch current settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/sharing");
        if (!res.ok) throw new Error("Failed to load settings");
        const data = await res.json();
        setSettings(data);
        setDisplayName(data.publicDisplayName || "");
        setBio(data.publicBio || "");
        setCustomSlug(data.publicSlug || "");
      } catch (err) {
        setError("Failed to load sharing settings");
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleTogglePublic = async () => {
    if (!settings) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/sharing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enable: !settings.isPublic,
          customSlug: customSlug || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update settings");
      }

      setSettings({
        ...settings,
        isPublic: data.isPublic,
        publicSlug: data.publicSlug,
        shareUrl: data.shareUrl,
      });
      setCustomSlug(data.publicSlug || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/sharing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicDisplayName: displayName || null,
          publicBio: bio || null,
          publicSlug: customSlug || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save settings");
      }

      // Update local state
      setSettings({
        ...settings,
        publicDisplayName: displayName || null,
        publicBio: bio || null,
        publicSlug: customSlug || null,
        shareUrl:
          settings.isPublic && customSlug
            ? `${window.location.origin}/u/${customSlug}`
            : settings.shareUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = async () => {
    if (!settings?.shareUrl) return;

    try {
      await navigator.clipboard.writeText(settings.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = settings.shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Share2 className="w-5 h-5 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Share Your Collection</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : error && !settings ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600">{error}</p>
            </div>
          ) : settings ? (
            <>
              {/* Public/Private Toggle */}
              <div className="mb-6">
                <div
                  className={`p-4 rounded-xl border-2 transition-all ${
                    settings.isPublic
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {settings.isPublic ? (
                        <Globe className="w-6 h-6 text-green-600" />
                      ) : (
                        <Lock className="w-6 h-6 text-gray-500" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {settings.isPublic ? "Public Collection" : "Private Collection"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {settings.isPublic
                            ? "Anyone with the link can view your collection"
                            : "Only you can see your collection"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleTogglePublic}
                      disabled={isSaving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.isPublic ? "bg-green-600" : "bg-gray-300"
                      } ${isSaving ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.isPublic ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Share Link (when public) */}
              {settings.isPublic && settings.shareUrl && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Share Link
                  </label>
                  <div className="flex gap-2 min-w-0">
                    <div className="min-w-0 flex-1 flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg border border-gray-200">
                      <span className="text-sm text-gray-600 truncate">{settings.shareUrl}</span>
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className={`shrink-0 px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                        copied
                          ? "bg-green-600 text-white"
                          : "bg-primary-600 text-white hover:bg-primary-700"
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <a
                    href={settings.shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-2"
                  >
                    Preview your public page
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Advanced Settings */}
              {settings.isPublic && (
                <div className="border-t border-gray-100 pt-6">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-sm font-medium text-gray-600 hover:text-gray-900 mb-4"
                  >
                    {showAdvanced ? "Hide" : "Show"} Advanced Settings
                  </button>

                  {showAdvanced && (
                    <div className="space-y-4">
                      {/* Display Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Your collector name"
                          maxLength={50}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          This will be shown on your public profile
                        </p>
                      </div>

                      {/* Bio */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                        <textarea
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Tell others about your collection..."
                          maxLength={200}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900 resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">{bio.length}/200 characters</p>
                      </div>

                      {/* Custom URL */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Custom URL
                        </label>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500">
                            {typeof window !== "undefined" ? window.location.origin : ""}/u/
                          </span>
                          <input
                            type="text"
                            value={customSlug}
                            onChange={(e) =>
                              setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                            }
                            placeholder="your-name"
                            maxLength={30}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Only lowercase letters, numbers, and hyphens. 3-30 characters.
                        </p>
                      </div>

                      {/* Save Button */}
                      <button
                        onClick={handleSaveSettings}
                        disabled={isSaving}
                        className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Settings"
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Info */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">What others will see</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>- Your collection stats (total comics, value, top publishers)</li>
                  <li>- Grid view of your comics with cover images</li>
                  <li>- Comic details (title, issue, publisher, value)</li>
                </ul>
                <p className="text-xs text-blue-600 mt-2">
                  Note: Visitors cannot edit or delete any items.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
