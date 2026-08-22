CREATE OR REPLACE FUNCTION public.event_shares_guard_invitee_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Privileged backend callers (no user session) are not restricted here;
  -- they are governed by their own credentials, not row-level rules.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Event owners may change anything on the share row.
  IF public.is_event_owner(OLD.event_id) THEN
    RETURN NEW;
  END IF;

  -- Invitees may only change their review status and note.
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.invited_email IS DISTINCT FROM OLD.invited_email
     OR NEW.can_edit IS DISTINCT FROM OLD.can_edit THEN
    RAISE EXCEPTION 'Only the event owner can change sharing permissions';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.event_shares_guard_invitee_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.event_shares_guard_invitee_update() FROM anon;
REVOKE EXECUTE ON FUNCTION public.event_shares_guard_invitee_update() FROM authenticated;

CREATE TRIGGER event_shares_guard_update
BEFORE UPDATE ON public.event_shares
FOR EACH ROW
EXECUTE FUNCTION public.event_shares_guard_invitee_update();