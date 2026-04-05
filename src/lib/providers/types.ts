// src/lib/providers/types.ts
// Shared types for the multi-provider AI fallback system.

import type { GradingCompany } from "@/types/comic";

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
  // Cover harvesting (populated for slabbed books only)
  coverHarvestable?: boolean;
  coverCropCoordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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

/** Cheap slab detection -- determines if image is a graded comic */
export interface SlabDetectionResult {
  isSlabbed: boolean;
  gradingCompany: GradingCompany | null;
  certificationNumber: string | null;
}

/** Focused extraction for slabbed comics -- barcode, cover harvest, creators */
export interface SlabDetailExtractionResult {
  barcode: {
    raw: string | null;
    confidence: "high" | "medium" | "low";
  };
  coverHarvestable: boolean;
  coverCropCoordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  writer: string | null;
  coverArtist: string | null;
  interiorArtist: string | null;
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

export type AICallType =
  | "imageAnalysis"
  | "verification"
  | "slabDetection"
  | "slabDetailExtraction";

export interface AIProvider {
  readonly name: "anthropic" | "gemini";
  analyzeImage(req: ImageAnalysisRequest, opts?: CallOptions): Promise<ImageAnalysisResult>;
  verifyAndEnrich(req: VerificationRequest, opts?: CallOptions): Promise<VerificationResult>;
  detectSlab(req: ImageAnalysisRequest, opts?: CallOptions): Promise<SlabDetectionResult>;
  extractSlabDetails(
    req: ImageAnalysisRequest,
    opts?: CallOptions & {
      skipCreators?: boolean;
      skipBarcode?: boolean;
    }
  ): Promise<SlabDetailExtractionResult>;
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
  provider: "anthropic" | "gemini";
  fallbackUsed: boolean;
  fallbackReason: string | null;
  confidence: "high" | "medium" | "low";
  cerebro_assisted?: boolean;
  callDetails: {
    imageAnalysis: { provider: string; fallbackUsed: boolean } | null;
    verification: { provider: string; fallbackUsed: boolean } | null;
    slabDetection?: { provider: string; durationMs: number; cost: number };
    slabDetailExtraction?: {
      provider: string;
      durationMs: number;
      cost: number;
      coverHarvestOnly?: boolean;
    };
  };
}
