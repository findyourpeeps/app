create table public.availability (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/New_York',
  expires_at timestamptz not null,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (expires_at >= starts_at),
  check (withdrawn_at is null or withdrawn_at >= created_at)
);

create index availability_member_expires_idx
  on public.availability (member_id, expires_at desc);
