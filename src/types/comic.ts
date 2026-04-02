// Barcode data detected from cover scan
export interface BarcodeData {
  raw: string; // Full barcode string (12-17 digits)
  confidence: "high" | "medium" | "low";
  parsed?: {
    upcPrefix: string; // First 5 digits (publisher code)
    itemNumber: string; // Next 6 digits (series identifier)
    checkDigit: string; // Digit 12 (validation)
    addonIssue?: string; // Digits 13-15 (issue number)
    addonVariant?: string; // Digits 16-17 (variant code)
  };
}

export interface ComicDetails {
  id: string;
  title: string | null;
  issueNumber: string | null;
  variant: string | null;
  publisher: string | null;
  coverArtist: string | null;
  writer: string | null;
  interiorArtist: string | null;
  releaseYear: string | null;
  confidence: "high" | "medium" | "low";
  // Grading info (detected from slabbed comics)
  isSlabbed: boolean;
  gradingCompany: GradingCompany | null;
  grade: string | null;
  certificationNumber: string | null; // CGC/CBCS/PGX cert number
  labelType: string | null; // e.g., "Universal", "Signature Series"
  pageQuality: string | null; // e.g., "White", "Off-white to white"
  gradeDate: string | null; // Date the comic was graded (CGC only)
  graderNotes: string | null; // Grader notes about defects (CGC: "Grader Notes", CBCS: "Notes")
  isSignatureSeries: boolean;
  signedBy: string | null;
  // Price/Value info
  priceData: PriceData | null;
  // Key info (first appearances, deaths, team changes, etc.)
  keyInfo: string[];
  // Source of keyInfo — controls whether "Verified" badge is shown
  keyInfoSource?: "database" | "cgc" | "ai" | "cache";
  // Barcode data (detected during cover scan)
  barcode?: BarcodeData | null;
  // Cerebro-assisted scan (Gemini low-confidence fallback was used)
  cerebro_assisted?: boolean;
}

export interface PriceData {
  estimatedValue: number | null;
  recentSales: RecentSale[];
  mostRecentSaleDate: string | null;
  isAveraged: boolean; // true if value is avg of multiple sales, false if single sale
  disclaimer: string | null;
  // Grade-aware pricing
  gradeEstimates?: GradeEstimate[];
  baseGrade?: number; // The grade the estimatedValue is based on (default 9.4 for raw estimates)
  // Price source indicator
  priceSource?: "ebay"; // Where the price data came from
}

export interface GradeEstimate {
  grade: number;
  label: string; // e.g., "Near Mint", "Very Fine"
  rawValue: number;
  slabbedValue: number; // CGC/CBCS graded value (typically higher)
}

export interface RecentSale {
  price: number;
  date: string;
  source: string;
  isOlderThan6Months: boolean;
}

export type GradingCompany = "CGC" | "CBCS" | "PGX" | "Other";

export interface CollectionItem {
  id: string;
  comic: ComicDetails;
  coverImageUrl: string;
  conditionGrade: number | null;
  conditionLabel: ConditionLabel | null;
  isGraded: boolean;
  gradingCompany: string | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  notes: string | null;
  forSale: boolean;
  forTrade: boolean;
  askingPrice: number | null;
  averagePrice: number | null;
  dateAdded: string;
  listIds: string[];
  isStarred: boolean;
  // Custom key info added by the user (pending approval)
  customKeyInfo: string[];
  customKeyInfoStatus: "pending" | "approved" | "rejected" | null;
}

export type ConditionLabel =
  | "Poor"
  | "Fair"
  | "Good"
  | "Very Good"
  | "Fine"
  | "Very Fine"
  | "Near Mint"
  | "Mint";

export interface UserList {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface PriceHistoryEntry {
  date: string;
  price: number;
  source: "ebay" | "user_report" | "price_guide";
  condition: number;
}

export interface SaleRecord {
  id: string;
  comic: ComicDetails;
  coverImageUrl: string;
  purchasePrice: number | null;
  salePrice: number;
  saleDate: string;
  profit: number;
  buyerId: string | null; // For future user-to-user sales
}

export const CONDITION_LABELS: ConditionLabel[] = [
  "Poor",
  "Fair",
  "Good",
  "Very Good",
  "Fine",
  "Very Fine",
  "Near Mint",
  "Mint",
];

export const CONDITION_TO_GRADE: Record<ConditionLabel, number> = {
  Poor: 0.5,
  Fair: 1.5,
  Good: 2.5,
  "Very Good": 4.0,
  Fine: 6.0,
  "Very Fine": 8.0,
  "Near Mint": 9.4,
  Mint: 10.0,
};

export const PUBLISHERS = [
  "Marvel Comics",
  "DC Comics",
  "Image Comics",
  "Dark Horse Comics",
  "IDW Publishing",
  "Boom! Studios",
  "Dynamite Entertainment",
  "Valiant Comics",
  "Archie Comics",
  "Vertigo",
  "Other",
];

/**
 * Maps common publisher shorthand/variations to canonical PUBLISHERS values.
 */
export const PUBLISHER_ALIASES: Record<string, string> = {
  dc: "DC Comics",
  "dc comics": "DC Comics",
  marvel: "Marvel Comics",
  "marvel comics": "Marvel Comics",
  image: "Image Comics",
  "image comics": "Image Comics",
  "dark horse": "Dark Horse Comics",
  "dark horse comics": "Dark Horse Comics",
  idw: "IDW Publishing",
  "idw publishing": "IDW Publishing",
  boom: "Boom! Studios",
  "boom!": "Boom! Studios",
  "boom studios": "Boom! Studios",
  "boom! studios": "Boom! Studios",
  dynamite: "Dynamite Entertainment",
  "dynamite entertainment": "Dynamite Entertainment",
  valiant: "Valiant Comics",
  "valiant comics": "Valiant Comics",
  archie: "Archie Comics",
  "archie comics": "Archie Comics",
  vertigo: "Vertigo",
  "vertigo comics": "Vertigo",
  "dc vertigo": "Vertigo",
  other: "Other",
};

/**
 * Normalize a publisher name to a canonical value from the PUBLISHERS list.
 * Returns null if no mapping exists.
 */
export function normalizePublisher(publisher: string | null | undefined): string | null {
  if (!publisher || !publisher.trim()) return null;
  const trimmed = publisher.trim();
  if (PUBLISHERS.includes(trimmed)) return trimmed;
  const alias = PUBLISHER_ALIASES[trimmed.toLowerCase()];
  return alias || null;
}

export const GRADING_COMPANIES: GradingCompany[] = ["CGC", "CBCS", "PGX", "Other"];

// Standard comic book grading scale (CGC/CBCS scale)
export const GRADE_SCALE: { value: string; label: string }[] = [
  { value: "10", label: "10 - Gem Mint" },
  { value: "9.9", label: "9.9 - Mint" },
  { value: "9.8", label: "9.8 - Near Mint/Mint" },
  { value: "9.6", label: "9.6 - Near Mint+" },
  { value: "9.4", label: "9.4 - Near Mint" },
  { value: "9.2", label: "9.2 - Near Mint-" },
  { value: "9.0", label: "9.0 - Very Fine/Near Mint" },
  { value: "8.5", label: "8.5 - Very Fine+" },
  { value: "8.0", label: "8.0 - Very Fine" },
  { value: "7.5", label: "7.5 - Very Fine-" },
  { value: "7.0", label: "7.0 - Fine/Very Fine" },
  { value: "6.5", label: "6.5 - Fine+" },
  { value: "6.0", label: "6.0 - Fine" },
  { value: "5.5", label: "5.5 - Fine-" },
  { value: "5.0", label: "5.0 - Very Good/Fine" },
  { value: "4.5", label: "4.5 - Very Good+" },
  { value: "4.0", label: "4.0 - Very Good" },
  { value: "3.5", label: "3.5 - Very Good-" },
  { value: "3.0", label: "3.0 - Good/Very Good" },
  { value: "2.5", label: "2.5 - Good+" },
  { value: "2.0", label: "2.0 - Good" },
  { value: "1.8", label: "1.8 - Good-" },
  { value: "1.5", label: "1.5 - Fair/Good" },
  { value: "1.0", label: "1.0 - Fair" },
  { value: "0.5", label: "0.5 - Poor" },
];
