// src/lib/providers/gemini.ts
// Google Gemini provider — reuses prompts from the Anthropic provider
// so both providers ask the same questions in the same format.

import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_PRIMARY } from "@/lib/models";
import {
  IMAGE_ANALYSIS_PROMPT,
  buildVerificationPrompt,
} from "./anthropic";
import type {
  AIProvider,
  AICallType,
  CallOptions,
  ImageAnalysisRequest,
  ImageAnalysisResult,
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
    const model = this.genAI.getGenerativeModel({ model: GEMINI_PRIMARY });

    const result = await this.withTimeout(
      model.generateContent(buildVerificationPrompt(req)),
      opts?.signal
    );

    const text = result.response.text();
    if (!text) throw new Error("No response from Gemini verification");
    return this.parseJsonResponse(text) as VerificationResult;
  }

  // ── Cost Estimation ──

  estimateCostCents(callType: AICallType): number {
    // Gemini Flash is very cost-effective
    switch (callType) {
      case "imageAnalysis":
        return 0.3;
      case "verification":
        return 0.1;
    }
  }
}
