-- Clients only need to update the three fields used when they report an access as provided.
-- Admin mutations use the server-side admin client after the signed-in user's admin role is verified.
revoke update on public.project_start_requirements from authenticated;
grant update (status, customer_note, updated_at) on public.project_start_requirements to authenticated;

drop policy if exists project_start_requirements_update_client_submit on public.project_start_requirements;
create policy project_start_requirements_update_client_submit
on public.project_start_requirements for update
to authenticated
using (
  client_can_submit = true
  and status in ('open','submitted')
  and exists (
    select 1 from public.projects pr
    where pr.id = project_start_requirements.project_id
      and pr.client_id = (select auth.uid())
  )
)
with check (
  client_can_submit = true
  and status = 'submitted'
  and exists (
    select 1 from public.projects pr
    where pr.id = project_start_requirements.project_id
      and pr.client_id = (select auth.uid())
  )
);

create or replace function public.submit_project_start_requirement(p_requirement_id uuid, p_note text default null)
returns boolean
language plpgsql
security invoker
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
    and psr.status in ('open','submitted');

  return found;
end;
$$;
revoke all on function public.submit_project_start_requirement(uuid,text) from public, anon;
grant execute on function public.submit_project_start_requirement(uuid,text) to authenticated;
