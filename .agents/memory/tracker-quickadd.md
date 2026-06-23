---
name: Tracker quick-add URL convention
description: How clicking "Add transaction" from the Trackers list opens the form in TrackerDetail.
---

## Rule
Navigating to `/trackers/:id?add=1` automatically opens the add-transaction form in `TrackerDetail.tsx`.

## Implementation
`TrackerDetail` reads `useSearch()` from wouter and runs a `useEffect` that calls `setShowAddTxn(true)` when `?add=1` is present.

`Trackers.tsx` `TrackerCard` has two action buttons at the bottom:
- "Open" → `<Link href="/trackers/:id">`
- "Add transaction" → `<Link href="/trackers/:id?add=1">`

## Why
Avoids duplicating the transaction form in the list page. The detail page already owns the form state and all necessary data (accounts, categories, tracker context).
