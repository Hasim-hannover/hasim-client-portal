create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'client' check (role in ('admin','client')),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active','paused','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('document','image','video')),
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now()
);

create index if not exists projects_client_id_idx on public.projects(client_id);
create index if not exists project_files_project_id_idx on public.project_files(project_id);
create index if not exists project_files_uploader_id_idx on public.project_files(uploader_id);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_files enable row level security;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, delete on public.project_files to authenticated;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists projects_select_own on public.projects;
drop policy if exists projects_select_access on public.projects;
drop policy if exists projects_insert_admin on public.projects;
drop policy if exists projects_update_admin on public.projects;
drop policy if exists projects_delete_admin on public.projects;
drop policy if exists files_select_own_project on public.project_files;
drop policy if exists files_select_project_access on public.project_files;
drop policy if exists files_select_access on public.project_files;
drop policy if exists files_insert_own_project on public.project_files;
drop policy if exists files_insert_project_access on public.project_files;
drop policy if exists files_insert_access on public.project_files;
drop policy if exists files_delete_access on public.project_files;

create policy profiles_select_own_or_admin
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.role = 'admin'
  )
);

create policy projects_select_access
on public.projects for select
to authenticated
using (
  client_id = (select auth.uid())
  or exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.role = 'admin'
  )
);

create policy projects_insert_admin
on public.projects for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.role = 'admin'
  )
);

create policy projects_update_admin
on public.projects for update
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.role = 'admin'
  )
);

create policy projects_delete_admin
on public.projects for delete
to authenticated
using (
  exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.role = 'admin'
  )
);

create policy files_select_access
on public.project_files for select
to authenticated
using (
  exists (
    select 1
    from public.projects pr
    where pr.id = project_files.project_id
      and (
        pr.client_id = (select auth.uid())
        or exists (
          select 1 from public.profiles me
          where me.id = (select auth.uid()) and me.role = 'admin'
        )
      )
  )
);

create policy files_insert_access
on public.project_files for insert
to authenticated
with check (
  uploader_id = (select auth.uid())
  and exists (
    select 1
    from public.projects pr
    where pr.id = project_files.project_id
      and (
        pr.client_id = (select auth.uid())
        or exists (
          select 1 from public.profiles me
          where me.id = (select auth.uid()) and me.role = 'admin'
        )
      )
  )
);

create policy files_delete_access
on public.project_files for delete
to authenticated
using (
  uploader_id = (select auth.uid())
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
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

DO $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 104857600)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists storage_select_own_project on storage.objects;
drop policy if exists storage_select_access on storage.objects;
drop policy if exists storage_insert_own_folder on storage.objects;
drop policy if exists storage_insert_access on storage.objects;
drop policy if exists storage_delete_own_file on storage.objects;
drop policy if exists storage_delete_access on storage.objects;

create policy storage_select_access
on storage.objects for select
to authenticated
using (
  bucket_id = 'project-files'
  and exists (
    select 1
    from public.project_files pf
    join public.projects pr on pr.id = pf.project_id
    where pf.storage_path = storage.objects.name
      and (
        pr.client_id = (select auth.uid())
        or exists (
          select 1 from public.profiles me
          where me.id = (select auth.uid()) and me.role = 'admin'
        )
      )
  )
);

create policy storage_insert_access
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'project-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.projects pr
    where pr.id::text = (storage.foldername(name))[2]
      and (
        pr.client_id = (select auth.uid())
        or exists (
          select 1 from public.profiles me
          where me.id = (select auth.uid()) and me.role = 'admin'
        )
      )
  )
);

create policy storage_delete_access
on storage.objects for delete
to authenticated
using (
  bucket_id = 'project-files'
  and (
    owner_id = (select auth.uid())::text
    or exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid()) and me.role = 'admin'
    )
  )
);
