
-- 1. Denormalize the event owner onto each share row
ALTER TABLE public.event_shares ADD COLUMN IF NOT EXISTS owner_id uuid;

UPDATE public.event_shares s
SET owner_id = e.owner_id
FROM public.events e
WHERE e.id = s.event_id;

ALTER TABLE public.event_shares ALTER COLUMN owner_id SET NOT NULL;

-- 2. Trigger keeps owner_id in sync server-side on new shares
CREATE OR REPLACE FUNCTION public.event_shares_set_owner_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT e.owner_id INTO NEW.owner_id FROM public.events e WHERE e.id = NEW.event_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_shares_set_owner ON public.event_shares;
CREATE TRIGGER event_shares_set_owner
BEFORE INSERT ON public.event_shares
FOR EACH ROW EXECUTE FUNCTION public.event_shares_set_owner_id();

-- 3. Convert RLS helper functions to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.my_email()
RETURNS text
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$ SELECT lower(coalesce(auth.jwt() ->> 'email', '')) $$;

CREATE OR REPLACE FUNCTION public.is_event_owner(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id = _event_id AND e.owner_id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.is_shared_with_me(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.event_shares s
  WHERE s.event_id = _event_id AND lower(s.invited_email) = public.my_email() AND public.my_email() <> ''
) $$;

CREATE OR REPLACE FUNCTION public.can_edit_event(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$ SELECT public.is_event_owner(_event_id) OR EXISTS (
  SELECT 1 FROM public.event_shares s
  WHERE s.event_id = _event_id AND s.can_edit AND lower(s.invited_email) = public.my_email() AND public.my_email() <> ''
) $$;

CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT _profile_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.events e
      JOIN public.event_shares s ON s.event_id = e.id
      WHERE e.owner_id = _profile_id
        AND lower(s.invited_email) = public.my_email()
        AND public.my_email() <> ''
    );
$$;

-- 4. Share owner policy uses the denormalized owner_id (no cross-table lookup)
DROP POLICY IF EXISTS event_shares_owner_all ON public.event_shares;
CREATE POLICY event_shares_owner_all ON public.event_shares
FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- 5. Event edit policy: inline owner check + share lookup (no self-referencing events query)
DROP POLICY IF EXISTS events_update_editors ON public.events;
CREATE POLICY events_update_editors ON public.events
FOR UPDATE TO authenticated
USING (
  auth.uid() = owner_id
  OR EXISTS (
    SELECT 1 FROM public.event_shares s
    WHERE s.event_id = id AND s.can_edit
      AND lower(s.invited_email) = public.my_email() AND public.my_email() <> ''
  )
)
WITH CHECK (
  auth.uid() = owner_id
  OR EXISTS (
    SELECT 1 FROM public.event_shares s
    WHERE s.event_id = id AND s.can_edit
      AND lower(s.invited_email) = public.my_email() AND public.my_email() <> ''
  )
);

-- 6. Invitee review policy simplified; the guard trigger enforces column pinning
DROP POLICY IF EXISTS event_shares_invitee_update ON public.event_shares;
CREATE POLICY event_shares_invitee_update ON public.event_shares
FOR UPDATE TO authenticated
USING (lower(invited_email) = public.my_email() AND public.my_email() <> '')
WITH CHECK (lower(invited_email) = public.my_email() AND public.my_email() <> '');

-- 7. Guard trigger also protects the new owner_id column; owner check uses owner_id
CREATE OR REPLACE FUNCTION public.event_shares_guard_invitee_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Privileged backend callers (no user session) are not restricted here.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Event owners may change anything on the share row.
  IF OLD.owner_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Invitees may only change their review status and note.
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.invited_email IS DISTINCT FROM OLD.invited_email
     OR NEW.can_edit IS DISTINCT FROM OLD.can_edit
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Only the event owner can change sharing permissions';
  END IF;

  RETURN NEW;
END;
$$;

-- 8. Trigger-only functions must not be directly callable by API roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_shares_guard_invitee_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_shares_set_owner_id() FROM PUBLIC, anon, authenticated;
