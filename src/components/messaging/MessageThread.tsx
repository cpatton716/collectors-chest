"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Flag, Loader2, MoreVertical, ShieldX } from "lucide-react";

import { supabase } from "@/lib/supabase";

import { SellerProfile } from "@/types/auction";
import { Message, MessagesResponse } from "@/types/messaging";

import { BlockUserModal } from "./BlockUserModal";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { ReportMessageModal } from "./ReportMessageModal";

interface MessageThreadProps {
  conversationId: string;
  currentUserId: string;
  onMessageSent?: () => void;
}

export function MessageThread({
  conversationId,
  currentUserId,
  onMessageSent,
}: MessageThreadProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherParticipant, setOtherParticipant] = useState<SellerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Block/Report modal state
  const [showMenu, setShowMenu] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  // Subscribe to realtime messages via broadcast
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on("broadcast", { event: "new-message" }, ({ payload }) => {
        const newMessage = payload.message;

        // Only add if it's from the other user (we already add our own optimistically)
        if (newMessage.senderId !== currentUserId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });

          // Mark as read since we're viewing the conversation
          fetch(`/api/messages/${conversationId}/read`, {
            method: "POST",
          }).catch(() => {});
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  const loadMessages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/messages/${conversationId}`);
      if (!response.ok) {
        throw new Error("Failed to load messages");
      }
      const data: MessagesResponse = await response.json();
      setMessages(data.messages);
      setOtherParticipant(data.otherParticipant);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (content: string, imageUrls?: string[]) => {
    if (!otherParticipant) return;

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: otherParticipant.id,
        content,
        imageUrls,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to send message");
    }

    const { message } = await response.json();
    setMessages((prev) => [...prev, message]);
    onMessageSent?.();
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-pop-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div>
          <p className="text-red-600">{error}</p>
          <button onClick={loadMessages} className="mt-2 text-sm text-pop-blue hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header with participant info and menu */}
      {otherParticipant && (
        <div className="flex items-center justify-between border-b-2 border-pop-black bg-pop-white px-4 py-3">
          {otherParticipant.username ? (
            <Link
              href={`/u/${otherParticipant.username}`}
              className="font-bold text-pop-blue hover:underline"
            >
              @{otherParticipant.username}
            </Link>
          ) : (
            <p
              className="font-bold text-gray-500 cursor-default"
              title="This user hasn't set up a public collection"
            >
              {otherParticipant.displayName || "User"}
            </p>
          )}

          {/* Menu dropdown */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg p-2 hover:bg-gray-100"
              aria-label="Conversation options"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border-2 border-pop-black bg-pop-white py-1 shadow-comic">
                <button
                  onClick={() => {
                    setShowBlockModal(true);
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left font-medium hover:bg-gray-100"
                >
                  <ShieldX className="h-4 w-4 text-pop-red" />
                  Block User
                </button>
                <button
                  onClick={() => {
                    // Find the most recent message from the other user to report
                    const otherMessages = messages.filter((m) => m.senderId !== currentUserId);
                    if (otherMessages.length > 0) {
                      setSelectedMessageId(otherMessages[otherMessages.length - 1].id);
                      setShowReportModal(true);
                    }
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left font-medium hover:bg-gray-100"
                >
                  <Flag className="h-4 w-4 text-pop-red" />
                  Report
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-gray-500">
            No messages yet. Send one to start the conversation!
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwnMessage={message.senderId === currentUserId}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <MessageComposer onSend={handleSendMessage} />

      {/* Block Modal */}
      <BlockUserModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        userId={otherParticipant?.id || ""}
        username={otherParticipant?.username || otherParticipant?.displayName || "User"}
        onBlocked={() => {
          router.push("/messages");
        }}
      />

      {/* Report Modal */}
      <ReportMessageModal
        isOpen={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setSelectedMessageId(null);
        }}
        messageId={selectedMessageId || ""}
      />
    </div>
  );
}
