"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { useClerk, useUser } from "@clerk/nextjs";

import {
  AlertCircle,
  AtSign,
  Calendar,
  Camera,
  Check,
  CreditCard,
  Crown,
  ExternalLink,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  Shield,
  Smartphone,
  Store,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";

import { useDebounce } from "@/hooks/useDebounce";
import { useSubscription } from "@/hooks/useSubscription";

import { LocationPrivacy, UserLocation } from "@/app/api/location/route";
import { FollowerCount } from "@/components/follows";
import { CreatorBadge, FeedbackList, FeedbackSummary, TrustBadge } from "@/components/creatorCredits";
import { TransactionFeedback, UserCreatorProfile } from "@/types/creatorCredits";

// Tab types
type TabId = "profile" | "security" | "billing";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const tabs: Tab[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "billing", label: "Billing", icon: CreditCard },
];

// Username availability state
interface UsernameAvailability {
  available: boolean;
  error?: string;
  display?: string;
}

// Connect status state
interface ConnectStatus {
  connected: boolean;
  onboardingComplete: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  completedSales: number;
}

export function CustomProfilePage() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  // Profile state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Avatar state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Username state
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLoadingUsername, setIsLoadingUsername] = useState(true);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<UsernameAvailability | null>(
    null
  );
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const debouncedUsername = useDebounce(username, 500);

  // Follow counts state
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoadingFollowCounts, setIsLoadingFollowCounts] = useState(false);

  // Location state
  const [locationCity, setLocationCity] = useState("");
  const [locationState, setLocationState] = useState("");
  const [locationCountry, setLocationCountry] = useState("");
  const [locationPrivacy, setLocationPrivacy] = useState<LocationPrivacy>("state_country");
  const [originalLocation, setOriginalLocation] = useState<UserLocation | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSuccess, setLocationSuccess] = useState(false);

  // Creator Credits state
  const [creatorProfile, setCreatorProfile] = useState<UserCreatorProfile | null>(null);
  const [recentFeedback, setRecentFeedback] = useState<TransactionFeedback[]>([]);
  const [isLoadingCreatorProfile, setIsLoadingCreatorProfile] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<
    Array<{
      id: string;
      device: string;
      browser: string;
      lastActive: Date;
      isCurrent: boolean;
    }>
  >([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isRevokingSession, setIsRevokingSession] = useState<string | null>(null);

  // Subscription hook
  const {
    tier,
    isTrialing,
    trialDaysRemaining,
    trialEndsAt,
    scansUsed,
    monthResetDate,
    trialAvailable,
    startCheckout,
    openBillingPortal,
    isLoading: isSubscriptionLoading,
  } = useSubscription();

  // Connect status state
  const searchParams = useSearchParams();
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectBanner, setConnectBanner] = useState<"success" | "incomplete" | "error" | null>(null);

  // Initialize user data
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
    }
  }, [user]);

  // Fetch username and profile ID on mount
  useEffect(() => {
    async function fetchUsername() {
      try {
        const res = await fetch("/api/username/current");
        if (res.ok) {
          const data = await res.json();
          if (data.username) {
            setUsername(data.username);
            setOriginalUsername(data.username);
          }
          if (data.profileId) {
            setProfileId(data.profileId);
          }
        }
      } catch (error) {
        console.error("Failed to fetch username:", error);
      } finally {
        setIsLoadingUsername(false);
      }
    }
    fetchUsername();
  }, []);

  // Fetch location on mount
  useEffect(() => {
    async function fetchLocation() {
      try {
        const res = await fetch("/api/location");
        if (res.ok) {
          const data: UserLocation = await res.json();
          setLocationCity(data.city || "");
          setLocationState(data.state || "");
          setLocationCountry(data.country || "");
          setLocationPrivacy(data.privacy);
          setOriginalLocation(data);
        }
      } catch (error) {
        console.error("Failed to fetch location:", error);
      } finally {
        setIsLoadingLocation(false);
      }
    }
    fetchLocation();
  }, []);

  // Fetch creator profile on mount
  useEffect(() => {
    async function fetchCreatorProfile() {
      if (!user?.id) return;
      setIsLoadingCreatorProfile(true);
      try {
        const res = await fetch(`/api/reputation?includeFeedback=true&feedbackLimit=5`);
        if (res.ok) {
          const data = await res.json();
          setCreatorProfile(data.reputation);
          setRecentFeedback(data.recentFeedback || []);
        }
      } catch (error) {
        console.error("Failed to fetch creator profile:", error);
      } finally {
        setIsLoadingCreatorProfile(false);
      }
    }
    fetchCreatorProfile();
  }, [user?.id]);

  // Fetch follow counts when profile ID is available
  useEffect(() => {
    async function fetchFollowCounts() {
      if (!profileId) return;
      setIsLoadingFollowCounts(true);
      try {
        const res = await fetch(`/api/follows/${profileId}`);
        if (res.ok) {
          const data = await res.json();
          setFollowerCount(data.followerCount || 0);
          setFollowingCount(data.followingCount || 0);
        }
      } catch (error) {
        console.error("Failed to fetch follow counts:", error);
      } finally {
        setIsLoadingFollowCounts(false);
      }
    }
    fetchFollowCounts();
  }, [profileId]);

  // Check username availability
  useEffect(() => {
    async function checkAvailability() {
      if (!debouncedUsername || debouncedUsername.length < 3) {
        setUsernameAvailability(null);
        return;
      }

      if (debouncedUsername === originalUsername) {
        setUsernameAvailability({ available: true, display: `@${debouncedUsername}` });
        return;
      }

      setIsCheckingUsername(true);
      try {
        const res = await fetch(`/api/username?username=${encodeURIComponent(debouncedUsername)}`);
        const data = await res.json();
        setUsernameAvailability(data);
      } catch (error) {
        console.error("Failed to check availability:", error);
        setUsernameAvailability({ available: false, error: "Failed to check availability" });
      } finally {
        setIsCheckingUsername(false);
      }
    }
    checkAvailability();
  }, [debouncedUsername, originalUsername]);

  // Fetch Connect status on mount
  useEffect(() => {
    async function fetchConnectStatus() {
      try {
        const res = await fetch("/api/connect/status");
        if (res.ok) {
          const data: ConnectStatus = await res.json();
          setConnectStatus(data);
        }
      } catch (error) {
        console.error("Failed to fetch connect status:", error);
      }
    }
    fetchConnectStatus();
  }, []);

  // Handle ?connect= query param from onboarding return
  useEffect(() => {
    const connectParam = searchParams.get("connect");
    if (connectParam === "success" || connectParam === "incomplete" || connectParam === "error") {
      setConnectBanner(connectParam);
      setActiveTab("billing");
      // Clear the query param from URL without navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("connect");
      window.history.replaceState({}, "", url.toString());
      // Auto-dismiss after 8 seconds
      setTimeout(() => setConnectBanner(null), 8000);
      // Refresh connect status
      fetch("/api/connect/status")
        .then((res) => res.ok ? res.json() : null)
        .then((data) => { if (data) setConnectStatus(data); })
        .catch(() => {});
    }
  }, [searchParams]);

  // Load sessions when security tab is active
  useEffect(() => {
    if (activeTab === "security" && user) {
      loadSessions();
    }
  }, [activeTab, user]);

  const loadSessions = async () => {
    if (!user) return;
    setIsLoadingSessions(true);
    try {
      const userSessions = await user.getSessions();
      const formattedSessions = userSessions.map((session) => {
        // Get device info from session's latestActivity if available
        const activity = session.latestActivity as {
          deviceType?: string;
          browserName?: string;
        } | null;
        return {
          id: session.id,
          device: activity?.deviceType || "Desktop",
          browser: activity?.browserName || "Browser",
          lastActive: new Date(session.lastActiveAt),
          isCurrent: session.status === "active",
        };
      });
      setSessions(formattedSessions);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Update profile
  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdatingProfile(true);
    setProfileError(null);
    setProfileUpdateSuccess(false);

    try {
      await user.update({
        firstName,
        lastName,
      });
      setProfileUpdateSuccess(true);
      setTimeout(() => setProfileUpdateSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update profile:", error);
      setProfileError("Failed to update profile");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Avatar upload
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image must be less than 5MB");
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarError(null);

    try {
      await user.setProfileImage({ file });
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      setAvatarError("Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Save username
  const handleSaveUsername = useCallback(async () => {
    if (!username || username.length < 3) return;
    if (!usernameAvailability?.available) return;

    setIsSavingUsername(true);
    setUsernameError(null);
    setUsernameSuccess(false);

    try {
      const res = await fetch("/api/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const data = await res.json();

      if (!res.ok) {
        setUsernameError(data.error || "Failed to save username");
        return;
      }

      setOriginalUsername(data.username);
      setUsernameSuccess(true);
      setTimeout(() => setUsernameSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save username:", error);
      setUsernameError("Failed to save username");
    } finally {
      setIsSavingUsername(false);
    }
  }, [username, usernameAvailability?.available]);

  // Save location
  const handleSaveLocation = useCallback(async () => {
    setIsSavingLocation(true);
    setLocationError(null);
    setLocationSuccess(false);

    try {
      const res = await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: locationCity,
          state: locationState,
          country: locationCountry,
          privacy: locationPrivacy,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setLocationError(data.error || "Failed to save location");
        return;
      }

      setOriginalLocation(data);
      setLocationSuccess(true);
      setTimeout(() => setLocationSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save location:", error);
      setLocationError("Failed to save location");
    } finally {
      setIsSavingLocation(false);
    }
  }, [locationCity, locationState, locationCountry, locationPrivacy]);

  // Revoke session
  const handleRevokeSession = async (sessionId: string) => {
    if (!user) return;
    setIsRevokingSession(sessionId);

    try {
      const session = (await user.getSessions()).find((s) => s.id === sessionId);
      if (session) {
        await session.revoke();
        await loadSessions();
      }
    } catch (error) {
      console.error("Failed to revoke session:", error);
    } finally {
      setIsRevokingSession(null);
    }
  };

  // Connect handlers
  const handleSetupConnect = async () => {
    try {
      const res = await fetch("/api/connect/create-account", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.alreadyComplete) {
        // Refresh status
        const statusRes = await fetch("/api/connect/status");
        if (statusRes.ok) {
          setConnectStatus(await statusRes.json());
        }
      }
    } catch (error) {
      console.error("Failed to set up connect:", error);
    }
  };

  const handleOpenDashboard = async () => {
    try {
      const res = await fetch("/api/connect/dashboard", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Failed to open dashboard:", error);
    }
  };

  // Billing helpers
  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const handleStartTrial = async () => {
    const url = await startCheckout("monthly", true);
    if (url) window.location.href = url;
  };

  const handleUpgrade = async () => {
    const url = await startCheckout("monthly", false);
    if (url) window.location.href = url;
  };

  const hasProfileChanges =
    firstName !== (user?.firstName || "") || lastName !== (user?.lastName || "");
  const hasUsernameChanges = username !== (originalUsername || "");
  const canSaveUsername =
    hasUsernameChanges &&
    usernameAvailability?.available &&
    !isCheckingUsername &&
    !isSavingUsername;
  const hasLocationChanges =
    locationCity !== (originalLocation?.city || "") ||
    locationState !== (originalLocation?.state || "") ||
    locationCountry !== (originalLocation?.country || "") ||
    locationPrivacy !== (originalLocation?.privacy || "state_country");
  const canSaveLocation = hasLocationChanges && !isSavingLocation;

  if (!isUserLoaded) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-4 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-pop-black font-comic">ACCOUNT SETTINGS</h1>
        <p className="text-sm text-gray-600 mt-1">Manage your profile, security, and billing</p>
      </div>

      {/* Tabs */}
      <div className="bg-pop-white border-3 border-pop-black overflow-hidden" style={{ boxShadow: "4px 4px 0px #000" }}>
        {/* Tab Navigation */}
        <div className="flex border-b-2 border-pop-black">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold font-comic transition-colors ${
                  isActive
                    ? "text-pop-blue border-b-3 border-pop-blue bg-blue-50/50"
                    : "text-gray-600 hover:text-pop-black hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-8">
              {/* Avatar Section */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4">Profile Photo</h3>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div
                      onClick={handleAvatarClick}
                      className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-gray-200"
                    >
                      {isUploadingAvatar ? (
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      ) : user?.imageUrl ? (
                        <Image
                          src={user.imageUrl}
                          alt="Profile"
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <User className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <button
                      onClick={handleAvatarClick}
                      className="absolute -bottom-1 -right-1 p-1.5 bg-pop-blue rounded-full text-white hover:bg-blue-700 transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Click to upload a new photo</p>
                    <p className="text-xs text-gray-400 mt-0.5">JPG, PNG. Max 5MB.</p>
                    {avatarError && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {avatarError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Name Section */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setProfileError(null);
                        setProfileUpdateSuccess(false);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        setProfileError(null);
                        setProfileUpdateSuccess(false);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                  </div>
                </div>

                {/* Email (read-only) */}
                <div className="mt-4">
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">{user?.primaryEmailAddress?.emailAddress}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Contact support to change your email</p>
                </div>

                {/* Save Profile Button */}
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleUpdateProfile}
                    disabled={!hasProfileChanges || isUpdatingProfile}
                    className="px-4 py-2 text-sm font-bold text-white bg-pop-blue border-2 border-pop-black hover:shadow-[2px_2px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isUpdatingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                  {profileUpdateSuccess && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      Saved!
                    </span>
                  )}
                  {profileError && (
                    <span className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {profileError}
                    </span>
                  )}
                </div>
              </div>

              {/* Username Section */}
              <div className="border-t border-gray-100 pt-8">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <AtSign className="w-4 h-4" />
                  Username
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Your unique username for the marketplace. Displayed as @username.
                </p>

                {isLoadingUsername ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center">
                      <span className="text-gray-500 text-lg mr-1">@</span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => {
                          const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                          setUsername(value);
                          setUsernameError(null);
                          setUsernameSuccess(false);
                        }}
                        placeholder="your_username"
                        maxLength={20}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                      />
                      <div className="ml-2 w-6 h-6 flex items-center justify-center">
                        {isCheckingUsername && (
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        )}
                        {!isCheckingUsername &&
                          usernameAvailability?.available &&
                          username.length >= 3 && <Check className="w-5 h-5 text-green-500" />}
                        {!isCheckingUsername &&
                          usernameAvailability &&
                          !usernameAvailability.available &&
                          username.length >= 3 && <X className="w-5 h-5 text-red-500" />}
                      </div>
                    </div>

                    {/* Validation Messages */}
                    {username.length > 0 && username.length < 3 && (
                      <p className="mt-2 text-sm text-amber-600">
                        Username must be at least 3 characters
                      </p>
                    )}
                    {usernameAvailability &&
                      !usernameAvailability.available &&
                      usernameAvailability.error && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {usernameAvailability.error}
                        </p>
                      )}
                    {usernameAvailability?.available &&
                      username.length >= 3 &&
                      hasUsernameChanges && (
                        <p className="mt-2 text-sm text-green-600">
                          {usernameAvailability.display} is available!
                        </p>
                      )}

                    <ul className="mt-3 text-xs text-gray-400 space-y-0.5">
                      <li>3-20 characters, letters, numbers, underscores only</li>
                    </ul>

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={handleSaveUsername}
                        disabled={!canSaveUsername}
                        className="px-4 py-2 text-sm font-bold text-white bg-pop-blue border-2 border-pop-black hover:shadow-[2px_2px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSavingUsername ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Username"
                        )}
                      </button>
                      {usernameSuccess && (
                        <span className="text-sm text-green-600 flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          Saved!
                        </span>
                      )}
                      {usernameError && (
                        <span className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {usernameError}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Followers Section */}
              <div className="border-t border-gray-100 pt-8">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Followers
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  See who follows you and who you follow
                </p>

                {isLoadingFollowCounts || !profileId ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                ) : (
                  <FollowerCount
                    userId={profileId}
                    followerCount={followerCount}
                    followingCount={followingCount}
                  />
                )}
              </div>

              {/* Location Section */}
              <div className="border-t border-gray-100 pt-8">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Share your general location to help with trades and shipping estimates. This is
                  optional.
                </p>

                {isLoadingLocation ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">City</label>
                        <input
                          type="text"
                          value={locationCity}
                          onChange={(e) => {
                            setLocationCity(e.target.value);
                            setLocationError(null);
                            setLocationSuccess(false);
                          }}
                          placeholder="e.g., Austin"
                          maxLength={100}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">State / Province</label>
                        <input
                          type="text"
                          value={locationState}
                          onChange={(e) => {
                            setLocationState(e.target.value);
                            setLocationError(null);
                            setLocationSuccess(false);
                          }}
                          placeholder="e.g., Texas"
                          maxLength={100}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Country</label>
                        <input
                          type="text"
                          value={locationCountry}
                          onChange={(e) => {
                            setLocationCountry(e.target.value);
                            setLocationError(null);
                            setLocationSuccess(false);
                          }}
                          placeholder="e.g., United States"
                          maxLength={100}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                        />
                      </div>
                    </div>

                    {/* Privacy Control */}
                    <div className="mt-4">
                      <label className="block text-xs text-gray-500 mb-1">
                        Location Visibility
                      </label>
                      <select
                        value={locationPrivacy}
                        onChange={(e) => {
                          setLocationPrivacy(e.target.value as LocationPrivacy);
                          setLocationError(null);
                          setLocationSuccess(false);
                        }}
                        className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
                      >
                        <option value="full">Show city, state, and country</option>
                        <option value="state_country">Show state and country only</option>
                        <option value="country_only">Show country only</option>
                        <option value="hidden">Hide location completely</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-400">
                        Controls what other users see on your listings and profile
                      </p>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={handleSaveLocation}
                        disabled={!canSaveLocation}
                        className="px-4 py-2 text-sm font-bold text-white bg-pop-blue border-2 border-pop-black hover:shadow-[2px_2px_0px_#000] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSavingLocation ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Location"
                        )}
                      </button>
                      {locationSuccess && (
                        <span className="text-sm text-green-600 flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          Saved!
                        </span>
                      )}
                      {locationError && (
                        <span className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {locationError}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Creator Credits Section */}
              <div className="border-t border-gray-100 pt-8">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Creator Credits & Feedback
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Your transaction trust score and creator credits
                </p>

                {isLoadingCreatorProfile ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading creator credits...</span>
                  </div>
                ) : creatorProfile ? (
                  <div className="space-y-6">
                    {/* Transaction Trust */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Transaction Trust</p>
                      <TrustBadge trust={creatorProfile.transactionTrust} size="lg" />
                      {creatorProfile.transactionTrust.totalCount > 0 && (
                        <div className="mt-3">
                          <FeedbackSummary
                            positiveCount={creatorProfile.transactionTrust.positiveCount}
                            negativeCount={creatorProfile.transactionTrust.negativeCount}
                          />
                        </div>
                      )}
                    </div>

                    {/* Creator Credits Badge */}
                    {creatorProfile.creatorBadge.tier !== "none" && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Creator Credits</p>
                        <CreatorBadge badge={creatorProfile.creatorBadge} size="lg" />
                        <p className="mt-1 text-xs text-gray-500">
                          {creatorProfile.creatorBadge.count} approved contribution
                          {creatorProfile.creatorBadge.count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}

                    {/* Recent Feedback */}
                    {recentFeedback.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Recent Feedback</p>
                        <FeedbackList feedback={recentFeedback} />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No creator credits data available</p>
                )}
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="space-y-8">
              {/* Password Section */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <KeyRound className="w-4 h-4" />
                  Password
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Manage your password and account security
                </p>
                <button
                  onClick={() => openUserProfile()}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  Change Password
                </button>
              </div>

              {/* Connected Accounts */}
              <div className="border-t border-gray-100 pt-8">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  Connected Accounts
                </h3>
                <p className="text-xs text-gray-500 mb-4">Link your accounts for easier sign-in</p>

                <div className="space-y-3">
                  {user?.externalAccounts && user.externalAccounts.length > 0 ? (
                    user.externalAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                            {account.provider === "google" ? (
                              <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path
                                  fill="#4285F4"
                                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                  fill="#34A853"
                                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                  fill="#FBBC05"
                                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                  fill="#EA4335"
                                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                              </svg>
                            ) : (
                              <LinkIcon className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 capitalize">
                              {account.provider}
                            </p>
                            <p className="text-xs text-gray-500">
                              {account.emailAddress || "Connected"}
                            </p>
                          </div>
                        </div>
                        <Check className="w-4 h-4 text-green-500" />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      <LinkIcon className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No connected accounts</p>
                      <button
                        onClick={() => openUserProfile()}
                        className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
                      >
                        Connect an account
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Sessions */}
              <div className="border-t border-gray-100 pt-8">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  Active Sessions
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Devices where you&apos;re currently signed in
                </p>

                {isLoadingSessions ? (
                  <div className="flex items-center gap-2 text-gray-400 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading sessions...</span>
                  </div>
                ) : sessions.length > 0 ? (
                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {session.device === "Mobile" ? (
                            <Smartphone className="w-5 h-5 text-gray-400" />
                          ) : (
                            <Monitor className="w-5 h-5 text-gray-400" />
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {session.browser} on {session.device}
                              {session.isCurrent && (
                                <span className="ml-2 text-xs font-normal text-green-600">
                                  (Current)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              Last active: {session.lastActive.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {!session.isCurrent && (
                          <button
                            onClick={() => handleRevokeSession(session.id)}
                            disabled={isRevokingSession === session.id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isRevokingSession === session.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-4">No active sessions found</p>
                )}
              </div>

              {/* Sign Out */}
              <div className="border-t border-gray-100 pt-8">
                <button
                  onClick={() => signOut()}
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === "billing" && (
            <div className="space-y-6">
              {/* Connect Onboarding Banner */}
              {connectBanner === "success" && (
                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <p className="font-body text-sm text-green-800">
                    Seller payments set up successfully! You&apos;re ready to sell.
                  </p>
                  <button onClick={() => setConnectBanner(null)} className="ml-auto text-green-600 hover:text-green-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {connectBanner === "incomplete" && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="font-body text-sm text-amber-800">
                    Seller setup is not yet complete. Please finish the remaining steps.
                  </p>
                  <button onClick={() => setConnectBanner(null)} className="ml-auto text-amber-600 hover:text-amber-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {connectBanner === "error" && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="font-body text-sm text-red-800">
                    Something went wrong during seller setup. Please try again.
                  </p>
                  <button onClick={() => setConnectBanner(null)} className="ml-auto text-red-600 hover:text-red-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Current Plan */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {tier === "premium" || isTrialing ? (
                      <Crown className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Zap className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-lg font-semibold text-gray-900">
                      {isTrialing ? "Premium (Trial)" : tier === "premium" ? "Premium" : "Free"}
                    </span>
                    {isTrialing && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                        {trialDaysRemaining} days left
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {tier === "premium"
                      ? "Unlimited scans, all features included"
                      : isTrialing
                        ? `Trial ends ${formatDate(trialEndsAt)}`
                        : "10 scans per month, basic features"}
                  </p>
                </div>

                {tier === "premium" && !isTrialing ? (
                  <button
                    onClick={openBillingPortal}
                    disabled={isSubscriptionLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Manage Plan
                    <ExternalLink className="w-4 h-4" />
                  </button>
                ) : isTrialing ? (
                  <button
                    onClick={handleUpgrade}
                    disabled={isSubscriptionLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Crown className="w-4 h-4" />
                    Subscribe Now
                  </button>
                ) : trialAvailable ? (
                  <button
                    onClick={handleStartTrial}
                    disabled={isSubscriptionLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    Start Free Trial
                  </button>
                ) : (
                  <Link
                    href="/pricing"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Crown className="w-4 h-4" />
                    Upgrade
                  </Link>
                )}
              </div>

              {/* Usage Stats (for free tier) */}
              {tier === "free" && !isTrialing && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Monthly Usage</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Scans used</span>
                        <span className="font-medium text-gray-900">{scansUsed} / 10</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            scansUsed >= 10
                              ? "bg-red-500"
                              : scansUsed >= 7
                                ? "bg-amber-500"
                                : "bg-green-500"
                          }`}
                          style={{ width: `${Math.min(100, (scansUsed / 10) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {monthResetDate && (
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Resets {formatDate(monthResetDate)}
                    </p>
                  )}
                </div>
              )}

              {/* Feature Comparison */}
              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  {tier === "premium" || isTrialing
                    ? "Your Premium Features"
                    : "Upgrade to Premium"}
                </h3>
                <ul className="space-y-2">
                  {[
                    { feature: "Unlimited scans", included: tier === "premium" || isTrialing },
                    {
                      feature: "Key Hunt (offline lookups)",
                      included: tier === "premium" || isTrialing,
                    },
                    { feature: "CSV export", included: tier === "premium" || isTrialing },
                    { feature: "Advanced statistics", included: tier === "premium" || isTrialing },
                    { feature: "Unlimited listings", included: tier === "premium" || isTrialing },
                    {
                      feature: "5% seller fee (vs 8%)",
                      included: tier === "premium" || isTrialing,
                    },
                  ].map((item) => (
                    <li key={item.feature} className="flex items-center gap-2 text-sm">
                      <Check
                        className={`w-4 h-4 ${item.included ? "text-green-500" : "text-gray-300"}`}
                      />
                      <span className={item.included ? "text-gray-900" : "text-gray-500"}>
                        {item.feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {tier === "free" && !isTrialing && (
                  <Link
                    href="/pricing"
                    className="inline-block mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    View all pricing details →
                  </Link>
                )}
              </div>

              {/* Seller Payments */}
              <div className="bg-pop-white border-3 border-pop-black shadow-[4px_4px_0px_#000] rounded-lg p-4">
                <h3 className="font-comic text-lg mb-3 flex items-center gap-2">
                  <Store className="w-5 h-5" />
                  SELLER PAYMENTS
                </h3>
                {connectStatus === null ? (
                  <p className="font-body text-sm text-pop-black/60">Loading...</p>
                ) : connectStatus.onboardingComplete ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-pop-green rounded-full" />
                      <span className="font-body text-sm">Payment setup complete</span>
                    </div>
                    <p className="font-body text-sm text-pop-black/60">
                      {connectStatus.completedSales} sale{connectStatus.completedSales !== 1 ? "s" : ""} completed
                    </p>
                    <button
                      onClick={handleOpenDashboard}
                      className="btn-pop btn-pop-blue py-2 px-4 text-sm font-comic"
                    >
                      VIEW PAYOUT DASHBOARD
                    </button>
                  </div>
                ) : connectStatus.connected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-pop-yellow rounded-full" />
                      <span className="font-body text-sm">Setup incomplete</span>
                    </div>
                    <button
                      onClick={handleSetupConnect}
                      className="btn-pop btn-pop-green py-2 px-4 text-sm font-comic"
                    >
                      COMPLETE SETUP
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="font-body text-sm text-pop-black/60">
                      Set up payments to start selling comics on the marketplace.
                    </p>
                    <button
                      onClick={handleSetupConnect}
                      className="btn-pop btn-pop-green py-2 px-4 text-sm font-comic"
                    >
                      SET UP SELLER PAYMENTS
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
