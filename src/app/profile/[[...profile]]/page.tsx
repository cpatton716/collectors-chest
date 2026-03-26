"use client";

import dynamic from "next/dynamic";

import { useUser } from "@clerk/nextjs";

import { Loader2 } from "lucide-react";

const CustomProfilePage = dynamic(
  () => import("@/components/CustomProfilePage").then((mod) => mod.CustomProfilePage),
  { ssr: false, loading: () => (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    </div>
  )}
);

export default function ProfilePage() {
  const { isLoaded, isSignedIn } = useUser();

  // Show loading state while checking auth
  if (!isLoaded) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // Guest users shouldn't see profile page
  if (!isSignedIn) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Sign in to view your profile</h1>
          <p className="text-gray-600">Create an account to access your profile settings.</p>
        </div>
      </div>
    );
  }

  return <CustomProfilePage />;
}
