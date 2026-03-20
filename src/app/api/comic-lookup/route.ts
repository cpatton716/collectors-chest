import { NextRequest, NextResponse } from "next/server";

import Anthropic from "@anthropic-ai/sdk";

import { cacheGet, cacheSet, generateComicMetadataCacheKey } from "@/lib/cache";
import { getComicMetadata, incrementComicLookupCount, saveComicMetadata } from "@/lib/db";
import { MODEL_PRIMARY } from "@/lib/models";
import { normalizeTitle, normalizeIssueNumber } from "@/lib/normalizeTitle";
import { recordScanAnalytics, estimateScanCostCents } from "@/lib/analyticsServer";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ComicLookupResult {
  publisher: string | null;
  releaseYear: string | null;
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  keyInfo: string[];
  priceData?: null;
  source?: "database" | "ai"; // Track where the data came from
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let aiCallsMade = 0;

  try {
    const { title, issueNumber, lookupType } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: "Please enter a comic title to look up." },
        { status: 400 }
      );
    }

    const normalizedTitle = normalizeTitle(title);
    const normalizedIssue = normalizeIssueNumber(issueNumber || "");

    // For publisher-only lookups, use simple approach (no caching needed)
    if (lookupType === "publisher") {
      aiCallsMade++;
      const result = await handlePublisherLookup(normalizedTitle);

      // Record scan analytics for publisher lookup (fire-and-forget)
      const pubCostCents = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade, ebayLookup: false });
      recordScanAnalytics({
        profile_id: null,
        scan_method: "comic-lookup",
        estimated_cost_cents: pubCostCents,
        ai_calls_made: aiCallsMade,
        metadata_cache_hit: false,
        ebay_lookup: false,
        duration_ms: Date.now() - startTime,
        success: true,
        subscription_tier: "guest",
      }).catch(() => {});

      return result;
    }

    // Full lookup - use hybrid approach
    if (!normalizedIssue) {
      return NextResponse.json(
        { error: "Issue number is required for full lookup." },
        { status: 400 }
      );
    }

    const cacheKey = generateComicMetadataCacheKey(normalizedTitle, normalizedIssue);

    // 1. Check Redis cache first (fastest, works across serverless invocations)
    try {
      const redisCached = await cacheGet<ComicLookupResult>(cacheKey, "comicMetadata");
      if (redisCached) {
        // Transition guard: strip non-eBay price data from cached results
        if (redisCached.priceData && (redisCached.priceData as unknown as Record<string, unknown>).priceSource !== 'ebay') {
          (redisCached as unknown as Record<string, unknown>).priceData = null;
        }
        return NextResponse.json({ ...redisCached, source: "cache" });
      }
    } catch (redisError) {
      console.error("[comic-lookup] Redis cache check failed:", redisError);
    }

    // 2. Check database (fast ~50ms, long-term storage)
    try {
      const dbResult = await getComicMetadata(normalizedTitle, normalizedIssue);
      if (dbResult) {
        const result: ComicLookupResult = {
          publisher: dbResult.publisher,
          releaseYear: dbResult.releaseYear,
          writer: dbResult.writer,
          coverArtist: dbResult.coverArtist,
          interiorArtist: dbResult.interiorArtist,
          keyInfo: dbResult.keyInfo,
          priceData: null,
          source: "database",
        };

        // Backfill Redis cache and increment lookup count (non-blocking)
        cacheSet(cacheKey, result, "comicMetadata");
        incrementComicLookupCount(normalizedTitle, normalizedIssue).catch(() => {});

        return NextResponse.json(result);
      }
    } catch (dbError) {
      console.error("[comic-lookup] Database lookup failed, falling back to AI:", dbError);
      // Continue to AI lookup
    }

    // 3. Fall back to Claude API (slower ~1-2s, but handles everything)

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Comic lookup is temporarily unavailable. Please try again later." },
        { status: 500 }
      );
    }

    aiCallsMade++;
    const result = await fetchFromClaudeAPI(normalizedTitle, normalizedIssue);

    // 4. Save to Redis and database for future lookups (non-blocking)
    cacheSet(cacheKey, result, "comicMetadata");
    saveComicMetadata({
      title: normalizedTitle,
      issueNumber: normalizedIssue,
      publisher: result.publisher,
      releaseYear: result.releaseYear,
      writer: result.writer,
      coverArtist: result.coverArtist,
      interiorArtist: result.interiorArtist,
      keyInfo: result.keyInfo,
    }).catch((err) => {
      console.error("[comic-lookup] Failed to save to database:", err);
    });

    // Record scan analytics (fire-and-forget)
    const costCents = estimateScanCostCents({ metadataCacheHit: false, aiCallsMade, ebayLookup: false });
    recordScanAnalytics({
      profile_id: null,
      scan_method: "comic-lookup",
      estimated_cost_cents: costCents,
      ai_calls_made: aiCallsMade,
      metadata_cache_hit: false,
      ebay_lookup: false,
      duration_ms: Date.now() - startTime,
      success: true,
      subscription_tier: "guest",
    }).catch(() => {});

    return NextResponse.json({ ...result, source: "ai" });
  } catch (error) {
    console.error("Error in comic lookup:", error);
    return NextResponse.json({
      publisher: null,
      releaseYear: null,
      writer: null,
      coverArtist: null,
      interiorArtist: null,
      keyInfo: [],
    });
  }
}

// Simple publisher lookup (no caching, fast AI call)
async function handlePublisherLookup(title: string): Promise<NextResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Comic lookup is temporarily unavailable." },
      { status: 500 }
    );
  }

  const prompt = `You are a comic book expert. For the comic series "${title}", provide the publisher.

Return ONLY a JSON object with this format, no other text:
{"publisher": "Publisher Name"}

If you're not sure, return {"publisher": null}`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_PRIMARY,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json({ publisher: null });
    }

    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
    if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
    if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);

    const result = JSON.parse(jsonText.trim());
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ publisher: null });
  }
}

// Fetch comic metadata from Claude API (pricing now handled by eBay Browse API)
async function fetchFromClaudeAPI(title: string, issueNumber: string): Promise<ComicLookupResult> {
  const prompt = `You are a comic book expert. For the comic "${title}" issue #${issueNumber}, provide:

1. Publisher (the company that published this comic)
2. Release Year (the year this specific issue was published)
3. Writer (primary writer)
4. Cover Artist (cover artist for this issue)
5. Interior Artist (interior/pencil artist for this issue)
6. Key Info (significant facts about this issue)

Return ONLY a JSON object with this format, no other text:
{
  "publisher": "Publisher Name",
  "releaseYear": "YYYY",
  "writer": "Writer Name",
  "coverArtist": "Artist Name",
  "interiorArtist": "Artist Name",
  "keyInfo": ["array of MAJOR key facts - leave empty if none"]
}

For keyInfo, ONLY include facts that significantly impact collector value:
- First appearances of MAJOR characters (not minor/supporting characters)
- Major storyline events (e.g., "Death of Superman", "Knightfall begins")
- Origin stories of major characters
- First appearance of iconic costumes/items (e.g., "First symbiote suit", "First Infinity Gauntlet")
- Iconic/historically significant cover art
- Creator milestones (e.g., "First Jim Lee X-Men art", "First Frank Miller Daredevil")

Do NOT include: minor character appearances, team roster changes, crossover tie-ins, deaths that were quickly reversed, relationship milestones, or cameo appearances.

Use null for any field you're not confident about. Most issues should have empty keyInfo array.`;

  const response = await anthropic.messages.create({
    model: MODEL_PRIMARY,
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    return {
      publisher: null,
      releaseYear: null,
      writer: null,
      coverArtist: null,
      interiorArtist: null,
      keyInfo: [],
    };
  }

  let jsonText = textContent.text.trim();
  if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
  if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
  if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);

  try {
    const result = JSON.parse(jsonText.trim()) as ComicLookupResult;

    // Ensure keyInfo is always an array
    if (!result.keyInfo || !Array.isArray(result.keyInfo)) {
      result.keyInfo = [];
    }

    // No price data — pricing handled by eBay Browse API
    result.priceData = null;

    return result;
  } catch {
    console.error("Failed to parse Claude API response");
    return {
      publisher: null,
      releaseYear: null,
      writer: null,
      coverArtist: null,
      interiorArtist: null,
      keyInfo: [],
    };
  }
}
