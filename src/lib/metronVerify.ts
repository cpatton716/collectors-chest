/**
 * Metron API verification layer
 *
 * Silent, non-blocking verification that runs alongside existing lookups.
 * If Metron confirms the comic exists, we boost confidence and optionally
 * use their cover image. Any failure is swallowed — zero user impact.
 */

export interface MetronVerifyResult {
  verified: boolean;
  confidence_boost: boolean;
  metron_id: string | null;
  cover_image: string | null;
}

const METRON_TIMEOUT_MS = 3000;
const METRON_BASE_URL = "https://metron.cloud/api";

/**
 * Verify a comic exists in the Metron database.
 *
 * - Uses Basic Auth from METRON_USERNAME / METRON_PASSWORD env vars.
 * - Hard 3-second timeout via AbortSignal.timeout().
 * - On ANY error, timeout, or missing config: returns a safe default (not verified).
 */
export async function verifyWithMetron(
  title: string,
  issueNumber: string
): Promise<MetronVerifyResult> {
  const safeDefault: MetronVerifyResult = {
    verified: false,
    confidence_boost: false,
    metron_id: null,
    cover_image: null,
  };

  try {
    const username = process.env.METRON_USERNAME;
    const password = process.env.METRON_PASSWORD;

    // If credentials aren't configured, bail immediately
    if (!username || !password) {
      return safeDefault;
    }

    const basicAuth = Buffer.from(`${username}:${password}`).toString("base64");

    const params = new URLSearchParams({
      series_name: title,
      number: issueNumber,
    });

    const url = `${METRON_BASE_URL}/issue/?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(METRON_TIMEOUT_MS),
    });

    if (!response.ok) {
      return safeDefault;
    }

    const data = await response.json();

    // Metron returns { count, next, previous, results: [...] }
    if (!data.results || data.results.length === 0) {
      return safeDefault;
    }

    const match = data.results[0];

    return {
      verified: true,
      confidence_boost: true,
      metron_id: match.id ? String(match.id) : null,
      cover_image: match.image ?? match.cover ?? null,
    };
  } catch {
    // Timeout, network error, JSON parse error — all silently ignored
    return safeDefault;
  }
}
