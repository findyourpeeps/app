create table public.member_matching_items (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  kind public.matching_item_kind not null,
  item_key text not null check (char_length(btrim(item_key)) between 1 and 80),
  value jsonb not null check (value <> 'null'::jsonb),
  firmness public.firmness not null,
  is_active boolean not null default true,
  display_order smallint not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, kind, item_key)
);

comment on table public.member_matching_items is
  'Member-entered D-05 matching data. Firm/flexible is explicit per item.';
