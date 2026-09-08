create index if not exists portal_notifications_event_id_idx on public.portal_notifications(event_id);

drop policy if exists project_actions_update_admin on public.project_actions;
drop policy if exists project_actions_update_client_upload on public.project_actions;
drop policy if exists project_actions_update_client_approval on public.project_actions;
drop policy if exists project_actions_update_client_info on public.project_actions;

create policy project_actions_update_access
on public.project_actions for update to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1 from public.projects pr
    where pr.id = project_actions.project_id
      and pr.client_id = (select auth.uid())
      and project_actions.action_type in ('upload','approval','info')
  )
)
with check (
  (select private.is_admin())
  or (
    exists (
      select 1 from public.projects pr
      where pr.id = project_actions.project_id
        and pr.client_id = (select auth.uid())
    )
    and (
      (project_actions.action_type = 'upload' and project_actions.status = 'submitted')
      or (project_actions.action_type = 'approval' and project_actions.status in ('approved','changes_requested'))
      or (project_actions.action_type = 'info' and project_actions.status = 'done')
    )
  )
);
