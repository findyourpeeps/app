-- Identity linkage: auth.users (Supabase) ↔ public.members (product).

create table public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  chosen_first_name text not null
    check (char_length(btrim(chosen_first_name)) between 1 and 80),
  self_reported_age smallint not null
    check (self_reported_age between 25 and 45),
  source text not null check (char_length(btrim(source)) between 1 and 200),
  home_zip text not null check (home_zip ~ '^[0-9]{5}$'),
  is_in_service_area boolean not null default false,
  status public.member_status not null default 'active',
  profile_status public.profile_status not null default 'draft',
  availability_cadence public.availability_cadence not null default 'weekly',
  pickleball_experience public.pickleball_experience,
  profile_completed_at timestamptz,
  paused_at timestamptz,
  deletion_requested_at timestamptz,
  inactivity_prompted_at timestamptz,
  last_member_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (profile_status = 'draft' and profile_completed_at is null)
    or (profile_status = 'complete' and profile_completed_at is not null)
  ),
  check (
    (status = 'paused' and paused_at is not null)
    or status <> 'paused'
  ),
  check (
    (status = 'deletion_requested' and deletion_requested_at is not null)
    or status <> 'deletion_requested'
  )
);

comment on column public.members.self_reported_age is
  'Self-reported integer age; birth date is not collected.';

create table public.role_grants (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique nulls not distinct (auth_user_id, role, revoked_at)
);

create index members_status_area_profile_idx
  on public.members (status, is_in_service_area, profile_status);

create index role_grants_active_user_role_idx
  on public.role_grants (auth_user_id, role)
  where revoked_at is null;
