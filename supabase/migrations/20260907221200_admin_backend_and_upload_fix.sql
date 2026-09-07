create schema if not exists private;

grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

alter table public.projects
  add column if not exists phase text not null default 'onboarding',
  add column if not exists phase_note text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.projects drop constraint if exists projects_phase_check;
alter table public.projects add constraint projects_phase_check
  check (phase in ('onboarding','content','concept','development','review','launch','completed'));

alter table public.projects drop constraint if exists projects_phase_note_length_check;
alter table public.projects add constraint projects_phase_note_length_check
  check (phase_note is null or char_length(phase_note) <= 1200);

create or replace function public.touch_project_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
before update on public.projects
for each row execute function public.touch_project_updated_at();

revoke all on function public.touch_project_updated_at() from public;
revoke all on function public.touch_project_updated_at() from anon;
revoke all on function public.touch_project_updated_at() from authenticated;

drop trigger if exists on_profile_created_test_project on public.profiles;
drop function if exists public.create_test_project_for_new_user();

revoke all on public.profiles from anon;
revoke all on public.projects from anon;
revoke all on public.project_files from anon;
revoke all on public.project_messages from anon;

revoke all on public.profiles from authenticated;
grant select, update on public.profiles to authenticated;

revoke all on public.projects from authenticated;
grant select, insert, update, delete on public.projects to authenticated;

revoke all on public.project_files from authenticated;
grant select, insert, delete on public.project_files to authenticated;

revoke all on public.project_messages from authenticated;
grant select, insert, delete on public.project_messages to authenticated;

drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update_admin on public.profiles for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists projects_select_access on public.projects;
drop policy if exists projects_insert_admin on public.projects;
drop policy if exists projects_update_admin on public.projects;
drop policy if exists projects_delete_admin on public.projects;
create policy projects_select_access on public.projects for select to authenticated
using (client_id = (select auth.uid()) or (select private.is_admin()));
create policy projects_insert_admin on public.projects for insert to authenticated
with check ((select private.is_admin()));
create policy projects_update_admin on public.projects for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy projects_delete_admin on public.projects for delete to authenticated
using ((select private.is_admin()));

drop policy if exists files_select_access on public.project_files;
drop policy if exists files_insert_access on public.project_files;
drop policy if exists files_delete_access on public.project_files;
create policy files_select_access on public.project_files for select to authenticated
using (exists (select 1 from public.projects pr where pr.id = project_files.project_id and (pr.client_id = (select auth.uid()) or (select private.is_admin()))));
create policy files_insert_access on public.project_files for insert to authenticated
with check (uploader_id = (select auth.uid()) and exists (select 1 from public.projects pr where pr.id = project_files.project_id and (pr.client_id = (select auth.uid()) or (select private.is_admin()))));
create policy files_delete_access on public.project_files for delete to authenticated
using (uploader_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists messages_select_access on public.project_messages;
drop policy if exists messages_insert_access on public.project_messages;
drop policy if exists messages_delete_access on public.project_messages;
create policy messages_select_access on public.project_messages for select to authenticated
using (exists (select 1 from public.projects pr where pr.id = project_messages.project_id and (pr.client_id = (select auth.uid()) or (select private.is_admin()))));
create policy messages_insert_access on public.project_messages for insert to authenticated
with check (sender_id = (select auth.uid()) and exists (select 1 from public.projects pr where pr.id = project_messages.project_id and (pr.client_id = (select auth.uid()) or (select private.is_admin()))));
create policy messages_delete_access on public.project_messages for delete to authenticated
using (sender_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists storage_select_access on storage.objects;
drop policy if exists storage_insert_access on storage.objects;
drop policy if exists storage_delete_access on storage.objects;
create policy storage_select_access on storage.objects for select to authenticated
using (bucket_id = 'project-files' and exists (select 1 from public.project_files pf join public.projects pr on pr.id = pf.project_id where pf.storage_path = storage.objects.name and (pr.client_id = (select auth.uid()) or (select private.is_admin()))));
create policy storage_insert_access on storage.objects for insert to authenticated
with check (bucket_id = 'project-files' and (storage.foldername(name))[1] = ((select auth.uid())::text) and exists (select 1 from public.projects pr where pr.id::text = (storage.foldername(storage.objects.name))[2] and (pr.client_id = (select auth.uid()) or (select private.is_admin()))));
create policy storage_delete_access on storage.objects for delete to authenticated
using (bucket_id = 'project-files' and (owner_id = ((select auth.uid())::text) or (select private.is_admin())));
