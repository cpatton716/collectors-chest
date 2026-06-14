// src/lib/providers/gemini.ts
// Google Gemini provider - reuses prompts from the Anthropic provider
// so both providers ask the same questions in the same format.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_PRIMARY, AI_COST_CENTS } from "@/lib/models";
import {
  IMAGE_ANALYSIS_PROMPT,
  buildVerificationPrompt,
  SLAB_DETECTION_PROMPT,
  SLAB_DETAIL_EXTRACTION_PROMPT,
  SLAB_COVER_HARVEST_ONLY_PROMPT,
  SLAB_BARCODE_HARVEST_PROMPT,
} from "./anthropic";
import type { GradingCompany } from "@/types/comic";
import type {
  AIProvider,
  AICallType,
  CallOptions,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  SlabDetectionResult,
  SlabDetailExtractionResult,
  VerificationRequest,
  VerificationResult,
} from "./types";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
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

  // ── Timeout helper ──

  private withTimeout<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return promise;

    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        if (signal.aborted) {
          reject(new DOMException("The operation was aborted.", "AbortError"));
          return;
        }
        signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        }, { once: true });
      }),
    ]);
  }

  // ── Call 1: Image Analysis ──

  async analyzeImage(
    req: ImageAnalysisRequest,
    opts?: CallOptions
  ): Promise<ImageAnalysisResult> {
    const model = this.genAI.getGenerativeModel(
      { model: GEMINI_PRIMARY },
      { apiVersion: "v1beta" }
    );

    const result = await this.withTimeout(
      model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: req.mediaType, data: req.base64Data } },
              { text: IMAGE_ANALYSIS_PROMPT },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 1536 },
      }),
      opts?.signal
    );

    const text = result.response.text();
    if (!text) throw new Error("No response from Gemini image analysis");
    return this.parseJsonResponse(text) as ImageAnalysisResult;
  }

  // ── Call 2: Verification & Enrichment ──

  async verifyAndEnrich(
    req: VerificationRequest,
    opts?: CallOptions
  ): Promise<VerificationResult> {
    const model = this.genAI.getGenerativeModel(
      { model: GEMINI_PRIMARY },
      { apiVersion: "v1beta" }
    );

    const result = await this.withTimeout(
      model.generateContent(buildVerificationPrompt(req)),
      opts?.signal
    );

    const text = result.response.text();
    if (!text) throw new Error("No response from Gemini verification");
    return this.parseJsonResponse(text) as VerificationResult;
  }

  // ── Slab Detection & Detail Extraction (stubs - implemented in Task 3) ──

  async detectSlab(
    req: ImageAnalysisRequest,
    opts?: CallOptions
  ): Promise<SlabDetectionResult> {
    const model = this.genAI.getGenerativeModel(
      { model: GEMINI_PRIMARY },
      { apiVersion: "v1beta" }
    );

    const result = await this.withTimeout(
      model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: req.mediaType, data: req.base64Data } },
              { text: SLAB_DETECTION_PROMPT },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 128 },
      }),
      opts?.signal
    );

    const text = result.response.text();
    if (!text) throw new Error("No response from Gemini slab detection");
    const parsed = this.parseJsonResponse(text) as SlabDetectionResult;
    if (parsed.gradingCompany) {
      parsed.gradingCompany = parsed.gradingCompany as GradingCompany;
    }
    return parsed;
  }

  async extractSlabDetails(
    req: ImageAnalysisRequest,
    opts?: CallOptions & { skipCreators?: boolean; skipBarcode?: boolean }
  ): Promise<SlabDetailExtractionResult> {
    // Prompt selection by what we still need (mirrors the Anthropic provider):
    // - skip creators + skip barcode -> harvest crop only
    // - skip creators, keep barcode  -> barcode + harvest (no creator reasoning)
    // - otherwise                    -> full detail extraction
    const isCoverHarvestOnly = opts?.skipCreators && opts?.skipBarcode;
    const isBarcodeHarvest = opts?.skipCreators && !opts?.skipBarcode;
    const prompt = isCoverHarvestOnly
      ? SLAB_COVER_HARVEST_ONLY_PROMPT
      : isBarcodeHarvest
        ? SLAB_BARCODE_HARVEST_PROMPT
        : SLAB_DETAIL_EXTRACTION_PROMPT;
    const maxOutputTokens = isCoverHarvestOnly ? 128 : isBarcodeHarvest ? 256 : 384;

    const model = this.genAI.getGenerativeModel(
      { model: GEMINI_PRIMARY },
      { apiVersion: "v1beta" }
    );

    const result = await this.withTimeout(
      model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: req.mediaType, data: req.base64Data } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { maxOutputTokens },
      }),
      opts?.signal
    );

    const text = result.response.text();
    if (!text) throw new Error("No response from Gemini slab detail extraction");
    return this.parseJsonResponse(text) as SlabDetailExtractionResult;
  }

  // ── Cost Estimation ──

  estimateCostCents(callType: AICallType): number {
    // Gemini Flash is very cost-effective.
    // Per-call costs are centralized in AI_COST_CENTS (models.ts).
    switch (callType) {
      case "imageAnalysis":
        return AI_COST_CENTS.gemini.imageAnalysis;
      case "verification":
        return AI_COST_CENTS.gemini.verification;
      // Slab calls are lighter vision calls.
      case "slabDetection":
        return 0.05;
      case "slabDetailExtraction":
        return 0.1;
    }
  }
}
