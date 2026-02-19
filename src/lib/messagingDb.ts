import {
  Conversation,
  ConversationPreview,
  Message,
  MessagesResponse,
  SendMessageInput,
} from "@/types/messaging";

import { getSellerProfile } from "./auctionDb";
import { checkMessageContent } from "./contentFilter";
import { sendNotificationEmail } from "./email";
import { supabase, supabaseAdmin } from "./supabase";

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
export async function getUserConversations(userId: string): Promise<ConversationPreview[]> {
  // Get conversations where user is a participant
  // Use supabaseAdmin to bypass RLS (we verify user access via userId param)
  const { data: conversations, error } = await supabaseAdmin
    .from("conversations")
    .select(
      `
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
    `
    )
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
    const unreadCount = messages.filter((m) => m.sender_id !== userId && !m.is_read).length;

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
  const { data: conversations, error: convError } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`);

  if (convError) throw convError;
  if (!conversations || conversations.length === 0) return 0;

  const conversationIds = conversations.map((c) => c.id);

  // Count unread messages where user is NOT the sender
  const { count, error } = await supabaseAdmin
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
 * Mark all unread messages in a conversation as read for a specific user.
 * Only marks messages where the user is the recipient (not the sender).
 */
export async function markMessagesAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  await supabaseAdmin
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .eq("is_read", false);
}

/**
 * Get messages for a conversation
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<MessagesResponse> {
  // Get conversation
  const { data: conv, error: convError } = await supabaseAdmin
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
  const { data: messages, error: msgError } = await supabaseAdmin
    .from("messages")
    .select(
      `
      *,
      auctions:listing_id (
        id,
        comics (
          title,
          cover_image_url
        )
      ),
      embedded_auctions:embedded_listing_id (
        id,
        current_bid,
        status,
        comics (
          title,
          cover_image_url
        )
      )
    `
    )
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
    imageUrls: msg.image_urls || [],
    embeddedListingId: msg.embedded_listing_id || null,
    listing: msg.auctions
      ? {
          id: msg.auctions.id,
          title: msg.auctions.comics?.title || "Unknown",
          coverImageUrl: msg.auctions.comics?.cover_image_url || null,
        }
      : undefined,
    embeddedListing: msg.embedded_auctions
      ? {
          id: msg.embedded_auctions.id,
          title: msg.embedded_auctions.comics?.title || "Unknown",
          coverImageUrl: msg.embedded_auctions.comics?.cover_image_url || null,
          currentPrice: msg.embedded_auctions.current_bid,
          status: msg.embedded_auctions.status,
        }
      : undefined,
  }));

  // Mark messages as read (where user is recipient)
  await markMessagesAsRead(conversationId, userId);

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
export async function sendMessage(senderId: string, input: SendMessageInput): Promise<Message> {
  const { recipientId, content, listingId, imageUrls, embeddedListingId } = input;

  // Validate content - require text or images
  if ((!content || content.trim().length === 0) && (!imageUrls || imageUrls.length === 0)) {
    throw new Error("Message content or image is required");
  }

  if (content && content.length > 2000) {
    throw new Error("Message is too long (max 2000 characters)");
  }

  // Can't message yourself
  if (senderId === recipientId) {
    throw new Error("Cannot send message to yourself");
  }

  // Check content filters
  const contentCheck = content ? checkMessageContent(content) : { blocked: false, flagged: false, reason: undefined };

  if (contentCheck.blocked) {
    throw new Error(contentCheck.reason || "Message not allowed");
  }

  // Check if sender is blocked by recipient
  const { data: blockExists } = await supabaseAdmin
    .from("user_blocks")
    .select("id")
    .eq("blocker_id", recipientId)
    .eq("blocked_id", senderId)
    .maybeSingle();

  if (blockExists) {
    throw new Error("You cannot message this user");
  }

  // Get or create conversation
  const conversationId = await getOrCreateConversation(senderId, recipientId);

  // Insert message (flagged if content check detected suspicious patterns)
  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content ? content.trim() : "",
      listing_id: listingId || null,
      image_urls: imageUrls || [],
      embedded_listing_id: embeddedListingId || null,
      is_flagged: contentCheck.flagged,
      flag_reason: contentCheck.flagged ? contentCheck.reason : null,
    })
    .select()
    .single();

  if (error) throw error;

  // Send email notification (fire and forget)
  void (async () => {
    try {
      // Get recipient's profile for email preferences and email address
      const { data: recipientProfile } = await supabaseAdmin
        .from("profiles")
        .select("email, msg_email_enabled, display_name")
        .eq("id", recipientId)
        .single();

      if (recipientProfile?.msg_email_enabled && recipientProfile.email) {
        // Get sender's name
        const { data: senderProfile } = await supabaseAdmin
          .from("profiles")
          .select("display_name")
          .eq("id", senderId)
          .single();

        const senderName = senderProfile?.display_name || "Someone";
        const messageText = content || (imageUrls?.length ? "[Image]" : "");
        const messagePreview = messageText.length > 100 ? messageText.slice(0, 100) + "..." : messageText;

        await sendNotificationEmail({
          to: recipientProfile.email,
          type: "message_received",
          data: {
            senderName,
            messagePreview,
            messagesUrl: `${process.env.NEXT_PUBLIC_APP_URL}/messages`,
          },
        });
      }
    } catch (err) {
      console.error("[Messaging] Failed to send email notification:", err);
    }
  })();

  return {
    id: data.id,
    conversationId: data.conversation_id,
    senderId: data.sender_id,
    content: data.content,
    listingId: data.listing_id,
    isRead: data.is_read,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    imageUrls: data.image_urls || [],
    embeddedListingId: data.embedded_listing_id || null,
  };
}

// ============================================================================
// BROADCAST HELPERS
// ============================================================================

/**
 * Broadcast a new message via Supabase Broadcast channels.
 * Called from API routes after inserting a message.
 * Uses supabaseAdmin so no RLS dependency on the browser client.
 */
export async function broadcastNewMessage(
  conversationId: string,
  recipientId: string,
  message: Message
): Promise<void> {
  try {
    // Broadcast full message to the conversation channel
    const conversationChannel = supabaseAdmin.channel(`conversation:${conversationId}`);
    await conversationChannel.send({
      type: "broadcast",
      event: "new-message",
      payload: { message },
    });
    supabaseAdmin.removeChannel(conversationChannel);

    // Broadcast to recipient's personal channel for badge updates
    const userChannel = supabaseAdmin.channel(`user:${recipientId}:messages`);
    await userChannel.send({
      type: "broadcast",
      event: "unread-update",
      payload: {},
    });
    supabaseAdmin.removeChannel(userChannel);
  } catch (error) {
    // Non-critical: don't fail the request if broadcast fails
    console.error("[messagingDb] Broadcast error:", error);
  }
}
