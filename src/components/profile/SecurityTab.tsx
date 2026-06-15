"use client";

import type { UserResource } from "@clerk/types";

import {
  Check,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Monitor,
  Smartphone,
  Trash2,
} from "lucide-react";

import { ProfileSession } from "./profileTabHelpers";

interface SecurityTabProps {
  user: UserResource | null | undefined;
  openUserProfile: () => void;
  signOut: () => void;
  isLoadingSessions: boolean;
  sessions: ProfileSession[];
  isRevokingSession: string | null;
  handleRevokeSession: (sessionId: string) => void;
}

export function SecurityTab({
  user,
  openUserProfile,
  signOut,
  isLoadingSessions,
  sessions,
  isRevokingSession,
  handleRevokeSession,
}: SecurityTabProps) {
  return (
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
          className="px-4 py-2 text-sm font-comic text-pop-black bg-pop-yellow border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
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
                className="mt-2 px-3 py-1 text-sm font-comic text-pop-black bg-pop-yellow border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all"
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
                    className="p-2 text-pop-black hover:bg-pop-red hover:text-white border-2 border-pop-black transition-all disabled:opacity-50"
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
          className="px-4 py-2 text-sm font-comic text-white bg-pop-red border-2 border-pop-black shadow-comic-sm hover:translate-y-0.5 hover:shadow-none transition-all flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
