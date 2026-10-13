-- S0/S1: enums required for members and role grants (see data-schema.md).

create extension if not exists pgcrypto;

create type public.app_role as enum (
  'member', 'curation_lead', 'event_lead', 'host',
  'safety_owner', 'community_lead'
);

create type public.member_status as enum (
  'active', 'paused', 'deletion_requested'
);

create type public.profile_status as enum ('draft', 'complete');

create type public.availability_cadence as enum ('weekly', 'every_other_week');

create type public.pickleball_experience as enum (
  'never_played', 'casual', 'regular'
);
