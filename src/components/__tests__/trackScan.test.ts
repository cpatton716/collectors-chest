import { buildScanEventProps } from "../PostHogProvider";
import type { ScanResponseMeta } from "@/lib/providers/types";

describe("buildScanEventProps", () => {
  it("returns basic props when no meta provided", () => {
    const result = buildScanEventProps("upload", true);
    expect(result).toEqual({
      method: "upload",
      success: true,
      provider: undefined,
      fallbackUsed: undefined,
      fallbackReason: undefined,
    });
  });

  it("includes provider data when meta provided", () => {
    const meta: ScanResponseMeta = {
      provider: "anthropic",
      fallbackUsed: false,
      fallbackReason: null,
      confidence: "high",
      callDetails: {
        imageAnalysis: { provider: "anthropic", fallbackUsed: false },
        verification: null,

      },
    };
    const result = buildScanEventProps("camera", true, meta);
    expect(result).toEqual({
      method: "camera",
      success: true,
      provider: "anthropic",
      fallbackUsed: false,
      fallbackReason: null,
    });
  });

  it("includes fallback reason when fallback was used", () => {
    const meta: ScanResponseMeta = {
      provider: "gemini",
      fallbackUsed: true,
      fallbackReason: "timeout",
      confidence: "medium",
      callDetails: {
        imageAnalysis: { provider: "gemini", fallbackUsed: true },
        verification: null,

      },
    };
    const result = buildScanEventProps("upload", true, meta);
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe("timeout");
    expect(result.provider).toBe("gemini");
  });
});
