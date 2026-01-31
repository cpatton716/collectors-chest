"use client";

import { useState } from "react";
import { FollowListModal } from "./FollowListModal";

interface FollowerCountProps {
  userId: string;
  followerCount: number;
  followingCount: number;
}

function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}

export function FollowerCount({
  userId,
  followerCount,
  followingCount,
}: FollowerCountProps) {
  const [showModal, setShowModal] = useState<"followers" | "following" | null>(
    null
  );

  return (
    <>
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setShowModal("followers")}
          className="hover:underline"
        >
          <span className="font-bold">{formatCount(followerCount)}</span>{" "}
          <span className="text-gray-600">followers</span>
        </button>
        <span>·</span>
        <button
          onClick={() => setShowModal("following")}
          className="hover:underline"
        >
          <span className="font-bold">{formatCount(followingCount)}</span>{" "}
          <span className="text-gray-600">following</span>
        </button>
      </div>

      {showModal && (
        <FollowListModal
          userId={userId}
          type={showModal}
          isOpen={true}
          onClose={() => setShowModal(null)}
        />
      )}
    </>
  );
}
