-- CPS Fit · seed 05 · secciones deportivas, equipos 2026-27, calendarios y asistencia, y registro de accesos. FICTICIO.
select setseed(0.911);

-- Más niños en las familias existentes (para completar las plantillas de equipos)
do $$
declare h record; kid uuid; age int; n int := 0; fem text[] := array['Aina','Júlia','Queralt','Ona','Mia','Laia','Emma','Berta','Carla','Nora','Aitana','Clàudia'];
  masc text[] := array['Pau','Pol','Nil','Martí','Biel','Arnau','Marc','Èric','Roger','Jan','Hugo','Oriol','Gerard','Marcel'];
begin
  for h in select p.household_id, p.last_name, m.started_on from public.people p join public.memberships m on m.person_id = p.id
           where p.household_role = 'holder' and p.household_id is not null and m.status = 'active' and exists (select 1 from public.memberships mm join public.people pp on pp.id = mm.person_id where pp.household_id = p.household_id and mm.type_id = (select id from public.membership_types where code = 'familiar'))
           order by random() limit 38 loop
    for i in 1..(1 + floor(random() * 2)::int) loop
      age := 6 + floor(random() * 12);
      insert into public.people (first_name, last_name, birth_date, national_id, email, household_id, household_role, status, postal_code, consent_data, consent_at)
      values ((case when random() < 0.5 then fem else masc end)[1 + floor(random() * 12)::int], h.last_name, current_date - (age * 365 + floor(random() * 364))::int, 'DEMO-K' || lpad((1000 + n)::text, 5, '0'),
        null, h.household_id, 'child', 'active', '17857', true, now()) returning id into kid;
      insert into public.memberships (person_id, type_id, started_on, seniority_since, billable)
      select kid, t.id, h.started_on, h.started_on, age > 7 from public.membership_types t where t.code = case when age <= 7 then 'beneficiari' else 'adherit' end;
      insert into public.cards (person_id, number) values (kid, 'CPS-K' || lpad((1000 + n)::text, 5, '0'));
      n := n + 1;
    end loop;
  end loop;
  raise notice 'niños añadidos: %', n;
end $$;

-- Coordinador y entrenadora de demo
update public.sections set coordinator_person_id = (select id from public.people where email = 'coordinador@cpsfit.demo') where code = 'futbol';
update public.sections set coordinator_person_id = (select id from public.people where email = 'entrenador@cpsfit.demo') where code = 'basquet';

-- Equipos de la temporada 2026-27 (los de fútbol son los reales de la web; el resto, ejemplo)
insert into public.teams (section_id, season_id, name, category, gender, league)
select s.id, (select id from public.seasons where is_current), t.name, t.cat, t.g, t.league
from (values
  ('futbol', 'Sènior · Segona Catalana', 'sènior', 'm', 'Segona Catalana'),
  ('futbol', 'Sènior · Quarta Catalana', 'sènior', 'm', 'Quarta Catalana'),
  ('futbol', 'Cadet', 'cadet', 'm', 'Lliga cadet'),
  ('futbol', 'Infantil', 'infantil', 'm', 'Lliga infantil'),
  ('futbol', 'Aleví', 'aleví', 'm', 'Lliga aleví'),
  ('futbol', 'Benjamí', 'benjamí', 'm', 'Lliga benjamí'),
  ('futbol', 'Pre-benjamí', 'pre-benjamí', 'm', 'Lliga pre-benjamí'),
  ('basquet', 'Pre-mini', 'pre-mini', 'mixed', 'Lliga pre-mini'),
  ('basquet', 'Mini', 'mini', 'mixed', 'Lliga mini'),
  ('basquet', 'Infantil femení', 'infantil', 'f', 'Lliga infantil'),
  ('basquet', 'Infantil masculí', 'infantil', 'm', 'Lliga infantil'),
  ('basquet', 'Cadet femení', 'cadet', 'f', 'Lliga cadet'),
  ('basquet', 'Cadet masculí', 'cadet', 'm', 'Lliga cadet'),
  ('basquet', 'Sènior femení', 'sènior', 'f', 'Lliga sènior'),
  ('basquet', 'Sènior masculí', 'sènior', 'm', 'Lliga sènior'),
  ('natacio', 'Iniciació', 'iniciació', 'mixed', null),
  ('natacio', 'Pre-competició', 'pre-competició', 'mixed', 'Copa Pirineus'),
  ('natacio', 'Competició', 'competició', 'mixed', 'Challenge David Moner'),
  ('excursionisme', 'Grup d''excursionisme', 'adults', 'mixed', 'FEEC')
) as t(sec, name, cat, g, league) join public.sections s on s.code = t.sec;

-- Jugadores según edad (los niños de las familias) y sénior con adultos
do $$
declare tm record; lo int; hi int; n int;
begin
  for tm in select t.id, t.category, t.gender, s.code from public.teams t join public.sections s on s.id = t.section_id loop
    select case tm.category when 'pre-benjamí' then 5 when 'benjamí' then 8 when 'aleví' then 10 when 'infantil' then 12 when 'cadet' then 14 when 'pre-mini' then 6 when 'mini' then 9
                 when 'iniciació' then 6 when 'pre-competició' then 9 when 'competició' then 12 else 18 end,
           case tm.category when 'pre-benjamí' then 7 when 'benjamí' then 9 when 'aleví' then 11 when 'infantil' then 13 when 'cadet' then 17 when 'pre-mini' then 8 when 'mini' then 11
                 when 'iniciació' then 8 when 'pre-competició' then 11 when 'competició' then 17 else 55 end into lo, hi;
    n := case when tm.category in ('sènior') then 14 when tm.code = 'natacio' then 10 when tm.code = 'excursionisme' then 12 else 11 end;
    insert into public.team_members (team_id, person_id, role, shirt_number, medical_ok, photo_auth)
    select tm.id, p.id, 'player', (row_number() over ())::smallint, random() < 0.9, random() < 0.8
    from (select id from public.people p
          where p.status = 'active' and p.user_id is null and extract(year from age(p.birth_date)) between lo and hi
            and not exists (select 1 from public.team_members x where x.person_id = p.id and x.team_id in (select id from public.teams where section_id = (select section_id from public.teams where id = tm.id)))
          order by random() limit n) p
    on conflict do nothing;
  end loop;
end $$;

-- Entrenadores: adultos de la base como coach de cada equipo; el entrenador demo entrena el Cadet masculí de bàsquet.
update public.teams t set coach_person_id = (select id from public.people p where p.email = 'entrenador@cpsfit.demo') where t.name = 'Cadet masculí';
update public.teams t set coach_person_id = (select p.id from public.people p where p.status = 'active' and p.birth_date < current_date - 25 * 365 and p.user_id is null and not exists (select 1 from public.teams x where x.coach_person_id = p.id) order by random() limit 1)
where t.coach_person_id is null;
insert into public.team_members (team_id, person_id, role) select id, coach_person_id, 'coach' from public.teams where coach_person_id is not null on conflict do nothing;

-- Calendario: entrenos (2/semana, ±3 semanas) y partidos (4 jugados + 3 próximos)
insert into public.team_events (team_id, kind, title, starts_at, ends_at, location)
select t.id, 'training', 'Entrenament', (d::date + (case extract(dow from d)::int when 2 then time '18:00' when 4 then time '18:00' else time '17:30' end))::timestamp at time zone 'Europe/Madrid',
  (d::date + (case extract(dow from d)::int when 2 then time '19:30' when 4 then time '19:30' else time '19:00' end))::timestamp at time zone 'Europe/Madrid',
  case s.code when 'futbol' then 'Camp de futbol' when 'basquet' then 'Pavelló' when 'natacio' then 'Piscina' else 'Punt de trobada' end
from public.teams t join public.sections s on s.id = t.section_id
cross join generate_series(current_date - 21, current_date + 21, interval '1 day') d
where extract(dow from d)::int in (2, 4) and s.code <> 'excursionisme';

insert into public.team_events (team_id, kind, title, starts_at, ends_at, location, opponent, is_home, score_for, score_against)
select t.id, 'match', 'Partit de lliga', (x.d::date + time '11:00')::timestamp at time zone 'Europe/Madrid', (x.d::date + time '12:30')::timestamp at time zone 'Europe/Madrid',
  case when (n % 2 = 0) then 'Sant Joan les Fonts' else 'Camp visitant' end,
  (array['CF Olot B','Bàsquet Besalú','FC Banyoles','CE Girona Nord','Castellfollit','CF Santa Pau','UE Les Preses','CB Garrotxa'])[1 + (abs(hashtext(t.id::text || n::text)) % 8)],
  (n % 2 = 0), case when x.d < current_date then floor(random() * 5)::int end, case when x.d < current_date then floor(random() * 4)::int end
from public.teams t join public.sections s on s.id = t.section_id
cross join generate_series(1, 7) n
cross join lateral (select (current_date + ((n - 5) * 7 + ((13 - extract(dow from current_date)::int) % 7))) as d) x
where s.code in ('futbol', 'basquet');

-- Asistencia: entrenos pasados (presentes/ausentes) y próximos (convocatoria: sí/no/quizá/sin respuesta)
insert into public.team_attendance (event_id, person_id, status)
select e.id, tm.person_id,
  case when e.starts_at < now() then (case when random() < 0.82 then 'present' else 'absent' end)
       else (array['yes','yes','yes','no','maybe','unknown'])[1 + floor(random() * 6)::int] end
from public.team_events e join public.team_members tm on tm.team_id = e.team_id and tm.role = 'player';

-- Registro de accesos: últimos 7 días + hoy. Gimnàs (abonados), sauna (socios), pàdel (con reserva), y algunas denegaciones.
do $$
declare d date; z_gym uuid; z_sauna uuid; z_padel uuid; z_poli uuid; p record; at_ts timestamptz; k int; start_h numeric; lim int; reasons text[] := array['Quota pendent', 'Fora d''horari', 'Abonament caducat', 'Sense reserva', 'Targeta bloquejada'];
begin
  select id into z_gym from public.zones where code = 'gym'; select id into z_sauna from public.zones where code = 'sauna';
  select id into z_padel from public.zones where code = 'padel'; select id into z_poli from public.zones where code = 'poli';
  for d in select generate_series(current_date - 7, current_date, interval '1 day')::date loop
    lim := case when d = current_date then 14 else 24 + floor(random() * 10)::int end;
    for p in select ps.person_id from public.passes ps join public.products pr on pr.id = ps.product_id and pr.pass_kind = 'gym' where ps.status = 'active' order by random() limit lim loop
      start_h := 7 + random() * 13;
      at_ts := ((d + (floor(start_h)::int || ' hours')::interval + ((floor((start_h - floor(start_h)) * 60))::int || ' minutes')::interval)::timestamp) at time zone 'Europe/Madrid';
      if at_ts < now() - interval '5 minutes' then
        insert into public.access_logs (person_id, zone_id, direction, allowed, method, at) values (p.person_id, z_gym, 'in', true, 'qr', at_ts);
        if at_ts + interval '95 minutes' < now() then
          insert into public.access_logs (person_id, zone_id, direction, allowed, method, at) values (p.person_id, z_gym, 'out', true, 'qr', at_ts + ((50 + floor(random() * 60))::int || ' minutes')::interval);
        end if;
      end if;
    end loop;
    -- sauna
    lim := 3 + floor(random() * 5)::int;
    for p in select m.person_id from public.memberships m where m.status = 'active' order by random() limit lim loop
      at_ts := ((d + (case when random() < 0.5 then interval '10 hours' else interval '18 hours 15 minutes' end))::timestamp) at time zone 'Europe/Madrid' + (floor(random() * 40)::int || ' minutes')::interval;
      if at_ts < now() - interval '5 minutes' then
        insert into public.access_logs (person_id, zone_id, direction, allowed, method, at) values (p.person_id, z_sauna, 'in', true, 'qr', at_ts);
        if at_ts + interval '75 minutes' < now() then insert into public.access_logs (person_id, zone_id, direction, allowed, method, at) values (p.person_id, z_sauna, 'out', true, 'qr', at_ts + interval '55 minutes'); end if;
      end if;
    end loop;
    -- pàdel: llegan a su reserva
    for p in select b.person_id, b.starts_at from public.bookings b join public.resources r on r.id = b.resource_id and r.kind = 'padel'
             where b.kind = 'booking' and b.status = 'confirmed' and (b.starts_at at time zone 'Europe/Madrid')::date = d and b.starts_at < now() and b.person_id is not null loop
      insert into public.access_logs (person_id, zone_id, direction, allowed, method, at) values (p.person_id, z_padel, 'in', true, 'qr', p.starts_at - interval '8 minutes');
    end loop;
    -- denegaciones
    for k in 1..(2 + floor(random() * 4)::int) loop
      select id into p from public.people where status in ('active', 'paused') order by random() limit 1;
      at_ts := ((d + (floor(8 + random() * 12)::int || ' hours')::interval)::timestamp) at time zone 'Europe/Madrid';
      if at_ts < now() then insert into public.access_logs (person_id, zone_id, direction, allowed, reason, method, at)
        values (p.id, (array[z_gym, z_sauna, z_padel, z_poli])[1 + floor(random() * 4)::int], 'in', false, reasons[1 + floor(random() * 5)::int], 'qr', at_ts); end if;
    end loop;
  end loop;
end $$;

-- Aforo: refresca zone_presence para todas las zonas
insert into public.zone_presence (zone_id, present, updated_at)
select z.id, (select count(*) from (select distinct on (person_id) person_id, direction from public.access_logs where zone_id = z.id and person_id is not null and allowed and at > now() - interval '6 hours' order by person_id, at desc) t where direction = 'in'), now()
from public.zones z on conflict (zone_id) do update set present = excluded.present, updated_at = now();

select (select count(*) from people) people, (select count(*) from teams) teams, (select count(*) from team_members) tm, (select count(*) from team_events) ev,
       (select count(*) from access_logs) logs, (select string_agg(z.code || ':' || zp.present, ' ') from zone_presence zp join zones z on z.id = zp.zone_id where zp.present > 0) presence;
