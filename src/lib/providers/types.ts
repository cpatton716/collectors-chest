// src/lib/providers/types.ts
// Shared types for the multi-provider AI fallback system.

import type { GradingCompany, GradeEstimate } from "@/types/comic";

// ── Call Options ──

export interface CallOptions {
  signal?: AbortSignal;
}

// ── Request Types ──

export interface ImageAnalysisRequest {
  base64Data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

export interface VerificationRequest {
  title: string;
  issueNumber: string;
  publisher: string | null;
  releaseYear: string | null;
  variant: string | null;
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  missingFields: string[];
}

export interface PriceEstimationRequest {
  title: string;
  issueNumber: string;
  publisher: string | null;
  releaseYear: string | null;
  grade: string | null;
  gradingCompany: string | null;
  isSlabbed: boolean;
  isSignatureSeries: boolean;
  signedBy: string | null;
}

// ── Result Types ──

/** Fields returned by Call 1 (image analysis). Derived from ComicDetails in src/types/comic.ts. */
export interface ImageAnalysisResult {
  title: string | null;
  issueNumber: string | null;
  publisher: string | null;
  releaseYear: string | null;
  variant: string | null;
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  confidence: "high" | "medium" | "low";
  isSlabbed: boolean;
  gradingCompany: GradingCompany | null;
  grade: string | null;
  certificationNumber: string | null;
  labelType: string | null;
  pageQuality: string | null;
  gradeDate: string | null;
  graderNotes: string | null;
  isSignatureSeries: boolean;
  signedBy: string | null;
  barcodeNumber: string | null;
  barcode: {
    raw: string;
    confidence: "high" | "medium" | "low";
  } | null;
}

export interface VerificationResult {
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
  publisher: string | null;
  releaseYear: string | null;
  variant: string | null;
  keyInfo: string[];
}

export interface PriceEstimationResult {
  recentSales: {
    price: number;
    date: string;
    source: string;
    daysAgo?: number;
  }[];
  gradeEstimates: GradeEstimate[];
  marketNotes: string;
}

// ── Error Types ──

export type ErrorReason =
  | "model_not_found"
  | "rate_limited"
  | "server_error"
  | "timeout"
  | "auth_error"
  | "bad_request"
  | "content_policy"
  | "unknown";

/** Errors that should NOT trigger fallback — same input will fail on any provider */
export const NON_RETRYABLE_ERRORS: ErrorReason[] = ["bad_request", "content_policy"];

// ── Provider Interface ──

export type AICallType = "imageAnalysis" | "verification" | "priceEstimation";

export interface AIProvider {
  readonly name: "anthropic" | "openai";
  analyzeImage(req: ImageAnalysisRequest, opts?: CallOptions): Promise<ImageAnalysisResult>;
  verifyAndEnrich(req: VerificationRequest, opts?: CallOptions): Promise<VerificationResult>;
  estimatePrice(req: PriceEstimationRequest, opts?: CallOptions): Promise<PriceEstimationResult>;
  estimateCostCents(callType: AICallType): number;
}

// ── Orchestrator Result ──

export interface CallResult<T> {
  result: T;
  provider: string;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  fallbackRawError: string | null;
}

// ── Response Metadata ──

export interface ScanResponseMeta {
  provider: "anthropic" | "openai";
  fallbackUsed: boolean;
  fallbackReason: string | null;
  confidence: "high" | "medium" | "low";
  callDetails: {
    imageAnalysis: { provider: string; fallbackUsed: boolean };
    verification: { provider: string; fallbackUsed: boolean } | null;
    priceEstimation: { provider: string; fallbackUsed: boolean } | null;
  };
}
