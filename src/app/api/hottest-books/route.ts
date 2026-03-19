import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import Anthropic from "@anthropic-ai/sdk";

import { cacheGet, cacheSet } from "@/lib/cache";
import { isBrowseApiConfigured, searchActiveListings } from "@/lib/ebayBrowse";
import { MODEL_PRIMARY } from "@/lib/models";


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Configuration
const PRICES_CACHE_HOURS = 24; // Refresh prices once per day

export interface HotBook {
  id?: string;
  rank: number;
  title: string;
  issueNumber: string;
  publisher: string;
  year: string;
  keyFacts: string[];
  whyHot: string;
  priceRange: {
    low: number;
    mid: number;
    high: number;
  };
  coverImageUrl?: string;
  priceSource?: string;
  rankChange?: number | null;
  dataSource?: string;
}

interface DbHotBook {
  id: string;
  title: string;
  issue_number: string;
  publisher: string | null;
  release_year: string | null;
  key_info: string[];
  why_hot: string | null;
  cover_image_url: string | null;
  price_low: number | null;
  price_mid: number | null;
  price_high: number | null;
  price_source: string;
  current_rank: number | null;
  rank_change: number | null;
  data_source: string;
  prices_updated_at: string | null;
}

/**
 * Check if prices need refreshing (older than PRICES_CACHE_HOURS)
 */
function needsPriceRefresh(pricesUpdatedAt: string | null): boolean {
  if (!pricesUpdatedAt) return true;

  const lastUpdate = new Date(pricesUpdatedAt);
  const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

  return hoursSinceUpdate >= PRICES_CACHE_HOURS;
}

/**
 * Fetch eBay prices for a comic using the Browse API directly
 * This avoids internal HTTP calls and uses Redis caching
 */
async function fetchEbayPrices(
  title: string,
  issueNumber: string
): Promise<{ low: number; mid: number; high: number } | null> {
  if (!isBrowseApiConfigured()) {
    return null;
  }

  try {
    const cacheKey = `ebayBrowse:hotbooks:${title}:${issueNumber}`;

    // Check Redis cache first
    const cached = await cacheGet<{ low: number; mid: number; high: number } | { noData: true }>(cacheKey, "ebayPrice");
    if (cached) {
      if ("noData" in cached) return null;
      return cached as { low: number; mid: number; high: number };
    }

    const result = await searchActiveListings(title, issueNumber);
    if (!result || result.medianPrice === null) {
      await cacheSet(cacheKey, { noData: true }, "ebayPrice", 60 * 60); // 1h for no-data
      return null;
    }
    const prices = {
      low: result.lowPrice ?? result.medianPrice,
      mid: result.medianPrice,
      high: result.highPrice ?? result.medianPrice,
    };
    await cacheSet(cacheKey, prices, "ebayPrice", 12 * 60 * 60); // 12h TTL
    return prices;
  } catch (error) {
    console.error("Error fetching eBay prices:", error);
    return null;
  }
}

/**
 * Update prices for a single hot book
 */
async function updateBookPrices(bookId: string, title: string, issueNumber: string): Promise<void> {
  const prices = await fetchEbayPrices(title, issueNumber);

  if (prices) {
    await supabase
      .from("hot_books")
      .update({
        price_low: prices.low,
        price_mid: prices.mid,
        price_high: prices.high,
        price_source: "ebay",
        prices_updated_at: new Date().toISOString(),
      })
      .eq("id", bookId);

    // Also record in history
    await supabase.from("hot_books_history").upsert({
      hot_book_id: bookId,
      rank: 0, // Will be updated separately
      price_low: prices.low,
      price_mid: prices.mid,
      price_high: prices.high,
      recorded_at: new Date().toISOString().split("T")[0],
    });
  }
}

/**
 * Convert database record to API response format
 */
function dbToApiFormat(db: DbHotBook): HotBook {
  return {
    id: db.id,
    rank: db.current_rank || 0,
    title: db.title,
    issueNumber: db.issue_number,
    publisher: db.publisher || "Unknown",
    year: db.release_year || "Unknown",
    keyFacts: db.key_info || [],
    whyHot: db.why_hot || "",
    priceRange: {
      low: db.price_low || 0,
      mid: db.price_mid || 0,
      high: db.price_high || 0,
    },
    coverImageUrl: db.cover_image_url || undefined,
    priceSource: db.price_source,
    rankChange: db.rank_change,
    dataSource: db.data_source,
  };
}

/**
 * Use AI to generate/refresh the hot books list
 * This is the fallback when GoCollect is not available
 */
async function refreshHotBooksListWithAI(): Promise<HotBook[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const response = await anthropic.messages.create({
    model: MODEL_PRIMARY,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a comic book market expert. Generate a list of the 10 hottest comic books in the current market based on your knowledge of recent trends, movie/TV announcements, key issues, and collector demand.

For each book, provide:
1. Title and issue number
2. Publisher and year
3. Key facts (first appearances, significant events)
4. Why it's hot right now (movie announcement, speculation, anniversary, etc.)
5. Estimated price range for raw copies in VF-NM condition (low/mid/high)

Return ONLY a valid JSON array with this exact format, no other text:
[
  {
    "rank": 1,
    "title": "Comic Title",
    "issueNumber": "1",
    "publisher": "Publisher Name",
    "year": "1980",
    "keyFacts": ["First appearance of Character", "Origin story"],
    "whyHot": "Brief explanation of current market interest",
    "priceRange": {"low": 50, "mid": 100, "high": 200}
  }
]

Focus on a mix of:
- Recent movie/TV speculation
- Classic key issues seeing renewed interest
- Modern keys with strong demand
- Books with upcoming media adaptations

Be accurate with your key facts and realistic with price estimates.`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from AI");
  }

  let jsonText = textContent.text.trim();
  // Remove markdown code blocks if present
  if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
  if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
  if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);

  return JSON.parse(jsonText.trim());
}

/**
 * Main GET handler
 */
export async function GET() {
  try {
    // 1. Fetch hot books from database
    const { data: dbBooks, error: dbError } = await supabase
      .from("hot_books")
      .select("*")
      .not("current_rank", "is", null)
      .order("current_rank", { ascending: true })
      .limit(10);

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to fetch hot books from database");
    }

    // 2. If we have books in the database, check if prices need refresh
    if (dbBooks && dbBooks.length > 0) {
      const books = dbBooks as DbHotBook[];
      const needsRefresh = books.some((book) => needsPriceRefresh(book.prices_updated_at));

      if (needsRefresh) {
        // Refresh prices in background (don't block response)

        // Find books that need price updates
        const booksToUpdate = books.filter((book) => needsPriceRefresh(book.prices_updated_at));

        // Update prices asynchronously (fire and forget for this request)
        Promise.all(
          booksToUpdate.map((book) => updateBookPrices(book.id, book.title, book.issue_number))
        )
          .then(() => {
            // Log the refresh
            supabase.from("hot_books_refresh_log").insert({
              refresh_type: "prices_only",
              data_source: "ebay",
              books_updated: booksToUpdate.length,
              success: true,
            });
          })
          .catch((err) => {
            console.error("Error updating hot book prices:", err);
          });
      }

      // Return current data immediately
      return NextResponse.json({
        books: books.map(dbToApiFormat),
        cached: true,
        pricesStale: needsRefresh,
      });
    }

    // 3. No books in database - need to generate the list
    // This should only happen on first deployment or if table is empty

    try {
      const aiBooks = await refreshHotBooksListWithAI();

      // Store in database
      for (const book of aiBooks) {
        const normalizedTitle = book.title
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .trim();

        await supabase.from("hot_books").upsert(
          {
            title: book.title,
            title_normalized: normalizedTitle,
            issue_number: book.issueNumber,
            publisher: book.publisher,
            release_year: book.year,
            key_info: book.keyFacts,
            why_hot: book.whyHot,
            price_low: book.priceRange.low,
            price_mid: book.priceRange.mid,
            price_high: book.priceRange.high,
            price_source: "ai_estimate",
            current_rank: book.rank,
            data_source: "ai",
            prices_updated_at: new Date().toISOString(),
            metadata_updated_at: new Date().toISOString(),
          },
          {
            onConflict: "title_normalized,issue_number",
          }
        );
      }

      // Log the refresh
      await supabase.from("hot_books_refresh_log").insert({
        refresh_type: "full_list",
        data_source: "ai",
        books_updated: aiBooks.length,
        success: true,
      });

      return NextResponse.json({
        books: aiBooks,
        cached: false,
        generated: true,
      });
    } catch (aiError) {
      console.error("Error generating hot books with AI:", aiError);

      // Log the failure
      await supabase.from("hot_books_refresh_log").insert({
        refresh_type: "full_list",
        data_source: "ai",
        books_updated: 0,
        success: false,
        error_message: aiError instanceof Error ? aiError.message : "Unknown error",
      });

      return NextResponse.json(
        { books: [], error: "Failed to generate hot books list" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in hottest-books API:", error);
    return NextResponse.json(
      { books: [], error: "Something went wrong while loading the hottest books" },
      { status: 500 }
    );
  }
}
