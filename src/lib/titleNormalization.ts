/**
 * Comic title abbreviation expansion for autocomplete.
 * Matches the ENTIRE query against known abbreviations.
 */

const ABBREVIATION_MAP: Record<string, string> = {
  // Marvel
  asm: "Amazing Spider-Man",
  tasm: "The Amazing Spider-Man",
  tos: "Tales of Suspense",
  tot: "Tales to Astonish",
  toa: "Tales to Astonish",
  ff: "Fantastic Four",
  ux: "Uncanny X-Men",
  uxm: "Uncanny X-Men",
  gsxm: "Giant-Size X-Men",
  ih: "Incredible Hulk",
  tih: "The Incredible Hulk",
  nm: "New Mutants",
  ssm: "Spectacular Spider-Man",
  wsm: "Web of Spider-Man",
  usm: "Ultimate Spider-Man",
  msh: "Marvel Super Heroes",
  msf: "Marvel Super Heroes Secret Wars",
  sw: "Secret Wars",
  ew: "Eternals",
  ca: "Captain America",
  ds: "Doctor Strange",
  dp: "Deadpool",

  // DC
  tec: "Detective Comics",
  jla: "Justice League of America",
  jle: "Justice League Europe",
  jli: "Justice League International",
  gl: "Green Lantern",
  ga: "Green Arrow",
  ww: "Wonder Woman",
  mos: "Man of Steel",
  dkr: "The Dark Knight Returns",
  coie: "Crisis on Infinite Earths",
  losh: "Legion of Super-Heroes",
  sok: "Saga of the Swamp Thing",

  // Indie
  tmnt: "Teenage Mutant Ninja Turtles",
  wd: "The Walking Dead",
  twd: "The Walking Dead",
};

/**
 * Check if the entire query is a known abbreviation.
 * Returns the expanded title or null.
 */
export function expandAbbreviation(query: string): string | null {
  const normalized = query.toLowerCase().trim();
  return ABBREVIATION_MAP[normalized] || null;
}

/**
 * Normalize a search query: expand abbreviations, trim whitespace.
 * Returns the expanded title if matched, otherwise the trimmed original.
 */
export function normalizeSearchQuery(query: string): string {
  const expanded = expandAbbreviation(query);
  if (expanded) return expanded;
  return query.trim();
}
