create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  area text not null,
  zip text not null check (zip ~ '^[0-9]{5}$'),
  arrival_instructions text not null,
  accessibility_notes text not null,
  capacity smallint not null check (capacity > 0),
  court_count smallint not null check (court_count > 0),
  is_indoor_or_covered boolean not null,
  noise_notes text,
  weather_alternative text,
  waiver_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references public.venues(id) on delete restrict,
  status public.event_status not null default 'draft',
  activity text not null default 'pickleball' check (activity = 'pickleball'),
  audience_description text not null,
  service_area text not null default 'intown east',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/New_York'
    check (timezone = 'America/New_York'),
  capacity smallint not null default 16 check (capacity = 16),
  minimum_group_size smallint not null default 12 check (minimum_group_size = 12),
  court_count smallint not null default 3 check (court_count = 3),
  decision_due_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at = interval '120 minutes'),
  check (minimum_group_size = 12)
);

create table public.event_staff (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  role public.app_role not null
    check (role in ('event_lead', 'host', 'safety_owner')),
  is_coach boolean not null default false,
  assigned_at timestamptz not null default now(),
  removed_at timestamptz,
  unique nulls not distinct (event_id, auth_user_id, role, removed_at)
);
