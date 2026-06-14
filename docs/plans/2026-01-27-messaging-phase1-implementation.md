# Phase 1: Core Messaging Implementation Plan

> **✅ STATUS: COMPLETED & SHIPPED.** This is a historical implementation plan retained for reference. The messaging system (conversations, message threads, image attachments, content filtering, and moderation) is live in production. Do not execute these steps — they have already been carried out.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the foundational messaging system with database, APIs, and basic UI for text-only conversations between users.

**Architecture:** Two database tables (conversations, messages) with unified threads per user pair. Messages reference a listing for context. REST APIs handle CRUD, React components provide inbox UI with conversation list and message thread views.

**Tech Stack:** Next.js App Router, Supabase (Postgres), TypeScript, Tailwind CSS, Lucide icons

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260127_messaging.sql`

**Step 1: Write the migration file**

```sql
-- ============================================================================
-- MESSAGING SYSTEM MIGRATION - Phase 1
-- ============================================================================
-- Creates core tables for peer-to-peer messaging:
-- - conversations: One per user pair, tracks last activity
-- - messages: Individual messages with listing context
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE CONVERSATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique conversation per user pair (ordered for consistency)
  CONSTRAINT unique_conversation UNIQUE (participant_1_id, participant_2_id),
  -- Ensure participant_1_id < participant_2_id for canonical ordering
  CONSTRAINT ordered_participants CHECK (participant_1_id < participant_2_id)
);

-- Indexes for conversation lookups
CREATE INDEX idx_conversations_participant_1 ON conversations(participant_1_id);
CREATE INDEX idx_conversations_participant_2 ON conversations(participant_2_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

-- ============================================================================
-- STEP 2: CREATE MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,

  -- Listing context ("Regarding: Amazing Spider-Man #300")
  listing_id UUID REFERENCES auctions(id) ON DELETE SET NULL,

  -- Read status (for recipient)
  is_read BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for message queries
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = FALSE;

-- ============================================================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Conversations: Users can see conversations they're part of
CREATE POLICY "conversations_select_policy" ON conversations
  FOR SELECT USING (
    participant_1_id = public.current_profile_id() OR
    participant_2_id = public.current_profile_id()
  );

-- Conversations: Users can insert if they're a participant
CREATE POLICY "conversations_insert_policy" ON conversations
  FOR INSERT WITH CHECK (
    participant_1_id = public.current_profile_id() OR
    participant_2_id = public.current_profile_id()
  );

-- Conversations: Users can update conversations they're part of
CREATE POLICY "conversations_update_policy" ON conversations
  FOR UPDATE USING (
    participant_1_id = public.current_profile_id() OR
    participant_2_id = public.current_profile_id()
  );

-- Messages: Users can see messages in their conversations
CREATE POLICY "messages_select_policy" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.participant_1_id = public.current_profile_id() OR
           c.participant_2_id = public.current_profile_id())
    )
  );

-- Messages: Users can insert messages in their conversations
CREATE POLICY "messages_insert_policy" ON messages
  FOR INSERT WITH CHECK (
    sender_id = public.current_profile_id() AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.participant_1_id = public.current_profile_id() OR
           c.participant_2_id = public.current_profile_id())
    )
  );

-- Messages: Users can update messages (mark as read)
CREATE POLICY "messages_update_policy" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.participant_1_id = public.current_profile_id() OR
           c.participant_2_id = public.current_profile_id())
    )
  );

-- ============================================================================
-- STEP 4: CREATE HELPER FUNCTION FOR CONVERSATION LOOKUP
-- ============================================================================

-- Function to get or create a conversation between two users
-- Always orders IDs so participant_1_id < participant_2_id
CREATE OR REPLACE FUNCTION get_or_create_conversation(user_a UUID, user_b UUID)
RETURNS UUID AS $$
DECLARE
  p1 UUID;
  p2 UUID;
  conv_id UUID;
BEGIN
  -- Order the IDs canonically
  IF user_a < user_b THEN
    p1 := user_a;
    p2 := user_b;
  ELSE
    p1 := user_b;
    p2 := user_a;
  END IF;

  -- Try to find existing conversation
  SELECT id INTO conv_id
  FROM conversations
  WHERE participant_1_id = p1 AND participant_2_id = p2;

  -- Create if not exists
  IF conv_id IS NULL THEN
    INSERT INTO conversations (participant_1_id, participant_2_id)
    VALUES (p1, p2)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 5: TRIGGER TO UPDATE CONVERSATION TIMESTAMP
-- ============================================================================

CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NOW(), updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON messages;
CREATE TRIGGER trigger_update_conversation_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
```

**Step 2: Verify migration syntax**

Run: `cd "/Users/chrispatton/Coding for Dummies/Comic Tracker/.worktrees/peer-to-peer-messaging" && cat supabase/migrations/20260127_messaging.sql | head -20`
Expected: See first 20 lines of migration

**Step 3: Commit migration**

```bash
git add supabase/migrations/20260127_messaging.sql
git commit -m "feat(messaging): add database migration for conversations and messages"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/messaging.ts`

**Step 1: Create types file**

```typescript
// ============================================================================
// MESSAGING TYPES
// ============================================================================

import { SellerProfile } from "./auction";

/**
 * A conversation between two users
 */
export interface Conversation {
  id: string;
  participant1Id: string;
  participant2Id: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;

  // Joined data (populated when needed)
  otherParticipant?: SellerProfile;
  lastMessage?: Message;
  unreadCount?: number;
}

/**
 * An individual message in a conversation
 */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  listingId: string | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;

  // Joined data (populated when needed)
  sender?: SellerProfile;
  listing?: {
    id: string;
    title: string;
    coverImageUrl: string | null;
  };
}

/**
 * Input for sending a message
 */
export interface SendMessageInput {
  recipientId: string;
  content: string;
  listingId?: string;
}

/**
 * Conversation list item for inbox display
 */
export interface ConversationPreview {
  id: string;
  otherParticipant: SellerProfile;
  lastMessage: {
    content: string;
    senderId: string;
    createdAt: string;
  };
  unreadCount: number;
  lastMessageAt: string;
}

/**
 * Result from get conversations API
 */
export interface ConversationsResponse {
  conversations: ConversationPreview[];
  totalUnread: number;
}

/**
 * Result from get messages API
 */
export interface MessagesResponse {
  messages: Message[];
  conversation: Conversation;
  otherParticipant: SellerProfile;
}
```

**Step 2: Verify file created**

Run: `cat src/types/messaging.ts | head -10`
Expected: See the file header and imports

**Step 3: Commit types**

```bash
git add src/types/messaging.ts
git commit -m "feat(messaging): add TypeScript types for messaging"
```

---

## Task 3: Database Helper Functions

**Files:**
- Create: `src/lib/messagingDb.ts`

**Step 1: Create database helper file**

```typescript
import {
  Conversation,
  ConversationPreview,
  Message,
  MessagesResponse,
  SendMessageInput,
} from "@/types/messaging";

import { supabase, supabaseAdmin } from "./supabase";
import { getSellerProfile } from "./auctionDb";

// ============================================================================
// CONVERSATION HELPERS
// ============================================================================

/**
 * Get or create a conversation between two users
 */
export async function getOrCreateConversation(
  userId: string,
  otherUserId: string
): Promise<string> {
  // Use the database function to handle ordering and upsert
  const { data, error } = await supabaseAdmin.rpc("get_or_create_conversation", {
    user_a: userId,
    user_b: otherUserId,
  });

  if (error) throw error;
  return data as string;
}

/**
 * Get all conversations for a user with previews
 */
export async function getUserConversations(
  userId: string
): Promise<ConversationPreview[]> {
  // Get conversations where user is a participant
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(`
      id,
      participant_1_id,
      participant_2_id,
      last_message_at,
      messages (
        id,
        content,
        sender_id,
        created_at,
        is_read
      )
    `)
    .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  if (!conversations) return [];

  // Build previews with other participant info
  const previews: ConversationPreview[] = [];

  for (const conv of conversations) {
    const otherUserId =
      conv.participant_1_id === userId ? conv.participant_2_id : conv.participant_1_id;

    // Get other participant's profile
    const otherParticipant = await getSellerProfile(otherUserId);
    if (!otherParticipant) continue;

    // Get last message and unread count
    const messages = conv.messages as Array<{
      id: string;
      content: string;
      sender_id: string;
      created_at: string;
      is_read: boolean;
    }>;

    // Sort messages by date descending to get latest first
    messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const lastMessage = messages[0];
    const unreadCount = messages.filter(
      (m) => m.sender_id !== userId && !m.is_read
    ).length;

    if (lastMessage) {
      previews.push({
        id: conv.id,
        otherParticipant,
        lastMessage: {
          content: lastMessage.content,
          senderId: lastMessage.sender_id,
          createdAt: lastMessage.created_at,
        },
        unreadCount,
        lastMessageAt: conv.last_message_at,
      });
    }
  }

  return previews;
}

/**
 * Get unread message count for a user
 */
export async function getUnreadMessageCount(userId: string): Promise<number> {
  // Get all conversations for user
  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("id")
    .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`);

  if (convError) throw convError;
  if (!conversations || conversations.length === 0) return 0;

  const conversationIds = conversations.map((c) => c.id);

  // Count unread messages where user is NOT the sender
  const { count, error } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .in("conversation_id", conversationIds)
    .neq("sender_id", userId)
    .eq("is_read", false);

  if (error) throw error;
  return count || 0;
}

// ============================================================================
// MESSAGE HELPERS
// ============================================================================

/**
 * Get messages for a conversation
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<MessagesResponse> {
  // Get conversation
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (convError) throw convError;
  if (!conv) throw new Error("Conversation not found");

  // Verify user is a participant
  if (conv.participant_1_id !== userId && conv.participant_2_id !== userId) {
    throw new Error("Access denied");
  }

  // Get other participant
  const otherUserId =
    conv.participant_1_id === userId ? conv.participant_2_id : conv.participant_1_id;
  const otherParticipant = await getSellerProfile(otherUserId);
  if (!otherParticipant) throw new Error("Other participant not found");

  // Get messages
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select(`
      *,
      auctions:listing_id (
        id,
        comics (
          title,
          cover_image_url
        )
      )
    `)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgError) throw msgError;

  // Transform messages
  const transformedMessages: Message[] = (messages || []).map((msg) => ({
    id: msg.id,
    conversationId: msg.conversation_id,
    senderId: msg.sender_id,
    content: msg.content,
    listingId: msg.listing_id,
    isRead: msg.is_read,
    createdAt: msg.created_at,
    updatedAt: msg.updated_at,
    listing: msg.auctions
      ? {
          id: msg.auctions.id,
          title: msg.auctions.comics?.title || "Unknown",
          coverImageUrl: msg.auctions.comics?.cover_image_url || null,
        }
      : undefined,
  }));

  // Mark messages as read (where user is recipient)
  await supabaseAdmin
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .eq("is_read", false);

  return {
    messages: transformedMessages,
    conversation: {
      id: conv.id,
      participant1Id: conv.participant_1_id,
      participant2Id: conv.participant_2_id,
      lastMessageAt: conv.last_message_at,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
    },
    otherParticipant,
  };
}

/**
 * Send a message
 */
export async function sendMessage(
  senderId: string,
  input: SendMessageInput
): Promise<Message> {
  const { recipientId, content, listingId } = input;

  // Validate content
  if (!content || content.trim().length === 0) {
    throw new Error("Message content is required");
  }

  if (content.length > 2000) {
    throw new Error("Message is too long (max 2000 characters)");
  }

  // Can't message yourself
  if (senderId === recipientId) {
    throw new Error("Cannot send message to yourself");
  }

  // Get or create conversation
  const conversationId = await getOrCreateConversation(senderId, recipientId);

  // Insert message
  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content.trim(),
      listing_id: listingId || null,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    conversationId: data.conversation_id,
    senderId: data.sender_id,
    content: data.content,
    listingId: data.listing_id,
    isRead: data.is_read,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
```

**Step 2: Verify the file compiles**

Run: `cd "/Users/chrispatton/Coding for Dummies/Comic Tracker/.worktrees/peer-to-peer-messaging" && npx tsc --noEmit src/lib/messagingDb.ts 2>&1 | head -20`
Expected: No errors, or only unrelated errors from other files

**Step 3: Commit database helpers**

```bash
git add src/lib/messagingDb.ts
git commit -m "feat(messaging): add database helper functions"
```

---

## Task 4: API Route - List Conversations (GET /api/messages)

**Files:**
- Create: `src/app/api/messages/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { isUserSuspended } from "@/lib/adminAuth";
import { getProfileByClerkId } from "@/lib/db";
import {
  getUnreadMessageCount,
  getUserConversations,
  sendMessage,
} from "@/lib/messagingDb";

// GET - List user's conversations
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const conversations = await getUserConversations(profile.id);
    const totalUnread = await getUnreadMessageCount(profile.id);

    return NextResponse.json({
      conversations,
      totalUnread,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

// POST - Send a new message
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is suspended
    const suspensionStatus = await isUserSuspended(userId);
    if (suspensionStatus.suspended) {
      return NextResponse.json(
        { error: "Your account has been suspended." },
        { status: 403 }
      );
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const { recipientId, content, listingId } = body;

    if (!recipientId) {
      return NextResponse.json(
        { error: "Recipient ID is required" },
        { status: 400 }
      );
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    const message = await sendMessage(profile.id, {
      recipientId,
      content,
      listingId,
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Error sending message:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify the route compiles**

Run: `cd "/Users/chrispatton/Coding for Dummies/Comic Tracker/.worktrees/peer-to-peer-messaging" && npx tsc --noEmit src/app/api/messages/route.ts 2>&1 | head -10`
Expected: No errors

**Step 3: Commit API route**

```bash
git add src/app/api/messages/route.ts
git commit -m "feat(messaging): add GET/POST /api/messages for conversations and sending"
```

---

## Task 5: API Route - Get Conversation Messages (GET /api/messages/[conversationId])

**Files:**
- Create: `src/app/api/messages/[conversationId]/route.ts`

**Step 1: Create the conversation detail route**

```typescript
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { getConversationMessages } from "@/lib/messagingDb";

// GET - Get messages for a specific conversation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { conversationId } = await params;

    const result = await getConversationMessages(conversationId, profile.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching messages:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage === "Access denied") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (errorMessage === "Conversation not found") {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit the route**

```bash
git add src/app/api/messages/[conversationId]/route.ts
git commit -m "feat(messaging): add GET /api/messages/[id] for conversation thread"
```

---

## Task 6: API Route - Unread Count (GET /api/messages/unread-count)

**Files:**
- Create: `src/app/api/messages/unread-count/route.ts`

**Step 1: Create the unread count route**

```typescript
import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { getProfileByClerkId } from "@/lib/db";
import { getUnreadMessageCount } from "@/lib/messagingDb";

// GET - Get unread message count for badge display
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const count = await getUnreadMessageCount(profile.id);

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return NextResponse.json(
      { error: "Failed to fetch unread count" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit the route**

```bash
git add src/app/api/messages/unread-count/route.ts
git commit -m "feat(messaging): add GET /api/messages/unread-count for badge"
```

---

## Task 7: Message Composer Component

**Files:**
- Create: `src/components/messaging/MessageComposer.tsx`

**Step 1: Create component directory and file**

```typescript
"use client";

import { useState } from "react";

import { Loader2, Send } from "lucide-react";

interface MessageComposerProps {
  onSend: (content: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
}

export function MessageComposer({
  onSend,
  placeholder = "Type a message...",
  disabled = false,
}: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedContent = content.trim();
    if (!trimmedContent || isSending || disabled) return;

    setIsSending(true);
    try {
      await onSend(trimmedContent);
      setContent("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift for newline)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t-2 border-pop-black bg-pop-white p-3">
      <div className="flex gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSending}
          rows={1}
          maxLength={2000}
          className="flex-1 resize-none rounded-lg border-2 border-pop-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pop-blue disabled:opacity-50"
          style={{ minHeight: "40px", maxHeight: "120px" }}
        />
        <button
          type="submit"
          disabled={!content.trim() || isSending || disabled}
          className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-pop-black bg-pop-blue text-white transition-all hover:shadow-[2px_2px_0px_#000] disabled:opacity-50 disabled:hover:shadow-none"
        >
          {isSending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}
```

**Step 2: Commit component**

```bash
mkdir -p src/components/messaging
git add src/components/messaging/MessageComposer.tsx
git commit -m "feat(messaging): add MessageComposer component"
```

---

## Task 8: Message Bubble Component

**Files:**
- Create: `src/components/messaging/MessageBubble.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { Message } from "@/types/messaging";

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
}

export function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const formattedDate = new Date(message.createdAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });

  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-lg px-3 py-2 ${
          isOwnMessage
            ? "bg-pop-blue text-white"
            : "border-2 border-pop-black bg-pop-white"
        }`}
      >
        {/* Listing context badge */}
        {message.listing && (
          <div
            className={`mb-1 text-xs ${
              isOwnMessage ? "text-blue-100" : "text-gray-500"
            }`}
          >
            Re: {message.listing.title}
          </div>
        )}

        {/* Message content */}
        <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>

        {/* Timestamp */}
        <p
          className={`mt-1 text-xs ${
            isOwnMessage ? "text-blue-100" : "text-gray-400"
          }`}
        >
          {formattedDate} at {formattedTime}
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Commit component**

```bash
git add src/components/messaging/MessageBubble.tsx
git commit -m "feat(messaging): add MessageBubble component"
```

---

## Task 9: Message Thread Component

**Files:**
- Create: `src/components/messaging/MessageThread.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";

import { Loader2 } from "lucide-react";

import { Message, MessagesResponse } from "@/types/messaging";
import { SellerProfile } from "@/types/auction";

import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherParticipant, setOtherParticipant] = useState<SellerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const handleSendMessage = async (content: string) => {
    if (!otherParticipant) return;

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: otherParticipant.id,
        content,
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
          <button
            onClick={loadMessages}
            className="mt-2 text-sm text-pop-blue hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with participant info */}
      {otherParticipant && (
        <div className="border-b-2 border-pop-black bg-pop-white px-4 py-3">
          <p className="font-bold">
            {otherParticipant.username
              ? `@${otherParticipant.username}`
              : otherParticipant.displayName || "User"}
          </p>
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
    </div>
  );
}
```

**Step 2: Commit component**

```bash
git add src/components/messaging/MessageThread.tsx
git commit -m "feat(messaging): add MessageThread component"
```

---

## Task 10: Conversation List Component

**Files:**
- Create: `src/components/messaging/ConversationList.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { ConversationPreview } from "@/types/messaging";

interface ConversationListProps {
  conversations: ConversationPreview[];
  selectedId?: string;
  onSelect: (conversationId: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No conversations yet</p>
        <p className="mt-1 text-sm">
          Message a seller to start a conversation
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y-2 divide-pop-black">
      {conversations.map((conv) => {
        const isSelected = conv.id === selectedId;
        const displayName = conv.otherParticipant.username
          ? `@${conv.otherParticipant.username}`
          : conv.otherParticipant.displayName || "User";

        const timeAgo = getTimeAgo(conv.lastMessageAt);
        const isUnread = conv.unreadCount > 0;

        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full px-4 py-3 text-left transition-colors ${
              isSelected
                ? "bg-pop-blue/10"
                : "bg-pop-white hover:bg-gray-50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className={`truncate font-bold ${isUnread ? "text-pop-black" : "text-gray-700"}`}>
                  {displayName}
                </p>
                <p className={`truncate text-sm ${isUnread ? "font-medium text-pop-black" : "text-gray-500"}`}>
                  {conv.lastMessage.content}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-gray-400">{timeAgo}</span>
                {isUnread && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-pop-red px-1.5 text-xs font-bold text-white">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}
```

**Step 2: Commit component**

```bash
git add src/components/messaging/ConversationList.tsx
git commit -m "feat(messaging): add ConversationList component"
```

---

## Task 11: Messages Page

**Files:**
- Create: `src/app/messages/page.tsx`

**Step 1: Create the page**

```typescript
"use client";

import { useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { useUser } from "@clerk/nextjs";
import { Loader2, MessageSquare } from "lucide-react";

import { ConversationPreview, ConversationsResponse } from "@/types/messaging";

import { ConversationList } from "@/components/messaging/ConversationList";
import { MessageThread } from "@/components/messaging/MessageThread";

export default function MessagesPage() {
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
  }, [urlConversationId, conversations]);

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
            <MessageSquare className="h-6 w-6" />
            <h1 className="text-2xl font-black">Messages</h1>
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
          <div
            className={`flex-1 ${
              !selectedConversationId ? "hidden md:flex" : "flex"
            }`}
          >
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
```

**Step 2: Commit page**

```bash
git add src/app/messages/page.tsx
git commit -m "feat(messaging): add /messages inbox page"
```

---

## Task 12: Message Button Component

**Files:**
- Create: `src/components/messaging/MessageButton.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { useUser } from "@clerk/nextjs";
import { Loader2, MessageCircle } from "lucide-react";

interface MessageButtonProps {
  sellerId: string;
  sellerName?: string;
  listingId?: string;
  size?: "sm" | "md" | "lg";
  variant?: "icon" | "button";
  className?: string;
}

export function MessageButton({
  sellerId,
  sellerName,
  listingId,
  size = "md",
  variant = "button",
  className = "",
}: MessageButtonProps) {
  const { user } = useUser();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const sizeClasses = {
    sm: variant === "icon" ? "h-7 w-7" : "px-2 py-1 text-xs",
    md: variant === "icon" ? "h-8 w-8" : "px-3 py-1.5 text-sm",
    lg: variant === "icon" ? "h-10 w-10" : "px-4 py-2 text-base",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const handleClick = async () => {
    if (!user) {
      router.push("/sign-in");
      return;
    }

    setIsLoading(true);
    try {
      // Send an initial message to create the conversation
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: sellerId,
          content: listingId
            ? "Hi! I'm interested in your listing."
            : "Hi! I'd like to chat with you.",
          listingId,
        }),
      });

      if (response.ok) {
        const { message } = await response.json();
        // Navigate to the conversation
        router.push(`/messages?id=${message.conversationId}`);
      } else {
        const data = await response.json();
        console.error("Failed to start conversation:", data.error);
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleClick}
        disabled={isLoading}
        title={`Message ${sellerName || "seller"}`}
        className={`flex items-center justify-center rounded-full border-2 border-pop-black bg-pop-white transition-all hover:bg-pop-blue hover:text-white disabled:opacity-50 ${sizeClasses[size]} ${className}`}
      >
        {isLoading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : (
          <MessageCircle className={iconSizes[size]} />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 rounded-lg border-2 border-pop-black bg-pop-white font-bold transition-all hover:shadow-[2px_2px_0px_#000] disabled:opacity-50 ${sizeClasses[size]} ${className}`}
    >
      {isLoading ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : (
        <MessageCircle className={iconSizes[size]} />
      )}
      <span>Message {sellerName || "Seller"}</span>
    </button>
  );
}
```

**Step 2: Create index file for messaging components**

Create `src/components/messaging/index.ts`:

```typescript
export { ConversationList } from "./ConversationList";
export { MessageBubble } from "./MessageBubble";
export { MessageButton } from "./MessageButton";
export { MessageComposer } from "./MessageComposer";
export { MessageThread } from "./MessageThread";
```

**Step 3: Commit component**

```bash
git add src/components/messaging/MessageButton.tsx src/components/messaging/index.ts
git commit -m "feat(messaging): add MessageButton component and exports"
```

---

## Task 13: Add MessageButton to Listing Detail Modal

**Files:**
- Modify: `src/components/auction/ListingDetailModal.tsx`

**Step 1: Read the file to find where to add the button**

Run: `head -100 src/components/auction/ListingDetailModal.tsx`

**Step 2: Add MessageButton import and component**

After reading the file, add the import at the top:
```typescript
import { MessageButton } from "@/components/messaging/MessageButton";
```

And add the button near the seller badge, in the seller info section (typically after the SellerBadge component):
```typescript
{/* Message Seller button - only show if not the seller */}
{!auction.isSeller && (
  <MessageButton
    sellerId={auction.sellerId}
    sellerName={auction.seller?.username ? `@${auction.seller.username}` : undefined}
    listingId={auction.id}
    size="md"
  />
)}
```

**Step 3: Commit the change**

```bash
git add src/components/auction/ListingDetailModal.tsx
git commit -m "feat(messaging): add MessageButton to listing detail modal"
```

---

## Task 14: Build Verification

**Step 1: Run type check**

Run: `npm run typecheck`
Expected: No errors (or only pre-existing errors)

**Step 2: Run linter**

Run: `npm run lint`
Expected: No new errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Final commit if needed**

If any fixes were required:
```bash
git add -A
git commit -m "fix: resolve build errors for messaging feature"
```

---

## Summary

Phase 1 implements:
- Database schema for conversations and messages
- TypeScript types
- Database helper functions
- API routes: GET/POST /api/messages, GET /api/messages/[id], GET /api/messages/unread-count
- UI components: MessageComposer, MessageBubble, MessageThread, ConversationList, MessageButton
- /messages inbox page
- MessageButton on listing detail modal

**Not included in Phase 1 (deferred to later phases):**
- Image attachments
- Listing embeds in messages
- Entry points everywhere (only listing detail for now)
- Unread badge in navigation
- Block/report functionality
- Real-time updates
- Notification preferences
- Admin moderation
