/**
 * Pure helper for building the INSERT payload when cloning a sold comic to
 * the buyer's collection. Kept in its own module (no Supabase / Resend imports)
 * so unit tests can exercise the field mapping without bootstrapping the
 * full DB stack.
 *
 * The side-effectful wrapper `cloneSoldComicToBuyer` lives in `auctionDb.ts`
 * and uses this helper.
 */

export interface SellerComicRow {
  id: string;
  user_id: string;
  title: string | null;
  issue_number: string | null;
  variant: string | null;
  publisher: string | null;
  cover_artist: string | null;
  writer: string | null;
  interior_artist: string | null;
  release_year: number | null;
  confidence: number | null;
  is_slabbed: boolean | null;
  grading_company: string | null;
  grade: number | null;
  certification_number: string | null;
  label_type: string | null;
  page_quality: string | null;
  grade_date: string | null;
  grader_notes: string | null;
  is_signature_series: boolean | null;
  signed_by: string | null;
  key_info: string[] | null;
  price_data: unknown;
  cover_image_url: string | null;
  condition_grade: number | null;
  condition_label: string | null;
  is_graded: boolean | null;
  purchase_price: number | null;
  average_price: number | null;
}

/**
 * Build the INSERT payload for a buyer-side comic clone.
 *
 * Catalog fields (title, publisher, cover, grade, signatures, etc.) copy
 * verbatim so the buyer sees the same comic identity. Owner-specific fields
 * reset: the buyer starts with a fresh row (not starred, not listed for sale,
 * purchase_price = what they paid, no personal notes, no custom key info, no
 * list membership).
 *
 * Explicitly does NOT set `id` — Supabase assigns a new UUID on insert.
 * Explicitly does NOT set `sold_at` / `sold_to_profile_id` / `sold_via_auction_id`
 * — those mark the *seller's* row, and the buyer's fresh copy must be fully
 * editable.
 */
export function buildBuyerComicClone(
  seller: SellerComicRow,
  buyerId: string,
  salePrice: number,
  now: Date = new Date()
): Record<string, unknown> {
  return {
    user_id: buyerId,
    // --- catalog / identity fields: copy as-is
    title: seller.title,
    issue_number: seller.issue_number,
    variant: seller.variant,
    publisher: seller.publisher,
    cover_artist: seller.cover_artist,
    writer: seller.writer,
    interior_artist: seller.interior_artist,
    release_year: seller.release_year,
    confidence: seller.confidence,
    is_slabbed: seller.is_slabbed,
    grading_company: seller.grading_company,
    grade: seller.grade,
    certification_number: seller.certification_number,
    label_type: seller.label_type,
    page_quality: seller.page_quality,
    grade_date: seller.grade_date,
    grader_notes: seller.grader_notes,
    is_signature_series: seller.is_signature_series,
    signed_by: seller.signed_by,
    key_info: seller.key_info,
    price_data: seller.price_data,
    cover_image_url: seller.cover_image_url,
    condition_grade: seller.condition_grade,
    condition_label: seller.condition_label,
    is_graded: seller.is_graded,
    average_price: seller.average_price,
    // --- owner-specific fields: reset for the buyer
    purchase_price: salePrice,
    purchase_date: now.toISOString().split("T")[0],
    notes: null,
    for_sale: false,
    asking_price: null,
    date_added: now.toISOString(),
    is_starred: false,
    custom_key_info: [],
    custom_key_info_status: null,
  };
}
