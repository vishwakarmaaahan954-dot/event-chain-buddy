DROP POLICY event_shares_invitee_update ON public.event_shares;

CREATE POLICY event_shares_invitee_update
ON public.event_shares
FOR UPDATE
TO authenticated
USING (lower(invited_email) = public.my_email() AND public.my_email() <> '')
WITH CHECK (
  lower(invited_email) = public.my_email()
  AND public.my_email() <> ''
  AND event_id = (SELECT s.event_id FROM public.event_shares s WHERE s.id = event_shares.id)
  AND can_edit = (SELECT s.can_edit FROM public.event_shares s WHERE s.id = event_shares.id)
);