alter table public.projects
  add column if not exists started_at timestamptz;

-- Preserve the current behaviour for projects that already existed before the start gate.
update public.projects
set started_at = coalesce(started_at, created_at)
where started_at is null;

alter table public.project_files
  add column if not exists document_type text,
  add column if not exists document_label text,
  add column if not exists invoice_number text,
  add column if not exists invoice_amount_net numeric(12,2),
  add column if not exists invoice_due_at date,
  add column if not exists invoice_payment_status text,
  add column if not exists invoice_paid_at timestamptz;

alter table public.project_files drop constraint if exists project_files_document_type_check;
alter table public.project_files add constraint project_files_document_type_check
  check (document_type is null or document_type in ('contract','invoice','project','approval','handover'));

alter table public.project_files drop constraint if exists project_files_document_label_length_check;
alter table public.project_files add constraint project_files_document_label_length_check
  check (document_label is null or char_length(document_label) <= 160);

alter table public.project_files drop constraint if exists project_files_invoice_payment_status_check;
alter table public.project_files add constraint project_files_invoice_payment_status_check
  check (invoice_payment_status is null or invoice_payment_status in ('open','paid'));

alter table public.project_files drop constraint if exists project_files_invoice_amount_check;
alter table public.project_files add constraint project_files_invoice_amount_check
  check (invoice_amount_net is null or invoice_amount_net >= 0);

create index if not exists project_files_document_type_idx
  on public.project_files(project_id, document_type, created_at desc)
  where document_type is not null;

create table if not exists public.project_start_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requirement_key text not null check (char_length(requirement_key) between 1 and 80),
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 1200),
  is_required boolean not null default true,
  client_can_submit boolean not null default false,
  status text not null default 'open' check (status in ('open','submitted','verified','not_needed')),
  customer_note text check (customer_note is null or char_length(customer_note) <= 1200),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1200),
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, requirement_key)
);

create index if not exists project_start_requirements_project_idx
  on public.project_start_requirements(project_id, sort_order, created_at);
create index if not exists project_start_requirements_open_idx
  on public.project_start_requirements(project_id, status)
  where is_required = true and status not in ('verified','not_needed');

alter table public.project_start_requirements enable row level security;
revoke all on public.project_start_requirements from anon;
revoke all on public.project_start_requirements from authenticated;
grant select, insert, update, delete on public.project_start_requirements to authenticated;

drop policy if exists project_start_requirements_select_access on public.project_start_requirements;
create policy project_start_requirements_select_access
on public.project_start_requirements for select
to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1 from public.projects pr
    where pr.id = project_start_requirements.project_id
      and pr.client_id = (select auth.uid())
  )
);

drop policy if exists project_start_requirements_insert_admin on public.project_start_requirements;
create policy project_start_requirements_insert_admin
on public.project_start_requirements for insert
to authenticated
with check ((select private.is_admin()));

drop policy if exists project_start_requirements_update_admin on public.project_start_requirements;
create policy project_start_requirements_update_admin
on public.project_start_requirements for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists project_start_requirements_delete_admin on public.project_start_requirements;
create policy project_start_requirements_delete_admin
on public.project_start_requirements for delete
to authenticated
using ((select private.is_admin()));

create or replace function private.seed_project_start_requirements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_start_requirements
    (project_id, requirement_key, title, description, is_required, client_can_submit, sort_order)
  values
    (new.id, 'contract_signed', 'Auftrag / Vertrag unterschrieben', 'Die verbindliche Auftragsgrundlage liegt unterschrieben vor.', true, false, 10),
    (new.id, 'invoice_issued', 'Erste Teilrechnung gestellt', 'Die erste Teilrechnung für den Projektstart wurde bereitgestellt.', true, false, 20),
    (new.id, 'invoice_paid', 'Erste Teilrechnung bezahlt', 'Der Zahlungseingang der ersten Teilrechnung ist bestätigt.', true, false, 30),
    (new.id, 'wordpress_access', 'WordPress-Zugang', 'Separaten Administrator-Zugang einrichten und anschließend als bereitgestellt melden.', true, true, 40),
    (new.id, 'hosting_access', 'Hosting-Zugang', 'Separaten Benutzer- oder Mitarbeiterzugang zum Hosting bereitstellen.', true, true, 50),
    (new.id, 'email_hosting_access', 'E-Mail-Hosting-Zugang', 'Nur erforderlich, wenn E-Mail und Webhosting getrennt verwaltet werden.', false, true, 60),
    (new.id, 'search_console_access', 'Google Search Console', 'Falls vorhanden: Zugriff für das Projekt bereitstellen.', false, true, 70)
  on conflict (project_id, requirement_key) do nothing;
  return new;
end;
$$;
revoke all on function private.seed_project_start_requirements() from public, anon, authenticated;

drop trigger if exists projects_seed_start_requirements on public.projects;
create trigger projects_seed_start_requirements
after insert on public.projects
for each row execute function private.seed_project_start_requirements();

create or replace function public.submit_project_start_requirement(p_requirement_id uuid, p_note text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(coalesce(p_note, '')) > 1200 then return false; end if;

  update public.project_start_requirements psr
  set status = 'submitted',
      customer_note = nullif(btrim(coalesce(p_note, '')), ''),
      updated_at = now()
  where psr.id = p_requirement_id
    and psr.client_can_submit = true
    and psr.status in ('open','submitted')
    and exists (
      select 1 from public.projects pr
      where pr.id = psr.project_id
        and pr.client_id = (select auth.uid())
    );

  return found;
end;
$$;
revoke all on function public.submit_project_start_requirement(uuid,text) from public, anon;
grant execute on function public.submit_project_start_requirement(uuid,text) to authenticated;

create or replace function private.project_start_requirement_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    perform private.log_project_event(
      new.project_id,
      (select auth.uid()),
      'start_requirement_changed',
      'Projektstart: ' || new.title,
      case new.status
        when 'submitted' then 'Als bereitgestellt gemeldet'
        when 'verified' then 'Geprüft und bestätigt'
        when 'not_needed' then 'Für dieses Projekt nicht erforderlich'
        else 'Offen'
      end,
      'start_requirement',
      new.id::text,
      jsonb_build_object('status', new.status, 'required', new.is_required)
    );
  end if;
  return new;
end;
$$;
revoke all on function private.project_start_requirement_event() from public, anon, authenticated;

drop trigger if exists project_start_requirements_event on public.project_start_requirements;
create trigger project_start_requirements_event
after update of status on public.project_start_requirements
for each row execute function private.project_start_requirement_event();

create or replace function private.project_started_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.started_at is null and new.started_at is not null then
    perform private.log_project_event(
      new.id,
      (select auth.uid()),
      'project_started',
      'Projekt gestartet',
      'Alle verpflichtenden Startvoraussetzungen sind erfüllt. Phase 1 beginnt.',
      'project',
      new.id::text,
      jsonb_build_object('started_at', new.started_at)
    );
  end if;
  return new;
end;
$$;
revoke all on function private.project_started_event() from public, anon, authenticated;

drop trigger if exists projects_started_event on public.projects;
create trigger projects_started_event
after update of started_at on public.projects
for each row execute function private.project_started_event();

create or replace function private.admin_document_updates_start_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_is_admin boolean;
begin
  select exists (
    select 1 from public.profiles p
    where p.id = new.uploader_id and p.role = 'admin'
  ) into v_is_admin;

  if not v_is_admin then return new; end if;

  if new.document_type = 'contract' then
    update public.project_start_requirements
    set status = 'verified', completed_at = coalesce(completed_at, now()), updated_at = now()
    where project_id = new.project_id and requirement_key = 'contract_signed';
  elsif new.document_type = 'invoice' then
    update public.project_start_requirements
    set status = 'verified', completed_at = coalesce(completed_at, now()), updated_at = now()
    where project_id = new.project_id and requirement_key = 'invoice_issued';
  end if;

  return new;
end;
$$;
revoke all on function private.admin_document_updates_start_gate() from public, anon, authenticated;

drop trigger if exists project_files_update_start_gate on public.project_files;
create trigger project_files_update_start_gate
after insert on public.project_files
for each row execute function private.admin_document_updates_start_gate();
