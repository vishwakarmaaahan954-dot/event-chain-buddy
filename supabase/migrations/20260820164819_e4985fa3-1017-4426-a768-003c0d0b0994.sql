
CREATE TABLE public.event_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  can_edit boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','changes_requested')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, invited_email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_shares TO authenticated;
GRANT ALL ON public.event_shares TO service_role;
ALTER TABLE public.event_shares ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.my_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT lower(coalesce(auth.jwt() ->> 'email', '')) $$;

CREATE OR REPLACE FUNCTION public.is_event_owner(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.events e WHERE e.id = _event_id AND e.owner_id = auth.uid()) $$;

CREATE OR REPLACE FUNCTION public.is_shared_with_me(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.event_shares s
  WHERE s.event_id = _event_id AND lower(s.invited_email) = public.my_email() AND public.my_email() <> ''
) $$;

CREATE OR REPLACE FUNCTION public.can_edit_event(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_event_owner(_event_id) OR EXISTS (
  SELECT 1 FROM public.event_shares s
  WHERE s.event_id = _event_id AND s.can_edit AND lower(s.invited_email) = public.my_email() AND public.my_email() <> ''
) $$;

REVOKE EXECUTE ON FUNCTION public.my_email() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_event_owner(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_shared_with_me(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_edit_event(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shared_with_me(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_event(uuid) TO authenticated;

CREATE POLICY event_shares_owner_all ON public.event_shares FOR ALL TO authenticated
  USING (public.is_event_owner(event_id)) WITH CHECK (public.is_event_owner(event_id));
CREATE POLICY event_shares_invitee_select ON public.event_shares FOR SELECT TO authenticated
  USING (lower(invited_email) = public.my_email() AND public.my_email() <> '');
CREATE POLICY event_shares_invitee_update ON public.event_shares FOR UPDATE TO authenticated
  USING (lower(invited_email) = public.my_email() AND public.my_email() <> '')
  WITH CHECK (lower(invited_email) = public.my_email() AND public.my_email() <> '');

DROP POLICY events_select_own_or_public ON public.events;
CREATE POLICY events_select_visible ON public.events FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR is_public OR public.is_shared_with_me(id));

DROP POLICY events_update_own ON public.events;
CREATE POLICY events_update_editors ON public.events FOR UPDATE TO authenticated
  USING (public.can_edit_event(id)) WITH CHECK (public.can_edit_event(id));

DROP POLICY event_nodes_select ON public.event_nodes;
CREATE POLICY event_nodes_select_visible ON public.event_nodes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_nodes.event_id AND (e.owner_id = auth.uid() OR e.is_public))
         OR public.is_shared_with_me(event_id));

DROP POLICY event_nodes_insert_own ON public.event_nodes;
CREATE POLICY event_nodes_insert_editors ON public.event_nodes FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_event(event_id));

DROP POLICY event_nodes_update_own ON public.event_nodes;
CREATE POLICY event_nodes_update_editors ON public.event_nodes FOR UPDATE TO authenticated
  USING (public.can_edit_event(event_id)) WITH CHECK (public.can_edit_event(event_id));

DROP POLICY event_nodes_delete_own ON public.event_nodes;
CREATE POLICY event_nodes_delete_editors ON public.event_nodes FOR DELETE TO authenticated
  USING (public.can_edit_event(event_id));
