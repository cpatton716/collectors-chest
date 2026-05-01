-- Grant permanent comp Premium access to the three co-founder accounts
--
-- These are the same three Clerk users who were granted is_admin=TRUE in the
-- earlier admin-grant migration. Co-founders need full Premium for product
-- testing, partner demos, and ongoing use; they should NOT pay through Stripe.
--
-- Mechanics:
--   subscription_tier   = 'premium'   → unlocks all premium features
--   subscription_status = 'active'    → not past-due, not canceled
--   subscription_source = 'comped'    → never expires; revenue analytics
--                                        filter excludes these rows
--   stripe_customer_id  stays NULL    → Stripe webhooks won't match them
--   stripe_subscription_id stays NULL → no automated billing
--   trial_*             cleared       → preserves their legitimate-trial
--                                        eligibility if they ever leave comp
--
-- Idempotent: running twice is safe (UPDATE WHERE clerk_user_id IN (...)).
-- Depends on 20260428_add_subscription_source.sql.

UPDATE profiles
   SET subscription_tier              = 'premium',
       subscription_status            = 'active',
       subscription_source            = 'comped',
       subscription_current_period_end = NULL,
       trial_started_at               = NULL,
       trial_ends_at                  = NULL,
       updated_at                     = NOW()
 WHERE clerk_user_id IN (
   'user_3CjC6Ov6pTXPw2u93VFli8l2vOQ',
   'user_3BzGTFOIRnURGTRDO2YfYvnDvVi',
   'user_3ClOCDQWU8RAM7wmIehSNEcoWl2'
 );
