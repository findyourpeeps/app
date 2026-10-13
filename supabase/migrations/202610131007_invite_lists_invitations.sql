create table public.invite_lists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  status public.invite_list_status not null default 'draft',
  target_capacity smallint not null default 16 check (target_capacity = 16),
  locked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'draft' and locked_at is null)
    or (status = 'locked' and locked_at is not null)
  )
);

create table public.invite_list_entries (
  id uuid primary key default gen_random_uuid(),
  invite_list_id uuid not null references public.invite_lists(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete restrict,
  qualifying_availability_id uuid not null references public.availability(id) on delete restrict,
  position integer not null check (position > 0),
  stated_criteria_reason text not null
    check (char_length(btrim(stated_criteria_reason)) between 1 and 1000),
  disposition public.invite_entry_disposition not null default 'pending',
  recheck_reason_code text,
  last_rechecked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invite_list_id, member_id),
  unique (invite_list_id, position)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete restrict,
  invite_list_entry_id uuid not null unique references public.invite_list_entries(id) on delete restrict,
  status public.invitation_status not null default 'not_sent',
  sent_at timestamptz,
  acceptance_deadline timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, member_id)
);

create table public.participations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete restrict,
  invitation_id uuid not null unique references public.invitations(id) on delete restrict,
  status public.participation_status not null default 'expected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, member_id)
);
