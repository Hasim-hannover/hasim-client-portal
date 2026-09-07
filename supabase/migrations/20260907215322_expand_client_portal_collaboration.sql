alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

alter table public.project_files
  add column if not exists upload_id uuid,
  add column if not exists note text;

alter table public.project_files
  drop constraint if exists project_files_category_check;

alter table public.project_files
  add constraint project_files_category_check
  check (category in ('document','image','video','other'));

alter table public.project_files
  drop constraint if exists project_files_note_length_check;

alter table public.project_files
  add constraint project_files_note_length_check
  check (note is null or char_length(note) <= 2000);

create index if not exists project_files_upload_id_idx
  on public.project_files(upload_id);

create table if not exists public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists project_messages_project_id_idx
  on public.project_messages(project_id, created_at desc);
create index if not exists project_messages_sender_id_idx
  on public.project_messages(sender_id);

alter table public.project_messages enable row level security;

revoke all on public.project_messages from anon;
grant select, insert, delete on public.project_messages to authenticated;

drop policy if exists messages_select_access on public.project_messages;
drop policy if exists messages_insert_access on public.project_messages;
drop policy if exists messages_delete_access on public.project_messages;

create policy messages_select_access
on public.project_messages for select
to authenticated
using (
  exists (
    select 1
    from public.projects pr
    where pr.id = project_messages.project_id
      and (
        pr.client_id = (select auth.uid())
        or exists (
          select 1 from public.profiles me
          where me.id = (select auth.uid()) and me.role = 'admin'
        )
      )
  )
);

create policy messages_insert_access
on public.project_messages for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.projects pr
    where pr.id = project_messages.project_id
      and (
        pr.client_id = (select auth.uid())
        or exists (
          select 1 from public.profiles me
          where me.id = (select auth.uid()) and me.role = 'admin'
        )
      )
  )
);

create policy messages_delete_access
on public.project_messages for delete
to authenticated
using (
  sender_id = (select auth.uid())
  or exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.role = 'admin'
  )
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
  set email = excluded.email;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
