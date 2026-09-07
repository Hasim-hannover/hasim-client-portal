create or replace function public.create_test_project_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.projects (client_id, name, status)
  values (new.id, 'Testprojekt Kundenportal', 'active');
  return new;
end;
$$;

revoke all on function public.create_test_project_for_new_user() from public;
revoke all on function public.create_test_project_for_new_user() from anon;
revoke all on function public.create_test_project_for_new_user() from authenticated;

drop trigger if exists on_profile_created_test_project on public.profiles;
create trigger on_profile_created_test_project
after insert on public.profiles
for each row execute function public.create_test_project_for_new_user();
