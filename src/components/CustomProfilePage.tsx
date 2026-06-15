"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

import { useClerk, useUser } from "@clerk/nextjs";

import { CreditCard, Loader2, Shield, User } from "lucide-react";

import { useDebounce } from "@/hooks/useDebounce";
import { useSubscription } from "@/hooks/useSubscription";

import { LocationPrivacy, UserLocation } from "@/app/api/location/route";
import { TransactionFeedback, UserCreatorProfile } from "@/types/creatorCredits";

import {
  ConnectStatus,
  ProfileSession,
  Tab,
  TabId,
  UsernameAvailability,
  downscaleAvatar,
} from "@/components/profile/profileTabHelpers";

// Code-split the three tabs (M-FE13): only the active tab's chunk is fetched,
// so non-active tabs stay out of the initial bundle. These are client-only
// presentational components, so SSR is disabled.
const ProfileTab = dynamic(
  () => import("@/components/profile/ProfileTab").then((m) => m.ProfileTab),
  { ssr: false }
);
const SecurityTab = dynamic(
  () => import("@/components/profile/SecurityTab").then((m) => m.SecurityTab),
  { ssr: false }
);
const BillingTab = dynamic(
  () => import("@/components/profile/BillingTab").then((m) => m.BillingTab),
  { ssr: false }
);

const tabs: Tab[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "billing", label: "Billing", icon: CreditCard },
];

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
  const [sessions, setSessions] = useState<ProfileSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isRevokingSession, setIsRevokingSession] = useState<string | null>(null);

  // Subscription hook
  const {
    tier,
    isTrialing,
    trialDaysRemaining,
    trialEndsAt,
    scansUsed,
    purchasedScans,
    scansRemaining,
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
  const [billingBanner, setBillingBanner] = useState<"success" | "cancelled" | null>(null);

  // Display preferences state
  const [showFinancials, setShowFinancials] = useState(true);

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
        // Counts-only path skips the follow-status check / auth round-trip (L-SO11).
        const res = await fetch(`/api/follows/${profileId}?countsOnly=true`);
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
        } else {
          // API not available or user has no connect account - show "not connected" state
          setConnectStatus({
            connected: false,
            onboardingComplete: false,
            completedSales: 0,
          });
        }
      } catch (error) {
        console.error("Failed to fetch connect status:", error);
        setConnectStatus({
          connected: false,
          onboardingComplete: false,
          completedSales: 0,
        });
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

  // Handle ?billing= query param from Stripe checkout return
  useEffect(() => {
    const billingParam = searchParams.get("billing");
    if (billingParam === "success" || billingParam === "cancelled") {
      setBillingBanner(billingParam);
      setActiveTab("billing");
      // Clear the query params from URL without navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("billing");
      url.searchParams.delete("type");
      window.history.replaceState({}, "", url.toString());
      // Auto-dismiss after 8 seconds
      setTimeout(() => setBillingBanner(null), 8000);
    }
  }, [searchParams]);

  // Handle ?tab= query param for direct tab navigation
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "billing" || tabParam === "security" || tabParam === "profile") {
      setActiveTab(tabParam);
      // Auto-scroll to seller payments when coming from listing modal
      if (tabParam === "billing") {
        setTimeout(() => {
          document.getElementById("seller-payments")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 500);
      }
    }
  }, [searchParams]);

  // Fetch display preferences on mount (once)
  const [prefsFetched, setPrefsFetched] = useState(false);
  useEffect(() => {
    if (prefsFetched || !user) return;
    async function fetchPreferences() {
      try {
        const res = await fetch("/api/settings/preferences");
        if (res.ok) {
          const data = await res.json();
          setShowFinancials(data.showFinancials ?? true);
        }
      } catch (error) {
        // Non-fatal: fall back to the default (financials shown). Log so the
        // failure is visible rather than silently swallowed (M-SC15).
        console.error("Failed to fetch display preferences:", error);
      }
      setPrefsFetched(true);
    }
    fetchPreferences();
  }, [user, prefsFetched]);

  const handleToggleFinancials = async () => {
    const newValue = !showFinancials;
    setShowFinancials(newValue);
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showFinancials: newValue }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setShowFinancials(!newValue);
    }
  };

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
      // Downscale/compress to a 256px square before upload (L-SO10).
      const optimized = await downscaleAvatar(file);
      await user.setProfileImage({ file: optimized });
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
  const [connectSetupLoading, setConnectSetupLoading] = useState(false);
  const handleSetupConnect = async () => {
    setConnectSetupLoading(true);
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
      } else if (data.error) {
        console.error("Connect setup error:", data.error);
      }
    } catch (error) {
      console.error("Failed to set up connect:", error);
    } finally {
      setConnectSetupLoading(false);
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
            <ProfileTab
              user={user}
              isUploadingAvatar={isUploadingAvatar}
              avatarError={avatarError}
              fileInputRef={fileInputRef}
              handleAvatarClick={handleAvatarClick}
              handleAvatarChange={handleAvatarChange}
              firstName={firstName}
              setFirstName={setFirstName}
              lastName={lastName}
              setLastName={setLastName}
              setProfileError={setProfileError}
              setProfileUpdateSuccess={setProfileUpdateSuccess}
              handleUpdateProfile={handleUpdateProfile}
              hasProfileChanges={hasProfileChanges}
              isUpdatingProfile={isUpdatingProfile}
              profileUpdateSuccess={profileUpdateSuccess}
              profileError={profileError}
              isLoadingUsername={isLoadingUsername}
              username={username}
              setUsername={setUsername}
              setUsernameError={setUsernameError}
              setUsernameSuccess={setUsernameSuccess}
              isCheckingUsername={isCheckingUsername}
              usernameAvailability={usernameAvailability}
              hasUsernameChanges={hasUsernameChanges}
              handleSaveUsername={handleSaveUsername}
              canSaveUsername={canSaveUsername}
              isSavingUsername={isSavingUsername}
              usernameSuccess={usernameSuccess}
              usernameError={usernameError}
              isLoadingFollowCounts={isLoadingFollowCounts}
              profileId={profileId}
              followerCount={followerCount}
              followingCount={followingCount}
              isLoadingLocation={isLoadingLocation}
              locationCity={locationCity}
              setLocationCity={setLocationCity}
              locationState={locationState}
              setLocationState={setLocationState}
              locationCountry={locationCountry}
              setLocationCountry={setLocationCountry}
              locationPrivacy={locationPrivacy}
              setLocationPrivacy={setLocationPrivacy}
              setLocationError={setLocationError}
              setLocationSuccess={setLocationSuccess}
              handleSaveLocation={handleSaveLocation}
              canSaveLocation={canSaveLocation}
              isSavingLocation={isSavingLocation}
              locationSuccess={locationSuccess}
              locationError={locationError}
              isLoadingCreatorProfile={isLoadingCreatorProfile}
              creatorProfile={creatorProfile}
              recentFeedback={recentFeedback}
              showFinancials={showFinancials}
              handleToggleFinancials={handleToggleFinancials}
            />
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <SecurityTab
              user={user}
              openUserProfile={openUserProfile}
              signOut={signOut}
              isLoadingSessions={isLoadingSessions}
              sessions={sessions}
              isRevokingSession={isRevokingSession}
              handleRevokeSession={handleRevokeSession}
            />
          )}

          {/* Billing Tab */}
          {activeTab === "billing" && (
            <BillingTab
              connectBanner={connectBanner}
              setConnectBanner={setConnectBanner}
              billingBanner={billingBanner}
              setBillingBanner={setBillingBanner}
              tier={tier}
              isTrialing={isTrialing}
              trialDaysRemaining={trialDaysRemaining}
              trialEndsAt={trialEndsAt}
              scansUsed={scansUsed}
              purchasedScans={purchasedScans}
              monthResetDate={monthResetDate}
              trialAvailable={trialAvailable}
              isSubscriptionLoading={isSubscriptionLoading}
              openBillingPortal={openBillingPortal}
              handleUpgrade={handleUpgrade}
              handleStartTrial={handleStartTrial}
              connectStatus={connectStatus}
              connectSetupLoading={connectSetupLoading}
              handleSetupConnect={handleSetupConnect}
              handleOpenDashboard={handleOpenDashboard}
            />
          )}
        </div>
      </div>
    </div>
  );
}
