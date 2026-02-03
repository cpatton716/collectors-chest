# Multi-Select Bulk Actions Design

**Date:** February 2, 2026
**Status:** Approved
**Feedback Item:** #18 from January 28th feedback

## Overview

Add the ability to select multiple comics in the collection view and perform bulk actions on them. This streamlines common workflows like cleaning up duplicates, organizing trades, or marking sold items.

## Bulk Actions

The following actions are available when comics are selected:

| Action | Description | Notes |
|--------|-------------|-------|
| **Delete** | Remove selected comics from collection | Soft delete with undo |
| **Mark for Trade** | Set trade status on selected comics | Toggle on/off |
| **Add to List** | Add selected comics to a custom list | Shows list picker |
| **Mark as Sold** | Mark comics as sold | Skips pricing, edit later |

**Not included:** "Mark for Sale" - each book needs individual pricing, so this remains a per-comic action.

## User Flow

1. **Enter Selection Mode**
   - User taps "Select" button in collection header
   - Checkboxes appear on each comic card
   - Bottom toolbar slides up with action buttons (all disabled initially)

2. **Select Comics**
   - Tap checkbox or card to toggle selection
   - Selected cards show checkmark + subtle highlight
   - Toolbar shows count: "3 selected"
   - Action buttons become enabled

3. **Perform Action**
   - User taps action (e.g., "Delete")
   - If 10+ comics: confirmation modal appears first
   - Action executes on all selected comics
   - Toast appears: "5 comics deleted" with UNDO button
   - Selection clears, exit selection mode

4. **Exit Selection Mode**
   - Tap "Cancel" or complete an action
   - Checkboxes hide, toolbar slides away
   - Return to normal collection view

## UI Components

### Selection Mode Header
```
┌─────────────────────────────────────────┐
│ [Cancel]    3 SELECTED    [Select All]  │
└─────────────────────────────────────────┘
```
- Replaces normal header when in selection mode
- "Cancel" exits without action
- "Select All" toggles all visible comics
- Count updates in real-time

### Comic Card (Selection Mode)
```
┌──────────────────────┐
│ [✓]                  │  ← Checkbox top-left
│    ┌──────────┐      │
│    │  COVER   │      │
│    │  IMAGE   │      │
│    └──────────┘      │
│  Amazing Spider-Man  │
│  #300                │
└──────────────────────┘
```
- Checkbox with pop-art styling (black border, pop-green when checked)
- Selected state: subtle pop-yellow background tint
- Entire card is tappable to toggle

### Bottom Action Toolbar
```
┌─────────────────────────────────────────┐
│  [Delete]  [Trade]  [Add to List] [Sold]│
└─────────────────────────────────────────┘
```
- Sticky to bottom of viewport
- Lichtenstein styling: pop-white background, black top border, hard shadow
- Buttons disabled (grayed) when selection is empty
- Icons + text labels for clarity

### Confirmation Modal (10+ comics)
```
┌─────────────────────────────────────────┐
│           DELETE 15 COMICS?             │
├─────────────────────────────────────────┤
│  • Amazing Spider-Man #300              │
│  • X-Men #1                             │
│  • Batman #404                          │
│  • Spawn #1                             │
│  • Teenage Mutant Ninja Turtles #1      │
│  ...and 10 more                         │
├─────────────────────────────────────────┤
│      [CANCEL]          [DELETE]         │
└─────────────────────────────────────────┘
```
- Pop-red header for destructive action
- Shows first 5 titles + count of remaining
- DELETE button in pop-red, CANCEL in pop-cream

### Undo Toast
```
┌─────────────────────────────────────────┐
│  5 comics deleted          [UNDO]       │
│  ════════════════════░░░░░░░░░░░░░░░░░  │  ← Progress bar (10 sec)
└─────────────────────────────────────────┘
```
- Appears bottom-center after any delete
- 10-second countdown with visual progress
- UNDO button restores all deleted comics
- Auto-dismisses after countdown

## State Management

### Selection State
```typescript
interface SelectionState {
  isSelectionMode: boolean;
  selectedIds: Set<string>;
}

// Actions
type SelectionAction =
  | { type: 'ENTER_SELECTION_MODE' }
  | { type: 'EXIT_SELECTION_MODE' }
  | { type: 'TOGGLE_SELECTION'; id: string }
  | { type: 'SELECT_ALL'; ids: string[] }
  | { type: 'CLEAR_SELECTION' };
```

### Location
- Lives in `useCollection` hook or new `useSelection` hook
- Colocated with collection data for easy access to comic IDs
- Clears on filter/sort changes (prevents confusion)

### Derived State
```typescript
const selectionCount = selectedIds.size;
const isAllSelected = selectedIds.size === visibleComics.length;
const hasSelection = selectedIds.size > 0;
```

## Delete Safety

### Confirmation Modal Trigger
- Appears when deleting **10 or more** comics
- Shows list of first 5 titles + remaining count
- Requires explicit confirmation before proceeding

### Soft Delete with Undo
1. When delete is triggered, set `deleted_at` timestamp on records
2. Records remain in database but filtered from queries
3. Show toast with UNDO button for 10 seconds
4. If UNDO clicked: clear `deleted_at` timestamp
5. If toast expires: records stay soft-deleted (or permanent delete via background job)

### Edge Cases
- **User navigates away during undo window:** Commit delete immediately
- **User refreshes page:** Delete is committed (no undo available)
- **Multiple bulk deletes:** Each gets its own toast, stacked vertically
- **Undo after toast expires:** Not possible, delete is final

## Testing Strategy

### Unit Tests (src/lib/__tests__/bulkActions.test.ts)
```typescript
describe('bulkActions', () => {
  describe('toggleSelection', () => {
    it('adds ID to empty selection', () => { ... });
    it('removes ID if already selected', () => { ... });
    it('preserves other selections when toggling', () => { ... });
  });

  describe('selectAll', () => {
    it('returns all visible comic IDs', () => { ... });
    it('returns empty array if no comics', () => { ... });
  });

  describe('clearSelection', () => {
    it('returns empty Set', () => { ... });
  });

  describe('isAllSelected', () => {
    it('returns true when selection equals visible count', () => { ... });
    it('returns false when selection is partial', () => { ... });
    it('returns false when selection is empty', () => { ... });
  });

  describe('filterSelectedByOwnership', () => {
    it('only includes comics user owns', () => { ... });
    it('returns empty if none owned', () => { ... });
  });
});
```

### Business Logic Tests
- Cannot bulk delete comics you don't own
- Cannot mark as sold comics already sold
- Cannot add to list comics already in that list
- Soft delete sets `deleted_at` timestamp correctly
- Undo clears `deleted_at` within time window

### Edge Case Tests
- Empty selection disables all action buttons
- Selection clears on filter/sort changes
- Bulk action on 0 comics is no-op
- Confirmation modal triggers at exactly 10+ comics
- Toast countdown expires after 10 seconds

### Manual Testing Checklist
- [ ] Mobile: toolbar doesn't obscure content
- [ ] Mobile: touch targets are adequate size (44px minimum)
- [ ] Select mode entry/exit is smooth
- [ ] Visual feedback on selection (checkbox + highlight)
- [ ] Undo toast is visible and clickable
- [ ] Large selection (50+ comics) performs acceptably
- [ ] Keyboard navigation works (desktop)

## Implementation Notes

### Files to Create/Modify
- `src/hooks/useSelection.ts` - Selection state management
- `src/lib/bulkActions.ts` - Pure helper functions
- `src/lib/__tests__/bulkActions.test.ts` - Unit tests
- `src/components/collection/SelectionToolbar.tsx` - Bottom action bar
- `src/components/collection/BulkDeleteModal.tsx` - Confirmation modal
- `src/components/ComicCard.tsx` - Add checkbox overlay
- `src/app/collection/page.tsx` - Integrate selection mode

### Database Changes
- Add `deleted_at` column to comics table (if not exists)
- Update queries to filter `WHERE deleted_at IS NULL`

### API Changes
- `POST /api/comics/bulk-delete` - Accepts array of IDs
- `POST /api/comics/bulk-update` - For trade/sold status
- `POST /api/comics/undo-delete` - Clears deleted_at

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Entry method | Dedicated "Select" button | Clear affordance, not accidental |
| Toolbar position | Sticky bottom | Thumb-friendly on mobile |
| Selection helpers | Select All + Clear | Faster for large operations |
| Delete safety | Modal (10+) + Toast undo | Prevention + recovery |
| Undo window | 10 seconds | Long enough to notice mistake |
| Mark as Sold pricing | Skip, edit later | Bulk action should be fast |
