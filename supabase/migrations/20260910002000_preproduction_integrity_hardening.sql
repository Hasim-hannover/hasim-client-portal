-- WERK pre-production integrity hardening

create or replace function private.enforce_project_client_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.client_id
      and p.role = 'client'
  ) then
    raise exception 'projects.client_id must reference a profile with role=client'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists projects_enforce_client_owner on public.projects;
create trigger projects_enforce_client_owner
before insert or update of client_id on public.projects
for each row execute function private.enforce_project_client_owner();

create or replace function private.cleanup_deleted_client_access_logs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notification_deliveries
  where project_id is null
    and event_id = old.id::text
    and kind in ('invite', 'recovery');

  return old;
end;
$$;

drop trigger if exists auth_user_cleanup_client_access_logs on auth.users;
create trigger auth_user_cleanup_client_access_logs
after delete on auth.users
for each row execute function private.cleanup_deleted_client_access_logs();

alter table public.project_files
  drop constraint if exists project_document_pdf_metadata;

alter table public.project_files
  add constraint project_document_pdf_metadata
  check (
    document_type is null
    or (
      lower(file_name) like '%.pdf'
      and mime_type = 'application/pdf'
    )
  ) not valid;

alter table public.project_files
  validate constraint project_document_pdf_metadata;
