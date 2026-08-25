# Fix: previous account comes back after sign-out

## What's happening

Three things combine to resurrect the old account:

1. **The sign-in page auto-bounces you.** `/auth` runs `getSession()` on load and redirects straight to `/dashboard` if *any* session exists. On preview surfaces your login is intentionally shared across the project's preview tabs/windows (a built-in sync so the editor preview and preview link stay logged in together). If a stale copy of the old session resurfaces — e.g. another preview tab was still signed in, or the sign-out signal hasn't finished syncing — you land on the sign-in page and are instantly redirected into the **previous** account before you can type anything.

2. **The Google button reuses the old Google account.** It starts the OAuth flow without asking Google which account to use, so the previously used Google account is picked silently.

3. **Sign-out leaves stragglers.** `signOut()` clears the active session, but the cross-tab sync is asynchronous; a leftover local copy of the session token can be picked up on the next visit.

## Changes

### 1. `src/components/AppShell.tsx` — harden sign-out
- After `supabase.auth.signOut()`, also remove any leftover `sb-*-auth-token` keys from `localStorage` (belt-and-braces against a stale copy resurrecting).
- Navigate to `/auth?signed_out=1` instead of plain `/auth`.

### 2. `src/routes/auth.tsx` — don't auto-redirect right after sign-out
- Accept a `signed_out` search param via `validateSearch`.
- Skip the `getSession()` auto-redirect when `signed_out=1`, so the sign-in form actually stays on screen even if a stale session resurfaces.
- Any successful sign-in (email, verification code, or Google) overwrites the session as it already does today.

### 3. `src/routes/auth.tsx` — Google account chooser
- Pass `extraParams: { prompt: "select_account" }` to `lovable.auth.signInWithOAuth("google", ...)` so Google always shows the account picker instead of silently reusing the previous Google account.

## Technical notes

- No database or backend changes; no changes to auto-generated files (`previewAuthStorage.ts` etc.).
- The preview-shared-login behavior itself is by design (one login across the project's preview surfaces). This plan doesn't remove that — it makes sign-out and account switching win over it.
- If you keep a second preview tab/window open and signed in while switching accounts, that tab can still re-sync its session; close other preview tabs when testing account switching.

## Verification

- Build passes.
- Manual check: sign in as account A → sign out → sign-in page stays put (no bounce) → sign in as account B → dashboard shows B, and refreshing stays on B.
