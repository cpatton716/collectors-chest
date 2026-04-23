# Reputation System Design

**Date:** January 30, 2026
**Status:** Approved
**Related Feedback:** #5 (Reward users for key info contributions)

> **Apr 23, 2026 update:** Added a new input to Transaction Trust — **system-inserted negative rating on payment-miss flag**. When the marketplace payment-deadline cron flags a buyer for missing the 48-hour payment window, the system automatically inserts a negative rating against that buyer's reviewee profile (reviewer = system user). This is in addition to the strike/bid-restriction logic (2 strikes / 90 days → bid restriction). System-inserted ratings count the same as user-submitted ratings for percentage calculation and "New Seller / X% positive" display.

---

## Overview

A dual-score reputation system that separates **Transaction Trust** (buyer/seller reliability) from **Community Reputation** (contributions to the platform). This approach provides clear trust signals for marketplace transactions while rewarding users who contribute valuable content.

---

## Design Principles

1. **Transaction feedback is king** - Real money exchanged = real accountability
2. **Community contributions as a bonus, not the base** - Admin-gated to prevent gaming
3. **Keep inputs simple** - Users should understand exactly what earns reputation
4. **Separate concerns** - Transaction trust and community contributions measure different things

---

## Score Types

### 1. Transaction Trust

Measures reliability in marketplace transactions (sales, auctions, trades).

**Inputs:**
| Activity | Effect |
|----------|--------|
| Positive rating from sale/auction | +1 to positive count |
| Negative rating from sale/auction | +1 to negative count |
| Positive rating from completed trade | +1 to positive count |
| Negative rating from completed trade | +1 to negative count |

**Calculation:**
```
percentage = positive_count / (positive_count + negative_count) * 100
```

**Display:**
| Condition | Display |
|-----------|---------|
| < 5 total ratings | "New Seller" (no percentage) |
| 5+ ratings, 90%+ positive | "98% positive (47)" - green |
| 5+ ratings, 70-89% positive | "82% positive (23)" - yellow |
| < 70% positive | "65% positive (12)" - red |

### 2. Community Reputation

Measures contributions to the platform's knowledge base.

**Inputs:**
| Activity | Effect |
|----------|--------|
| Key info submission approved by admin | +1 to contribution count |

**Future inputs (not in v1):**
- Accurate abuse reports (if action taken)
- Other admin-gated contributions

**Display:**
| Condition | Badge |
|-----------|-------|
| 0 approved contributions | No badge shown |
| 1-4 approved contributions | "Contributor" |
| 5-9 approved contributions | "Verified Contributor" |
| 10+ approved contributions | "Top Contributor" |

---

## Feedback Rules

### Timing - Sales & Auctions

| Party | When Feedback Becomes Available |
|-------|--------------------------------|
| Buyer | After item marked "arrived" OR 7 days post-payment (whichever comes first) |
| Seller | After payment confirmed AND item marked as shipped |

### Timing - Trades

| Condition | When Feedback Becomes Available |
|-----------|--------------------------------|
| Both parties mark trade "complete" | Immediately after both confirmations |

### Edit Windows

| Action | Window |
|--------|--------|
| Edit your own feedback | 7 days after initially leaving it |
| Seller response to negative feedback | 48 hours to edit after posting |

### Reminders (Buyers Only)

| Days Post-Payment | Action |
|-------------------|--------|
| 7 days | Feedback becomes available |
| 14 days | First reminder notification (if no feedback) |
| 21 days | Second reminder notification (if no feedback) |

### Seller Response to Negative Feedback

- Sellers may post **one** public response to negative feedback
- Maximum 500 characters
- Can be edited within 48 hours of posting, then locked
- Response is displayed alongside the original feedback

---

## UI Visibility

### Transaction Trust Score

| Location | Shown |
|----------|-------|
| Shop listing cards | Yes |
| Listing detail modal | Yes (with full breakdown) |
| Auction cards | Yes |
| Auction detail modal | Yes (with full breakdown) |
| Trade cards | Yes |
| Messages (conversation header) | Yes |
| User's own profile page | Yes |

### Community Contributor Badge

| Location | Shown |
|----------|-------|
| User's profile page | Yes (prominent) |
| Shop/auction listings they create | Yes (subtle icon next to name) |
| Messages | No |
| Trade cards | No |

---

## Database Schema Changes

### New Tables

```sql
-- Transaction feedback (extends existing seller_ratings concept)
CREATE TABLE transaction_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('sale', 'auction', 'trade')),
  transaction_id UUID NOT NULL,  -- References auctions.id, listings.id, or trades.id
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  reviewee_id UUID NOT NULL REFERENCES profiles(id),
  rating_type TEXT NOT NULL CHECK (rating_type IN ('positive', 'negative')),
  comment TEXT,  -- Max 500 chars, enforced in app
  seller_response TEXT,  -- Max 500 chars
  seller_response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  CONSTRAINT unique_reviewer_transaction UNIQUE (reviewer_id, transaction_id, transaction_type)
);

-- Community contribution tracking
CREATE TABLE community_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  contribution_type TEXT NOT NULL CHECK (contribution_type IN ('key_info', 'report_accurate')),
  reference_id UUID,  -- References the approved submission
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback reminders tracking
CREATE TABLE feedback_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL,
  transaction_id UUID NOT NULL,
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  feedback_left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Profile Table Updates

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS community_contribution_count INTEGER DEFAULT 0;

-- Existing columns (already present):
-- positive_ratings INTEGER DEFAULT 0
-- negative_ratings INTEGER DEFAULT 0
```

### Indexes

```sql
CREATE INDEX idx_feedback_reviewee ON transaction_feedback(reviewee_id);
CREATE INDEX idx_feedback_transaction ON transaction_feedback(transaction_id, transaction_type);
CREATE INDEX idx_contributions_user ON community_contributions(user_id);
CREATE INDEX idx_reminders_pending ON feedback_reminders(buyer_id) WHERE feedback_left_at IS NULL;
```

---

## API Endpoints

### Feedback

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feedback/[userId]` | Get user's received feedback |
| POST | `/api/feedback` | Submit feedback for a transaction |
| PATCH | `/api/feedback/[id]` | Edit feedback (within 7 days) |
| POST | `/api/feedback/[id]/respond` | Seller response to negative feedback |

### Reputation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reputation/[userId]` | Get user's full reputation (both scores) |

---

## Component Changes

### New Components

- `ReputationBadge` - Displays transaction trust score
- `ContributorBadge` - Displays community contributor tier
- `FeedbackModal` - Leave/edit feedback
- `FeedbackList` - Display feedback history on profile
- `SellerResponseForm` - Inline response to negative feedback

### Updated Components

- `SellerBadge` - Add `ReputationBadge` display
- `ListingCard` / `AuctionCard` - Show reputation inline
- `CustomProfilePage` - Add feedback history section, contributor badge
- `MessageThread` - Show reputation in header

---

## Cron Jobs / Background Tasks

| Task | Schedule | Description |
|------|----------|-------------|
| Send feedback reminders | Daily | Check for transactions at 14/21 days without buyer feedback |
| Update contribution counts | On approval | Increment count when admin approves key info |

---

## Future Expansion (v2+)

### Tiered Benefits

Once reputation data accumulates, consider unlocking perks:

| Tier | Requirement | Benefit |
|------|-------------|---------|
| Trusted Seller | 25+ transactions, 95%+ positive | Featured in search, lower fees |
| Top Contributor | 10+ approved contributions | Special badge, early feature access |
| Power Seller | 100+ transactions, 98%+ positive | Premium placement, verification badge |

### Additional Contribution Types

- Accurate abuse reports (when admin takes action)
- Helpful answers in community Q&A (if added)
- Verified collection milestones

---

## Implementation Phases

### Phase 1: Foundation
- Database schema changes
- Transaction feedback for sales/auctions (extend existing `seller_ratings`)
- Basic `ReputationBadge` component
- Display on listing cards and modals

### Phase 2: Full Feedback Flow
- Feedback timing rules (7 days, arrived trigger)
- Edit window (7 days)
- Seller response to negative feedback
- Reminder system (14/21 days)

### Phase 3: Trades Integration
- Feedback for completed trades
- "Both complete" trigger logic

### Phase 4: Community Contributions
- `ContributorBadge` component
- Auto-increment on key info approval
- Badge display on profile and listings

### Phase 5: Polish
- Feedback history on profile page
- Notification improvements
- Analytics/reporting for admins
