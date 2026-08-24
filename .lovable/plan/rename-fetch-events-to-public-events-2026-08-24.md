# Rename "Fetch events" to "Public events"

## Goal
Change the dashboard tab label from "Fetch events" to "Public events" so the feature's purpose is clearer to users.

## Changes
1. Update the tab trigger text in `src/routes/_authenticated/dashboard.tsx` (line ~83) from `"Fetch events"` to `"Public events"`.
2. Update the empty-state copy in the same file (line ~113) from "No shared plans from other people yet. Check back soon." to something consistent with the new label, e.g. "No public events from other people yet. Check back soon."

## Out of scope
- No backend/RLS changes.
- No route or query-key renames (internal code can keep the `discover` tab value and `fetchPublicEvents` naming).
