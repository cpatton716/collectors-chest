export function normalizeGradingCompany(raw: string | null | undefined): "CGC" | "CBCS" | "PGX" | null {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (cleaned === "CGC") return "CGC";
  if (cleaned === "CBCS") return "CBCS";
  if (cleaned === "PGX") return "PGX";
  return null;
}

export function parseKeyComments(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
}

export function mergeKeyComments(certEntries: string[], dbEntries: string[]): string[] {
  const seen = new Set(certEntries.map((s) => s.toLowerCase().trim()));
  const merged = [...certEntries];
  for (const entry of dbEntries) {
    const normalized = entry.toLowerCase().trim();
    if (!seen.has(normalized)) { seen.add(normalized); merged.push(entry); }
  }
  return merged;
}

export function parseArtComments(artComments: string | null): { writer?: string; coverArtist?: string; interiorArtist?: string } {
  if (!artComments) return {};
  const result: { writer?: string; coverArtist?: string; interiorArtist?: string } = {};
  const coverAndArt = artComments.match(/^([\w\s.\-']+?)\s+cover\s+(?:and|&)\s+art$/i);
  if (coverAndArt) { result.coverArtist = coverAndArt[1].trim(); result.interiorArtist = coverAndArt[1].trim(); return result; }
  const coverBy = artComments.match(/cover\s+by\s+([\w\s.\-']+?)(?:;|$)/i);
  const interiorBy = artComments.match(/interior\s+art\s+by\s+([\w\s.\-']+?)(?:;|$)/i);
  const artBy = artComments.match(/(?:^|\s)art\s+by\s+([\w\s.\-']+?)(?:;|$)/i);
  if (coverBy) result.coverArtist = coverBy[1].trim();
  if (interiorBy) result.interiorArtist = interiorBy[1].trim();
  if (artBy && !result.interiorArtist) result.interiorArtist = artBy[1].trim();
  return result;
}
