import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import sharp from "sharp";

import { getProfileByClerkId } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";
import { MAX_IMAGE_UPLOAD_BYTES, MAX_IMAGE_UPLOAD_LABEL } from "@/lib/uploadLimits";

/**
 * Maximum stored cover dimension (longest edge), in pixels. Covers are
 * displayed at thumbnail/detail sizes, so a 1600px ceiling keeps quality
 * crisp while sharply reducing the stored payload (and Supabase storage
 * pressure). Smaller images are never upscaled.
 */
export const MAX_COVER_DIMENSION = 1600;

/** WebP quality used for stored covers (0-100). 80 is visually lossless for art. */
export const COVER_WEBP_QUALITY = 80;

/**
 * Image file signatures (magic numbers) we accept for cover uploads. The
 * uploaded MIME type / extension is attacker-controlled, so we sniff the
 * first bytes of the decoded buffer to confirm it is actually an image
 * before handing it to sharp. Returns the detected format or null.
 */
export function sniffImageFormat(
  buffer: Buffer
): "jpeg" | "png" | "webp" | "gif" | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }
  // GIF: "GIF87a" or "GIF89a"
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return "gif";
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

/**
 * Re-compress and convert an uploaded image to a resized WebP buffer.
 *
 * Resizes the longest edge down to {@link MAX_COVER_DIMENSION} (never
 * upscales) and encodes to WebP at {@link COVER_WEBP_QUALITY}. Rotates per
 * EXIF orientation so portrait phone photos land upright. This shrinks the
 * stored payload dramatically (typically 60-80% smaller than the source
 * JPEG) and normalizes the stored content type to a safe, known format.
 */
export async function convertCoverToWebp(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // honor EXIF orientation
    .resize(MAX_COVER_DIMENSION, MAX_COVER_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: COVER_WEBP_QUALITY })
    .toBuffer();
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getProfileByClerkId(userId);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `Image must be under ${MAX_IMAGE_UPLOAD_LABEL}` },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const sourceBuffer = Buffer.from(arrayBuffer);

    // Sniff the real file signature server-side; the client-supplied MIME
    // type and filename extension are not trustworthy.
    const detectedFormat = sniffImageFormat(sourceBuffer);
    if (!detectedFormat) {
      return NextResponse.json(
        { error: "File is not a recognized image format" },
        { status: 400 }
      );
    }

    // Re-encode to a resized WebP. This both compresses the upload and
    // forces a known-safe content type/extension regardless of the source.
    let webpBuffer: Buffer;
    try {
      webpBuffer = await convertCoverToWebp(sourceBuffer);
    } catch (conversionError) {
      console.error("Cover image conversion failed:", conversionError);
      return NextResponse.json({ error: "Could not process image" }, { status: 400 });
    }

    const filename = `${profile.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.webp`;

    const { data, error } = await supabaseAdmin.storage
      .from("comic-covers")
      .upload(filename, webpBuffer, {
        contentType: "image/webp",
        upsert: false,
      });

    if (error) {
      console.error("Cover upload error:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("comic-covers")
      .getPublicUrl(data.path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error("Cover upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
