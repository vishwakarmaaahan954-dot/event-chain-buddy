UPDATE public.event_nodes
SET vendor_link = 'https://www.coc.com'
WHERE id = '71141a3e-f5e4-46dc-933c-513fa0a4776c';

ALTER TABLE public.event_nodes
ADD CONSTRAINT event_nodes_vendor_link_http
CHECK (vendor_link IS NULL OR vendor_link ~* '^https?://');