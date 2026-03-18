// src/lib/providers/openai.ts
// OpenAI GPT-4o provider — reuses prompts from the Anthropic provider
// so both providers ask the same questions in the same format.

import OpenAI from "openai";
import { OPENAI_PRIMARY } from "@/lib/models";
import {
  IMAGE_ANALYSIS_PROMPT,
  buildVerificationPrompt,
  buildPriceEstimationPrompt,
} from "./anthropic";
import type {
  AIProvider,
  AICallType,
  CallOptions,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  VerificationRequest,
  VerificationResult,
  PriceEstimationRequest,
  PriceEstimationResult,
} from "./types";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async analyzeImage(
    req: ImageAnalysisRequest,
    opts?: CallOptions
  ): Promise<ImageAnalysisResult> {
    const response = await this.client.chat.completions.create(
      {
        model: OPENAI_PRIMARY,
        max_tokens: 1024,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${req.mediaType};base64,${req.base64Data}`,
                },
              },
              { type: "text", text: IMAGE_ANALYSIS_PROMPT },
            ],
          },
        ],
      },
      { signal: opts?.signal }
    );

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("No response from OpenAI image analysis");
    return JSON.parse(text) as ImageAnalysisResult;
  }

  async verifyAndEnrich(
    req: VerificationRequest,
    opts?: CallOptions
  ): Promise<VerificationResult> {
    const response = await this.client.chat.completions.create(
      {
        model: OPENAI_PRIMARY,
        max_tokens: 384,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: buildVerificationPrompt(req),
          },
        ],
      },
      { signal: opts?.signal }
    );

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("No response from OpenAI verification");
    return JSON.parse(text) as VerificationResult;
  }

  async estimatePrice(
    req: PriceEstimationRequest,
    opts?: CallOptions
  ): Promise<PriceEstimationResult> {
    const response = await this.client.chat.completions.create(
      {
        model: OPENAI_PRIMARY,
        max_tokens: 512,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: buildPriceEstimationPrompt(req),
          },
        ],
      },
      { signal: opts?.signal }
    );

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("No response from OpenAI price estimation");
    return JSON.parse(text) as PriceEstimationResult;
  }

  estimateCostCents(callType: AICallType): number {
    switch (callType) {
      case "imageAnalysis":
        return 1.2;
      case "verification":
        return 0.4;
      case "priceEstimation":
        return 0.4;
    }
  }
}
