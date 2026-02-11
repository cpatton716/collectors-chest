"use client";

import { Message } from "@/types/messaging";

// Auto-link URLs in message text
function linkifyContent(text: string, isOwnMessage: boolean) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      // Reset lastIndex since we reuse the regex
      urlRegex.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline break-all ${
            isOwnMessage ? "text-blue-100 hover:text-white" : "text-pop-blue hover:text-blue-700"
          }`}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

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
          isOwnMessage ? "bg-pop-blue text-white" : "border-2 border-pop-black bg-pop-white"
        }`}
      >
        {/* Listing context badge */}
        {message.listing && (
          <div className={`mb-1 text-xs ${isOwnMessage ? "text-blue-100" : "text-gray-500"}`}>
            Re: {message.listing.title}
          </div>
        )}

        {/* Message content */}
        <p className="whitespace-pre-wrap break-words text-sm">{linkifyContent(message.content, isOwnMessage)}</p>

        {/* Images */}
        {message.imageUrls && message.imageUrls.length > 0 && (
          <div className={`mt-2 flex gap-2 ${message.imageUrls.length === 1 ? "" : "flex-wrap"}`}>
            {message.imageUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt=""
                  className="max-h-[200px] max-w-[200px] rounded border-2 border-pop-black object-cover transition-opacity hover:opacity-90"
                />
              </a>
            ))}
          </div>
        )}

        {/* Embedded Listing */}
        {message.embeddedListing && (
          <div className="mt-2 rounded border-2 border-pop-black bg-gray-50 p-2">
            <div className="flex gap-2">
              {message.embeddedListing.coverImageUrl && (
                <img
                  src={message.embeddedListing.coverImageUrl}
                  alt=""
                  className="h-16 w-12 rounded object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{message.embeddedListing.title}</p>
                <p className="text-sm font-bold text-pop-blue">
                  ${message.embeddedListing.currentPrice}
                </p>
                <p className="text-xs capitalize text-gray-500">{message.embeddedListing.status}</p>
              </div>
            </div>
          </div>
        )}

        {/* Timestamp */}
        <p className={`mt-1 text-xs ${isOwnMessage ? "text-blue-100" : "text-gray-400"}`}>
          {formattedDate} at {formattedTime}
        </p>
      </div>
    </div>
  );
}
