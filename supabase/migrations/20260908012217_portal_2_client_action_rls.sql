revoke update on public.project_actions from authenticated;
grant update (status, response_note, completed_at, updated_at) on public.project_actions to authenticated;

drop policy if exists project_actions_update_client_upload on public.project_actions;
drop policy if exists project_actions_update_client_approval on public.project_actions;
drop policy if exists project_actions_update_client_info on public.project_actions;

create policy project_actions_update_client_upload
on public.project_actions for update to authenticated
using (
  action_type = 'upload'
  and exists (select 1 from public.projects pr where pr.id = project_actions.project_id and pr.client_id = (select auth.uid()))
)
with check (
  action_type = 'upload'
  and status = 'submitted'
  and exists (select 1 from public.projects pr where pr.id = project_actions.project_id and pr.client_id = (select auth.uid()))
);

create policy project_actions_update_client_approval
on public.project_actions for update to authenticated
using (
  action_type = 'approval'
  and exists (select 1 from public.projects pr where pr.id = project_actions.project_id and pr.client_id = (select auth.uid()))
)
with check (
  action_type = 'approval'
  and status in ('approved','changes_requested')
  and exists (select 1 from public.projects pr where pr.id = project_actions.project_id and pr.client_id = (select auth.uid()))
);

create policy project_actions_update_client_info
on public.project_actions for update to authenticated
using (
  action_type = 'info'
  and exists (select 1 from public.projects pr where pr.id = project_actions.project_id and pr.client_id = (select auth.uid()))
)
with check (
  action_type = 'info'
  and status = 'done'
  and exists (select 1 from public.projects pr where pr.id = project_actions.project_id and pr.client_id = (select auth.uid()))
);

alter function public.submit_project_action(uuid) security invoker;
alter function public.respond_project_approval(uuid,text,text) security invoker;
alter function public.complete_project_action(uuid,text) security invoker;
