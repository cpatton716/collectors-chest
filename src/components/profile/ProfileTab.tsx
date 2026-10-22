"use client";

import Image from "next/image";

import type { UserResource } from "@clerk/types";

import {
  AlertCircle,
  AtSign,
  Camera,
  Check,
  Loader2,
  Mail,
  MapPin,
  Shield,
  User,
  X,
} from "lucide-react";

import { MARKETPLACE_ENABLED } from "@/lib/features";

import {
  CreatorBadge,
  FeedbackList,
  FeedbackSummary,
  TrustBadge,
} from "@/components/creatorCredits";
import { FollowerCount } from "@/components/follows";

import { TransactionFeedback, UserCreatorProfile } from "@/types/creatorCredits";

import { LocationPrivacy } from "@/app/api/location/route";

import { UsernameAvailability } from "./profileTabHelpers";

interface ProfileTabProps {
  user: UserResource | null | undefined;

  // Avatar
  isUploadingAvatar: boolean;
  avatarError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleAvatarClick: () => void;
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // Name / profile
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  setProfileError: (value: string | null) => void;
  setProfileUpdateSuccess: (value: boolean) => void;
  handleUpdateProfile: () => void;
  hasProfileChanges: boolean;
  isUpdatingProfile: boolean;
  profileUpdateSuccess: boolean;
  profileError: string | null;

  // Username
  isLoadingUsername: boolean;
  username: string;
  setUsername: (value: string) => void;
  setUsernameError: (value: string | null) => void;
  setUsernameSuccess: (value: boolean) => void;
  isCheckingUsername: boolean;
  usernameAvailability: UsernameAvailability | null;
  hasUsernameChanges: boolean;
  handleSaveUsername: () => void;
  canSaveUsername: boolean | undefined;
  isSavingUsername: boolean;
  usernameSuccess: boolean;
  usernameError: string | null;

  // Followers
  isLoadingFollowCounts: boolean;
  profileId: string | null;
  followerCount: number;
  followingCount: number;

  // Location
  isLoadingLocation: boolean;
  locationCity: string;
  setLocationCity: (value: string) => void;
  locationState: string;
  setLocationState: (value: string) => void;
  locationCountry: string;
  setLocationCountry: (value: string) => void;
  locationPrivacy: LocationPrivacy;
  setLocationPrivacy: (value: LocationPrivacy) => void;
  setLocationError: (value: string | null) => void;
  setLocationSuccess: (value: boolean) => void;
  handleSaveLocation: () => void;
  canSaveLocation: boolean;
  isSavingLocation: boolean;
  locationSuccess: boolean;
  locationError: string | null;

  // Creator credits
  isLoadingCreatorProfile: boolean;
  creatorProfile: UserCreatorProfile | null;
  recentFeedback: TransactionFeedback[];

  // Display preferences
  showFinancials: boolean;
  handleToggleFinancials: () => void;
}

export function ProfileTab({
  user,
  isUploadingAvatar,
  avatarError,
  fileInputRef,
  handleAvatarClick,
  handleAvatarChange,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  setProfileError,
  setProfileUpdateSuccess,
  handleUpdateProfile,
  hasProfileChanges,
  isUpdatingProfile,
  profileUpdateSuccess,
  profileError,
  isLoadingUsername,
  username,
  setUsername,
  setUsernameError,
  setUsernameSuccess,
  isCheckingUsername,
  usernameAvailability,
  hasUsernameChanges,
  handleSaveUsername,
  canSaveUsername,
  isSavingUsername,
  usernameSuccess,
  usernameError,
  isLoadingFollowCounts,
  profileId,
  followerCount,
  followingCount,
  isLoadingLocation,
  locationCity,
  setLocationCity,
  locationState,
  setLocationState,
  locationCountry,
  setLocationCountry,
  locationPrivacy,
  setLocationPrivacy,
  setLocationError,
  setLocationSuccess,
  handleSaveLocation,
  canSaveLocation,
  isSavingLocation,
  locationSuccess,
  locationError,
  isLoadingCreatorProfile,
  creatorProfile,
  recentFeedback,
  showFinancials,
  handleToggleFinancials,
}: ProfileTabProps) {
  return (
    <>
      {/* Profile Tab */}
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
              className="px-4 py-2 text-sm font-comic text-pop-black bg-pop-yellow border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
            Your unique username{MARKETPLACE_ENABLED && " for the marketplace"}. Displayed as
            @username.
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
                  {isCheckingUsername && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
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
              {usernameAvailability?.available && username.length >= 3 && hasUsernameChanges && (
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
                  className="px-4 py-2 text-sm font-comic text-pop-black bg-pop-yellow border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          <p className="text-xs text-gray-500 mb-4">See who follows you and who you follow</p>

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
                <label className="block text-xs text-gray-500 mb-1">Location Visibility</label>
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
                  Controls what other users see on your {MARKETPLACE_ENABLED && "listings and "}
                  profile
                </p>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={handleSaveLocation}
                  disabled={!canSaveLocation}
                  className="px-4 py-2 text-sm font-comic text-pop-black bg-pop-yellow border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        <div className="border-t border-gray-100 pt-8 mb-8">
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

      {/* Display Preferences */}
      <div
        className="bg-pop-white border-3 border-pop-black p-6 mt-8 mb-8"
        style={{ boxShadow: "4px 4px 0px #000" }}
      >
        <h3 className="text-lg font-black text-pop-black mb-4">Display Preferences</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-pop-black">Show Financial Fields</p>
            <p className="text-sm text-gray-500">
              Display Cost, Sales, and Profit/Loss on your collection page
            </p>
          </div>
          <button
            onClick={handleToggleFinancials}
            className={`relative w-12 h-6 rounded-full transition-colors ${showFinancials ? "bg-pop-green" : "bg-gray-300"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${showFinancials ? "translate-x-6" : ""}`}
            />
          </button>
        </div>
      </div>
    </>
  );
}
