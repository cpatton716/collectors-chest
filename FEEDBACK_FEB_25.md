# Feedback - February 25, 2026

## Testing Context
- **Platform:** Both (Mobile + Web)
- **Account Types:** Free, Premium
- **Mobile Device:** Android
- **Desktop:** Mac (Chrome/Safari)

---

## Issues

### #1 - CSV Drag & Drop Opens File in New Tab
**Status:** Backlog
**Severity:** Medium
**Area:** CSV Import
**Description:** When attempting to drag and drop a CSV file into the import drop zone, the browser opens the file in a new tab instead of accepting the drop. The drop zone is not properly preventing the default browser behavior.
**Expected:** File should be accepted by the drop zone and begin import processing.

---

### #2 - Comic Vine API Still in Import Lookup
**Status:** Backlog
**Severity:** High
**Area:** CSV Import / Cover Images
**Description:** The import-lookup API route still uses Comic Vine API for cover image search during CSV imports. Comic Vine was previously removed from the codebase because their API is unreliable. Should be removed from import-lookup as well.
