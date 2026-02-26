# Beta Mode Planning

**Status:** Planning — revisit later
**Date:** February 25, 2026

---

## Concept

Reopen registration and give all users full access to the entire platform for a limited time (free beta), with the exception of shop and auction features. Set a clear date when the current premium subscription model kicks in.

---

## Why This Is Smart

- Builds a user base before monetizing — much harder to sell a subscription to an empty platform
- Real users stress-test features and surface bugs you'd never find alone
- Creates word-of-mouth momentum — people share free things
- Gives you actual usage data to justify what belongs in premium vs free

---

## Key Considerations

### 1. The "Takeaway" Problem
People psychologically hate losing something they had for free more than never having it. When the beta ends and features move behind a paywall, some users will be vocal about it. Need clear messaging from day one: "Everything is free during beta. Here's what will require Premium after [date]." Transparency upfront reduces backlash.

### 2. Why Exclude Shop/Auction?
Is it because those features aren't ready, or strategic? If they're ready, keeping them out of beta means less real-world testing on the most complex (and revenue-generating) features.

### 3. Beta Duration
How long? Too short and you don't build a meaningful user base. Too long and people forget it's temporary.

### 4. Data Leverage
During beta, you'll learn which features people actually use. That should inform what goes in Premium vs Free tier. Don't lock in the tiers now — let the data tell you.

### 5. Conversion Strategy
What happens on cutover day? Do existing beta users get a grace period? A discount? First month free? The transition plan matters as much as the launch.

### 6. Technical Cleanup
Premium checks are currently scattered across the codebase. A beta mode flag would need to bypass all of those cleanly, and be easy to flip back.

---

## Open Questions

- What's driving the timing? Launch soon or planning for down the road?
- How long should the beta period last?
- What's the communication plan for existing waitlist / early users?
- Should shop/auction be included or excluded from beta?
- What metrics define a successful beta? (user count, engagement, feedback?)
- What's the cutover plan for transitioning beta users to paid?

---

## Next Steps

- [ ] Decide beta duration
- [ ] Define which features are included/excluded
- [ ] Plan the conversion strategy (grace period, discounts, etc.)
- [ ] Design the technical implementation (beta mode flag)
- [ ] Draft user-facing messaging and timeline
