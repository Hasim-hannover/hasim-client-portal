create index if not exists notification_deliveries_actor_id_idx
  on public.notification_deliveries(actor_id);

create index if not exists project_requests_created_by_idx
  on public.project_requests(created_by);
