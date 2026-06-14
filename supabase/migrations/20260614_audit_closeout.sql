-- ============================================================================
-- 20260614_audit_closeout.sql
-- Consolidated close-out migration (AUDIT_2026-06-14.md / closeout-plan.md)
-- ============================================================================
-- Date:     2026-06-14
-- Purpose:  Single, owner-reviewable DDL/RPC batch that unblocks the migration-
--           staged code shipped in batches B1-B24. Each app feature below ships
--           a SAFE fallback today; applying this file activates the durable /
--           atomic path. Every block is idempotent (IF NOT EXISTS / OR REPLACE)
--           and safe to run on the live production DB.
--
--           >>> REVIEW BEFORE RUNNING. <<<
--           In particular, sanity-check every "-- ASSUMPTION:" note against the
--           live schema (see summary at the bottom of this comment).
--
-- Conventions matched from existing migrations:
--   * RPCs use CREATE OR REPLACE FUNCTION ... LANGUAGE plpgsql SECURITY DEFINER
--     (read-only fns add STABLE; DML/trigger fns omit it).
--   * SECURITY DEFINER fns SET search_path = public to harden against search-path
--     hijacking (newer-than-repo hardening; harmless, recommended).
--
-- FEATURES UNLOCKED BY EACH BLOCK
-- REQUIRED (run all):
--   1  sales.sale_price_recorded + nullable sale_price ... bulk "Mark as Sold"
--      skippable price prompt; revenue/PL math can flag value-less sold rows. [H-CO1]
--   2  sales.platform_fee + sales.seller_net ............ marketplace destination-
--      charge reconciliation (webhook records seller net + platform fee). [M-MK16]
--   3  profiles.promo_trial_eligible (+ promo_trial_used_at) ... one-time signed
--      QR-exclusive 30-day promo trial persistence. [L-PAY17]
--   4  profiles.comp_granted ............................. comped accounts read as
--      "granted" (granted != trialing) in access-state resolution. [L-AD5]
--   5  profiles.stripe_connect_charges_enabled / _payouts_enabled ... Connect
--      status served from DB mirror (avoids per-request accounts.retrieve). [M-MK19]
--   6  partial UNIQUE index on profiles.stripe_customer_id ... webhook customer
--      lookups (.maybeSingle) are guaranteed at-most-one row. [M-PAY8]
--   7  processed_stripe_sessions + credit_scan_pack() RPC ... idempotent scan-pack
--      credit on Stripe checkout.session.completed (replay-safe). [M-PAY5]
--   8  one-winning-bid partial UNIQUE index on bids ...... DB backstop preventing
--      two winning bids per auction. [H-AU1]
--   9  complete_trade() RPC .............................. atomic two-party comic
--      ownership swap + matched hunt-list cleanup on receipt confirmation. [H-MK6]
--  10  find_trade_matches() column fix + functional indexes ... trade matching
--      (currently broken: references nonexistent seller_rating columns). [H-MK8]
--  11  review_barcode() RPC ............................... atomic admin barcode
--      approve/reject across admin_barcode_reviews + barcode_catalog. [M-SC14]
--  12  idx_comics_user_date_added ......................... collection list ORDER BY
--      date_added perf. [M-CO10]
--  13  sum_seller_platform_fees() RPC ..................... Connect status "total
--      fees paid" via SQL SUM instead of client-side tally. [M-MK19]
--
-- OPTIONAL (clearly marked; safe to skip / apply later):
--  14  COMMENT ON admin_audit_log.action .................. doc sync to full
--      AdminAction set. [L-DOC16]
--  15  pg_trgm GIN index on key_comics.title_normalized ... ONLY if substring/
--      fuzzy key-comic search is later restored. [L-AD9]
-- ============================================================================


-- ############################################################################
-- ##                              REQUIRED                                   ##
-- ############################################################################

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. [H-CO1] sales: skippable sale-price recording
--    Adds a flag for "sold but price not recorded" and relaxes the sale_price
--    NOT NULL constraint so skipped bulk sales can persist (price NULL/0).
--    schema.sql confirms: sales.sale_price is DECIMAL NOT NULL today.
-- ----------------------------------------------------------------------------
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS sale_price_recorded BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE sales
  ALTER COLUMN sale_price DROP NOT NULL;

COMMENT ON COLUMN sales.sale_price_recorded IS
  'False when a sale was logged (e.g. bulk "Mark as Sold") without a recorded price; revenue/PL math should exclude or flag these rows. [H-CO1]';


-- ----------------------------------------------------------------------------
-- 2. [M-MK16] sales: marketplace fee reconciliation columns
--    Populated by the Stripe webhook from the charge's application_fee /
--    transfer when a destination-charge marketplace sale completes.
-- ASSUMPTION: amounts are stored as decimal dollars (matching existing DECIMAL
--    money columns like sale_price/purchase_price), NOT integer cents. If the
--    webhook writes cents, change type to BIGINT.
-- ----------------------------------------------------------------------------
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS platform_fee DECIMAL;

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS seller_net DECIMAL;

COMMENT ON COLUMN sales.platform_fee IS 'Platform application fee (decimal dollars) on a marketplace destination charge. NULL for self-recorded sales. [M-MK16]';
COMMENT ON COLUMN sales.seller_net  IS 'Seller net proceeds (decimal dollars) after platform fee + Stripe fees. NULL for self-recorded sales. [M-MK16]';


-- ----------------------------------------------------------------------------
-- 3. [L-PAY17] profiles: one-time QR-exclusive promo-trial eligibility
--    promo_trial_eligible gates whether a signed promo token may grant the
--    30-day trial; promo_trial_used_at marks one-time consumption.
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS promo_trial_eligible BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS promo_trial_used_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.promo_trial_eligible IS 'Eligible to redeem the QR-exclusive 30-day promo trial via a signed token. [L-PAY17]';
COMMENT ON COLUMN profiles.promo_trial_used_at  IS 'Timestamp the promo trial was redeemed (one-time use). [L-PAY17]';


-- ----------------------------------------------------------------------------
-- 4. [L-AD5] profiles: comped-access flag (granted != trialing)
--    Lets access-state resolution distinguish an admin-comped account from a
--    self-serve trial without overloading trial date fields.
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS comp_granted BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.comp_granted IS 'Admin-granted complimentary premium access (distinct from a trial). [L-AD5]';


-- ----------------------------------------------------------------------------
-- 5. [M-MK19] profiles: Stripe Connect capability mirror columns
--    Mirrors of the Stripe account's charges_enabled / payouts_enabled so the
--    /api/connect/status route can serve from DB + cache instead of calling
--    accounts.retrieve on every request.
-- NOTE: profiles already has stripe_connect_account_id (TEXT) and
--    stripe_connect_onboarding_complete (BOOLEAN). These two are new.
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN;

COMMENT ON COLUMN profiles.stripe_connect_charges_enabled IS 'Mirror of Stripe Connect account charges_enabled (refreshed by account.updated webhook). [M-MK19]';
COMMENT ON COLUMN profiles.stripe_connect_payouts_enabled IS 'Mirror of Stripe Connect account payouts_enabled (refreshed by account.updated webhook). [M-MK19]';


-- ----------------------------------------------------------------------------
-- 6. [M-PAY8] profiles: one-customer-per-profile guarantee
--    NOTE: 20260115_add_subscription_fields.sql already adds a table-level
--    UNIQUE constraint (profiles_stripe_customer_id_key). In Postgres, plain
--    UNIQUE treats NULLs as distinct, so multiple NULL customer ids are already
--    allowed -- the existing constraint is functionally equivalent to this
--    partial index. This block is therefore a no-op on a normal DB; it exists
--    so the guarantee survives even if that constraint was never applied or was
--    dropped. CREATE UNIQUE INDEX IF NOT EXISTS is safe/idempotent.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_stripe_customer_id
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 7. [M-PAY5] Idempotent scan-pack credit
--    Records each processed Stripe session once and atomically increments the
--    buyer's purchased scan balance. Replays (webhook retries / duplicate
--    deliveries) are no-ops. profiles.purchased_scans (INTEGER DEFAULT 0)
--    confirmed present (20260115_add_subscription_fields.sql).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_stripe_sessions (
  session_id   TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE processed_stripe_sessions IS
  'De-dupe ledger for Stripe checkout sessions credited as scan packs (idempotency). [M-PAY5]';

CREATE OR REPLACE FUNCTION credit_scan_pack(
  p_session_id TEXT,
  p_profile_id UUID,
  p_scans      INT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_inserted BOOLEAN := false;
BEGIN
  -- Claim the session. ON CONFLICT DO NOTHING => replay is a clean no-op.
  INSERT INTO processed_stripe_sessions (session_id)
  VALUES (p_session_id)
  ON CONFLICT (session_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;  -- 1 = first time, 0 = already processed

  IF v_inserted THEN
    UPDATE profiles
       SET purchased_scans = COALESCE(purchased_scans, 0) + GREATEST(p_scans, 0)
     WHERE id = p_profile_id;
  END IF;

  -- TRUE  => scans were credited this call
  -- FALSE => session already processed (no-op replay)
  RETURN v_inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION credit_scan_pack(TEXT, UUID, INT) IS
  'Atomically records a Stripe session + increments purchased_scans; returns false on replay. [M-PAY5]';


-- ----------------------------------------------------------------------------
-- 8. [H-AU1] One winning bid per auction (DB backstop)
--    bids.is_winning (BOOLEAN DEFAULT FALSE) confirmed present. An existing
--    NON-unique index idx_bids_auction_winning covers the same predicate; this
--    adds the UNIQUE guarantee so two winning rows can never coexist.
-- ASSUMPTION: no auction currently has >1 row with is_winning = true. If a
--    duplicate exists this CREATE will fail -- de-dupe first, e.g.:
--      -- SELECT auction_id, count(*) FROM bids WHERE is_winning GROUP BY 1 HAVING count(*) > 1;
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_bids_one_winning_per_auction
  ON bids (auction_id)
  WHERE is_winning = true;


-- ----------------------------------------------------------------------------
-- 9. [H-MK6] complete_trade(): atomic ownership swap + hunt-list cleanup
--    On confirmed receipt, transfers each side's comics to the other party and
--    removes any now-satisfied key_hunt_lists rows, in one transaction.
--
--    Schema facts used:
--      * trades(id, proposer_id, recipient_id, status, completed_at, ...)
--      * trade_items(trade_id, comic_id, owner_id)  -- owner_id = ORIGINAL owner
--      * comics(id, user_id, title, issue_number, for_trade)
--      * key_hunt_lists(user_id /* CLERK text id */, title_normalized, issue_number)
--      * profiles(id, clerk_user_id)
--
-- ASSUMPTION: trade_items.owner_id holds the comic's ORIGINAL (pre-swap) owner,
--    i.e. it stays put while comics.user_id changes. We swap each comic's
--    user_id to the OTHER party (proposer<->recipient) based on owner_id. We do
--    NOT mutate trade_items.owner_id (it is the historical record of who put up
--    what). Verify this matches tradingDb.ts expectations.
-- ASSUMPTION: only proposer_id/recipient_id participate; trade_items.owner_id is
--    always one of those two.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_trade(
  p_trade_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_proposer_id        UUID;
  v_recipient_id       UUID;
  v_proposer_clerk_id  TEXT;
  v_recipient_clerk_id TEXT;
  v_status             TEXT;
BEGIN
  -- Lock the trade row for the duration of the swap.
  SELECT proposer_id, recipient_id, status
    INTO v_proposer_id, v_recipient_id, v_status
    FROM trades
   WHERE id = p_trade_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'complete_trade: trade % not found', p_trade_id;
  END IF;

  IF v_status = 'completed' THEN
    -- Idempotent: already completed, nothing to do.
    RETURN false;
  END IF;

  IF v_status NOT IN ('accepted', 'shipped') THEN
    RAISE EXCEPTION 'complete_trade: trade % is in status % and cannot be completed', p_trade_id, v_status;
  END IF;

  -- Resolve Clerk ids for hunt-list cleanup (key_hunt_lists keys on Clerk id).
  SELECT clerk_user_id INTO v_proposer_clerk_id  FROM profiles WHERE id = v_proposer_id;
  SELECT clerk_user_id INTO v_recipient_clerk_id FROM profiles WHERE id = v_recipient_id;

  -- Swap ownership: each comic moves from its original owner to the OTHER party.
  -- Also clear for_trade so swapped books don't linger in trade pools.
  UPDATE comics c
     SET user_id   = CASE
                       WHEN ti.owner_id = v_proposer_id  THEN v_recipient_id
                       WHEN ti.owner_id = v_recipient_id THEN v_proposer_id
                       ELSE c.user_id  -- defensive: leave unexpected owners untouched
                     END,
         for_trade = false,
         updated_at = NOW()
    FROM trade_items ti
   WHERE ti.trade_id = p_trade_id
     AND ti.comic_id = c.id
     AND ti.owner_id IN (v_proposer_id, v_recipient_id);

  -- Hunt-list cleanup: a party who RECEIVED a comic no longer needs it on their
  -- want list. After the swap, comics.user_id reflects the NEW owner, so match
  -- each newly-owned traded comic against that owner's key_hunt_lists.
  DELETE FROM key_hunt_lists kh
   USING trade_items ti
   JOIN comics c ON c.id = ti.comic_id
   JOIN profiles p ON p.id = c.user_id
   WHERE ti.trade_id = p_trade_id
     AND kh.user_id = p.clerk_user_id
     AND LOWER(TRIM(kh.title_normalized)) = LOWER(TRIM(c.title))
     AND TRIM(kh.issue_number) = TRIM(c.issue_number);

  -- Finalize.
  UPDATE trades
     SET status       = 'completed',
         completed_at = NOW(),
         updated_at   = NOW()
   WHERE id = p_trade_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION complete_trade(UUID) IS
  'Atomically swaps comic ownership between both trade parties and prunes satisfied key_hunt_lists rows; idempotent once completed. [H-MK6]';


-- ----------------------------------------------------------------------------
-- 10. [H-MK8] find_trade_matches column fix + functional indexes
--    BUG (20260128_trading_phase3_matching.sql): the function references
--    p_b.seller_rating and p_b.seller_rating_count, which DO NOT exist on
--    profiles. The real reputation columns are positive_ratings /
--    negative_ratings (INTEGER DEFAULT 0). Matching is broken until fixed.
--
--    quality_score redefined as: 50 baseline + positive_ratings - negative_ratings,
--    floored at 0, then bounded by the prior count-normalization shape
--    (LEAST(positive_ratings, 50)) so scores stay in a sane band.
--
--    Body otherwise preserved verbatim from the original definition.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_trade_matches(
  p_user_id UUID,                 -- profile ID of user whose data changed
  p_comic_id UUID DEFAULT NULL    -- optional: specific comic to match
)
RETURNS INTEGER AS $$
DECLARE
  matches_found INTEGER := 0;
  v_clerk_user_id TEXT;
BEGIN
  -- Get the Clerk user ID for key_hunt_lists lookup
  SELECT clerk_user_id INTO v_clerk_user_id FROM profiles WHERE id = p_user_id;

  -- Find matches: User A has comic that User B wants, AND User B has comic that User A wants
  INSERT INTO trade_matches (user_a_id, user_b_id, user_a_comic_id, user_b_comic_id, quality_score)
  SELECT DISTINCT
    c_a.user_id as user_a_id,
    c_b.user_id as user_b_id,
    c_a.id as user_a_comic_id,
    c_b.id as user_b_comic_id,
    -- Quality score: reputation-weighted. positive_ratings / negative_ratings
    -- are the real reputation columns (was: nonexistent seller_rating*).
    GREATEST(
      0,
      50
        + COALESCE(p_b.positive_ratings, 0)
        - COALESCE(p_b.negative_ratings, 0)
    )
    + LEAST(COALESCE(p_b.positive_ratings, 0), 50) as quality_score
  FROM comics c_a
  -- Join to key_hunt_lists to find who wants User A's comic
  JOIN key_hunt_lists kh_b ON (
    LOWER(TRIM(c_a.title)) = LOWER(TRIM(kh_b.title_normalized))
    AND TRIM(c_a.issue_number) = TRIM(kh_b.issue_number)
  )
  -- Get User B's profile from their Clerk ID
  JOIN profiles p_b ON p_b.clerk_user_id = kh_b.user_id
  -- Find comics User B has for trade
  JOIN comics c_b ON (
    c_b.user_id = p_b.id
    AND c_b.for_trade = true
  )
  -- Check if User A wants User B's comic
  JOIN key_hunt_lists kh_a ON (
    kh_a.user_id = v_clerk_user_id
    AND LOWER(TRIM(c_b.title)) = LOWER(TRIM(kh_a.title_normalized))
    AND TRIM(c_b.issue_number) = TRIM(kh_a.issue_number)
  )
  WHERE
    c_a.user_id = p_user_id
    AND c_a.for_trade = true
    AND c_a.user_id != c_b.user_id
    AND (p_comic_id IS NULL OR c_a.id = p_comic_id)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS matches_found = ROW_COUNT;
  RETURN matches_found;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION find_trade_matches(UUID, UUID) IS
  'Inserts reciprocal trade matches; quality_score uses positive_ratings/negative_ratings. [H-MK8]';

-- Functional indexes backing the normalized title+issue join above.
-- comics side: only books offered for trade.
CREATE INDEX IF NOT EXISTS idx_comics_trade_norm_title_issue
  ON comics (LOWER(TRIM(title)), TRIM(issue_number))
  WHERE for_trade = true;

-- key_hunt_lists side: mirror the same functional shape. (title_normalized is
-- already lowercased on write, but LOWER(TRIM(...)) keeps the index usable by
-- the LOWER(TRIM(kh.title_normalized)) predicate in the joins above.)
CREATE INDEX IF NOT EXISTS idx_key_hunt_norm_title_issue
  ON key_hunt_lists (LOWER(TRIM(title_normalized)), TRIM(issue_number));


-- ----------------------------------------------------------------------------
-- 11. [M-SC14] review_barcode(): atomic admin barcode approve/reject
--    Wraps the paired writes to admin_barcode_reviews + barcode_catalog in one
--    transaction so a review can never leave the two tables out of sync.
--
--    Schema facts used:
--      admin_barcode_reviews(id, barcode_catalog_id, status['pending','approved',
--        'corrected','rejected'], corrected_upc, admin_notes, resolved_at,
--        resolved_by)
--      barcode_catalog(id, status['auto_approved','pending_review','approved',
--        'rejected'], reviewed_by, reviewed_at, variant_name,
--        variant_name_status['pending','approved','rejected'])
--
--    Mapping (review status -> catalog status):
--      'approved' / 'corrected' -> 'approved'
--      'rejected'               -> 'rejected'
--      anything else            -> left at its current catalog value
--
-- ASSUMPTION: p_admin_id is a profiles.id (matches *_by FK targets). The route
--    resolves the Clerk admin to a profile before calling.
-- ASSUMPTION: variant_name_status should follow the catalog status (approved on
--    approve, rejected on reject) only when a variant_name is present. Adjust if
--    the admin UI manages variant approval separately.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION review_barcode(
  p_review_id     UUID,
  p_admin_id      UUID,
  p_status        TEXT,            -- 'approved' | 'corrected' | 'rejected'
  p_corrected_upc TEXT DEFAULT NULL,
  p_admin_notes   TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_catalog_id     UUID;
  v_catalog_status TEXT;
BEGIN
  IF p_status NOT IN ('approved', 'corrected', 'rejected') THEN
    RAISE EXCEPTION 'review_barcode: invalid status %', p_status;
  END IF;

  -- Lock the review row and grab its linked catalog id.
  SELECT barcode_catalog_id
    INTO v_catalog_id
    FROM admin_barcode_reviews
   WHERE id = p_review_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'review_barcode: review % not found', p_review_id;
  END IF;

  -- Update the admin review row.
  UPDATE admin_barcode_reviews
     SET status        = p_status,
         corrected_upc = COALESCE(p_corrected_upc, corrected_upc),
         admin_notes   = COALESCE(p_admin_notes, admin_notes),
         resolved_at   = NOW(),
         resolved_by   = p_admin_id
   WHERE id = p_review_id;

  -- Map to the catalog's status vocabulary.
  v_catalog_status := CASE
                        WHEN p_status IN ('approved', 'corrected') THEN 'approved'
                        WHEN p_status = 'rejected'                 THEN 'rejected'
                        ELSE NULL
                      END;

  IF v_catalog_status IS NOT NULL AND v_catalog_id IS NOT NULL THEN
    UPDATE barcode_catalog
       SET status      = v_catalog_status,
           reviewed_by = p_admin_id,
           reviewed_at = NOW(),
           variant_name_status = CASE
                                   WHEN variant_name IS NOT NULL AND v_catalog_status = 'approved' THEN 'approved'
                                   WHEN variant_name IS NOT NULL AND v_catalog_status = 'rejected' THEN 'rejected'
                                   ELSE variant_name_status
                                 END
     WHERE id = v_catalog_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION review_barcode(UUID, UUID, TEXT, TEXT, TEXT) IS
  'Atomically resolves an admin_barcode_reviews row and syncs barcode_catalog status. [M-SC14]';


-- ----------------------------------------------------------------------------
-- 12. [M-CO10] comics: collection list ordering index
--    Supports the default collection query: WHERE user_id = ? AND deleted_at IS
--    NULL ORDER BY date_added DESC. comics.deleted_at confirmed present
--    (20260202_add_deleted_at.sql).
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_comics_user_date_added
  ON comics (user_id, date_added DESC)
  WHERE deleted_at IS NULL;


-- ----------------------------------------------------------------------------
-- 13. [M-MK19] sum_seller_platform_fees(): total platform fees for a seller
--    Backs the Connect status "total fees paid" figure via SQL SUM rather than
--    a client-side tally over rows.
-- ASSUMPTION: "seller" on a sale is sales.user_id (schema.sql has no seller_id;
--    user_id is the recording/selling profile). p_account_id is therefore a
--    profiles.id. If callers pass a Stripe Connect account id instead, this must
--    join profiles ON stripe_connect_account_id = p_account_id (left as a note
--    rather than implemented, since the column type would differ).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sum_seller_platform_fees(
  p_account_id UUID
)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(platform_fee), 0)::NUMERIC
    FROM sales
   WHERE user_id = p_account_id
     AND platform_fee IS NOT NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION sum_seller_platform_fees(UUID) IS
  'Total platform_fee across a seller''s (profiles.id) marketplace sales. [M-MK19]';

COMMIT;


-- ############################################################################
-- ##                              OPTIONAL                                   ##
-- ##  Reviewed separately. Safe to apply now or defer. Each block is fully   ##
-- ##  idempotent. Uncomment item 15 only if/when substring key-comic search  ##
-- ##  is restored.                                                           ##
-- ############################################################################

-- ----------------------------------------------------------------------------
-- 14. [L-DOC16] admin_audit_log.action documentation sync (OPTIONAL, doc only)
--    admin_audit_log.action is plain TEXT (no CHECK); this only updates the
--    column comment to the full AdminAction set. Keep in sync with the union in
--    src/lib/adminAuth.ts.
-- ----------------------------------------------------------------------------
COMMENT ON COLUMN admin_audit_log.action IS
  'AdminAction (see src/lib/adminAuth.ts): search_users, view_profile, reset_trial, grant_premium, suspend, unsuspend, approve_barcode, reject_barcode, approve_cover, edit_key_comic, delete_key_comic. [L-DOC16]';
-- ASSUMPTION: this list mirrors the final AdminAction union extended in B6. If
--    the union changes, update this comment to match (it is documentation only).


-- ----------------------------------------------------------------------------
-- 15. [L-AD9] pg_trgm fuzzy-search index on key_comics.title_normalized
--    (OPTIONAL, perf only -- enable ONLY if substring/leading-wildcard search
--    is later restored in keyComicsDb.ts. Prefix search uses the existing
--    idx_key_comics_lookup and does NOT need this.)
--    key_comics.title_normalized confirmed: TEXT NOT NULL
--    (20250117_key_info_community.sql).
-- ----------------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_key_comics_title_trgm
--   ON key_comics USING gin (title_normalized gin_trgm_ops);

-- ============================================================================
-- END 20260614_audit_closeout.sql
-- ============================================================================
