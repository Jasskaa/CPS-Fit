// Genera supabase/seed.sql (datos ficticios). Uso: node scripts/gen-seed.mjs
import { writeFileSync } from 'node:fs'
import { EXERCISES, TIPS } from './exercises-data.mjs'

const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const arr = (a) => `array[${a.map(q).join(',')}]::text[]`
const hex = (n, len = 12) => n.toString(16).padStart(len, '0')
const uid = (kind, n) => `${hex(kind, 8)}-0000-4000-8000-${hex(n)}`
let seed = 20261007
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = (a) => a[Math.floor(rnd() * a.length)]

const TIPS_ES = {
  Pit: ['Escápulas juntas y hacia abajo; pecho siempre alto.', 'Rebotar la barra en el pecho o abrir demasiado los codos.'],
  Esquena: ['Inicia el movimiento llevando las escápulas hacia atrás.', 'Balancear el tronco para ayudarse con impulso.'],
  Espatlles: ['Cuerpo estable y abdomen contraído; no arquear la lumbar.', 'Subir los hombros hacia las orejas.'],
  Bíceps: ['Codos fijos junto al cuerpo.', 'Hacer trampa con la espalda para subir más peso.'],
  Tríceps: ['Codos cerrados y fijos; solo se mueve el antebrazo.', 'Abrir los codos y perder tensión.'],
  Quàdriceps: ['Rodillas alineadas con la punta de los pies.', 'Dejar que las rodillas se junten al subir.'],
  Isquiotibials: ['Espalda neutra; el movimiento sale de la cadera.', 'Redondear la lumbar o bloquear las rodillas.'],
  Glutis: ['Contrae los glúteos arriba y pausa un segundo.', 'Hiperextensión lumbar al final.'],
  Panxells: ['Recorrido completo: baja hasta estirar y sube del todo.', 'Hacer rebotes cortos sin control.'],
  Abdomen: ['Respira y contrae el abdomen; no tires del cuello.', 'Tirar de la cabeza con las manos o dejar caer la lumbar.'],
  Cardio: ['Ritmo sostenible; mantén una postura recta.', 'Agarrarse con fuerza a las barras de la máquina.'],
  'Cos complet': ['Técnica antes que velocidad; peso moderado.', 'Perder la espalda neutra bajo fatiga.'],
}
const LEVEL = { b: 'beginner', i: 'intermediate', a: 'advanced' }

const out = []
const push = (s) => out.push(s)
push('-- Generado por scripts/gen-seed.mjs · DATOS FICTICIOS (prototipo CPS Fit)\n')

// ── Ejercicios
const exId = {}
EXERCISES.forEach((e, i) => { exId[e[0]] = uid(0xe0, i + 1) })
push('insert into public.exercises (id, slug, name_ca, name_es, primary_muscle, secondary_muscles, equipment, level, is_timed) values')
push(EXERCISES.map((e) => {
  const [slug, ca, es, m, sec, eq, lv, timed] = e
  return `(${q(exId[slug])},${q(slug)},${q(ca)},${q(es)},${q(m)},${arr(sec)},${q(eq)},${q(LEVEL[lv])},${timed ? 'true' : 'false'})`
}).join(',\n') + '\non conflict (slug) do nothing;\n')
push('-- Textos descriptivos por grupo muscular (editables por el monitor)')
push(`update public.exercises x set
  description_ca = 'Exercici de ' || lower(x.primary_muscle) || ' amb ' || lower(x.equipment) || '.',
  description_es = 'Ejercicio de ' || lower(x.primary_muscle) || ' con ' || lower(x.equipment) || '.',
  tips_ca = t.tc, tips_es = t.te, mistakes_ca = t.mc, mistakes_es = t.me
from (values
${Object.keys(TIPS).map((m) => `(${q(m)},${q(TIPS[m][0])},${q(TIPS_ES[m][0])},${q(TIPS[m][1])},${q(TIPS_ES[m][1])})`).join(',\n')}
) as t(muscle, tc, te, mc, me) where t.muscle = x.primary_muscle;
`)

// ── Usuarios demo (auth.users). Contraseña: Demo1234!
const PEOPLE = [
  { n: 1, role: 'admin', name: 'Marta Vilarrasa', email: 'admin@cpsfit.demo' },
  { n: 2, role: 'trainer', name: 'Jordi Puigdevall', email: 'monitor1@cpsfit.demo' },
  { n: 3, role: 'trainer', name: 'Anna Ferrer', email: 'monitor2@cpsfit.demo' },
]
const MEMBER_NAMES = ['Laia Serra', 'Pau Casadevall', 'Núria Costa', 'Marc Roura', 'Clara Soler', 'Oriol Vidal',
  'Berta Pons', 'Arnau Camps', 'Judit Mas', 'Biel Garriga', 'Carla Font', 'Sergi Danés']
MEMBER_NAMES.forEach((name, i) => {
  PEOPLE.push({ n: 10 + i, role: 'member', name, email: `soci${i + 1}@cpsfit.demo`, idx: i })
})
const pid = (p) => uid(0xa0, p.n)

push('-- Usuarios (auth). El trigger crea profiles + member_details. Contrasenya demo: Demo1234!')
push(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', v.id::uuid, 'authenticated', 'authenticated', v.email, crypt('Demo1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', v.name, 'locale', 'ca', 'consent', 'true'), now(), now(), '', '', '', ''
from (values
${PEOPLE.map((p) => `(${q(pid(p))},${q(p.email)},${q(p.name)})`).join(',\n')}
) as v(id, email, name) on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email', jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
from auth.users u where u.email like '%@cpsfit.demo' on conflict do nothing;`)
push('')

// ── Estado, roles, detalles, relación monitor-socio
const GOALS = ['Guanyar força', 'Perdre greix', 'Guanyar massa muscular', 'Millorar la salut', 'Tonificar', 'Preparar una cursa']
const LEVELS = ['beginner', 'intermediate', 'advanced']
const LIMITS = [null, null, 'Molèstia lleu al genoll dret', null, 'Hèrnia discal L5 (evitar càrrega axial alta)', null, null, 'Tendinitis a l\'espatlla esquerra', null, null, null, null]
push(`update public.profiles set role = 'admin', status = 'active' where email = 'admin@cpsfit.demo';
update public.profiles set role = 'trainer', status = 'active' where email like 'monitor%@cpsfit.demo';
update public.profiles set status = 'active' where email like 'soci%@cpsfit.demo';
update public.profiles set status = 'paused' where email = 'soci8@cpsfit.demo';
update public.profiles set status = 'pending' where email = 'soci11@cpsfit.demo';

update public.member_details d set
  goal = (array[${GOALS.map(q).join(',')}])[1 + (x.i % 6)],
  level = (array['beginner','intermediate','advanced'])[1 + (x.i % 3)]::public.level_kind,
  days_per_week = 2 + (x.i % 3),
  limitations = case x.i when 2 then ${q(LIMITS[2])} when 4 then ${q(LIMITS[4])} when 7 then ${q(LIMITS[7])} end,
  shares_photos = (x.i % 4 = 0),
  joined_at = current_date - (40 + x.i * 9)
from (select id, (substring(email from 'soci([0-9]+)@'))::int - 1 as i from public.profiles where email like 'soci%@cpsfit.demo') x
where d.member_id = x.id;

insert into public.trainer_members (trainer_id, member_id)
select (select id from public.profiles where email = case when x.i < 6 then 'monitor1@cpsfit.demo' else 'monitor2@cpsfit.demo' end), x.id
from (select id, (substring(email from 'soci([0-9]+)@'))::int - 1 as i from public.profiles where email like 'soci%@cpsfit.demo') x
on conflict do nothing;`)
push('')

// ── Plantillas del club
const TEMPLATES = [
  { key: 'fb3', name: 'Full body 3 dies', goal: 'Salut i força general', weeks: 6, desc: 'Tres sessions de cos complet per a qui comença o té poc temps.', days: [
    ['Dia A', [['esquat-goblet', 3, 8, 12, 90], ['press-banca-manuelles', 3, 8, 12, 90], ['rem-politja-baixa', 3, 10, 12, 75], ['planxa', 3, 30, 45, 45, 'timed']]],
    ['Dia B', [['premsa-cames', 3, 10, 12, 90], ['press-espatlles-manuelles', 3, 8, 12, 75], ['jalon-pit', 3, 10, 12, 75], ['pont-glutis-pes-corporal', 3, 12, 15, 60]]],
    ['Dia C', [['pes-mort-manuelles', 3, 8, 10, 90], ['press-pectoral-maquina', 3, 10, 12, 75], ['rem-maquina', 3, 10, 12, 75], ['crunch', 3, 12, 15, 45]]]] },
  { key: 'tc4', name: 'Torso/cames 4 dies', goal: 'Guany de massa muscular', weeks: 8, desc: 'Divisió torso/cames, dues vegades per setmana cada grup.', days: [
    ['Torso A', [['press-banca-barra', 4, 6, 10, 120], ['rem-barra', 4, 8, 10, 90], ['press-espatlles-manuelles', 3, 8, 12, 75], ['curl-manuelles', 3, 10, 12, 60], ['extensio-corda', 3, 10, 12, 60]]],
    ['Cames A', [['esquat-barra', 4, 6, 10, 150], ['pes-mort-romanes', 3, 8, 10, 120], ['extensio-quadriceps', 3, 12, 15, 60], ['panxells-dret', 4, 12, 15, 45]]],
    ['Torso B', [['press-banca-inclinat', 4, 8, 12, 90], ['jalon-pit', 4, 8, 12, 90], ['elevacions-laterals', 4, 12, 15, 45], ['curl-martell', 3, 10, 12, 60], ['press-frances', 3, 8, 12, 75]]],
    ['Cames B', [['premsa-cames', 4, 10, 12, 120], ['curl-femoral-assegut', 3, 10, 12, 75], ['zancades', 3, 10, 12, 75], ['pont-glutis', 3, 8, 12, 90], ['planxa', 3, 40, 60, 45, 'timed']]]] },
  { key: 'ini', name: 'Iniciació', goal: 'Aprendre els moviments bàsics', weeks: 4, desc: 'Primeres setmanes: màquines guiades i tècnica.', days: [
    ['Dia A', [['bici-estatica', 1, 10, 10, 0, 'timed'], ['premsa-cames', 2, 12, 15, 75], ['press-pectoral-maquina', 2, 12, 15, 75], ['rem-maquina', 2, 12, 15, 75], ['planxa', 2, 20, 30, 45, 'timed']]],
    ['Dia B', [['cinta-caminar', 1, 10, 10, 0, 'timed'], ['extensio-quadriceps', 2, 12, 15, 60], ['press-espatlles-maquina', 2, 12, 15, 75], ['jalon-pit', 2, 12, 15, 75], ['dead-bug', 2, 10, 12, 45]]]] },
  { key: 'fat', name: 'Pèrdua de greix', goal: 'Reduir % de greix', weeks: 8, desc: 'Força combinada amb cardio i circuits per augmentar la despesa.', days: [
    ['Circuit força', [['esquat-goblet', 3, 12, 15, 45], ['flexions', 3, 10, 15, 45], ['rem-manuella', 3, 12, 15, 45], ['kettlebell-swing', 3, 15, 20, 45], ['mountain-climbers', 3, 30, 40, 30, 'timed']]],
    ['Cardio + core', [['cinta-pendent', 1, 20, 20, 0, 'timed'], ['bicicleta-abdominal', 3, 15, 20, 30], ['planxa', 3, 40, 60, 30, 'timed'], ['elevacio-cames-terra', 3, 12, 15, 30]]],
    ['Circuit cames', [['zancades', 3, 12, 15, 45], ['pont-glutis-pes-corporal', 3, 15, 20, 45], ['pujada-banc', 3, 12, 15, 45], ['remo-ergometre', 1, 10, 10, 0, 'timed']]]] },
  { key: 'str', name: 'Guany de força', goal: 'Augmentar força màxima', weeks: 8, desc: 'Bàsics pesats amb pocs rèptis i descansos llargs.', days: [
    ['Esquat + empenta', [['esquat-barra', 5, 3, 5, 180], ['press-banca-barra', 5, 3, 5, 180], ['press-militar-barra', 3, 5, 6, 120], ['fons-paral·leles', 3, 6, 8, 90]]],
    ['Pes mort + estirada', [['pes-mort', 5, 3, 5, 180], ['dominades', 4, 5, 6, 120], ['rem-barra', 4, 5, 6, 120], ['curl-barra', 3, 6, 8, 75]]]] },
]
// Entradas: [slug, sets, repsMin, repsMax, rest, 'timed'?]; en timed repsMin = segundos (o minutos si es cardio)
const tplIds = {}
TEMPLATES.forEach((t, i) => { tplIds[t.key] = uid(0xb0, i + 1) })
push(`insert into public.routines (id, owner_id, created_by, name, description, goal, is_template, duration_weeks) values
${TEMPLATES.map((t) => `(${q(tplIds[t.key])},null,${q(pid(PEOPLE[1]))},${q(t.name)},${q(t.desc)},${q(t.goal)},true,${t.weeks})`).join(',\n')};`)
const rows = []
TEMPLATES.forEach((t) => t.days.forEach(([dname, items], di) => items.forEach((it, pi) => {
  const [slug, sets, a, b, rest, timed] = it
  const cardio = timed && a >= 10 && rest === 0
  rows.push(`(${q(tplIds[t.key])},${q(dname)},${di + 1},${q(slug)},${pi + 1},${sets},${timed ? 'null' : a},${timed ? 'null' : b},${timed ? (cardio ? a * 60 : a) : 'null'},${rest})`)
})))
push(`with t(tid, dname, dpos, slug, pos, sets, rmin, rmax, dur, rest) as (values
${rows.join(',\n')}
), days as (
  insert into public.routine_days (routine_id, position, name)
  select distinct tid::uuid, dpos::smallint, dname from t returning id, routine_id, position
)
insert into public.routine_exercises (day_id, exercise_id, position, sets, reps_min, reps_max, duration_sec, rest_sec)
select d.id, e.id, t.pos, t.sets, t.rmin, t.rmax, t.dur, t.rest
from t join days d on d.routine_id = t.tid::uuid and d.position = t.dpos
join public.exercises e on e.slug = t.slug;`)
push('')

// ── Rutinas de socios (copia de plantilla), asignaciones e historial
const PLAN = ['fb3', 'tc4', 'ini', 'fat', 'str', 'fb3', 'tc4', 'fat', 'fb3', 'str', 'ini', 'tc4']
const BASE = { Pit: 40, Esquena: 40, Espatlles: 14, Bíceps: 12, Tríceps: 20, Quàdriceps: 60, Isquiotibials: 50, Glutis: 50, Panxells: 40, Abdomen: 0, 'Cos complet': 16, Cardio: 0 }
const exByslug = Object.fromEntries(EXERCISES.map((e) => [e[0], e]))
const e1rm = (w, r) => w * (1 + r / 30)
const sess = [], sets = [], prs = [], meas = [], assigns = []
let sid = 1, setid = 1, prid = 1
push('-- Rutinas de socios (copia de plantilla) + asignaciones')
const MAP = PEOPLE.filter((x) => x.role === 'member').map((p) => {
  const tpl = TEMPLATES.find((t) => t.key === PLAN[p.idx])
  const trainer = PEOPLE[p.idx < 6 ? 1 : 2]
  return `(${q(uid(0xb1, p.idx + 1))},${q(pid(p))},${q(pid(trainer))},${q(tplIds[PLAN[p.idx]])},${p.idx === 10 ? 0 : 14 + p.idx * 3})`
})
push(`do $$
declare m record; nr uuid; d record; nd uuid; tw smallint;
begin
  for m in select * from (values
${MAP.join(',\n')}
  ) as v(routine_id, member_id, trainer_id, tpl_id, start_off) loop
    insert into public.routines (id, owner_id, created_by, name, description, goal, is_template, duration_weeks, parent_id)
    select m.routine_id::uuid, m.member_id::uuid, m.trainer_id::uuid, name, description, goal, false, duration_weeks, id from public.routines where id = m.tpl_id::uuid
    returning duration_weeks into tw;
    for d in select * from public.routine_days where routine_id = m.tpl_id::uuid order by position loop
      insert into public.routine_days (routine_id, position, name) values (m.routine_id::uuid, d.position, d.name) returning id into nd;
      insert into public.routine_exercises (day_id, exercise_id, position, sets, reps_min, reps_max, duration_sec, target_weight, rest_sec, rpe, set_type, notes)
      select nd, exercise_id, position, sets, reps_min, reps_max, duration_sec, target_weight, rest_sec, rpe, set_type, notes
      from public.routine_exercises where day_id = d.id;
    end loop;
    insert into public.routine_assignments (member_id, routine_id, assigned_by, start_date, end_date, status)
    values (m.member_id::uuid, m.routine_id::uuid, m.trainer_id::uuid, current_date - m.start_off, current_date - m.start_off + tw * 7, 'active');
  end loop;
end $$;
`)
push(`
-- Historial sintético (6 semanas) generado en SQL: sesiones, series, récords y medidas.
select setseed(0.42);
do $$
declare
  m record; d record; re record; sid uuid;
  n int := 0; factor numeric; perweek int; gap int; wk int; s int; days_ago int; k int;
  w numeric; r int; base numeric; ord int; day_ids uuid[]; hr int; dur int;
begin
  for m in
    select p.id, p.email, a.routine_id, row_number() over (order by p.email) - 1 as idx
    from public.profiles p join public.routine_assignments a on a.member_id = p.id
    where p.role = 'member' and p.status <> 'pending'
  loop
    factor := 0.6 + (m.idx % 5) * 0.18;
    perweek := case when m.email = 'soci8@cpsfit.demo' then 1 else 2 + (m.idx % 2) end;
    gap := case m.email when 'soci4@cpsfit.demo' then 12 when 'soci9@cpsfit.demo' then 9 else 0 end;
    select array_agg(id order by position) into day_ids from public.routine_days where routine_id = m.routine_id;
    ord := 0;
    for wk in reverse 5..0 loop
      for s in 0..perweek - 1 loop
        continue when random() < 0.12;
        days_ago := greatest(gap, wk * 7 + (s * 7) / perweek + (random() < 0.5)::int);
        continue when m.email = 'soci8@cpsfit.demo' and days_ago < 20;
        hr := 7 + floor(random() * 13)::int; dur := 45 + floor(random() * 25)::int;
        insert into public.workout_sessions (member_id, routine_id, day_id, day_name, started_at, ended_at)
        select m.id, m.routine_id, rd.id, rd.name,
               date_trunc('day', now()) - make_interval(days => days_ago) + make_interval(hours => hr),
               date_trunc('day', now()) - make_interval(days => days_ago) + make_interval(hours => hr, mins => dur)
        from public.routine_days rd where rd.id = day_ids[1 + (ord % array_length(day_ids, 1))]
        returning id into sid;
        ord := ord + 1; n := n + 1;
        for re in
          select e.*, x.primary_muscle, x.equipment from public.routine_exercises e
          join public.exercises x on x.id = e.exercise_id
          join public.workout_sessions ws on ws.day_id = e.day_id and ws.id = sid
          order by e.position
        loop
          base := case re.primary_muscle when 'Pit' then 40 when 'Esquena' then 40 when 'Espatlles' then 14 when 'Bíceps' then 12
                  when 'Tríceps' then 20 when 'Quàdriceps' then 60 when 'Isquiotibials' then 50 when 'Glutis' then 50
                  when 'Panxells' then 40 when 'Cos complet' then 16 else 0 end;
          if re.equipment in ('Pes corporal', 'Corda', 'Cinta de córrer', 'Bicicleta', 'El·líptica', 'Remo', 'Escales', 'Roda') then base := 0; end if;
          for k in 1..re.sets loop
            w := null; r := null;
            if re.duration_sec is null then
              r := re.reps_min + floor(random() * (re.reps_max - re.reps_min + 1))::int;
              if base > 0 then
                w := greatest(2.5, round(base * factor * (1 + (5 - wk) * 0.025) * (case when re.equipment = 'Manuelles' then 0.5 else 1 end) / 2.5) * 2.5);
              end if;
            end if;
            insert into public.workout_sets (session_id, exercise_id, set_index, weight, reps, duration_sec, completed)
            values (sid, re.exercise_id, k, w, r, re.duration_sec, true);
          end loop;
        end loop;
      end loop;
    end loop;
  end loop;
  raise notice 'sesiones demo: %', n;
end $$;

-- Sin sesiones en el futuro (si se genera a primera hora del día)
update public.workout_sessions set started_at = started_at - interval '1 day', ended_at = ended_at - interval '1 day' where ended_at > now() - interval '5 minutes';

insert into public.personal_records (member_id, exercise_id, kind, value, session_id, achieved_at)
select distinct on (ws.member_id, st.exercise_id) ws.member_id, st.exercise_id, 'e1rm',
       round(st.weight * (1 + st.reps / 30.0), 1), ws.id, ws.started_at
from public.workout_sets st join public.workout_sessions ws on ws.id = st.session_id
where st.weight is not null and st.reps is not null
order by ws.member_id, st.exercise_id, st.weight * (1 + st.reps / 30.0) desc;

insert into public.body_measurements (member_id, measured_at, weight_kg, body_fat_pct, waist_cm)
select p.id, current_date - (w * 7 + 1),
       round((58 + (i % 12) * 3.5 + (5 - w) * (case when i % 6 = 1 then -0.4 when i % 6 = 2 then 0.3 else -0.1 end))::numeric, 1),
       round((18 + (i % 6) * 2 + (5 - w) * (case when i % 6 = 1 then -0.2 else -0.05 end))::numeric, 1),
       round((78 + (i % 12) * 1.5 + (5 - w) * (case when i % 6 = 1 then -0.4 else -0.1 end))::numeric, 1)
from (select id, row_number() over (order by email) - 1 as i from public.profiles where role = 'member' and status <> 'pending') p,
     generate_series(0, 5) w;
`)

// ── Anuncios y comentarios
push(`
insert into public.announcements (title_ca, title_es, body_ca, body_es, starts_at, ends_at, pinned, created_by) values
('Horari especial per Tots Sants','Horario especial por Todos los Santos','El gimnàs obrirà de 08:00 a 14:00 l''1 de novembre.','El gimnasio abrirá de 08:00 a 14:00 el 1 de noviembre.', now() - interval '1 day', now() + interval '30 days', true, ${q(pid(PEOPLE[0]))}),
('Nova màquina de rem a la sala','Nueva máquina de remo en la sala','Ja tens disponible una màquina de rem nova a la zona de musculació.','Ya tienes disponible una máquina de remo nueva en la zona de musculación.', now() - interval '3 days', now() + interval '20 days', false, ${q(pid(PEOPLE[1]))}),
('Manteniment de la sauna','Mantenimiento de la sauna','La sauna estarà tancada dimarts per manteniment.','La sauna estará cerrada el martes por mantenimiento.', now(), now() + interval '6 days', false, ${q(pid(PEOPLE[0]))});
`)
const M = (i) => pid(PEOPLE[3 + i])
push(`insert into public.comments (member_id, author_id, routine_id, body, created_at) values
(${q(M(0))}, ${q(M(0))}, ${q(uid(0xb1, 1))}, 'Em fa mal una mica el genoll fent esquat goblet. Ho puc canviar?', now() - interval '2 days'),
(${q(M(0))}, ${q(pid(PEOPLE[1]))}, ${q(uid(0xb1, 1))}, 'Ho mirem! Prova la premsa amb menys recorregut aquesta setmana.', now() - interval '1 day'),
(${q(M(1))}, ${q(M(1))}, ${q(uid(0xb1, 2))}, 'Puc augmentar el pes al press banca?', now() - interval '3 hours'),
(${q(M(6))}, ${q(M(6))}, ${q(uid(0xb1, 7))}, 'Hi ha alternativa al rem amb barra? No ho trobo còmode.', now() - interval '5 hours');`)

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), out.join('\n') + '\n')
console.log('seed.sql OK:', out.join('\n').length, 'bytes;', sess.length, 'sessions;', sets.length, 'sets')
