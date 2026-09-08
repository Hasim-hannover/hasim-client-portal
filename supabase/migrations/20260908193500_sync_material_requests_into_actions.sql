insert into public.project_actions (
  project_id, created_by, title, description, action_type, status, sort_order, completed_at, legacy_request_id, created_at, updated_at
)
select
  pr.project_id,
  pr.created_by,
  pr.title,
  pr.description,
  'upload',
  pr.status,
  pr.sort_order,
  case when pr.status = 'done' then coalesce(pr.completed_at, pr.updated_at) else null end,
  pr.id,
  pr.created_at,
  pr.updated_at
from public.project_requests pr
where not exists (
  select 1 from public.project_actions pa where pa.legacy_request_id = pr.id
);

update public.project_files pf
set action_id = pa.id
from public.project_actions pa
where pf.action_id is null
  and pf.request_id is not null
  and pa.legacy_request_id = pf.request_id;
