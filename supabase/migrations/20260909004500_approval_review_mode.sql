alter table public.project_actions
  add column if not exists phase_key text,
  add column if not exists version_label text,
  add column if not exists demo_url text,
  add column if not exists preview_image_url text,
  add column if not exists blocks_progress boolean not null default false,
  add column if not exists demo_auth_type text not null default 'none';

alter table public.project_actions drop constraint if exists project_actions_phase_key_check;
alter table public.project_actions add constraint project_actions_phase_key_check
  check (phase_key is null or phase_key in ('onboarding','content','concept','development','review','launch','completed'));
alter table public.project_actions drop constraint if exists project_actions_version_label_length_check;
alter table public.project_actions add constraint project_actions_version_label_length_check
  check (version_label is null or char_length(version_label) <= 80);
alter table public.project_actions drop constraint if exists project_actions_demo_url_length_check;
alter table public.project_actions add constraint project_actions_demo_url_length_check
  check (demo_url is null or char_length(demo_url) <= 2000);
alter table public.project_actions drop constraint if exists project_actions_preview_image_url_length_check;
alter table public.project_actions add constraint project_actions_preview_image_url_length_check
  check (preview_image_url is null or char_length(preview_image_url) <= 3000);
alter table public.project_actions drop constraint if exists project_actions_demo_auth_type_check;
alter table public.project_actions add constraint project_actions_demo_auth_type_check
  check (demo_auth_type in ('none','shared_password','basic'));

create index if not exists project_actions_approval_phase_idx
  on public.project_actions(project_id, phase_key, status, created_at desc)
  where action_type = 'approval';

create table if not exists public.project_action_demo_secrets (
  action_id uuid primary key references public.project_actions(id) on delete cascade,
  username text check (username is null or char_length(username) <= 160),
  secret_ciphertext text not null check (char_length(secret_ciphertext) between 16 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_action_demo_secrets enable row level security;
revoke all on public.project_action_demo_secrets from anon;
revoke all on public.project_action_demo_secrets from authenticated;
grant select, insert, update, delete on public.project_action_demo_secrets to authenticated;

drop policy if exists project_action_demo_secrets_select_admin on public.project_action_demo_secrets;
create policy project_action_demo_secrets_select_admin on public.project_action_demo_secrets
  for select to authenticated using ((select private.is_admin()));
drop policy if exists project_action_demo_secrets_insert_admin on public.project_action_demo_secrets;
create policy project_action_demo_secrets_insert_admin on public.project_action_demo_secrets
  for insert to authenticated with check ((select private.is_admin()));
drop policy if exists project_action_demo_secrets_update_admin on public.project_action_demo_secrets;
create policy project_action_demo_secrets_update_admin on public.project_action_demo_secrets
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists project_action_demo_secrets_delete_admin on public.project_action_demo_secrets;
create policy project_action_demo_secrets_delete_admin on public.project_action_demo_secrets
  for delete to authenticated using ((select private.is_admin()));

alter table public.notification_deliveries drop constraint if exists notification_deliveries_kind_check;
alter table public.notification_deliveries add constraint notification_deliveries_kind_check check (kind in (
  'upload_owner','upload_customer','message_owner','message_customer',
  'invite','recovery','test','request_customer','phase_customer','action_customer',
  'action_response_owner','approval_customer'
));

create or replace function public.respond_project_approval(p_action_id uuid, p_decision text, p_note text default null)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_decision not in ('approved','changes_requested') or char_length(coalesce(p_note,'')) > 2000 then return false; end if;
  if p_decision = 'changes_requested' and nullif(btrim(coalesce(p_note,'')), '') is null then return false; end if;

  update public.project_actions pa
  set status = p_decision,
      response_note = nullif(btrim(coalesce(p_note,'')), ''),
      completed_at = case when p_decision = 'approved' then now() else null end,
      updated_at = now()
  where pa.id = p_action_id
    and pa.action_type = 'approval'
    and exists (
      select 1 from public.projects pr
      where pr.id = pa.project_id and pr.client_id = (select auth.uid())
    );
  return found;
end;
$$;
revoke all on function public.respond_project_approval(uuid,text,text) from public, anon;
grant execute on function public.respond_project_approval(uuid,text,text) to authenticated;
