create table if not exists public.project_actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 2000),
  action_type text not null default 'upload' check (action_type in ('upload','approval','info')),
  status text not null default 'open' check (status in ('open','submitted','approved','changes_requested','done')),
  due_at timestamptz,
  response_note text check (response_note is null or char_length(response_note) <= 2000),
  sort_order integer not null default 0,
  completed_at timestamptz,
  legacy_request_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_actions_project_status_idx on public.project_actions(project_id, status, sort_order, created_at);
create index if not exists project_actions_created_by_idx on public.project_actions(created_by);
create index if not exists project_actions_due_at_idx on public.project_actions(due_at) where due_at is not null and status in ('open','submitted','changes_requested');

alter table public.project_actions enable row level security;
revoke all on public.project_actions from anon;
revoke all on public.project_actions from authenticated;
grant select, insert, update, delete on public.project_actions to authenticated;

create policy project_actions_select_access on public.project_actions for select to authenticated using (
  (select private.is_admin()) or exists (
    select 1 from public.projects pr where pr.id = project_actions.project_id and pr.client_id = (select auth.uid())
  )
);
create policy project_actions_insert_admin on public.project_actions for insert to authenticated with check ((select private.is_admin()) and created_by = (select auth.uid()));
create policy project_actions_update_admin on public.project_actions for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy project_actions_delete_admin on public.project_actions for delete to authenticated using ((select private.is_admin()));

alter table public.project_files add column if not exists action_id uuid references public.project_actions(id) on delete set null;
create index if not exists project_files_action_id_idx on public.project_files(action_id) where action_id is not null;

insert into public.project_actions (project_id, created_by, title, description, action_type, status, sort_order, completed_at, legacy_request_id, created_at, updated_at)
select pr.project_id, pr.created_by, pr.title, pr.description, 'upload', pr.status,
       pr.sort_order, case when pr.status = 'done' then coalesce(pr.completed_at, pr.updated_at) else null end,
       pr.id, pr.created_at, pr.updated_at
from public.project_requests pr
where not exists (select 1 from public.project_actions pa where pa.legacy_request_id = pr.id);

update public.project_files pf
set action_id = pa.id
from public.project_actions pa
where pf.action_id is null and pf.request_id is not null and pa.legacy_request_id = pf.request_id;

create table if not exists public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 80),
  title text not null check (char_length(title) between 1 and 240),
  body text check (body is null or char_length(body) <= 2000),
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists project_events_project_created_idx on public.project_events(project_id, created_at desc);
create index if not exists project_events_actor_idx on public.project_events(actor_id) where actor_id is not null;

alter table public.project_events enable row level security;
revoke all on public.project_events from anon;
revoke all on public.project_events from authenticated;
grant select on public.project_events to authenticated;

create policy project_events_select_access on public.project_events for select to authenticated using (
  (select private.is_admin()) or exists (
    select 1 from public.projects pr where pr.id = project_events.project_id and pr.client_id = (select auth.uid())
  )
);

create table if not exists public.portal_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  event_id uuid not null references public.project_events(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, event_id)
);
create index if not exists portal_notifications_user_unread_idx on public.portal_notifications(user_id, read_at, created_at desc);
create index if not exists portal_notifications_project_idx on public.portal_notifications(project_id, created_at desc);

alter table public.portal_notifications enable row level security;
revoke all on public.portal_notifications from anon;
revoke all on public.portal_notifications from authenticated;
grant select, update on public.portal_notifications to authenticated;

create policy portal_notifications_select_own on public.portal_notifications for select to authenticated using (user_id = (select auth.uid()));
create policy portal_notifications_update_own on public.portal_notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function private.log_project_event(
  p_project_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_title text,
  p_body text default null,
  p_entity_type text default null,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.project_events(project_id, actor_id, event_type, title, body, entity_type, entity_id, metadata)
  values (p_project_id, p_actor_id, p_event_type, p_title, p_body, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.log_project_event(uuid,uuid,text,text,text,text,text,jsonb) from public, anon, authenticated;

create or replace function private.distribute_project_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_client_id uuid;
begin
  select client_id into v_client_id from public.projects where id = new.project_id;
  if v_client_id is not null and new.actor_id is distinct from v_client_id then
    insert into public.portal_notifications(user_id, project_id, event_id, title, body)
    values (v_client_id, new.project_id, new.id, new.title, new.body)
    on conflict do nothing;
  end if;
  insert into public.portal_notifications(user_id, project_id, event_id, title, body)
  select p.id, new.project_id, new.id, new.title, new.body
  from public.profiles p
  where p.role = 'admin' and p.id is distinct from new.actor_id
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists project_events_distribute on public.project_events;
create trigger project_events_distribute after insert on public.project_events for each row execute function private.distribute_project_event();

create or replace function private.project_files_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.log_project_event(new.project_id, new.uploader_id, 'file_uploaded', 'Neue Datei: ' || new.file_name,
    case when new.note is null then null else new.note end, 'file', new.id::text,
    jsonb_build_object('category', new.category, 'size_bytes', new.size_bytes, 'action_id', new.action_id));
  return new;
end; $$;
drop trigger if exists project_files_event on public.project_files;
create trigger project_files_event after insert on public.project_files for each row execute function private.project_files_event();

create or replace function private.project_messages_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.log_project_event(new.project_id, new.sender_id, 'message_created', 'Neue Projektnachricht', left(new.body, 320), 'message', new.id::text, '{}'::jsonb);
  return new;
end; $$;
drop trigger if exists project_messages_event on public.project_messages;
create trigger project_messages_event after insert on public.project_messages for each row execute function private.project_messages_event();

create or replace function private.project_actions_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_project_event(new.project_id, new.created_by, 'action_created', 'Neue Aufgabe: ' || new.title,
      new.description, 'action', new.id::text, jsonb_build_object('action_type', new.action_type, 'status', new.status, 'due_at', new.due_at));
  elsif old.status is distinct from new.status then
    perform private.log_project_event(new.project_id, (select auth.uid()), 'action_status_changed', 'Aufgabe aktualisiert: ' || new.title,
      case new.status when 'submitted' then 'Eingereicht' when 'approved' then 'Freigegeben' when 'changes_requested' then 'Änderungen angefordert' when 'done' then 'Erledigt' else 'Offen' end,
      'action', new.id::text, jsonb_build_object('action_type', new.action_type, 'status', new.status));
  end if;
  return new;
end; $$;
drop trigger if exists project_actions_event on public.project_actions;
create trigger project_actions_event after insert or update of status on public.project_actions for each row execute function private.project_actions_event();

create or replace function private.projects_phase_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.phase is distinct from new.phase then
    perform private.log_project_event(new.id, (select auth.uid()), 'phase_changed', 'Projektphase aktualisiert',
      new.phase_note, 'project', new.id::text, jsonb_build_object('phase', new.phase));
  end if;
  return new;
end; $$;
drop trigger if exists projects_phase_event on public.projects;
create trigger projects_phase_event after update of phase on public.projects for each row execute function private.projects_phase_event();

create or replace function public.submit_project_action(p_action_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.project_actions pa
  set status = 'submitted', updated_at = now(), completed_at = null
  where pa.id = p_action_id
    and pa.action_type = 'upload'
    and pa.status in ('open','submitted','changes_requested')
    and exists (select 1 from public.projects pr where pr.id = pa.project_id and pr.client_id = (select auth.uid()));
  return found;
end;
$$;
revoke all on function public.submit_project_action(uuid) from public, anon;
grant execute on function public.submit_project_action(uuid) to authenticated;

create or replace function public.respond_project_approval(p_action_id uuid, p_decision text, p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_decision not in ('approved','changes_requested') or char_length(coalesce(p_note,'')) > 2000 then return false; end if;
  update public.project_actions pa
  set status = p_decision,
      response_note = nullif(btrim(coalesce(p_note,'')), ''),
      completed_at = case when p_decision = 'approved' then now() else null end,
      updated_at = now()
  where pa.id = p_action_id and pa.action_type = 'approval'
    and exists (select 1 from public.projects pr where pr.id = pa.project_id and pr.client_id = (select auth.uid()));
  return found;
end;
$$;
revoke all on function public.respond_project_approval(uuid,text,text) from public, anon;
grant execute on function public.respond_project_approval(uuid,text,text) to authenticated;

create or replace function public.complete_project_action(p_action_id uuid, p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(coalesce(p_note,'')) > 2000 then return false; end if;
  update public.project_actions pa
  set status = 'done', response_note = nullif(btrim(coalesce(p_note,'')), ''), completed_at = now(), updated_at = now()
  where pa.id = p_action_id and pa.action_type = 'info'
    and exists (select 1 from public.projects pr where pr.id = pa.project_id and pr.client_id = (select auth.uid()));
  return found;
end;
$$;
revoke all on function public.complete_project_action(uuid,text) from public, anon;
grant execute on function public.complete_project_action(uuid,text) to authenticated;

alter table public.notification_deliveries drop constraint if exists notification_deliveries_kind_check;
alter table public.notification_deliveries add constraint notification_deliveries_kind_check check (kind in ('upload_owner','upload_customer','message_owner','message_customer','invite','recovery','test','request_customer','phase_customer','action_customer'));
