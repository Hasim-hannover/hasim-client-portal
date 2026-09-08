alter table public.notification_deliveries alter column actor_id drop not null;

alter table public.notification_deliveries drop constraint if exists notification_deliveries_kind_check;
alter table public.notification_deliveries add constraint notification_deliveries_kind_check check (kind in (
  'upload_owner','upload_customer','message_owner','message_customer',
  'invite','recovery','test','request_customer','phase_customer','action_customer',
  'action_response_owner'
));
