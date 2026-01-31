# Follow System Design

**Date:** January 30, 2026
**Status:** Approved
**Related Feedback:** #23 (Allow users to follow trusted sellers/buyers)

---

## Overview

A one-way follow system that lets users follow sellers they like. Similar to eBay/Etsy seller follows - low friction, no friend requests required.

**Scope:** Full featured with notifications and shop filtering.

**Privacy:** No privacy controls - follower counts always visible.

---

## Data Model

### New Table: `user_follows`

```sql
CREATE TABLE user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_follow UNIQUE (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id)
);

CREATE INDEX idx_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_follows_following ON user_follows(following_id);
```

### Profile Table Updates

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
```

### Triggers for Count Updates

```sql
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_follow_counts
  AFTER INSERT OR DELETE ON user_follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
```

### RLS Policies

```sql
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can see follows
CREATE POLICY "follows_select_policy" ON user_follows FOR SELECT USING (TRUE);

-- Users can only create follows where they are the follower
CREATE POLICY "follows_insert_policy" ON user_follows FOR INSERT
  WITH CHECK (follower_id = public.current_profile_id());

-- Users can only delete their own follows
CREATE POLICY "follows_delete_policy" ON user_follows FOR DELETE
  USING (follower_id = public.current_profile_id());
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/follows/[userId]` | Follow a user |
| DELETE | `/api/follows/[userId]` | Unfollow a user |
| GET | `/api/follows/[userId]/followers` | Get user's followers (paginated) |
| GET | `/api/follows/[userId]/following` | Get who user follows (paginated) |
| GET | `/api/follows/check/[userId]` | Check if current user follows this user |

### Shop Integration

Modify `/api/auctions` GET to accept `?followingOnly=true`:
- Filters to only listings from users the current user follows
- Returns empty array if user follows no one

### Response Formats

```typescript
// GET /api/follows/[userId]/followers
{
  users: [{ id, username, displayName, avatarUrl, isFollowing }],
  total: 47,
  limit: 20,
  offset: 0
}

// GET /api/follows/check/[userId]
{
  isFollowing: true,
  followedAt: "2026-01-30T12:00:00Z"
}

// POST /api/follows/[userId]
{ success: true }

// DELETE /api/follows/[userId]
{ success: true }
```

---

## UI Components

### New Components

**`FollowButton`**
- Props: `userId`, `initialIsFollowing?`, `size?: "sm" | "md"`
- States: "Follow" (outline) → "Following" (filled, "Unfollow" on hover)
- Optimistic updates with error rollback

**`FollowerCount`**
- Props: `followerCount`, `followingCount`, `userId`
- Display: "47 followers · 12 following"
- Clickable to open FollowListModal

**`FollowListModal`**
- Props: `userId`, `type: "followers" | "following"`, `isOpen`, `onClose`
- Paginated list with avatar, name, follow button per row
- "Load more" button for pagination

### Updated Components

**`SellerBadge`**
- Add FollowButton (size="sm") next to seller name
- Only show if viewing another user's badge (not your own)

**`CustomProfilePage`**
- Add FollowerCount below username
- Add "Following" section showing who they follow

**`ShopPage` (Shop filters)**
- Add toggle: "From people I follow"
- Empty state if following no one

---

## Notifications

### On New Listing Creation

When `createAuction()` or `createFixedPriceListing()` is called:

1. Query followers: `SELECT follower_id FROM user_follows WHERE following_id = ?`
2. Batch insert notifications with type `"new_listing_from_followed"`
3. Send emails to followers with notifications enabled

### Notification Display

- Type: `"new_listing_from_followed"`
- Message: "**@username** listed Amazing Spider-Man #300 for $450"
- Links to listing detail page

### Email Template

- Subject: "New listing from @username on Collectors Chest"
- Body: Seller name, comic title, price, cover thumbnail, "View Listing" CTA
- Respects user's email notification preferences

---

## Implementation Phases

### Phase 1: Database & Core API
- Migration: create table, columns, triggers, RLS
- Follow/unfollow endpoints
- Followers/following list endpoints
- Check follow status endpoint

### Phase 2: UI Components
- FollowButton component
- FollowerCount component
- FollowListModal component
- useFollow hook

### Phase 3: Profile Integration
- Add to SellerBadge
- Add to CustomProfilePage
- Following section on profile

### Phase 4: Shop Filter
- Add filter toggle to Shop page
- Update auctions API for followingOnly param
- Empty state handling

### Phase 5: Notifications
- Create notifications on listing creation
- Email template
- Respect notification preferences

---

## Testing Considerations

- Follow/unfollow cycle works correctly
- Can't follow yourself
- Can't follow same user twice
- Counts update correctly (including on user deletion)
- Shop filter shows only followed users' listings
- Notifications sent to all followers
- Email respects preferences
