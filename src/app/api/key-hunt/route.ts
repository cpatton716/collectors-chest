import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { createClient } from "@supabase/supabase-js";
import { schemas, validateBody, validateQuery } from "@/lib/validation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const createKeyHuntSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  issueNumber: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .pipe(z.string().min(1, "Issue number is required").max(50)),
  publisher: z.string().trim().max(100).optional().nullable(),
  releaseYear: z
    .union([z.string(), z.number()])
    .transform((v) => (v === undefined || v === null ? null : String(v)))
    .optional()
    .nullable(),
  coverImageUrl: z.string().url().max(2048).optional().nullable(),
  keyInfo: z.array(z.string().max(500)).max(20).optional(),
  targetPriceLow: z.number().nonnegative().max(1_000_000).optional().nullable(),
  targetPriceHigh: z.number().nonnegative().max(1_000_000).optional().nullable(),
  currentPriceLow: z.number().nonnegative().max(1_000_000).optional().nullable(),
  currentPriceMid: z.number().nonnegative().max(1_000_000).optional().nullable(),
  currentPriceHigh: z.number().nonnegative().max(1_000_000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  priority: z.number().int().min(1).max(10).optional(),
  addedFrom: z.string().trim().max(50).optional(),
  notifyPriceDrop: z.boolean().optional(),
  notifyThreshold: z.number().nonnegative().max(1_000_000).optional().nullable(),
});

const updateKeyHuntSchema = z.object({
  id: schemas.uuid,
  targetPriceLow: z.number().nonnegative().max(1_000_000).optional().nullable(),
  targetPriceHigh: z.number().nonnegative().max(1_000_000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  priority: z.number().int().min(1).max(10).optional(),
  notifyPriceDrop: z.boolean().optional(),
  notifyThreshold: z.number().nonnegative().max(1_000_000).optional().nullable(),
});

const deleteKeyHuntQuerySchema = z.object({
  id: schemas.uuid,
});

export interface KeyHuntItem {
  id: string;
  title: string;
  issueNumber: string;
  publisher?: string;
  releaseYear?: string;
  coverImageUrl?: string;
  keyInfo: string[];
  targetPriceLow?: number;
  targetPriceHigh?: number;
  currentPriceLow?: number;
  currentPriceMid?: number;
  currentPriceHigh?: number;
  pricesUpdatedAt?: string;
  notes?: string;
  priority: number;
  addedFrom: string;
  notifyPriceDrop: boolean;
  notifyThreshold?: number;
  createdAt: string;
}

interface DbKeyHuntItem {
  id: string;
  user_id: string;
  title: string;
  title_normalized: string;
  issue_number: string;
  publisher: string | null;
  release_year: string | null;
  cover_image_url: string | null;
  key_info: string[];
  target_price_low: number | null;
  target_price_high: number | null;
  current_price_low: number | null;
  current_price_mid: number | null;
  current_price_high: number | null;
  prices_updated_at: string | null;
  notes: string | null;
  priority: number;
  added_from: string;
  notify_price_drop: boolean;
  notify_threshold: number | null;
  created_at: string;
  updated_at: string;
}

function dbToApiFormat(db: DbKeyHuntItem): KeyHuntItem {
  return {
    id: db.id,
    title: db.title,
    issueNumber: db.issue_number,
    publisher: db.publisher || undefined,
    releaseYear: db.release_year || undefined,
    coverImageUrl: db.cover_image_url || undefined,
    keyInfo: db.key_info || [],
    targetPriceLow: db.target_price_low || undefined,
    targetPriceHigh: db.target_price_high || undefined,
    currentPriceLow: db.current_price_low || undefined,
    currentPriceMid: db.current_price_mid || undefined,
    currentPriceHigh: db.current_price_high || undefined,
    pricesUpdatedAt: db.prices_updated_at || undefined,
    notes: db.notes || undefined,
    priority: db.priority,
    addedFrom: db.added_from,
    notifyPriceDrop: db.notify_price_drop,
    notifyThreshold: db.notify_threshold || undefined,
    createdAt: db.created_at,
  };
}

/**
 * GET - Get user's Key Hunt list
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("key_hunt_lists")
      .select("*")
      .eq("user_id", userId)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching key hunt list:", error);
      return NextResponse.json({ error: "Failed to fetch list" }, { status: 500 });
    }

    const items = (data as DbKeyHuntItem[]).map(dbToApiFormat);

    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    console.error("Error in key-hunt GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST - Add a book to Key Hunt list
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => null);
    const validated = validateBody(createKeyHuntSchema, rawBody);
    if (!validated.success) return validated.response;
    const {
      title,
      issueNumber,
      publisher,
      releaseYear,
      coverImageUrl,
      keyInfo,
      targetPriceLow,
      targetPriceHigh,
      currentPriceLow,
      currentPriceMid,
      currentPriceHigh,
      notes,
      priority = 5,
      addedFrom = "manual",
      notifyPriceDrop = false,
      notifyThreshold,
    } = validated.data;

    const titleNormalized = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();

    // Check if already in list
    const { data: existing } = await supabase
      .from("key_hunt_lists")
      .select("id")
      .eq("user_id", userId)
      .eq("title_normalized", titleNormalized)
      .eq("issue_number", issueNumber)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "This book is already in your Key Hunt list", existingId: existing.id },
        { status: 409 }
      );
    }

    // Insert new item
    const { data, error } = await supabase
      .from("key_hunt_lists")
      .insert({
        user_id: userId,
        title,
        title_normalized: titleNormalized,
        issue_number: issueNumber,
        publisher,
        release_year: releaseYear,
        cover_image_url: coverImageUrl,
        key_info: keyInfo || [],
        target_price_low: targetPriceLow,
        target_price_high: targetPriceHigh,
        current_price_low: currentPriceLow,
        current_price_mid: currentPriceMid,
        current_price_high: currentPriceHigh,
        prices_updated_at: currentPriceLow ? new Date().toISOString() : null,
        notes,
        priority,
        added_from: addedFrom,
        notify_price_drop: notifyPriceDrop,
        notify_threshold: notifyThreshold,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding to key hunt list:", error);
      return NextResponse.json({ error: "Failed to add to list" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      item: dbToApiFormat(data as DbKeyHuntItem),
    });
  } catch (error) {
    console.error("Error in key-hunt POST:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE - Remove a book from Key Hunt list
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const validated = validateQuery(deleteKeyHuntQuerySchema, new URL(request.url).searchParams);
    if (!validated.success) return validated.response;
    const { id: itemId } = validated.data;

    const { error } = await supabase
      .from("key_hunt_lists")
      .delete()
      .eq("id", itemId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting from key hunt list:", error);
      return NextResponse.json({ error: "Failed to remove from list" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in key-hunt DELETE:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH - Update a Key Hunt item
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json().catch(() => null);
    const validated = validateBody(updateKeyHuntSchema, rawBody);
    if (!validated.success) return validated.response;
    const { id, ...updates } = validated.data;

    // Build update object with snake_case keys
    const dbUpdates: Record<string, unknown> = {};
    if (updates.targetPriceLow !== undefined) dbUpdates.target_price_low = updates.targetPriceLow;
    if (updates.targetPriceHigh !== undefined)
      dbUpdates.target_price_high = updates.targetPriceHigh;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.notifyPriceDrop !== undefined)
      dbUpdates.notify_price_drop = updates.notifyPriceDrop;
    if (updates.notifyThreshold !== undefined) dbUpdates.notify_threshold = updates.notifyThreshold;

    const { data, error } = await supabase
      .from("key_hunt_lists")
      .update(dbUpdates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating key hunt item:", error);
      return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      item: dbToApiFormat(data as DbKeyHuntItem),
    });
  } catch (error) {
    console.error("Error in key-hunt PATCH:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
