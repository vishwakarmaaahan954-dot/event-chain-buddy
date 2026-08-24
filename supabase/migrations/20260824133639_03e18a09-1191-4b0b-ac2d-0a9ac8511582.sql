DROP POLICY IF EXISTS events_update_editors ON public.events;

CREATE POLICY events_update_editors
ON public.events
FOR UPDATE
TO authenticated
USING (
  auth.uid() = owner_id
  OR EXISTS (
    SELECT 1
    FROM public.event_shares s
    WHERE s.event_id = events.id
      AND s.can_edit
      AND lower(s.invited_email) = public.my_email()
      AND public.my_email() <> ''
  )
)
WITH CHECK (
  auth.uid() = owner_id
  OR EXISTS (
    SELECT 1
    FROM public.event_shares s
    WHERE s.event_id = events.id
      AND s.can_edit
      AND lower(s.invited_email) = public.my_email()
      AND public.my_email() <> ''
  )
);