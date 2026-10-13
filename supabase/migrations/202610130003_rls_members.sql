-- Baseline RLS for S1 identity tables (self row only on members).

alter table public.members enable row level security;
alter table public.members force row level security;

create policy members_select_self
on public.members for select
to authenticated
using (auth_user_id = auth.uid());

revoke all on public.members from anon, authenticated;
grant select on public.members to authenticated;

alter table public.role_grants enable row level security;
alter table public.role_grants force row level security;

revoke all on public.role_grants from anon, authenticated;

-- Staff role management RPCs arrive in a later slice; no client policies yet.
