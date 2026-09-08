create sequence if not exists public.client_number_seq start with 1 increment by 1;

alter table public.profiles
  add column if not exists client_number text,
  add column if not exists company_name text,
  add column if not exists phone text;

alter table public.profiles
  drop constraint if exists profiles_company_name_length_check,
  drop constraint if exists profiles_phone_length_check;

alter table public.profiles
  add constraint profiles_company_name_length_check check (company_name is null or char_length(company_name) <= 160),
  add constraint profiles_phone_length_check check (phone is null or char_length(phone) <= 80);

create unique index if not exists profiles_client_number_unique_idx
  on public.profiles(client_number)
  where client_number is not null;

create or replace function public.assign_client_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_number is null and coalesce(new.role, 'client') = 'client' then
    new.client_number := 'K-' || lpad(nextval('public.client_number_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

revoke all on function public.assign_client_number() from public;
revoke all on function public.assign_client_number() from anon;
revoke all on function public.assign_client_number() from authenticated;

drop trigger if exists profiles_assign_client_number on public.profiles;
create trigger profiles_assign_client_number
before insert or update of role, client_number on public.profiles
for each row execute function public.assign_client_number();

with numbered as (
  select id,
         row_number() over (order by created_at, id) + (select last_value from public.client_number_seq) as n
  from public.profiles
  where role = 'client' and client_number is null
)
update public.profiles p
set client_number = 'K-' || lpad(numbered.n::text, 6, '0')
from numbered
where p.id = numbered.id;

select setval(
  'public.client_number_seq',
  greatest(
    (select last_value from public.client_number_seq),
    coalesce((select max(substring(client_number from 3)::bigint) from public.profiles where client_number ~ '^K-[0-9]{6}$'), 1)
  ),
  true
);
