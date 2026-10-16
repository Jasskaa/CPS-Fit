-- CPS Fit · secciones deportivas, eventos, comunicación, instalaciones y ajustes del club.
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  starts_on date not null,
  ends_on date not null,
  is_current boolean not null default false
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ca text not null,
  name_es text not null,
  description_ca text,
  description_es text,
  coordinator_person_id uuid references public.people (id) on delete set null,
  email text,
  color text,
  discount_pct numeric(4, 1) not null default 25,
  founded_year smallint,
  sort smallint not null default 0,
  active boolean not null default true
);
create index on public.sections (coordinator_person_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete cascade,
  name text not null,
  category text,
  gender text check (gender in ('m', 'f', 'mixed')),
  league text,
  coach_person_id uuid references public.people (id) on delete set null,
  training_notes text
);
create index on public.teams (section_id);
create index on public.teams (season_id);
create index on public.teams (coach_person_id);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  role text not null default 'player' check (role in ('player', 'coach', 'coordinator', 'staff')),
  shirt_number smallint,
  joined_on date not null default current_date,
  medical_ok boolean not null default false,
  photo_auth boolean not null default false,
  primary key (team_id, person_id)
);
create index on public.team_members (person_id);

create table public.team_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  kind text not null default 'training' check (kind in ('training', 'match', 'trip', 'other')),
  title text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  opponent text,
  is_home boolean,
  score_for smallint,
  score_against smallint,
  notes text
);
create index on public.team_events (team_id, starts_at);

create table public.team_attendance (
  event_id uuid not null references public.team_events (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  status text not null default 'unknown' check (status in ('unknown', 'yes', 'no', 'maybe', 'present', 'absent')),
  note text,
  primary key (event_id, person_id)
);
create index on public.team_attendance (person_id);

create table public.club_events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  kind text not null default 'event' check (kind in ('event', 'campus', 'course', 'race', 'casal')),
  title_ca text not null,
  title_es text,
  description_ca text,
  description_es text,
  location text,
  starts_on date not null,
  ends_on date,
  capacity integer,
  price_member_cents integer not null default 0,
  price_non_member_cents integer not null default 0,
  registration_open boolean not null default true,
  external_url text,
  section_id uuid references public.sections (id) on delete set null,
  published boolean not null default true
);
create index on public.club_events (section_id);

create table public.event_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.club_events (id) on delete cascade,
  name text not null,
  min_age smallint,
  max_age smallint,
  capacity integer,
  distance_km numeric(5, 1)
);
create index on public.event_categories (event_id);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.club_events (id) on delete cascade,
  category_id uuid references public.event_categories (id) on delete set null,
  person_id uuid not null references public.people (id) on delete cascade,
  status text not null default 'registered' check (status in ('registered', 'waitlist', 'cancelled')),
  bib integer,
  invoice_id uuid references public.invoices (id) on delete set null,
  result_seconds integer,
  result_position integer,
  created_at timestamptz not null default now(),
  unique (event_id, person_id)
);
create index on public.event_registrations (person_id);
create index on public.event_registrations (category_id);
create index on public.event_registrations (invoice_id);

create table public.news (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title_ca text not null,
  title_es text,
  excerpt_ca text,
  excerpt_es text,
  body_ca text,
  body_es text,
  cover_url text,
  category text not null default 'club',
  audience text not null default 'all',
  status text not null default 'published' check (status in ('draft', 'scheduled', 'published')),
  published_at timestamptz not null default now(),
  pinned boolean not null default false,
  author_id uuid references auth.users (id) on delete set null
);
create index on public.news (published_at desc);
create index on public.news (author_id);

alter table public.announcements add column if not exists audience text not null default 'all';
alter table public.announcements add column if not exists audience_ref uuid;
alter table public.audit_log add column if not exists detail jsonb;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  channel text not null default 'push' check (channel in ('push', 'email', 'sms')),
  title text not null,
  body text,
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (person_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'email' check (channel in ('whatsapp', 'email', 'app', 'phone')),
  category text not null default 'query' check (category in ('query', 'suggestion', 'incident')),
  person_id uuid references public.people (id) on delete set null,
  from_name text,
  from_contact text,
  subject text,
  body text not null,
  status text not null default 'new' check (status in ('new', 'open', 'closed')),
  assigned_to uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.messages (person_id);
create index on public.messages (assigned_to);
create index on public.messages (status, created_at desc);

create table public.message_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.message_replies (message_id);
create index on public.message_replies (author_id);

create table public.facility_tasks (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'incident' check (kind in ('incident', 'maintenance', 'task')),
  zone_id uuid references public.zones (id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  reported_by uuid references auth.users (id) on delete set null,
  assigned_to uuid references auth.users (id) on delete set null,
  due_on date,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index on public.facility_tasks (zone_id);
create index on public.facility_tasks (reported_by);
create index on public.facility_tasks (assigned_to);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references public.zones (id) on delete set null,
  name text not null,
  qty integer not null default 0,
  min_qty integer not null default 0,
  notes text
);
create index on public.inventory_items (zone_id);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  zone_id uuid references public.zones (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null
);
create index on public.shifts (user_id, starts_at);
create index on public.shifts (zone_id);

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  question_ca text not null,
  question_es text,
  options jsonb not null default '[]',
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  option_idx smallint not null,
  primary key (poll_id, person_id)
);
create index on public.poll_votes (person_id);

create table public.club_history (
  id uuid primary key default gen_random_uuid(),
  year smallint not null,
  title_ca text not null,
  title_es text,
  body_ca text,
  body_es text
);

create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  album text not null,
  caption text,
  url text not null,
  taken_on date,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public) values ('club-media', 'club-media', true) on conflict (id) do nothing;
