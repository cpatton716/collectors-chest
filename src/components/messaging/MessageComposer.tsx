"use client";

import { useRef, useState } from "react";

import { ImagePlus, Loader2, Send, X } from "lucide-react";

interface MessageComposerProps {
  onSend: (content: string, imageUrls?: string[]) => Promise<void>;
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
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 2) {
      alert("Maximum 2 images allowed");
      return;
    }
    const newImages = [...images, ...files].slice(0, 2);
    setImages(newImages);
    const newPreviews = newImages.map((file) => URL.createObjectURL(file));
    // Clean up old preview URLs
    imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setImagePreviewUrls(newPreviews);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviewUrls[index]);
    setImages(images.filter((_, i) => i !== index));
    setImagePreviewUrls(imagePreviewUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedContent = content.trim();
    if ((!trimmedContent && images.length === 0) || isSending || disabled) return;

    setIsSending(true);
    try {
      let uploadedUrls: string[] = [];
      if (images.length > 0) {
        for (const image of images) {
          const formData = new FormData();
          formData.append("file", image);
          const res = await fetch("/api/messages/upload-image", {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const { url } = await res.json();
            uploadedUrls.push(url);
          }
        }
      }

      await onSend(trimmedContent, uploadedUrls.length > 0 ? uploadedUrls : undefined);
      setContent("");

      // Clear images after send
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
      setImages([]);
      setImagePreviewUrls([]);
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
      {imagePreviewUrls.length > 0 && (
        <div className="mb-2 flex gap-2">
          {imagePreviewUrls.map((url, i) => (
            <div key={i} className="relative">
              <img
                src={url}
                alt=""
                className="h-16 w-16 rounded border-2 border-pop-black object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute -right-2 -top-2 rounded-full bg-pop-red p-0.5 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={images.length >= 2 || isSending || disabled}
          className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-pop-black bg-pop-white transition-all hover:bg-gray-100 disabled:opacity-50"
        >
          <ImagePlus className="h-5 w-5" />
        </button>
        <button
          type="submit"
          disabled={(!content.trim() && images.length === 0) || isSending || disabled}
          className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-pop-black bg-pop-blue text-white transition-all hover:shadow-[2px_2px_0px_#000] disabled:opacity-50 disabled:hover:shadow-none"
        >
          {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">Press Enter to send, Shift+Enter for new line</p>
    </form>
  );
}
