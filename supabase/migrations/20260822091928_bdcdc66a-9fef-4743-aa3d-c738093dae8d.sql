CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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

REVOKE EXECUTE ON FUNCTION public.can_view_profile(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid) TO authenticated;

DROP POLICY profiles_select_authenticated ON public.profiles;

CREATE POLICY profiles_select_visible
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_view_profile(id));

REVOKE EXECUTE ON FUNCTION public.is_event_owner(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_shared_with_me(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_event(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_email() FROM anon;