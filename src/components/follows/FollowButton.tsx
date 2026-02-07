"use client";

import { useEffect, useState } from "react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";

interface FollowButtonProps {
  userId: string;
  initialIsFollowing?: boolean;
  size?: "sm" | "md";
  onFollowChange?: (isFollowing: boolean) => void;
}

export function FollowButton({
  userId,
  initialIsFollowing,
  size = "md",
  onFollowChange,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing ?? false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(initialIsFollowing === undefined);
  const [isHovered, setIsHovered] = useState(false);

  // Fetch follow status on mount when not provided by parent
  useEffect(() => {
    if (initialIsFollowing !== undefined) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/follows/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setIsFollowing(data.isFollowing ?? false);
        }
      } catch {
        // Silently fail — button defaults to "Follow"
      } finally {
        setIsChecking(false);
      }
    };

    checkStatus();
  }, [userId, initialIsFollowing]);

  const sizeClasses = {
    sm: "px-2 py-1 text-xs gap-1",
    md: "px-3 py-1.5 text-sm gap-1.5",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
  };

  const handleClick = async () => {
    setIsLoading(true);
    const previousState = isFollowing;

    // Optimistic update
    setIsFollowing(!isFollowing);

    try {
      const response = await fetch(`/api/follows/${userId}`, {
        method: isFollowing ? "DELETE" : "POST",
      });

      if (!response.ok) {
        // Rollback on error
        setIsFollowing(previousState);
        const error = await response.json();
        console.error("Follow action failed:", error);
        return;
      }

      // Call callback if provided
      onFollowChange?.(!previousState);
    } catch (error) {
      // Rollback on error
      setIsFollowing(previousState);
      console.error("Follow action failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const baseClasses = `inline-flex items-center rounded-full font-medium border-2 transition-colors ${sizeClasses[size]}`;

  // Show loading spinner while checking initial status
  if (isChecking) {
    return (
      <span className={`${baseClasses} border-gray-200 bg-gray-50 text-gray-400 cursor-default`}>
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
        <span>Follow</span>
      </span>
    );
  }

  // Following state (with hover to show unfollow)
  if (isFollowing) {
    const showUnfollow = isHovered && !isLoading;

    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`${baseClasses} ${
          showUnfollow
            ? "bg-red-50 border-red-300 text-red-600"
            : "bg-pop-blue/10 border-pop-blue text-pop-blue"
        } ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {isLoading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : showUnfollow ? (
          <UserPlus className={iconSizes[size]} />
        ) : (
          <UserCheck className={iconSizes[size]} />
        )}
        <span>{showUnfollow ? "Unfollow" : "Following"}</span>
      </button>
    );
  }

  // Not following state
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={`${baseClasses} border-pop-black bg-pop-white hover:bg-pop-yellow ${
        isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      {isLoading ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : (
        <UserPlus className={iconSizes[size]} />
      )}
      <span>Follow</span>
    </button>
  );
}
