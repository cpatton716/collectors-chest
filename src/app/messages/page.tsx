"use client";

import { Suspense, useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { useUser } from "@clerk/nextjs";

import { Loader2, MessageSquare } from "lucide-react";

import { ConversationList } from "@/components/messaging/ConversationList";
import { MessageThread } from "@/components/messaging/MessageThread";

import { ConversationPreview, ConversationsResponse } from "@/types/messaging";

function MessagesContent() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get conversation ID from URL if provided
  const urlConversationId = searchParams.get("id");

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in");
    }
  }, [isLoaded, user, router]);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadCurrentUser();
    }
  }, [user]);

  useEffect(() => {
    // Set selected conversation from URL or first conversation
    if (urlConversationId) {
      setSelectedConversationId(urlConversationId);
    } else if (conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [urlConversationId, conversations, selectedConversationId]);

  const loadCurrentUser = async () => {
    try {
      const response = await fetch("/api/username/current");
      if (response.ok) {
        const data = await response.json();
        setCurrentUserId(data.profileId);
      }
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  };

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/messages");
      if (response.ok) {
        const data: ConversationsResponse = await response.json();
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    // Update URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.set("id", id);
    window.history.pushState({}, "", url.toString());
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pop-blue" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-pop-cream">
      {/* Header */}
      <div className="border-b-4 border-pop-black bg-pop-white">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pop-blue border-2 border-pop-black">
              <MessageSquare className="h-5 w-5 text-pop-white" />
            </div>
            <h1 className="text-2xl font-comic text-pop-black">MESSAGES</h1>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-6xl">
        <div className="flex h-[calc(100vh-120px)] border-x-4 border-b-4 border-pop-black bg-pop-white">
          {/* Conversation list - hidden on mobile when conversation selected */}
          <div
            className={`w-full border-r-2 border-pop-black md:w-80 ${
              selectedConversationId ? "hidden md:block" : ""
            }`}
          >
            <ConversationList
              conversations={conversations}
              selectedId={selectedConversationId || undefined}
              onSelect={handleSelectConversation}
            />
          </div>

          {/* Message thread */}
          <div className={`flex-1 ${!selectedConversationId ? "hidden md:flex" : "flex"}`}>
            {selectedConversationId && currentUserId ? (
              <div className="flex w-full flex-col">
                {/* Back button for mobile */}
                <button
                  onClick={() => setSelectedConversationId(null)}
                  className="border-b-2 border-pop-black p-2 text-left text-sm font-bold text-pop-blue md:hidden"
                >
                  ← Back to conversations
                </button>
                <div className="flex-1">
                  <MessageThread
                    conversationId={selectedConversationId}
                    currentUserId={currentUserId}
                    onMessageSent={loadConversations}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-gray-500">
                <div className="text-center">
                  <MessageSquare className="mx-auto h-12 w-12 opacity-50" />
                  <p className="mt-2">Select a conversation to view messages</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-pop-blue" />
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
