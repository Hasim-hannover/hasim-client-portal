create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open',
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_requests_title_length_check check (char_length(title) between 1 and 160),
  constraint project_requests_description_length_check check (description is null or char_length(description) <= 1200),
  constraint project_requests_status_check check (status in ('open', 'submitted', 'done')),
  constraint project_requests_sort_order_check check (sort_order >= 0)
);

create index if not exists project_requests_project_status_idx
  on public.project_requests(project_id, status, sort_order, created_at);

alter table public.project_requests enable row level security;
revoke all on public.project_requests from anon;
revoke all on public.project_requests from authenticated;
grant select, insert, update, delete on public.project_requests to authenticated;

drop policy if exists project_requests_select_access on public.project_requests;
drop policy if exists project_requests_insert_admin on public.project_requests;
drop policy if exists project_requests_update_admin on public.project_requests;
drop policy if exists project_requests_delete_admin on public.project_requests;

create policy project_requests_select_access
on public.project_requests for select
to authenticated
using (
  exists (
    select 1
    from public.projects pr
    where pr.id = project_requests.project_id
      and (pr.client_id = (select auth.uid()) or (select private.is_admin()))
  )
);

create policy project_requests_insert_admin
on public.project_requests for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_admin())
);

create policy project_requests_update_admin
on public.project_requests for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy project_requests_delete_admin
on public.project_requests for delete
to authenticated
using ((select private.is_admin()));

create or replace function public.touch_project_request_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

revoke all on function public.touch_project_request_updated_at() from public;
revoke all on function public.touch_project_request_updated_at() from anon;
revoke all on function public.touch_project_request_updated_at() from authenticated;

drop trigger if exists project_requests_touch_updated_at on public.project_requests;
create trigger project_requests_touch_updated_at
before update on public.project_requests
for each row execute function public.touch_project_request_updated_at();

alter table public.project_files
  add column if not exists request_id uuid references public.project_requests(id) on delete set null;

create index if not exists project_files_request_id_idx
  on public.project_files(request_id);

-- A linked request must belong to the same project as the uploaded file.
create or replace function public.validate_project_file_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.request_id is not null and not exists (
    select 1
    from public.project_requests r
    where r.id = new.request_id
      and r.project_id = new.project_id
  ) then
    raise exception 'Project request does not belong to this project';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_project_file_request() from public;
revoke all on function public.validate_project_file_request() from anon;
revoke all on function public.validate_project_file_request() from authenticated;

drop trigger if exists project_files_validate_request on public.project_files;
create trigger project_files_validate_request
before insert or update of request_id, project_id on public.project_files
for each row execute function public.validate_project_file_request();

create or replace function public.mark_project_request_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.request_id is not null then
    update public.project_requests
    set status = 'submitted', updated_at = now()
    where id = new.request_id
      and project_id = new.project_id
      and status = 'open';
  end if;
  return new;
end;
$$;

revoke all on function public.mark_project_request_submitted() from public;
revoke all on function public.mark_project_request_submitted() from anon;
revoke all on function public.mark_project_request_submitted() from authenticated;

drop trigger if exists project_files_mark_request_submitted on public.project_files;
create trigger project_files_mark_request_submitted
after insert on public.project_files
for each row execute function public.mark_project_request_submitted();

-- Preserve existing file policy while validating optional request links.
drop policy if exists files_insert_access on public.project_files;
create policy files_insert_access
on public.project_files for insert
to authenticated
with check (
  uploader_id = (select auth.uid())
  and exists (
    select 1
    from public.projects pr
    where pr.id = project_files.project_id
      and (pr.client_id = (select auth.uid()) or (select private.is_admin()))
  )
  and (
    request_id is null
    or exists (
      select 1
      from public.project_requests r
      where r.id = project_files.request_id
        and r.project_id = project_files.project_id
    )
  )
);
