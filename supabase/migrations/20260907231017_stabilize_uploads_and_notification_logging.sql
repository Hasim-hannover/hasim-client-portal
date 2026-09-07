drop policy if exists storage_select_access on storage.objects;
create policy storage_select_access
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-files'
  and (
    owner_id = ((select auth.uid())::text)
    or (select private.is_admin())
    or exists (
      select 1
      from public.project_files pf
      join public.projects pr on pr.id = pf.project_id
      where pf.storage_path = storage.objects.name
        and pr.client_id = (select auth.uid())
    )
  )
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  event_id text,
  kind text not null check (kind in ('upload_owner','upload_customer','message_owner','message_customer','invite','recovery','test')),
  recipient_type text not null check (recipient_type in ('owner','customer','invitee','test')),
  recipient_email text not null,
  provider text not null default 'brevo',
  provider_status integer not null default 0,
  provider_message_id text,
  ok boolean not null default false,
  error text check (error is null or char_length(error) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists notification_deliveries_created_at_idx
  on public.notification_deliveries(created_at desc);
create index if not exists notification_deliveries_project_id_idx
  on public.notification_deliveries(project_id, created_at desc);
create index if not exists notification_deliveries_event_id_idx
  on public.notification_deliveries(event_id);

alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from anon;
revoke all on public.notification_deliveries from authenticated;
grant select, insert on public.notification_deliveries to authenticated;

drop policy if exists notification_deliveries_select_admin on public.notification_deliveries;
drop policy if exists notification_deliveries_insert_access on public.notification_deliveries;

create policy notification_deliveries_select_admin
on public.notification_deliveries for select
to authenticated
using ((select private.is_admin()));

create policy notification_deliveries_insert_access
on public.notification_deliveries for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and (
    (project_id is null and (select private.is_admin()))
    or exists (
      select 1
      from public.projects pr
      where pr.id = notification_deliveries.project_id
        and (pr.client_id = (select auth.uid()) or (select private.is_admin()))
    )
  )
);
