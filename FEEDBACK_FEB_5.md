# Feedback - February 5, 2026

## Status Summary

| # | Issue | Status |
|---|-------|--------|
| 1 | CSV import: accept flexible boolean values (yes/no, Y/N, etc.) | ✅ Complete |
| 2 | Cover images being returned incorrectly | ⚠️ Needs Testing |
| 3 | Book details missing cover uses old Riddler style, not pop-art | ✅ Complete |
| 4 | Edit mode publisher dropdown doesn't match stored publisher value | ⚠️ Pending |
| 5 | CSV import: dollar signs in price fields cause values to be dropped | ⚠️ Pending |
| 6 | Notify key info submitter on admin approval/rejection | ⚠️ Pending |
| 7 | Approving key info doesn't update submitter's reputation/feedback | ⚠️ Pending |
| 8 | Public share page missing covers use old Riddler style, not pop-art | ✅ Complete (same fix as #3) |
| 9 | Public view book details should show user profile info | ⚠️ Pending |
| 10 | Admin user search: magnifying glass overlaps placeholder text | ⚠️ Pending |
| 11 | Admin user search: no message when no results found | ⚠️ Pending |
| 12 | Premium user lost Key Hunt access after trial reset + reactivation | ⚠️ Pending |
| 13 | Admin portal needs better navigation to all admin tools | ⚠️ Pending |
| 14 | Key Hunt list not showing up for guest/free user | ⚠️ Needs Testing |
| 15 | "Start 7-day Trial" button on Key Hunt page not working | ⚠️ Pending |
| 16 | Key Hunt page not in pop-art style and not scrollable | ⚠️ Pending |
| 17 | Messages need real-time updates without page refresh | ⚠️ Pending |
| 18 | Changing raw↔slabbed should re-evaluate book value | ⚠️ Pending |
| 19 | Sort by value not sorting correctly | ⚠️ Pending |
| 20 | Message notification icon behavior is sporadic/broken | ⚠️ Pending |
| 21 | No visible way to follow another user | ⚠️ Pending |

---

## 1. CSV import should accept flexible boolean values

**Status:** ✅ Complete

**Issue:** CSV import only accepts `true`/`false` for boolean fields (e.g., `forSale`, `isSlabbed`). Users naturally type "yes", "no", "Y", "N", etc. which get ignored.

**Desired behavior:** Accept common boolean representations: `true/false`, `yes/no`, `y/n`, `1/0` (case-insensitive).

---

## 16. Key Hunt page not in pop-art style and not scrollable

**Status:** ⚠️ Pending

**Issue:** The Key Hunt page does not follow the Lichtenstein pop-art design language used across the rest of the site. Additionally, the "How to Use Key Hunt" section is far enough down the page that it appears scrollable, but the page doesn't actually scroll. Need to apply pop-art styling and fix the scroll/overflow issue.

---

## 15. "Start 7-day Trial" button on Key Hunt page not working

**Status:** ⚠️ Pending

**Issue:** The "Start 7-day Trial" button on the Key Hunt page does not respond when clicked. May be related to Stripe not being configured, or a broken click handler.

---

## 14. Key Hunt list not showing up for guest/free user

**Status:** ⚠️ Needs Testing

**Issue:** User scanned books and added them to the Key Hunt list, but the list is not visible. User is a guest (not premium). May be feature-gated to Premium only — need to confirm whether this is intentional or a bug. If intentional, the "Add to Hunt List" button should not appear for non-premium users.

---

## 13. Admin portal needs better navigation to all admin tools

**Status:** ⚠️ Pending

**Issue:** The admin portal is focused on User Management and makes it difficult to find the other admin tools (Key Info Moderation, Service Usage Monitor, Barcode Reviews, Message Moderation). These are buried and not easily discoverable. Need a proper admin dashboard or nav that surfaces all admin sections equally.

---

## 12. Premium user lost Key Hunt access after trial reset + reactivation

**Status:** ⚠️ Pending

**Issue:** User `jsnaponte@yahoo.com` was on a Premium trial, admin reset their trial, then user reactivated Premium. After reactivation, Key Hunt is no longer accessible despite having Premium status.

**Steps to reproduce:**
1. User has active Premium trial
2. Admin resets user's trial
3. User starts a new Premium trial
4. Key Hunt feature is no longer accessible

**Investigation needed:** Check if the trial reset clears a flag or subscription field that the Key Hunt feature gate checks, and whether reactivation properly restores all gated features.

---

## 11. Admin user search: no message when no results found

**Status:** ⚠️ Pending

**Issue:** When searching for a user in the admin panel and no results are found, there is no feedback to the admin. Should display a message like "No users found matching [query]".

---

## 9. Public view book details should show user profile info

**Status:** ⚠️ Pending

**Issue:** The public collection page header says "A Collector's Collection" instead of using the owner's actual profile name. Should display as "[Profile Name]'s Collection" (e.g., "patton-test1's Collection"). The profile name/username should be pulled from the user's profile data.

**Screenshot reference:** `collectors-chest.com/u/patton-test1` shows "A Collector's Collection" instead of the user's name.

---

## 7. Approving key info doesn't update submitter's reputation/feedback

**Status:** ⚠️ Pending

**Issue:** When an admin approves a user's key info submission, the submitter's reputation score and contributor badge are not updated. The `community_contribution_count` should increment on approval, which drives the contributor badge system (Contributor → Verified Contributor → Top Contributor).

---

## 6. Notify key info submitter on admin approval/rejection

**Status:** ⚠️ Pending

**Issue:** When an admin approves or rejects a user's key info submission, the submitter receives no notification. They have no way to know the outcome.

**Desired behavior:**
- On approval: in-app notification (e.g., "Your key info for [comic] was approved!")
- On rejection: in-app notification with the reason (e.g., "Your key info for [comic] was rejected: [reason]")
- No email needed — use the existing in-app notifications system
- Approved key info should appear on that book AND all copies of the same title/issue across all users going forward

---

## 5. CSV import should strip dollar signs from price fields

**Status:** ⚠️ Pending

**Issue:** When importing via CSV with dollar signs in price fields (e.g., `$8.00` instead of `8.00`), the purchase price doesn't show up in the edit details view. `parseFloat("$8.00")` returns `NaN`. Need to strip `$`, commas, and other currency formatting before parsing. Applies to `purchasePrice` and `askingPrice`.

---

## 4. Edit mode publisher dropdown doesn't match stored publisher value

**Status:** ⚠️ Pending

**Issue:** Book details view shows "DC" as the publisher, but when entering Edit mode, the Publisher dropdown shows "Select publisher..." instead of the stored value. Likely a mismatch between the stored value ("DC") and the dropdown options (which may use "DC Comics"). Noticed on imports.

**Screenshot reference:** Batman #497 shows "Publisher: DC" in detail view, but Edit mode shows empty dropdown.

---

## 2. Cover images being returned incorrectly

**Status:** ⚠️ Needs Testing

**Issue:** Some cover images returned during scans or lookups are wrong. User to provide specific examples for investigation.

---

## 17. Messages need real-time updates without page refresh

**Status:** ⚠️ Pending

**Issue:** When exchanging messages between users, new messages do not appear in real-time. Users must manually refresh the page to see incoming messages. Need to implement real-time message updates (e.g., via Supabase Realtime subscriptions or polling) so messages pop up automatically as they arrive.

---

## 18. Changing raw↔slabbed should re-evaluate book value

**Status:** ⚠️ Pending

**Issue:** When changing a book's condition from raw to slabbed or slabbed to raw, the book's value is not re-evaluated. The value should be recalculated based on the new condition type, since slabbed and raw copies have different market values.

---

## 19. Sort by value not sorting correctly

**Status:** ⚠️ Pending

**Issue:** When sorting the collection by value, the results appear random and do not actually sort by the book's value. Need to investigate whether the sort is using the correct field and whether the comparison logic is correct.

---

## 20. Message notification icon behavior is sporadic/broken

**Status:** ⚠️ Pending

**Issue:** Multiple problems with the message notification icon:
1. **Notification appears on navigate-away only** — The icon shows up when navigating away from messages, but not consistently when a new message arrives.
2. **Notification doesn't clear on open** — Opening the message thread does not dismiss the notification icon; it persists.
3. **Recipient never sees notification** — When sending a message to `jsnaponte@yahoo.com`, the recipient never sees a notification icon on their side.

**Investigation needed:** Check the notification read/unread state management, how notifications are triggered on send, and how they're cleared on message open.

---

## 21. No visible way to follow another user

**Status:** ⚠️ Pending

**Issue:** There is no obvious "Follow" button or action available when interacting with another user. Visited their public collection page and exchanged messages, but no follow option is surfaced anywhere. Need to expose a Follow button in discoverable locations (e.g., public collection page, user profile card, message thread header).

---

