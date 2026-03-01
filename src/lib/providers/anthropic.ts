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
  PriceEstimationRequest,
  PriceEstimationResult,
  VerificationRequest,
  VerificationResult,
} from "./types";

// ── Exported Prompts (shared with OpenAI provider) ──

export const IMAGE_ANALYSIS_PROMPT = `You are an expert comic book identifier and grading specialist. Analyze this comic book cover image and extract as much information as possible.

Look carefully at:
1. The title of the comic series (usually prominently displayed)
2. The issue number (often with # symbol)
3. The publisher logo (Marvel, DC, Image, Dark Horse, etc.)
4. Any variant cover indicators (Cover A, B, 1:25, etc.)
5. Creator credits if visible (writer, artist names)
6. The publication year or month/year
7. **UPC BARCODE DETECTION** - Look for any UPC barcode visible on the cover:
   - Read ALL digits carefully (typically 12 digits for UPC-A, plus optional 5-digit add-on = 17 total)
   - The main UPC is 12 digits; if there's a smaller 5-digit add-on code to the right, include those too
   - Report your confidence level based on image clarity:
     * "high" - barcode is clear and fully readable
     * "medium" - barcode is partially visible or slightly blurry but you can make out most digits
     * "low" - barcode is obscured, damaged, or very blurry but you can attempt to read it
   - If no barcode is visible at all, return null for the barcode field
8. WHETHER THIS IS A GRADED/SLABBED COMIC - Look for:
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
  "variant": "variant name if this is a variant cover, otherwise null",
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
- **BARCODE PRIORITY**: If you can see a UPC barcode, read EVERY digit carefully - this enables faster database lookup
- **BARCODE CONFIDENCE**: Report "high" only if you can clearly read all digits; "medium" if some digits are unclear; "low" if barcode is partially obscured`;

export function buildVerificationPrompt(req: VerificationRequest): string {
  return `You are a comic book expert. Complete this comic's information.

Comic: "${req.title}" #${req.issueNumber}
Known: Publisher=${req.publisher || "?"}, Year=${req.releaseYear || "?"}, Variant=${req.variant || "standard"}
Need: ${req.missingFields.join(", ")}

Return JSON:
{
  "writer": "${req.writer || "fill in or null"}",
  "coverArtist": "${req.coverArtist || "fill in or null"}",
  "interiorArtist": "${req.interiorArtist || "fill in or null"}",
  "publisher": "${req.publisher || "fill in (full name like Marvel Comics)"}",
  "releaseYear": "${req.releaseYear || "YYYY or null"}",
  "variant": ${req.variant ? `"${req.variant}"` : "null if standard cover"},
  "keyInfo": ["ONLY major key facts - first appearances, deaths, origins. Empty array for regular issues."]
}

Rules:
- Keep existing values if already filled
- For keyInfo: ONLY significant collector facts (first appearances of MAJOR characters, major storyline events, origin stories). Most issues = empty array.
- Return ONLY valid JSON, no other text.`;
}

export function buildPriceEstimationPrompt(req: PriceEstimationRequest): string {
  const gradeInfo = req.grade ? `Grade: ${req.grade}` : "Raw/Ungraded";
  const signatureInfo = req.isSignatureSeries
    ? `Signature Series signed by ${req.signedBy || "unknown"}`
    : "";
  const gradingCompanyInfo = req.gradingCompany ? `Graded by ${req.gradingCompany}` : "";

  return `You are a comic book market expert with knowledge of recent comic book sales and values.

I need estimated recent sale prices for this comic:
- Title: ${req.title}
- Issue Number: ${req.issueNumber}
- Publisher: ${req.publisher || "Unknown"}
- Year: ${req.releaseYear || "Unknown"}
- Condition: ${gradeInfo} ${gradingCompanyInfo} ${signatureInfo}

Based on your knowledge of the comic book market, provide realistic estimated recent sale prices. Consider:
- The significance/key status of this issue
- The grade/condition
- Whether it's a signature series (adds value)
- Recent market trends for this title

Return a JSON object with estimated recent sales data AND grade-specific price estimates:
{
  "recentSales": [
    { "price": estimated_price_1, "date": "YYYY-MM-DD", "source": "eBay", "daysAgo": number },
    { "price": estimated_price_2, "date": "YYYY-MM-DD", "source": "eBay", "daysAgo": number },
    { "price": estimated_price_3, "date": "YYYY-MM-DD", "source": "eBay", "daysAgo": number }
  ],
  "gradeEstimates": [
    { "grade": 9.8, "label": "Near Mint/Mint", "rawValue": price, "slabbedValue": price },
    { "grade": 9.4, "label": "Near Mint", "rawValue": price, "slabbedValue": price },
    { "grade": 8.0, "label": "Very Fine", "rawValue": price, "slabbedValue": price },
    { "grade": 6.0, "label": "Fine", "rawValue": price, "slabbedValue": price },
    { "grade": 4.0, "label": "Very Good", "rawValue": price, "slabbedValue": price },
    { "grade": 2.0, "label": "Good", "rawValue": price, "slabbedValue": price }
  ],
  "marketNotes": "brief note about this comic's market value"
}

Important:
- Return ONLY the JSON object, no other text
- For recentSales: provide 3 realistic sale prices at the scanned grade (or 9.4 NM for raw)
- Use dates within the last 6 months (late 2025/early 2026)
- For gradeEstimates: provide realistic price differences between grades
  - Raw comics are ungraded copies (typically 10-30% less than slabbed)
  - Slabbed values are for CGC/CBCS graded copies (command a premium)
  - Higher grades exponentially more valuable for key issues
  - Lower grades have smaller price gaps between them
- Price scaling rules:
  - For KEY issues (first appearances, deaths): 9.8 can be 2-10x the 9.4 price
  - For regular issues: grade premiums are more modest (9.8 ~1.5-2x of 9.4)
  - Raw copies typically 70-90% of equivalent slabbed value
  - Lower grades (2.0-4.0) may be affordable entry points for expensive keys
- Be realistic with actual market pricing behavior`;
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

  // ── Call 3: Price Estimation ──

  async estimatePrice(
    req: PriceEstimationRequest,
    opts?: CallOptions
  ): Promise<PriceEstimationResult> {
    const response = await this.client.messages.create(
      {
        model: MODEL_PRIMARY,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: buildPriceEstimationPrompt(req),
          },
        ],
      },
      { signal: opts?.signal }
    );

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Price estimation call returned no text content.");
    }

    return this.parseJsonResponse(textBlock.text) as PriceEstimationResult;
  }

  // ── Cost Estimation ──

  estimateCostCents(callType: AICallType): number {
    switch (callType) {
      case "imageAnalysis":
        return 1.5;
      case "verification":
        return 0.6;
      case "priceEstimation":
        return 0.6;
    }
  }
}
