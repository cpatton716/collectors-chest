// src/lib/providers/anthropic.ts
// Anthropic AI provider — extracts Claude-specific prompts and API calls
// from the analyze route into a reusable, testable provider class.

import Anthropic from "@anthropic-ai/sdk";

import { MODEL_PRIMARY } from "@/lib/models";

import type {
  AICallType,
  AIProvider,
  CallOptions,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  VerificationRequest,
  VerificationResult,
} from "./types";

// ── Exported Prompts (shared with Gemini provider) ──

export const IMAGE_ANALYSIS_PROMPT = `You are an expert comic book identifier with deep knowledge of Marvel, DC,
and independent publishers spanning from the 1930s to present day.
You have particular expertise in identifying vintage and bronze/copper age
comics (1970s-1990s), variant covers, and special editions.

Analyze the comic book cover image and return a structured JSON identification.

Examine the cover carefully for: title, issue number, volume, publisher,
cover date or year, creative credits if visible, variant cover indicators,
condition observations, and any visible barcode or UPC.

IMPORTANT: Capture the FULL series title including any subtitles or sub-series names. For example, 'Batman '89: Echoes' is a different series than 'Batman '89'. Look for colons, hyphens, or smaller text beneath the main title that indicates a subtitle or sub-series.

FOIL, EMBOSSED, AND METALLIC COVERS:
If the cover appears to be foil, holographic, embossed, lenticular, or
metallic, the main logo may be unreadable due to light reflection. In these
cases you must:
1. Focus on the indicia (fine print box, usually bottom of cover or inside)
2. Read the spine text if visible
3. Look for any non-reflective text areas on the cover
4. Note the variant type in the variant field (e.g. "red foil cover")

VINTAGE COMICS (pre-1995):
Pay close attention to the cover date printed on the comic, the Comics Code
Authority stamp if present, and the publisher indicia. These are more
reliable identifiers than cover art recognition for older books.

VARIANT DETECTION - Carefully check for ANY variant indicators:
- Cover letter variants: "Cover A", "Cover B", "Cover C", etc.
- Ratio variants: "1:10", "1:25", "1:50", "1:100" incentive variants
- Print variants: "Second Print", "Third Print", "2nd Printing", etc.
- Edition variants: "Newsstand Edition", "Direct Edition", "Book Market Edition"
- Special covers: "Foil Cover", "Hologram", "Glow in the Dark", "Virgin Cover" (no trade dress/logos), "Sketch Cover", "Blank Cover"
- Creator variants: "Stanley 'Artgerm' Lau Variant", artist name variants
- Store exclusives: "NYCC Exclusive", "ComicsPro Variant", shop-specific exclusives
- Format variants: "Director's Cut", "Facsimile Edition", "Reprint"
- Look for text like "VARIANT", "VARIANT COVER", "VARIANT EDITION" on the cover
- Check if the cover art differs from the standard/Cover A (different artist style, wraparound, etc.)
- If multiple variant indicators apply, combine them (e.g., "Cover B Virgin Variant", "1:25 Foil Variant")

UPC BARCODE DETECTION - Look for any UPC barcode visible on the cover:
- Read ALL digits carefully (typically 12 digits for UPC-A, plus optional 5-digit add-on = 17 total)
- The main UPC is 12 digits; if there's a smaller 5-digit add-on code to the right, include those too
- Report your confidence level based on image clarity:
  * "high" - barcode is clear and fully readable
  * "medium" - barcode is partially visible or slightly blurry but you can make out most digits
  * "low" - barcode is obscured, damaged, or very blurry but you can attempt to read it
- If no barcode is visible at all, return null for the barcode field

GRADED/SLABBED COMIC DETECTION - Look for:
- A hard plastic case (slab) around the comic
- A label at the top with grading company logo (CGC, CBCS, PGX)
- A numeric grade (e.g., 9.8, 9.6, 9.4, 9.0, etc.)
- "Signature Series" or "SS" indicating it's signed
- The name of who signed it (often on the label)
- THE CERTIFICATION NUMBER - This is a long number (usually 7-10 digits) on the label, often near a barcode

Return your findings as a JSON object with this exact structure:
{
  "title": "series title or null if not identifiable",
  "issueNumber": "issue number as string or null",
  "variant": "specific variant description (e.g., 'Cover B', '1:25 Ratio Variant', 'Newsstand Edition', 'Second Print', 'Foil Cover', 'Virgin Variant') or null if standard Cover A / no variant indicators",
  "publisher": "publisher name or null",
  "coverArtist": "cover artist name if visible, otherwise null",
  "writer": "writer name if visible, otherwise null",
  "interiorArtist": "interior artist if visible (usually same as cover unless specified), otherwise null",
  "releaseYear": "4-digit year as string or null",
  "confidence": "high if most fields identified, medium if some fields identified, low if few fields identified",
  "isSlabbed": true or false - whether the comic is in a graded slab/case,
  "gradingCompany": "CGC" or "CBCS" or "PGX" or "Other" or null if not slabbed,
  "grade": "the numeric grade as a string (e.g., '9.8', '9.0') or null if not slabbed",
  "certificationNumber": "the certification/serial number from the label (7-10 digit number) or null if not visible/not slabbed",
  "isSignatureSeries": true or false - whether it's a Signature Series (signed and authenticated),
  "signedBy": "name of person who signed it or null if not signed/not visible",
  "barcodeNumber": "the full UPC barcode digits (12-17 numbers) if visible on the cover, otherwise null",
  "barcode": {
    "raw": "all barcode digits as a single string (12-17 digits)",
    "confidence": "high" | "medium" | "low"
  } or null if no barcode visible
}

Important:
- Return ONLY the JSON object, no other text
- Use null for any field you cannot determine
- Be accurate - don't guess if you're not confident
- For publisher, use the full name (e.g., "Marvel Comics" not just "Marvel")
- Pay special attention to the grading label if present - it contains valuable info
- The CGC/CBCS label typically shows: grade, title, issue, date, and signature info
- **VARIANT DETECTION**: Look carefully for ANY variant indicators on the cover — text, logos, special finishes, or cover art that differs from the standard edition. Variant information is critical for accurate pricing. When in doubt, describe what you see (e.g., "possible variant - different cover art from standard")
- **BARCODE PRIORITY**: If you can see a UPC barcode, read EVERY digit carefully - this enables faster database lookup
- **BARCODE CONFIDENCE**: Report "high" only if you can clearly read all digits; "medium" if some digits are unclear; "low" if barcode is partially obscured`;

export function buildVerificationPrompt(req: VerificationRequest): string {
  return `You are a comic book expert. Complete this comic's information.

Comic: "${req.title}" #${req.issueNumber}
Known: Publisher=${req.publisher || "?"}, Year=${req.releaseYear || "?"}, Variant=${req.variant || "unknown"}
Need: ${req.missingFields.join(", ")}

Return JSON:
{
  "writer": "${req.writer || "fill in or null"}",
  "coverArtist": "${req.coverArtist || "fill in or null"}",
  "interiorArtist": "${req.interiorArtist || "fill in or null"}",
  "publisher": "${req.publisher || "fill in (full name like Marvel Comics)"}",
  "releaseYear": "${req.releaseYear || "YYYY or null"}",
  "variant": ${req.variant ? `"${req.variant}"` : '"identify the variant if known (e.g., Cover B, 1:25 Ratio Variant, Newsstand Edition, Second Print, Foil Cover, Virgin Variant) or null if standard Cover A"'},
  "keyInfo": ["ONLY major key facts - first appearances, deaths, origins. Empty array for regular issues."]
}

Rules:
- Keep existing values if already filled
- For title: Ensure it includes the FULL series name with any subtitles or sub-series (e.g., 'Batman \'89: Echoes' not just 'Batman \'89'). If the title appears incomplete, use your knowledge to provide the full series title including subtitle.
- For variant: If the variant field is null or "standard", use your knowledge to determine if this issue had notable variants and whether the cover artist or other details suggest a specific variant. Common variant types include: Cover letter (A/B/C), ratio variants (1:10, 1:25, 1:50), print variants (2nd Print, 3rd Print), edition types (Newsstand, Direct), special covers (Foil, Virgin, Sketch), and store/convention exclusives. Return null only if it's the standard Cover A.
- For keyInfo: ONLY significant collector facts (first appearances of MAJOR characters, major storyline events, origin stories). Most issues = empty array.
- Return ONLY valid JSON, no other text.`;
}

// ── Provider Class ──

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
  }

  // ── JSON Parsing ──

  private parseJsonResponse(raw: string): unknown {
    let text = raw.trim();
    if (text.startsWith("```json")) {
      text = text.slice(7);
    }
    if (text.startsWith("```")) {
      text = text.slice(3);
    }
    if (text.endsWith("```")) {
      text = text.slice(0, -3);
    }
    return JSON.parse(text.trim());
  }

  // ── Call 1: Image Analysis ──

  async analyzeImage(
    req: ImageAnalysisRequest,
    opts?: CallOptions
  ): Promise<ImageAnalysisResult> {
    const response = await this.client.messages.create(
      {
        model: MODEL_PRIMARY,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: req.mediaType,
                  data: req.base64Data,
                },
              },
              {
                type: "text",
                text: IMAGE_ANALYSIS_PROMPT,
              },
            ],
          },
        ],
      },
      { signal: opts?.signal }
    );

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error(
        "We couldn't analyze this image. Please try a clearer photo of the comic cover."
      );
    }

    return this.parseJsonResponse(textBlock.text) as ImageAnalysisResult;
  }

  // ── Call 2: Verification & Enrichment ──

  async verifyAndEnrich(
    req: VerificationRequest,
    opts?: CallOptions
  ): Promise<VerificationResult> {
    const response = await this.client.messages.create(
      {
        model: MODEL_PRIMARY,
        max_tokens: 384,
        messages: [
          {
            role: "user",
            content: buildVerificationPrompt(req),
          },
        ],
      },
      { signal: opts?.signal }
    );

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Verification call returned no text content.");
    }

    return this.parseJsonResponse(textBlock.text) as VerificationResult;
  }

  // ── Cost Estimation ──

  estimateCostCents(callType: AICallType): number {
    switch (callType) {
      case "imageAnalysis":
        return 1.5;
      case "verification":
        return 0.6;
    }
  }
}
