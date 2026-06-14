import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { lookupCertification } from "@/lib/certLookup";
import { checkRateLimit, getRateLimitIdentifier, rateLimiters } from "@/lib/rateLimit";
import { validateBody } from "@/lib/validation";

const certLookupSchema = z.object({
  certNumber: z
    .string()
    .trim()
    .min(1, "Certification number is required")
    .max(20, "Certification number is too long"),
  gradingCompany: z
    .string()
    .trim()
    .min(1, "Grading company is required")
    .max(20),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit cert scraping (public endpoint, hits external sites). H-PR3.
    const identifier = getRateLimitIdentifier(
      null,
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip")
    );
    const { success: rateLimitSuccess, response: rateLimitResponse } = await checkRateLimit(
      rateLimiters.lookup,
      identifier
    );
    if (!rateLimitSuccess && rateLimitResponse) return rateLimitResponse;

    const body = await request.json().catch(() => null);
    const validated = validateBody(certLookupSchema, body);
    if (!validated.success) return validated.response;
    const { certNumber, gradingCompany } = validated.data;

    const result = await lookupCertification(gradingCompany, certNumber);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Certification lookup failed",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      source: result.source,
      certNumber: result.certNumber,
      data: result.data,
    });
  } catch (error) {
    console.error("[cert-lookup API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
