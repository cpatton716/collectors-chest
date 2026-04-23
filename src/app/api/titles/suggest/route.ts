import { NextRequest, NextResponse } from "next/server";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { cacheGet, cacheSet } from "@/lib/cache";
import { MODEL_LIGHTWEIGHT } from "@/lib/models";
import { validateBody } from "@/lib/validation";

const titleSuggestSchema = z.object({
  query: z.string().trim().min(1).max(200),
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface TitleSuggestion {
  title: string;
  years: string; // e.g., "1963-2011" or "2018-Present"
  publisher?: string;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    const validated = validateBody(titleSuggestSchema, rawBody);
    if (!validated.success) return validated.response;
    const { query } = validated.data;

    if (query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // Check Redis cache first (24-hour TTL)
    const cacheKey = query.toLowerCase().trim();
    const cached = await cacheGet<TitleSuggestion[]>(cacheKey, "titleSuggest");
    if (cached) {
      return NextResponse.json({ suggestions: cached });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Title suggestions are temporarily unavailable." },
        { status: 500 }
      );
    }

    // Use Haiku for title suggestions - cheaper model, sufficient for this task
    const response = await anthropic.messages.create({
      model: MODEL_LIGHTWEIGHT,
      max_tokens: 512, // Reduced from 1024 - simple JSON array output
      messages: [
        {
          role: "user",
          content: `You are a comic book expert. Given the search term "${query}", suggest up to 10 official comic book series titles that CONTAIN this text anywhere in the title.

IMPORTANT: Match titles where the search term appears ANYWHERE in the title, not just at the beginning. For example:
- "Spider" should match "The Amazing Spider-Man", "Spider-Woman", "Ultimate Spider-Man", "Superior Spider-Man", etc.
- "man" should match "Batman", "Superman", "Iron Man", "Spider-Man", etc.
- "x-men" should match "X-Men", "Uncanny X-Men", "New X-Men", "Astonishing X-Men", etc.

Also handle common typos and variations:
- "Spiderman" or "spider man" → match "Spider-Man" titles
- "Xmen" → match "X-Men" titles
- "Batmam" → match "Batman" titles

Handle common comic abbreviations: ASM = Amazing Spider-Man, TEC = Detective Comics, FF = Fantastic Four, JLA = Justice League of America, UXM = Uncanny X-Men, TMNT = Teenage Mutant Ninja Turtles, IH = Incredible Hulk, NM = New Mutants, GL = Green Lantern, WD = The Walking Dead.

CRITICAL: Many comic series have been relaunched multiple times with the same name. Include ALL major runs as separate entries with their year ranges. For example:
- "Amazing Spider-Man (1963-1998)" - Original run
- "Amazing Spider-Man (1999-2013)" - Volume 2
- "Amazing Spider-Man (2014-2015)" - Volume 3
- "Amazing Spider-Man (2015-2018)" - Volume 4
- "Amazing Spider-Man (2018-Present)" - Volume 5/current

Focus on:
- Major publisher titles (Marvel, DC, Image, Dark Horse, etc.)
- Use the official/canonical series name
- Prioritize more popular/well-known series first
- Include both current and classic series
- Separate different volumes/runs of the same title

Return ONLY a JSON array of objects with this format, no other text:
[{"title": "Amazing Spider-Man", "years": "1963-1998", "publisher": "Marvel"}, ...]

Use "Present" for ongoing series. If no matches, return an empty array: []`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json({ suggestions: [] });
    }

    let suggestions: TitleSuggestion[] = [];
    try {
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.slice(7);
      }
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith("```")) {
        jsonText = jsonText.slice(0, -3);
      }
      const parsed = JSON.parse(jsonText.trim());

      // Handle both old format (string[]) and new format (TitleSuggestion[])
      if (Array.isArray(parsed)) {
        suggestions = parsed.map((item: string | TitleSuggestion) => {
          if (typeof item === "string") {
            return { title: item, years: "" };
          }
          return item;
        });
      }
    } catch {
      console.error("Failed to parse title suggestions");
      return NextResponse.json({ suggestions: [] });
    }

    // Cache the result in Redis (fire and forget)
    if (suggestions.length > 0) {
      cacheSet(cacheKey, suggestions, "titleSuggest").catch(() => {});
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error getting title suggestions:", error);
    return NextResponse.json({ suggestions: [] });
  }
}
