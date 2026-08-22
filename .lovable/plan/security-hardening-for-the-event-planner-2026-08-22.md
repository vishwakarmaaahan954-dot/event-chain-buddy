# Security hardening for the event planner

## Scan results (current state)

- Dependencies: no high/critical vulnerabilities.
- No critical findings. Two warnings:
  1. **Any logged-in user can read every profile** — the `profiles_select_authenticated` policy uses `USING (true)`, exposing all users' display names and avatars.
  2. **Signed-in users can directly execute the SECURITY DEFINER helper functions** (`is_event_owner`, `is_shared_with_me`, `can_edit_event`, `my_email`) via the API, instead of them only running inside access policies.

## Planned changes

### 1. Restrict profile visibility (database migration)
- Drop the read-all profiles policy.
- New policy: a user can read **their own** profile, plus profiles of people they **co-share an event with** (event owner ↔ invited collaborator), implemented through a helper function so the policies don't reference each other recursively.
- Verify the dashboard and share panel still show names correctly after the change (they read either your own profile or the invite email stored on the share itself, so impact should be nil).

### 2. Harden the helper functions (database migration)
- Revoke direct execution from anonymous callers on all four helpers; keep it for signed-in users because the access policies themselves need it.
- These functions only ever reveal the caller's *own* access level, so the residual risk is minimal — this just removes unnecessary exposure.

### 3. Enable leaked-password protection (auth setting, no code)
- Turn on the Have I Been Pwned check so passwords found in known data breaches are rejected at signup and password change.
- Optionally raise the minimum password length at the same time.

## Already in good shape (no action)
- Row-level security enabled on every table with owner/share-scoped policies.
- Email OTP verification and password-reset flow in place.
- Sign-out clears cached data; OAuth redirects stay same-origin.
- No secrets in client code.

## Verification
- Re-run the security scan after the migration and confirm both warnings are gone.
- Quick manual pass: view dashboard, open a shared event as owner and as invitee, confirm names/avatars still render.
