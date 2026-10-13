create type public.firmness as enum ('firm', 'flexible');

create type public.matching_item_kind as enum (
  'gender_identity',
  'dating_gender',
  'desired_age_range',
  'relationship_intention',
  'relationship_structure',
  'dating_radius',
  'value_or_lifestyle',
  'activity_interest',
  'prompt'
);

create type public.event_status as enum (
  'draft', 'inviting', 'decision_pending', 'go', 'smaller',
  'rescheduled', 'in_progress', 'completed', 'closed', 'canceled'
);

create type public.invite_list_status as enum ('draft', 'locked');

create type public.invite_entry_disposition as enum (
  'pending', 'eligible', 'held_recheck_failed', 'invited', 'removed'
);

create type public.invitation_status as enum (
  'not_sent', 'invited', 'accepted', 'confirmed',
  'declined', 'expired', 'canceled', 'released'
);

create type public.participation_status as enum (
  'expected', 'checked_in', 'late', 'absent'
);
