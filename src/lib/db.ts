import { CollectionItem, SaleRecord, UserList } from "@/types/comic";

import { cacheDelete, cacheGet, cacheSet } from "./cache";
import { supabase, supabaseAdmin } from "./supabase";

// Profile management
export async function getOrCreateProfile(clerkUserId: string, email?: string) {
  // First try to get existing profile
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (existing) return existing;

  // Create new profile
  const { data: newProfile, error } = await supabase
    .from("profiles")
    .insert({ clerk_user_id: clerkUserId, email })
    .select()
    .single();

  if (error) throw error;
  return newProfile;
}

// Profile type for caching
interface CachedProfile {
  id: string;
  clerk_user_id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  display_preference: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  is_public: boolean;
  public_slug: string | null;
  public_display_name: string | null;
  public_bio: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export async function getProfileByClerkId(clerkUserId: string): Promise<CachedProfile | null> {
  // Try Redis cache first (5 minute TTL)
  const cached = await cacheGet<CachedProfile>(clerkUserId, "profile");
  if (cached) {
    return cached;
  }

  // Cache miss - fetch from database
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found

  // Cache the result if found (fire and forget)
  if (data) {
    cacheSet(clerkUserId, data, "profile").catch(() => {});
  }

  return data;
}

/**
 * Invalidate profile cache after updates
 * Call this whenever profile data changes (subscription, settings, etc.)
 */
export async function invalidateProfileCache(clerkUserId: string): Promise<void> {
  await cacheDelete(clerkUserId, "profile");
}

// Comics
export async function getUserComics(profileId: string): Promise<CollectionItem[]> {
  const { data, error } = await supabase
    .from("comics")
    .select(
      `
      *,
      comic_lists(list_id)
    `
    )
    .eq("user_id", profileId)
    .is("deleted_at", null)
    .order("date_added", { ascending: false });

  if (error) throw error;

  // Transform to CollectionItem format
  return (data || []).map(transformDbComicToCollectionItem);
}

export async function addComic(profileId: string, item: CollectionItem) {
  const dbComic = {
    id: item.id, // Preserve the client-generated ID for consistency with listings
    ...transformCollectionItemToDbComic(item, profileId),
  };

  const { data, error } = await supabase.from("comics").insert(dbComic).select().single();

  if (error) throw error;

  // Add to lists
  if (item.listIds.length > 0) {
    const listInserts = item.listIds.map((listId) => ({
      comic_id: data.id,
      list_id: listId,
    }));
    await supabase.from("comic_lists").insert(listInserts);
  }

  // Catalog barcode if detected during scan (async, non-blocking)
  if (item.comic.barcode?.raw) {
    catalogBarcode({
      comicId: data.id,
      raw: item.comic.barcode.raw,
      confidence: item.comic.barcode.confidence,
      parsed: item.comic.barcode.parsed,
      submittedBy: profileId,
      coverImageUrl: item.coverImageUrl,
      comicTitle: item.comic.title || undefined,
      comicIssue: item.comic.issueNumber || undefined,
    }).catch((err) => {
      console.error("[addComic] Barcode cataloging failed:", err);
    });
  }

  return data;
}

/**
 * Ensure a comic exists in Supabase (sync from localStorage if needed)
 * Used when creating listings - the comic must exist in Supabase for the foreign key
 */
export async function ensureComicInSupabase(
  profileId: string,
  item: CollectionItem
): Promise<string> {
  // Check if comic already exists
  const { data: existing } = await supabaseAdmin
    .from("comics")
    .select("id")
    .eq("id", item.id)
    .single();

  if (existing) {
    return existing.id;
  }

  // Comic doesn't exist, create it with the same ID
  const dbComic = {
    id: item.id, // Preserve the localStorage ID
    ...transformCollectionItemToDbComic(item, profileId),
  };

  const { data, error } = await supabaseAdmin.from("comics").insert(dbComic).select().single();

  if (error) throw error;

  return data.id;
}

export async function updateComic(comicId: string, updates: Partial<CollectionItem>) {
  const dbUpdates: Record<string, unknown> = {};

  if (updates.comic) {
    Object.assign(dbUpdates, {
      title: updates.comic.title,
      issue_number: updates.comic.issueNumber,
      variant: updates.comic.variant,
      publisher: updates.comic.publisher,
      cover_artist: updates.comic.coverArtist,
      writer: updates.comic.writer,
      interior_artist: updates.comic.interiorArtist,
      release_year: updates.comic.releaseYear,
      confidence: updates.comic.confidence,
      is_slabbed: updates.comic.isSlabbed,
      grading_company: updates.comic.gradingCompany,
      grade: updates.comic.grade,
      is_signature_series: updates.comic.isSignatureSeries,
      signed_by: updates.comic.signedBy,
      price_data: updates.comic.priceData,
    });
  }

  if (updates.coverImageUrl !== undefined) dbUpdates.cover_image_url = updates.coverImageUrl;
  if (updates.conditionGrade !== undefined) dbUpdates.condition_grade = updates.conditionGrade;
  if (updates.conditionLabel !== undefined) dbUpdates.condition_label = updates.conditionLabel;
  if (updates.isGraded !== undefined) dbUpdates.is_graded = updates.isGraded;
  if (updates.purchasePrice !== undefined) dbUpdates.purchase_price = updates.purchasePrice;
  if (updates.purchaseDate !== undefined) dbUpdates.purchase_date = updates.purchaseDate;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.forSale !== undefined) dbUpdates.for_sale = updates.forSale;
  if (updates.askingPrice !== undefined) dbUpdates.asking_price = updates.askingPrice;
  if (updates.isStarred !== undefined) dbUpdates.is_starred = updates.isStarred;

  const { error } = await supabase.from("comics").update(dbUpdates).eq("id", comicId);

  if (error) throw error;
}

export async function deleteComic(comicId: string) {
  const { error } = await supabase.from("comics").delete().eq("id", comicId);
  if (error) throw error;
}

// Lists
export async function getUserLists(profileId: string): Promise<UserList[]> {
  const { data, error } = await supabase
    .from("lists")
    .select("*")
    .eq("user_id", profileId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    isDefault: list.is_default,
    createdAt: list.created_at,
  }));
}

export async function createList(profileId: string, name: string): Promise<UserList> {
  const { data, error } = await supabase
    .from("lists")
    .insert({
      user_id: profileId,
      name,
      description: "",
      is_default: false,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    isDefault: data.is_default,
    createdAt: data.created_at,
  };
}

export async function deleteList(listId: string): Promise<void> {
  // First remove all comics from this list
  await supabase.from("comic_lists").delete().eq("list_id", listId);

  // Then delete the list (only if not default)
  const { error } = await supabase.from("lists").delete().eq("id", listId).eq("is_default", false);

  if (error) throw error;
}

export async function addComicToList(comicId: string, listId: string): Promise<void> {
  const { error } = await supabase
    .from("comic_lists")
    .insert({ comic_id: comicId, list_id: listId });

  // Ignore duplicate key errors (comic already in list)
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function removeComicFromList(comicId: string, listId: string): Promise<void> {
  const { error } = await supabase
    .from("comic_lists")
    .delete()
    .eq("comic_id", comicId)
    .eq("list_id", listId);

  if (error) throw error;
}

// Sales
export async function getUserSales(profileId: string): Promise<SaleRecord[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .eq("user_id", profileId)
    .order("sale_date", { ascending: false });

  if (error) throw error;

  return (data || []).map((sale) => ({
    id: sale.id,
    comic: {
      id: sale.id,
      title: sale.comic_title,
      issueNumber: sale.comic_issue_number,
      variant: sale.comic_variant,
      publisher: sale.comic_publisher,
      coverArtist: null,
      writer: null,
      interiorArtist: null,
      releaseYear: null,
      confidence: "medium" as const,
      isSlabbed: false,
      gradingCompany: null,
      grade: null,
      certificationNumber: null,
      labelType: null,
      pageQuality: null,
      gradeDate: null,
      graderNotes: null,
      isSignatureSeries: false,
      signedBy: null,
      priceData: null,
      keyInfo: [],
    },
    coverImageUrl: sale.cover_image_url || "",
    purchasePrice: sale.purchase_price,
    salePrice: sale.sale_price,
    saleDate: sale.sale_date,
    profit: sale.profit,
    buyerId: sale.buyer_id,
  }));
}

export async function recordSale(
  profileId: string,
  item: CollectionItem,
  salePrice: number,
  buyerId?: string
): Promise<SaleRecord> {
  const { data, error } = await supabase
    .from("sales")
    .insert({
      user_id: profileId,
      comic_title: item.comic.title,
      comic_issue_number: item.comic.issueNumber,
      comic_variant: item.comic.variant,
      comic_publisher: item.comic.publisher,
      cover_image_url: item.coverImageUrl,
      purchase_price: item.purchasePrice,
      sale_price: salePrice,
      profit: salePrice - (item.purchasePrice || 0),
      buyer_id: buyerId || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Delete the comic from collection
  await deleteComic(item.id);

  return {
    id: data.id,
    comic: item.comic,
    coverImageUrl: item.coverImageUrl,
    purchasePrice: item.purchasePrice,
    salePrice: data.sale_price,
    saleDate: data.sale_date,
    profit: data.profit,
    buyerId: data.buyer_id,
  };
}

// Migration: Import localStorage data to Supabase
export async function migrateLocalDataToCloud(
  profileId: string,
  comics: CollectionItem[],
  lists: UserList[],
  sales: SaleRecord[]
) {
  // Get existing default lists for the user
  const existingLists = await getUserLists(profileId);
  const defaultListMap = new Map<string, string>();

  // Map old default list IDs to new ones
  existingLists.forEach((list) => {
    if (list.name === "My Collection") defaultListMap.set("collection", list.id);
    if (list.name === "Want List") defaultListMap.set("want-list", list.id);
    if (list.name === "For Sale") defaultListMap.set("for-sale", list.id);
    if (list.name === "Slabbed") defaultListMap.set("slabbed", list.id);
    if (list.name === "Passed On") defaultListMap.set("passed-on", list.id);
  });

  // Import custom lists
  const customLists = lists.filter((l) => !l.isDefault);
  for (const list of customLists) {
    const { data } = await supabase
      .from("lists")
      .insert({
        user_id: profileId,
        name: list.name,
        description: list.description,
        is_default: false,
      })
      .select()
      .single();

    if (data) {
      defaultListMap.set(list.id, data.id);
    }
  }

  // Import comics
  for (const item of comics) {
    const dbComic = transformCollectionItemToDbComic(item, profileId);
    const { data: newComic } = await supabase.from("comics").insert(dbComic).select().single();

    if (newComic && item.listIds.length > 0) {
      const listInserts = item.listIds
        .map((oldId) => defaultListMap.get(oldId))
        .filter((newId): newId is string => !!newId)
        .map((listId) => ({
          comic_id: newComic.id,
          list_id: listId,
        }));

      if (listInserts.length > 0) {
        await supabase.from("comic_lists").insert(listInserts);
      }
    }
  }

  // Import sales
  for (const sale of sales) {
    await supabase.from("sales").insert({
      user_id: profileId,
      comic_title: sale.comic.title,
      comic_issue_number: sale.comic.issueNumber,
      comic_variant: sale.comic.variant,
      comic_publisher: sale.comic.publisher,
      cover_image_url: sale.coverImageUrl,
      purchase_price: sale.purchasePrice,
      sale_price: sale.salePrice,
      sale_date: sale.saleDate,
      profit: sale.profit,
    });
  }

  return { success: true };
}

// ============================================
// Comic Metadata Cache (Shared Repository)
// ============================================

export interface ComicMetadata {
  id: string;
  title: string;
  issueNumber: string;
  publisher: string | null;
  releaseYear: string | null;
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  coverImageUrl: string | null;
  keyInfo: string[];
  priceData: {
    estimatedValue: number;
    mostRecentSaleDate: string | null;
    recentSales: { price: number; date: string }[];
    gradeEstimates: {
      grade: number;
      label: string;
      rawValue: number;
      slabbedValue: number;
    }[];
    disclaimer: string;
    priceSource?: "ebay" | "ai";
  } | null;
  lookupCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Look up comic metadata from the shared repository
 * Returns null if not found (caller should fall back to API)
 */
export async function getComicMetadata(
  title: string,
  issueNumber: string
): Promise<ComicMetadata | null> {
  const { data, error } = await supabase
    .from("comic_metadata")
    .select("*")
    .ilike("title", title)
    .ilike("issue_number", issueNumber)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    title: data.title,
    issueNumber: data.issue_number,
    publisher: data.publisher,
    releaseYear: data.release_year,
    writer: data.writer,
    coverArtist: data.cover_artist,
    interiorArtist: data.interior_artist,
    coverImageUrl: data.cover_image_url || null,
    keyInfo: data.key_info || [],
    priceData: data.price_data,
    lookupCount: data.lookup_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Save comic metadata to the shared repository
 * Uses upsert to update existing records
 */
export async function saveComicMetadata(metadata: {
  title: string;
  issueNumber: string;
  publisher?: string | null;
  releaseYear?: string | null;
  writer?: string | null;
  coverArtist?: string | null;
  interiorArtist?: string | null;
  coverImageUrl?: string | null;
  keyInfo?: string[];
  priceData?: ComicMetadata["priceData"];
}): Promise<void> {
  const { error } = await supabase.from("comic_metadata").upsert(
    {
      title: metadata.title,
      issue_number: metadata.issueNumber,
      publisher: metadata.publisher,
      release_year: metadata.releaseYear,
      writer: metadata.writer,
      cover_artist: metadata.coverArtist,
      interior_artist: metadata.interiorArtist,
      cover_image_url: metadata.coverImageUrl,
      key_info: metadata.keyInfo || [],
      price_data: metadata.priceData,
    },
    {
      onConflict: "title,issue_number",
      ignoreDuplicates: false,
    }
  );

  if (error) {
    console.error("Error saving comic metadata:", error);
    // Don't throw - cache failures shouldn't break the app
  }
}

/**
 * Increment lookup count for a comic (for analytics/popularity)
 */
export async function incrementComicLookupCount(title: string, issueNumber: string): Promise<void> {
  // The trigger handles incrementing on update, so we just touch the record
  await supabase
    .from("comic_metadata")
    .update({ updated_at: new Date().toISOString() })
    .ilike("title", title)
    .ilike("issue_number", issueNumber);
}

// ============================================
// Helper functions
// ============================================

function transformDbComicToCollectionItem(dbComic: Record<string, unknown>): CollectionItem {
  return {
    id: dbComic.id as string,
    comic: {
      id: dbComic.id as string,
      title: dbComic.title as string | null,
      issueNumber: dbComic.issue_number as string | null,
      variant: dbComic.variant as string | null,
      publisher: dbComic.publisher as string | null,
      coverArtist: dbComic.cover_artist as string | null,
      writer: dbComic.writer as string | null,
      interiorArtist: dbComic.interior_artist as string | null,
      releaseYear: dbComic.release_year as string | null,
      confidence: (dbComic.confidence as "high" | "medium" | "low") || "medium",
      isSlabbed: dbComic.is_slabbed as boolean,
      gradingCompany: dbComic.grading_company as "CGC" | "CBCS" | "PGX" | "Other" | null,
      grade: dbComic.grade as string | null,
      isSignatureSeries: dbComic.is_signature_series as boolean,
      signedBy: dbComic.signed_by as string | null,
      priceData: dbComic.price_data as CollectionItem["comic"]["priceData"],
      keyInfo: (dbComic.key_info as string[]) || [],
      certificationNumber: dbComic.certification_number as string | null,
      labelType: dbComic.label_type as string | null,
      pageQuality: dbComic.page_quality as string | null,
      gradeDate: dbComic.grade_date as string | null,
      graderNotes: dbComic.grader_notes as string | null,
    },
    coverImageUrl: dbComic.cover_image_url as string,
    conditionGrade: dbComic.condition_grade as number | null,
    conditionLabel: dbComic.condition_label as CollectionItem["conditionLabel"],
    isGraded: dbComic.is_graded as boolean,
    gradingCompany: dbComic.grading_company as string | null,
    purchasePrice: dbComic.purchase_price as number | null,
    purchaseDate: dbComic.purchase_date as string | null,
    notes: dbComic.notes as string | null,
    forSale: dbComic.for_sale as boolean,
    forTrade: (dbComic.for_trade as boolean) || false,
    askingPrice: dbComic.asking_price as number | null,
    averagePrice: dbComic.average_price as number | null,
    dateAdded: dbComic.date_added as string,
    listIds: ((dbComic.comic_lists as { list_id: string }[]) || []).map((cl) => cl.list_id),
    isStarred: dbComic.is_starred as boolean,
    customKeyInfo: (dbComic.custom_key_info as string[]) || [],
    customKeyInfoStatus: dbComic.custom_key_info_status as "pending" | "approved" | "rejected" | null,
  };
}

function transformCollectionItemToDbComic(item: CollectionItem, profileId: string) {
  return {
    user_id: profileId,
    title: item.comic.title,
    issue_number: item.comic.issueNumber,
    variant: item.comic.variant,
    publisher: item.comic.publisher,
    cover_artist: item.comic.coverArtist,
    writer: item.comic.writer,
    interior_artist: item.comic.interiorArtist,
    release_year: item.comic.releaseYear,
    confidence: item.comic.confidence,
    is_slabbed: item.comic.isSlabbed,
    grading_company: item.comic.gradingCompany,
    grade: item.comic.grade,
    certification_number: item.comic.certificationNumber,
    label_type: item.comic.labelType,
    page_quality: item.comic.pageQuality,
    grade_date: item.comic.gradeDate,
    grader_notes: item.comic.graderNotes,
    is_signature_series: item.comic.isSignatureSeries,
    signed_by: item.comic.signedBy,
    key_info: item.comic.keyInfo,
    price_data: item.comic.priceData,
    cover_image_url: item.coverImageUrl,
    condition_grade: item.conditionGrade,
    condition_label: item.conditionLabel,
    is_graded: item.isGraded,
    purchase_price: item.purchasePrice,
    purchase_date: item.purchaseDate,
    notes: item.notes,
    for_sale: item.forSale,
    asking_price: item.askingPrice,
    average_price: item.averagePrice,
    date_added: item.dateAdded,
    is_starred: item.isStarred,
    custom_key_info: item.customKeyInfo || [],
    custom_key_info_status: item.customKeyInfoStatus,
  };
}

// ============================================
// Public Collection Sharing
// ============================================

export interface PublicProfile {
  id: string;
  displayName: string | null;
  username: string | null;
  displayPreference: "username_only" | "display_name_only" | "both" | null;
  publicSlug: string | null;
  publicDisplayName: string | null;
  publicBio: string | null;
  isPublic: boolean;
  createdAt: string;
}

export interface PublicCollectionStats {
  totalComics: number;
  totalValue: number;
  topPublishers: { publisher: string; count: number }[];
  oldestComic: { title: string; year: string } | null;
  newestComic: { title: string; year: string } | null;
}

/**
 * Get a public profile by slug or user ID
 * Uses supabaseAdmin to bypass RLS for anonymous public access
 */
export async function getPublicProfile(slugOrId: string): Promise<PublicProfile | null> {
  // Try by slug first, then by ID
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .or(`public_slug.eq.${slugOrId},id.eq.${slugOrId}`)
    .eq("is_public", true)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    displayName: data.display_name,
    username: data.username,
    displayPreference: data.display_preference,
    publicSlug: data.public_slug,
    publicDisplayName: data.public_display_name,
    publicBio: data.public_bio,
    isPublic: data.is_public,
    createdAt: data.created_at,
  };
}

/**
 * Get comics for a public profile (read-only)
 * Uses supabaseAdmin to bypass RLS for anonymous public access
 */
export async function getPublicComics(profileId: string): Promise<CollectionItem[]> {
  const { data, error } = await supabaseAdmin
    .from("comics")
    .select(
      `
      *,
      comic_lists(list_id)
    `
    )
    .eq("user_id", profileId)
    .is("deleted_at", null)
    .order("date_added", { ascending: false });

  if (error) return [];

  return (data || []).map(transformDbComicToCollectionItem);
}

/**
 * Get lists for a public profile (only shared lists)
 * Uses supabaseAdmin to bypass RLS for anonymous public access
 */
export async function getPublicLists(profileId: string): Promise<UserList[]> {
  const { data, error } = await supabaseAdmin
    .from("lists")
    .select("*")
    .eq("user_id", profileId)
    .eq("is_shared", true)
    .order("created_at", { ascending: true });

  if (error) return [];

  return (data || []).map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    isDefault: list.is_default,
    createdAt: list.created_at,
  }));
}

/**
 * Calculate stats for a public collection
 */
export function calculatePublicStats(comics: CollectionItem[]): PublicCollectionStats {
  const totalComics = comics.length;
  const totalValue = comics.reduce(
    (sum, item) => sum + (item.comic.priceData?.estimatedValue || 0),
    0
  );

  // Count by publisher
  const publisherCounts: Record<string, number> = {};
  comics.forEach((item) => {
    const publisher = item.comic.publisher || "Unknown";
    publisherCounts[publisher] = (publisherCounts[publisher] || 0) + 1;
  });

  const topPublishers = Object.entries(publisherCounts)
    .map(([publisher, count]) => ({ publisher, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Find oldest and newest comics
  const comicsWithYear = comics.filter((c) => c.comic.releaseYear);
  const sortedByYear = [...comicsWithYear].sort((a, b) =>
    (a.comic.releaseYear || "").localeCompare(b.comic.releaseYear || "")
  );

  const oldestComic = sortedByYear[0]
    ? {
        title: sortedByYear[0].comic.title || "Unknown",
        year: sortedByYear[0].comic.releaseYear || "",
      }
    : null;

  const newestComic = sortedByYear[sortedByYear.length - 1]
    ? {
        title: sortedByYear[sortedByYear.length - 1].comic.title || "Unknown",
        year: sortedByYear[sortedByYear.length - 1].comic.releaseYear || "",
      }
    : null;

  return {
    totalComics,
    totalValue,
    topPublishers,
    oldestComic,
    newestComic,
  };
}

/**
 * Toggle public sharing for a profile
 */
export async function togglePublicSharing(
  profileId: string,
  enable: boolean,
  customSlug?: string
): Promise<{ success: boolean; slug?: string; error?: string }> {
  if (enable) {
    // Check if custom slug is available
    if (customSlug) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("public_slug", customSlug)
        .neq("id", profileId)
        .single();

      if (existing) {
        return { success: false, error: "This URL is already taken" };
      }
    }

    // Generate slug if not provided
    let slug = customSlug;
    if (!slug) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, email, public_slug")
        .eq("id", profileId)
        .single();

      if (profile?.public_slug) {
        slug = profile.public_slug;
      } else {
        // Generate from display name or email
        const baseName = profile?.display_name || profile?.email?.split("@")[0] || "collector";
        const baseSlug = baseName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");

        // Check for uniqueness
        let finalSlug = baseSlug;
        let counter = 0;
        while (true) {
          const { data: existingSlug } = await supabase
            .from("profiles")
            .select("id")
            .eq("public_slug", finalSlug)
            .single();

          if (!existingSlug) break;
          counter++;
          finalSlug = `${baseSlug}-${counter}`;
        }
        slug = finalSlug;
      }
    }

    // Enable public sharing (use supabaseAdmin to bypass RLS)
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_public: true, public_slug: slug })
      .eq("id", profileId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, slug };
  } else {
    // Disable public sharing (keep the slug for reuse)
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_public: false })
      .eq("id", profileId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }
}

/**
 * Update public profile display settings
 */
export async function updatePublicProfileSettings(
  profileId: string,
  settings: {
    publicDisplayName?: string;
    publicBio?: string;
    publicSlug?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  // Check slug uniqueness if changing
  if (settings.publicSlug) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("public_slug", settings.publicSlug)
      .neq("id", profileId)
      .single();

    if (existing) {
      return { success: false, error: "This URL is already taken" };
    }
  }

  const updates: Record<string, unknown> = {};
  if (settings.publicDisplayName !== undefined) {
    updates.public_display_name = settings.publicDisplayName;
  }
  if (settings.publicBio !== undefined) {
    updates.public_bio = settings.publicBio;
  }
  if (settings.publicSlug !== undefined) {
    updates.public_slug = settings.publicSlug;
  }

  // Use supabaseAdmin to bypass RLS
  const { error } = await supabaseAdmin.from("profiles").update(updates).eq("id", profileId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get sharing settings for a profile
 */
export async function getSharingSettings(profileId: string): Promise<{
  isPublic: boolean;
  publicSlug: string | null;
  publicDisplayName: string | null;
  publicBio: string | null;
} | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_public, public_slug, public_display_name, public_bio")
    .eq("id", profileId)
    .single();

  if (error || !data) return null;

  return {
    isPublic: data.is_public || false,
    publicSlug: data.public_slug,
    publicDisplayName: data.public_display_name,
    publicBio: data.public_bio,
  };
}

/**
 * Toggle list sharing visibility
 */
export async function toggleListSharing(listId: string, isShared: boolean): Promise<void> {
  await supabase.from("lists").update({ is_shared: isShared }).eq("id", listId);
}

// ============================================
// Barcode Cataloging
// ============================================

interface BarcodeCatalogEntry {
  comicId: string;
  raw: string;
  confidence: "high" | "medium" | "low";
  parsed?: {
    upcPrefix: string;
    itemNumber: string;
    checkDigit: string;
    addonIssue?: string;
    addonVariant?: string;
  };
  submittedBy: string;
  coverImageUrl: string;
  comicTitle?: string;
  comicIssue?: string;
}

/**
 * Catalog a barcode after user saves a comic to their collection.
 * High confidence barcodes are auto-approved.
 * Low/medium confidence barcodes are flagged for admin review.
 */
export async function catalogBarcode(entry: BarcodeCatalogEntry): Promise<void> {
  try {
    const status = entry.confidence === "high" ? "auto_approved" : "pending_review";

    // Insert into barcode_catalog
    const { data: catalogEntry, error: catalogError } = await supabaseAdmin
      .from("barcode_catalog")
      .insert({
        comic_id: entry.comicId,
        raw_barcode: entry.raw,
        upc_prefix: entry.parsed?.upcPrefix || null,
        item_number: entry.parsed?.itemNumber || null,
        check_digit: entry.parsed?.checkDigit || null,
        addon_issue: entry.parsed?.addonIssue || null,
        addon_variant: entry.parsed?.addonVariant || null,
        confidence: entry.confidence,
        status,
        submitted_by: entry.submittedBy,
      })
      .select()
      .single();

    if (catalogError) {
      console.error("[catalogBarcode] Error inserting catalog entry:", catalogError);
      return; // Don't throw - barcode cataloging shouldn't break comic save
    }

    // If low/medium confidence, create admin review alert
    if (entry.confidence !== "high" && catalogEntry) {
      const { error: reviewError } = await supabaseAdmin
        .from("admin_barcode_reviews")
        .insert({
          barcode_catalog_id: catalogEntry.id,
          detected_upc: entry.raw,
          cover_image_url: entry.coverImageUrl,
          comic_title: entry.comicTitle || null,
          comic_issue: entry.comicIssue || null,
          status: "pending",
        });

      if (reviewError) {
        console.error("[catalogBarcode] Error creating admin review:", reviewError);
      }
    }

    // Barcode successfully cataloged (status: ${status})
  } catch (error) {
    console.error("[catalogBarcode] Unexpected error:", error);
    // Don't throw - barcode cataloging shouldn't break the main flow
  }
}
