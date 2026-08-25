alter table public.events
  add column tags text[] not null default '{}',
  add column show_description boolean not null default true,
  add column show_date boolean not null default true,
  add column show_location boolean not null default true,
  add column show_tags boolean not null default true,
  add column show_nodes boolean not null default true,
  add column show_creator boolean not null default true;

drop policy event_nodes_select_visible on public.event_nodes;
create policy event_nodes_select_visible on public.event_nodes
for select to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = event_nodes.event_id
      and (e.owner_id = auth.uid() or (e.is_public and e.show_nodes))
  )
  or public.is_shared_with_me(event_id)
);

create or replace function public.can_view_profile(_profile_id uuid)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select _profile_id = auth.uid()
    or exists (
      select 1
      from public.events e
      join public.event_shares s on s.event_id = e.id
      where e.owner_id = _profile_id
        and lower(s.invited_email) = public.my_email()
        and public.my_email() <> ''
    )
    or exists (
      select 1
      from public.events e
      where e.owner_id = _profile_id
        and e.is_public
        and e.show_creator
    );
$$;

create view public.public_event_feed
with (security_invoker = true) as
select
  e.id,
  e.owner_id,
  e.title,
  case when e.show_description then e.description end as description,
  case when e.show_date then e.event_date end as event_date,
  case when e.show_location then e.location end as location,
  case when e.show_tags then e.tags else '{}'::text[] end as tags,
  e.show_creator,
  e.show_nodes,
  e.created_at
from public.events e
where e.is_public = true;

grant select on public.public_event_feed to authenticated;
grant select on public.public_event_feed to service_role;