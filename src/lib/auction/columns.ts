// AUTO-EXTRACTED from auctionDb.ts during R1-auctiondb refactor (M-AU9).
// Behavior-preserving: function bodies moved verbatim.

// ============================================================================
// SHARED COLUMN PROJECTIONS
// ----------------------------------------------------------------------------
// Explicit column lists for the auctions + joined comics rows, matching every
// field transformDbAuction reads. Replaces the prior `auctions.*` /
// `comics(*)` star-selects so list queries pull only what the transform
// consumes (M-AU8 / L-MK22). Keep these in sync with transformDbAuction.
// ============================================================================

export const AUCTION_COLUMNS = [
  "id",
  "seller_id",
  "comic_id",
  "listing_type",
  "starting_price",
  "current_bid",
  "buy_it_now_price",
  "start_time",
  "end_time",
  "status",
  "winner_id",
  "winning_bid",
  "shipping_cost",
  "detail_images",
  "description",
  "bid_count",
  "payment_status",
  "payment_deadline",
  "shipped_at",
  "tracking_number",
  "tracking_carrier",
  "accepts_offers",
  "min_offer_amount",
  "expires_at",
  "cancel_reason",
  "original_end_time",
  "created_at",
  "updated_at",
].join(", ");

export const COMIC_COLUMNS = [
  "id",
  "title",
  "issue_number",
  "variant",
  "publisher",
  "cover_artist",
  "writer",
  "interior_artist",
  "release_year",
  "confidence",
  "is_slabbed",
  "grading_company",
  "grade",
  "certification_number",
  "label_type",
  "page_quality",
  "is_signature_series",
  "signed_by",
  "price_data",
  "key_info",
  "grade_date",
  "grader_notes",
  "cover_image_url",
  "condition_grade",
  "condition_label",
  "is_graded",
  "purchase_price",
  "purchase_date",
  "notes",
  "for_sale",
  "for_trade",
  "asking_price",
  "average_price",
  "date_added",
  "is_starred",
  "custom_key_info",
  "custom_key_info_status",
].join(", ");

/**
 * `auctions` row plus the lean joined `comics` projection, for list endpoints
 * that hydrate full auction cards via transformDbAuction.
 */
export const AUCTION_WITH_COMIC_SELECT = `${AUCTION_COLUMNS}, comics!auctions_comic_id_fkey(${COMIC_COLUMNS})`;
