-- CPS Fit · dominio del club (fase 2): personas, familias, cuotas, zonas y accesos, recursos y reservas, facturación.
-- Todo el dinero va en céntimos (integer). Datos de ejemplo/ficticios; las tarifas editables viven en tablas.
create extension if not exists btree_gist;

create type public.person_status as enum ('active', 'paused', 'left', 'prospect');
create type public.membership_status as enum ('active', 'pending', 'paused', 'ended');
create type public.booking_status as enum ('confirmed', 'cancelled', 'no_show', 'waitlist', 'blocked');
create type public.invoice_status as enum ('draft', 'pending', 'paid', 'overdue', 'void', 'refunded');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

-- ───────── Personas y familias ─────────
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  postal_code text,
  municipality text not null default 'Sant Joan les Fonts',
  empadronament_ok boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.membership_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ca text not null,
  name_es text not null,
  description_ca text,
  annual_fee_cents integer not null default 0,
  min_age smallint,
  max_age smallint,
  needs_adult_link boolean not null default false,
  needs_pair boolean not null default false,
  min_seniority_years smallint,
  retiree boolean not null default false,
  sort smallint not null default 0,
  active boolean not null default true
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  first_name text not null,
  last_name text not null,
  birth_date date,
  national_id text,
  email text,
  phone text,
  address text,
  postal_code text,
  household_id uuid references public.households (id) on delete set null,
  household_role text not null default 'other' check (household_role in ('holder', 'partner', 'child', 'other')),
  status public.person_status not null default 'active',
  locale text not null default 'ca' check (locale in ('ca', 'es')),
  notes text,
  tags text[] not null default '{}',
  consent_data boolean not null default false,
  consent_at timestamptz,
  marketing_ok boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.people (household_id);
create index on public.people (last_name, first_name);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  type_id uuid not null references public.membership_types (id),
  status public.membership_status not null default 'active',
  started_on date not null default current_date,
  ended_on date,
  seniority_since date,
  billable boolean not null default true,
  entry_fee_due boolean not null default false,
  entry_fee_paid boolean not null default false,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index memberships_one_open on public.memberships (person_id) where status in ('active', 'pending', 'paused');
create index on public.memberships (type_id);

create table public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  applicant jsonb not null,
  type_code text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  reason text,
  created_at timestamptz not null default now()
);

-- IBAN ficticios; en producción cifrar con Supabase Vault (ver docs/MIGRACION.md).
create table public.bank_accounts (
  person_id uuid primary key references public.people (id) on delete cascade,
  iban text not null,
  holder_name text,
  mandate_id text,
  mandate_signed_on date,
  created_at timestamptz not null default now()
);

-- ───────── Zonas, accesos, carnets ─────────
create table public.zones (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ca text not null,
  name_es text not null,
  kind text not null default 'area',
  capacity integer,
  color text,
  sort smallint not null default 0,
  active boolean not null default true
);

create table public.access_rules (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones (id) on delete cascade,
  audience text not null check (audience in ('member', 'non_member', 'pass_holder')),
  membership_type_code text,
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  time_from time,
  time_to time,
  season_from date,
  season_to date,
  requires_booking boolean not null default false,
  requires_pass_kind text,
  allow boolean not null default true,
  note_ca text,
  sort smallint not null default 0
);
create index on public.access_rules (zone_id);

create table public.access_overrides (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  zone_id uuid not null references public.zones (id) on delete cascade,
  allow boolean not null,
  reason text,
  until date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.access_overrides (person_id);
create index on public.access_overrides (zone_id);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references public.people (id) on delete cascade,
  number text unique not null,
  status text not null default 'active' check (status in ('active', 'blocked', 'lost')),
  issued_at timestamptz not null default now(),
  printed_at timestamptz
);

create table public.access_logs (
  id bigint generated always as identity primary key,
  person_id uuid references public.people (id) on delete set null,
  zone_id uuid not null references public.zones (id) on delete cascade,
  direction text not null default 'in' check (direction in ('in', 'out')),
  allowed boolean not null,
  reason text,
  method text not null default 'qr',
  operator_id uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);
create index on public.access_logs (zone_id, at desc);
create index on public.access_logs (person_id, at desc);

-- Aforo en vivo sin datos personales (lo mantiene un trigger).
create table public.zone_presence (
  zone_id uuid primary key references public.zones (id) on delete cascade,
  present integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ───────── Recursos, tarifas y reservas ─────────
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references public.zones (id) on delete set null,
  code text unique not null,
  name text not null,
  kind text not null,
  slot_min smallint not null default 30,
  open_time time not null default '08:00',
  close_time time not null default '22:00',
  durations smallint[] not null default '{60,90,120}',
  max_advance_days smallint not null default 14,
  cancel_hours smallint not null default 24,
  max_active_per_person smallint not null default 3,
  capacity smallint,
  active boolean not null default true
);
create index on public.resources (zone_id);

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  resource_kind text not null,
  audience text not null check (audience in ('member', 'non_member')),
  weekdays smallint[] not null default '{0,1,2,3,4,5,6}',
  hour_from smallint not null,
  hour_to smallint not null,
  price_cents_hour integer not null,
  valid_from date,
  valid_to date,
  note text
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ca text not null,
  name_es text not null,
  kind text not null check (kind in ('extra', 'pass', 'subscription', 'ticket', 'fee', 'merch', 'course')),
  price_member_cents integer not null default 0,
  price_non_member_cents integer not null default 0,
  vat_pct numeric(4, 1) not null default 0,
  uses smallint,
  valid_days smallint,
  nominal boolean not null default false,
  season_only boolean not null default false,
  age_min smallint,
  age_max smallint,
  example boolean not null default false,
  active boolean not null default true,
  sort smallint not null default 0
);

create table public.invoice_counters (
  series text not null,
  year integer not null,
  last_number integer not null default 0,
  primary key (series, year)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  series text not null default 'F',
  number text unique,
  person_id uuid not null references public.people (id),
  issued_on date not null default current_date,
  due_on date,
  status public.invoice_status not null default 'pending',
  kind text not null default 'other',
  subtotal_cents integer not null default 0,
  vat_cents integer not null default 0,
  total_cents integer not null default 0,
  rectifies_id uuid references public.invoices (id),
  notes text,
  source text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index on public.invoices (person_id, issued_on desc);
create index on public.invoices (status);
create index on public.invoices (rectifies_id);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  qty numeric(8, 2) not null default 1,
  unit_cents integer not null,
  vat_pct numeric(4, 1) not null default 0,
  total_cents integer not null default 0,
  product_id uuid references public.products (id) on delete set null
);
create index on public.invoice_lines (invoice_id);
create index on public.invoice_lines (product_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id),
  person_id uuid references public.people (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'confirmed',
  kind text not null default 'booking' check (kind in ('booking', 'block', 'class', 'training', 'match', 'rental')),
  title text,
  price_cents integer not null default 0,
  audience_applied text,
  open_match boolean not null default false,
  players_needed smallint,
  invoice_id uuid references public.invoices (id) on delete set null,
  series_id uuid,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancel_reason text,
  check (ends_at > starts_at),
  constraint bookings_no_overlap exclude using gist (resource_id with =, tstzrange(starts_at, ends_at, '[)') with &&) where (status in ('confirmed', 'blocked'))
);
create index on public.bookings (person_id, starts_at desc);
create index on public.bookings (invoice_id);
create index on public.bookings (resource_id, starts_at);

-- Disponibilidad pública (sin datos personales), mantenida por trigger.
create table public.booking_slots (
  id uuid primary key,
  resource_id uuid not null references public.resources (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null,
  kind text not null,
  title text,
  open_match boolean not null default false,
  players_needed smallint,
  host_name text
);
create index on public.booking_slots (resource_id, starts_at);

create table public.booking_extras (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  product_id uuid not null references public.products (id),
  qty smallint not null default 1,
  unit_cents integer not null
);
create index on public.booking_extras (booking_id);
create index on public.booking_extras (product_id);

create table public.booking_players (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  status text not null default 'joined' check (status in ('joined', 'requested')),
  created_at timestamptz not null default now(),
  primary key (booking_id, person_id)
);
create index on public.booking_players (person_id);

create table public.booking_waitlist (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.booking_waitlist (resource_id, starts_at);
create index on public.booking_waitlist (person_id);

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid references auth.users (id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_cents integer not null default 0,
  counted_cents integer,
  expected_cents integer,
  note text
);
create index on public.cash_sessions (opened_by);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  person_id uuid not null references public.people (id),
  method text not null check (method in ('sepa', 'card', 'cash', 'transfer', 'simulated')),
  amount_cents integer not null,
  status public.payment_status not null default 'succeeded',
  provider text,
  provider_ref text,
  paid_at timestamptz not null default now(),
  cash_session_id uuid references public.cash_sessions (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null
);
create index on public.payments (invoice_id);
create index on public.payments (person_id);
create index on public.payments (cash_session_id);

create table public.sepa_batches (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  kind text not null default 'fees',
  collection_date date not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'closed')),
  total_cents integer not null default 0,
  xml text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.sepa_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.sepa_batches (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id),
  person_id uuid not null references public.people (id),
  mandate_id text,
  iban_last4 text,
  amount_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'collected', 'returned')),
  return_reason text
);
create index on public.sepa_items (batch_id);
create index on public.sepa_items (invoice_id);
create index on public.sepa_items (person_id);

create table public.passes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  product_id uuid not null references public.products (id),
  uses_total smallint,
  uses_left smallint,
  valid_from date not null default current_date,
  valid_until date,
  nominal boolean not null default false,
  status text not null default 'active' check (status in ('active', 'used', 'expired')),
  invoice_id uuid references public.invoices (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.passes (person_id);
create index on public.passes (product_id);
create index on public.passes (invoice_id);
