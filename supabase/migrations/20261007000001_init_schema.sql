-- CPS Fit Â· esquema inicial (prototipo). Reproducible en cualquier proyecto Supabase.
-- DecisiÃ³n: las plantillas de rutina son filas de `routines` con is_template = true.

create schema if not exists private;

create type public.user_role as enum ('admin', 'trainer', 'member');
create type public.member_status as enum ('pending', 'active', 'paused', 'inactive');
create type public.level_kind as enum ('beginner', 'intermediate', 'advanced');
create type public.set_kind as enum ('normal', 'warmup', 'dropset', 'superset');
create type public.assign_status as enum ('active', 'completed', 'cancelled');

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€ Perfiles â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'member',
  full_name text not null default '',
  email text,
  locale text not null default 'ca' check (locale in ('ca', 'es')),
  units text not null default 'kg' check (units in ('kg', 'lb')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  status public.member_status not null default 'pending',
  consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.member_details (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  goal text,
  level public.level_kind not null default 'beginner',
  days_per_week smallint check (days_per_week between 1 and 7),
  limitations text,
  trainer_notes text,
  shares_photos boolean not null default false,
  joined_at date not null default current_date
);

create table public.trainer_members (
  trainer_id uuid not null references public.profiles (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trainer_id, member_id)
);
create index on public.trainer_members (member_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€ Funciones auxiliares (schema privado, no expuesto por la API) â”€â”€â”€â”€â”€â”€â”€â”€â”€
create function private.my_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() = 'admin', false)
$$;

create function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() in ('admin', 'trainer'), false)
$$;

-- Â¿Puede el usuario actual gestionar a este socio? (admin, o monitor asignado)
create function private.manages(member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_admin() or exists (
    select 1 from public.trainer_members tm
    where tm.member_id = member and tm.trainer_id = (select auth.uid())
  )
$$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€ Ejercicios â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_ca text not null,
  name_es text not null,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text not null default 'Pes corporal',
  description_ca text,
  description_es text,
  tips_ca text,
  tips_es text,
  mistakes_ca text,
  mistakes_es text,
  media_url text,
  level public.level_kind not null default 'beginner',
  tags text[] not null default '{}',
  is_timed boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.exercises (primary_muscle);
create index on public.exercises (created_by);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€ Rutinas â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete cascade, -- null = plantilla del club
  created_by uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  goal text,
  is_template boolean not null default false,
  duration_weeks smallint check (duration_weeks between 1 and 52),
  version integer not null default 1,
  parent_id uuid references public.routines (id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.routines (owner_id);
create index on public.routines (created_by);
create index on public.routines (parent_id);

create table public.routine_days (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  position smallint not null,
  name text not null
);
create index on public.routine_days (routine_id);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.routine_days (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position smallint not null,
  sets smallint not null default 3 check (sets between 1 and 20),
  reps_min smallint,
  reps_max smallint,
  duration_sec integer,
  target_weight numeric(6, 2),
  rest_sec smallint not null default 60,
  rpe numeric(3, 1) check (rpe between 1 and 10),
  set_type public.set_kind not null default 'normal',
  superset_group smallint,
  notes text
);
create index on public.routine_exercises (day_id);
create index on public.routine_exercises (exercise_id);

create table public.routine_assignments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  assigned_by uuid not null references public.profiles (id) on delete cascade,
  start_date date not null default current_date,
  end_date date,
  status public.assign_status not null default 'active',
  created_at timestamptz not null default now()
);
create index on public.routine_assignments (member_id, status);
create index on public.routine_assignments (routine_id);
create index on public.routine_assignments (assigned_by);

-- Lectura/escritura de rutinas (usadas tambiÃ©n por dÃ­as y ejercicios de rutina)
create function private.can_read_routine(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.routines r
    where r.id = rid and (
      r.owner_id = (select auth.uid())
      or r.created_by = (select auth.uid())
      or private.is_admin()
      or (r.owner_id is not null and private.manages(r.owner_id))
      or (r.is_template and private.is_staff())
      or exists (select 1 from public.routine_assignments a
                 where a.routine_id = r.id and a.member_id = (select auth.uid()))
    )
  )
$$;

create function private.can_write_routine(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.routines r
    where r.id = rid and (
      r.owner_id = (select auth.uid())
      or private.is_admin()
      or (r.owner_id is not null and private.manages(r.owner_id))
      or (r.owner_id is null and r.created_by = (select auth.uid()))
    )
  )
$$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€ Entrenos â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  routine_id uuid references public.routines (id) on delete set null,
  day_id uuid references public.routine_days (id) on delete set null,
  day_name text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.workout_sessions (member_id, started_at desc);
create index on public.workout_sessions (routine_id);
create index on public.workout_sessions (day_id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  set_index smallint not null,
  set_type public.set_kind not null default 'normal',
  weight numeric(6, 2),
  reps smallint,
  duration_sec integer,
  rpe numeric(3, 1),
  completed boolean not null default true
);
create index on public.workout_sets (session_id);
create index on public.workout_sets (exercise_id);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  kind text not null check (kind in ('weight', 'reps', 'volume', 'e1rm')),
  value numeric(8, 2) not null,
  session_id uuid references public.workout_sessions (id) on delete set null,
  achieved_at timestamptz not null default now()
);
create index on public.personal_records (member_id, exercise_id);
create index on public.personal_records (exercise_id);
create index on public.personal_records (session_id);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  measured_at date not null default current_date,
  weight_kg numeric(5, 2),
  body_fat_pct numeric(4, 1),
  waist_cm numeric(5, 1),
  chest_cm numeric(5, 1),
  hip_cm numeric(5, 1),
  arm_cm numeric(5, 1),
  thigh_cm numeric(5, 1)
);
create index on public.body_measurements (member_id, measured_at desc);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null,
  taken_at date not null default current_date,
  created_at timestamptz not null default now()
);
create index on public.progress_photos (member_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€ Comentarios, anuncios, auditorÃ­a â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade, -- hilo del socio
  author_id uuid not null references public.profiles (id) on delete cascade,
  routine_exercise_id uuid references public.routine_exercises (id) on delete set null,
  routine_id uuid references public.routines (id) on delete set null,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.comments (member_id, created_at desc);
create index on public.comments (author_id);
create index on public.comments (routine_exercise_id);
create index on public.comments (routine_id);
create index on public.comments (parent_id);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title_ca text not null,
  title_es text,
  body_ca text,
  body_es text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  pinned boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.announcements (created_by);

-- Sin datos sensibles: solo quÃ© se hizo, quiÃ©n y sobre quÃ© entidad.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  at timestamptz not null default now()
);
create index on public.audit_log (actor_id);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€ Triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Alta de perfil al crear usuario en auth.users (siempre 'member' pendiente).
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, locale, consent_at)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'locale' = 'es' then 'es' else 'ca' end,
    case when new.raw_user_meta_data ->> 'consent' = 'true' then now() end
  );
  insert into public.member_details (member_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Evita escalada de privilegios: solo un admin cambia role; admin/monitor del socio cambian status.
create function private.guard_profile_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return new; end if; -- service_role / migraciones
  if new.role is distinct from old.role and not private.is_admin() then
    raise exception 'role_change_forbidden';
  end if;
  if new.status is distinct from old.status and not private.manages(old.id) then
    raise exception 'status_change_forbidden';
  end if;
  return new;
end $$;

create trigger guard_profile_update
  before update on public.profiles
  for each row execute function private.guard_profile_update();

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger routines_touch before update on public.routines
  for each row execute function private.touch_updated_at();

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€ RLS â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table public.profiles enable row level security;
alter table public.member_details enable row level security;
alter table public.trainer_members enable row level security;
alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_days enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.routine_assignments enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;
alter table public.personal_records enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.comments enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_log enable row level security;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.manages(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or private.manages(id))
  with check (id = (select auth.uid()) or private.manages(id));
create policy profiles_delete on public.profiles for delete to authenticated
  using (id = (select auth.uid()) or private.is_admin());

-- member_details
create policy md_select on public.member_details for select to authenticated
  using (member_id = (select auth.uid()) or private.manages(member_id));
create policy md_write on public.member_details for all to authenticated
  using (member_id = (select auth.uid()) or private.manages(member_id))
  with check (member_id = (select auth.uid()) or private.manages(member_id));

-- trainer_members
create policy tm_select on public.trainer_members for select to authenticated
  using (trainer_id = (select auth.uid()) or member_id = (select auth.uid()) or private.is_admin());
create policy tm_insert on public.trainer_members for insert to authenticated
  with check (private.is_admin() or (trainer_id = (select auth.uid()) and private.is_staff()));
create policy tm_delete on public.trainer_members for delete to authenticated
  using (private.is_admin() or trainer_id = (select auth.uid()));

-- exercises: lectura para todos, escritura monitor/admin
create policy ex_select on public.exercises for select to authenticated using (true);
create policy ex_insert on public.exercises for insert to authenticated with check (private.is_staff());
create policy ex_update on public.exercises for update to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy ex_delete on public.exercises for delete to authenticated using (private.is_staff());

-- routines
create policy routines_select on public.routines for select to authenticated
  using (private.can_read_routine(id));
create policy routines_insert on public.routines for insert to authenticated
  with check (
    created_by = (select auth.uid()) and (
      owner_id = (select auth.uid())
      or (owner_id is null and private.is_staff())
      or (owner_id is not null and private.manages(owner_id))
    )
  );
create policy routines_update on public.routines for update to authenticated
  using (private.can_write_routine(id)) with check (private.can_write_routine(id));
create policy routines_delete on public.routines for delete to authenticated
  using (private.can_write_routine(id));

-- routine_days / routine_exercises
create policy rd_select on public.routine_days for select to authenticated
  using (private.can_read_routine(routine_id));
create policy rd_write on public.routine_days for all to authenticated
  using (private.can_write_routine(routine_id)) with check (private.can_write_routine(routine_id));

create policy re_select on public.routine_exercises for select to authenticated
  using (private.can_read_routine((select d.routine_id from public.routine_days d where d.id = day_id)));
create policy re_write on public.routine_exercises for all to authenticated
  using (private.can_write_routine((select d.routine_id from public.routine_days d where d.id = day_id)))
  with check (private.can_write_routine((select d.routine_id from public.routine_days d where d.id = day_id)));

-- routine_assignments
create policy ra_select on public.routine_assignments for select to authenticated
  using (member_id = (select auth.uid()) or private.manages(member_id));
create policy ra_insert on public.routine_assignments for insert to authenticated
  with check (
    assigned_by = (select auth.uid()) and (
      private.manages(member_id)
      or (member_id = (select auth.uid()) and private.can_write_routine(routine_id))
    )
  );
create policy ra_update on public.routine_assignments for update to authenticated
  using (member_id = (select auth.uid()) or private.manages(member_id))
  with check (member_id = (select auth.uid()) or private.manages(member_id));
create policy ra_delete on public.routine_assignments for delete to authenticated
  using (private.manages(member_id));

-- workout_sessions / sets: el socio escribe lo suyo; el monitor solo lee
create policy ws_select on public.workout_sessions for select to authenticated
  using (member_id = (select auth.uid()) or private.manages(member_id));
create policy ws_write on public.workout_sessions for all to authenticated
  using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()));

create policy wset_select on public.workout_sets for select to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id
                 and (s.member_id = (select auth.uid()) or private.manages(s.member_id))));
create policy wset_write on public.workout_sets for all to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id
                 and s.member_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_sessions s where s.id = session_id
                      and s.member_id = (select auth.uid())));

-- personal_records, body_measurements
create policy pr_select on public.personal_records for select to authenticated
  using (member_id = (select auth.uid()) or private.manages(member_id));
create policy pr_write on public.personal_records for all to authenticated
  using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()));

create policy bm_select on public.body_measurements for select to authenticated
  using (member_id = (select auth.uid()) or private.manages(member_id));
create policy bm_write on public.body_measurements for all to authenticated
  using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()));

-- progress_photos: privadas; el monitor solo ve si el socio las comparte
create policy pp_select on public.progress_photos for select to authenticated
  using (
    member_id = (select auth.uid())
    or (private.manages(member_id) and exists (
          select 1 from public.member_details d where d.member_id = progress_photos.member_id and d.shares_photos))
  );
create policy pp_write on public.progress_photos for all to authenticated
  using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()));

-- comments
create policy cm_select on public.comments for select to authenticated
  using (member_id = (select auth.uid()) or private.manages(member_id));
create policy cm_insert on public.comments for insert to authenticated
  with check (author_id = (select auth.uid())
              and (member_id = (select auth.uid()) or private.manages(member_id)));
create policy cm_update on public.comments for update to authenticated
  using (author_id = (select auth.uid()) or private.manages(member_id))
  with check (author_id = (select auth.uid()) or private.manages(member_id));
create policy cm_delete on public.comments for delete to authenticated
  using (author_id = (select auth.uid()));

-- announcements: todos leen los vigentes; monitor/admin gestionan
create policy an_select on public.announcements for select to authenticated
  using (private.is_staff() or (starts_at <= now() and (ends_at is null or ends_at >= now())));
create policy an_insert on public.announcements for insert to authenticated with check (private.is_staff());
create policy an_update on public.announcements for update to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy an_delete on public.announcements for delete to authenticated using (private.is_staff());

-- audit_log: solo lectura admin (las escrituras van con service_role desde el servidor)
create policy al_select on public.audit_log for select to authenticated using (private.is_admin());

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€ Storage â”€â”€â”€â”€â”€â”€â”€â”€â”€
insert into storage.buckets (id, name, public) values
  ('exercise-media', 'exercise-media', true),
  ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy "exercise media write" on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-media' and private.is_staff());
create policy "exercise media update" on storage.objects for update to authenticated
  using (bucket_id = 'exercise-media' and private.is_staff());
create policy "exercise media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-media' and private.is_staff());

create policy "photos own rw" on storage.objects for all to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
