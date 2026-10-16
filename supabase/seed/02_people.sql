-- CPS Fit · seed 02 · personas, familias, cuotas, carnets, cuentas bancarias y abonos. TODO FICTICIO (DNI/IBAN/teléfonos inventados).
select setseed(0.314);

create temp sequence card_seq start 1;

create function pg_temp.pick(a text[]) returns text language sql as $$ select a[1 + floor(random() * array_length(a, 1))::int] $$;

-- IBAN español con dígitos de control válidos (datos ficticios, bancos y cuentas inventados).
create function pg_temp.fake_iban(n int) returns text language plpgsql as $$
declare bban text := '2100' || lpad(((n * 37) % 9000 + 1000)::text, 4, '0') || '00' || lpad((n * 7919 % 10000000000)::text, 10, '0'); chk int;
begin
  chk := 98 - (((bban || '142800')::numeric) % 97)::int;
  return 'ES' || lpad(chk::text, 2, '0') || bban;
end $$;

create function pg_temp.mkperson(p_first text, p_last text, p_age double precision, p_hh uuid, p_role text, p_status text default 'active') returns uuid language plpgsql as $$
declare pid uuid; n int := nextval('card_seq');
begin
  insert into public.people (first_name, last_name, birth_date, national_id, email, phone, household_id, household_role, status, address, postal_code, consent_data, consent_at, marketing_ok)
  values (p_first, p_last, current_date - (p_age * 365 + floor(random() * 364))::int, 'DEMO-' || lpad(n::text, 6, '0'),
    lower(translate(p_first || '.' || split_part(p_last, ' ', 1), 'àáèéíïòóúüçÀÈÉÍÒÓÚ ', 'aaeeiioouucaeeioou')) || n || '@exemple.cat',
    '600 00' || lpad((n % 100)::text, 2, '0') || ' ' || lpad(((n * 13) % 1000)::text, 3, '0'),
    p_hh, p_role, p_status::public.person_status, null, '17857', true, now() - (random() * 700 || ' days')::interval, random() < 0.4)
  returning id into pid;
  return pid;
end $$;

create function pg_temp.mkmember(p_person uuid, p_type text, p_since date, p_billable boolean default true, p_status text default 'active') returns void language plpgsql as $$
begin
  insert into public.memberships (person_id, type_id, status, started_on, seniority_since, billable, ended_on)
  select p_person, t.id, p_status::public.membership_status, p_since, p_since, p_billable, case when p_status = 'ended' then current_date - 120 end
  from public.membership_types t where t.code = p_type;
end $$;

create function pg_temp.mkhh(p_name text, p_ok boolean default true) returns uuid language plpgsql as $$
declare hid uuid;
begin
  insert into public.households (name, address, postal_code, empadronament_ok)
  values (p_name, pg_temp.pick(array['C/ Major','C/ del Pont','Av. Catalunya','Pg. de la Fageda','C/ Sant Roc','C/ Ter','C/ Paperera Torras','C/ de la Font','Camí del Riu','C/ Girona']) || ', ' || (1 + floor(random() * 60))::int, '17857', p_ok)
  returning id into hid;
  return hid;
end $$;

do $$
declare
  fem text[] := array['Marta','Laia','Núria','Anna','Clara','Berta','Júlia','Carla','Mireia','Montserrat','Roser','Queralt','Aina','Neus','Paula','Sílvia','Judit','Gemma','Marina','Carme','Pilar','Mercè','Cristina','Emma','Sara','Irene','Elisabet','Sandra'];
  masc text[] := array['Pau','Marc','Jordi','Oriol','Arnau','Biel','Sergi','Joan','Pere','Ferran','Albert','Xavier','Ramon','Josep','Jaume','Martí','Roger','Èric','Àlex','Genís','Quim','David','Isaac','Lluís','Miquel','Toni','Rafel','Andreu'];
  sur text[] := array['Serra','Casadevall','Costa','Roura','Soler','Vidal','Pons','Camps','Mas','Garriga','Font','Danés','Puigdevall','Ferrer','Vila','Ribas','Prat','Colomer','Planas','Sala','Bosch','Pujol','Camprubí','Bofill','Gironès','Teixidor','Domènech','Rovira','Sunyer','Figueras','Oliveras','Cabrera','Martínez','García','López','Fernández','Sánchez','Aymerich','Juanola','Masó'];
  i int; k int; hh uuid; a uuid; b uuid; kid uuid; s text; s2 text; age double precision; kids int; since date; female boolean; typ text;
begin
  -- Cuentas con login → personas (los 15 usuarios demo ya existen en profiles)
  insert into public.people (user_id, first_name, last_name, email, locale, status, consent_data, consent_at, tags)
  select p.id, split_part(p.full_name, ' ', 1), trim(substr(p.full_name, length(split_part(p.full_name, ' ', 1)) + 1)), p.email, p.locale, 'active', true, now(),
    case when p.role in ('admin', 'trainer') then '{staff}'::text[] else '{}'::text[] end
  from public.profiles p where not exists (select 1 from public.people x where x.user_id = p.id);

  -- Nuevas cuentas demo por rol (contraseña Demo1234!)
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  select '00000000-0000-0000-0000-000000000000', v.id::uuid, 'authenticated', 'authenticated', v.email, crypt('Demo1234!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v.name, 'locale', 'ca', 'consent', 'true'), now(), now(), '', '', '', ''
  from (values
    ('000000a0-0000-4000-8000-000000000101', 'junta@cpsfit.demo', 'Pere Vila'),
    ('000000a0-0000-4000-8000-000000000102', 'recepcio@cpsfit.demo', 'Marta Ribas'),
    ('000000a0-0000-4000-8000-000000000103', 'coordinador@cpsfit.demo', 'Coordinador Futbol'),
    ('000000a0-0000-4000-8000-000000000104', 'entrenador@cpsfit.demo', 'Ferran Entrenador'),
    ('000000a0-0000-4000-8000-000000000105', 'client@cpsfit.demo', 'Carles Client')) as v(id, email, name)
  on conflict (id) do nothing;
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text, 'email', jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
  from auth.users u where u.email in ('junta@cpsfit.demo', 'recepcio@cpsfit.demo', 'coordinador@cpsfit.demo', 'entrenador@cpsfit.demo', 'client@cpsfit.demo') on conflict do nothing;
  update public.profiles set role = 'board', status = 'active' where email = 'junta@cpsfit.demo';
  update public.profiles set role = 'reception', status = 'active' where email = 'recepcio@cpsfit.demo';
  update public.profiles set role = 'coordinator', status = 'active' where email = 'coordinador@cpsfit.demo';
  update public.profiles set role = 'coach', status = 'active' where email = 'entrenador@cpsfit.demo';
  update public.profiles set status = 'active' where email = 'client@cpsfit.demo';
  update public.people set status = 'active', tags = '{staff}' where email in ('junta@cpsfit.demo', 'recepcio@cpsfit.demo', 'coordinador@cpsfit.demo', 'entrenador@cpsfit.demo');
  update public.people set status = 'active', tags = '{client}' where email = 'client@cpsfit.demo';
  update public.people set birth_date = date '1980-05-14' where birth_date is null and user_id is not null;

  -- Familia demo con login: Laia Serra (soci1) + pareja + 2 hijos
  hh := pg_temp.mkhh('Pons Serra');
  select id into a from public.people where email = 'soci1@cpsfit.demo';
  update public.people set household_id = hh, household_role = 'holder', birth_date = current_date - 38 * 365 - 120 where id = a;
  b := pg_temp.mkperson('Ramon', 'Pons Teixidor', 40, hh, 'partner');
  perform pg_temp.mkmember(a, 'familiar', date '2016-03-12', true);
  perform pg_temp.mkmember(b, 'familiar', date '2016-03-12', false);
  kid := pg_temp.mkperson('Ona', 'Pons Serra', 12, hh, 'child'); perform pg_temp.mkmember(kid, 'adherit', date '2020-09-01', true);
  kid := pg_temp.mkperson('Pol', 'Pons Serra', 6, hh, 'child'); perform pg_temp.mkmember(kid, 'beneficiari', date '2021-01-10', false);

  -- Pareja con dos cuentas: Núria Costa (soci3) y Marc Roura (soci4)
  hh := pg_temp.mkhh('Costa Roura');
  select id into a from public.people where email = 'soci3@cpsfit.demo';
  select id into b from public.people where email = 'soci4@cpsfit.demo';
  update public.people set household_id = hh, household_role = 'holder', birth_date = current_date - 33 * 365 where id = a;
  update public.people set household_id = hh, household_role = 'partner', birth_date = current_date - 35 * 365 where id = b;
  perform pg_temp.mkmember(a, 'familiar', date '2019-06-01', true);
  perform pg_temp.mkmember(b, 'familiar', date '2019-06-01', false);

  -- Resto de cuentas con gimnàs
  for s, typ, age, since in
    select * from (values
      ('soci2@cpsfit.demo', 'individual', 34, date '2018-02-01'), ('soci5@cpsfit.demo', 'jove', 22, date '2022-09-15'),
      ('soci6@cpsfit.demo', 'individual', 41, date '2014-05-20'), ('soci7@cpsfit.demo', 'individual', 29, date '2021-10-01'),
      ('soci9@cpsfit.demo', 'jubilat_individual', 68, date '2009-01-15'), ('soci10@cpsfit.demo', 'individual', 52, date '2012-11-05'),
      ('soci12@cpsfit.demo', 'individual', 47, date '2017-04-04')) v(e, t, a, d)
  loop
    select id into a from public.people where email = s;
    hh := pg_temp.mkhh((select last_name from public.people where id = a));
    update public.people set household_id = hh, household_role = 'holder', birth_date = current_date - (age * 365 + 100)::int where id = a;
    perform pg_temp.mkmember(a, typ, since, true);
  end loop;
  select id into a from public.people where email = 'soci8@cpsfit.demo';
  hh := pg_temp.mkhh('Camps'); update public.people set household_id = hh, household_role = 'holder', status = 'paused', birth_date = current_date - 36 * 365 where id = a;
  perform pg_temp.mkmember(a, 'individual', date '2020-01-10', true, 'paused');
  select id into a from public.people where email = 'soci11@cpsfit.demo';
  hh := pg_temp.mkhh('Font', false); update public.people set household_id = hh, household_role = 'holder', status = 'prospect', birth_date = current_date - 31 * 365 where id = a;
  perform pg_temp.mkmember(a, 'individual', current_date - 3, true, 'pending');

  -- Familias con hijos (16)
  for i in 1..16 loop
    s := pg_temp.pick(sur); s2 := pg_temp.pick(sur);
    hh := pg_temp.mkhh(s || ' ' || s2, i <> 16);
    female := random() < 0.5;
    a := pg_temp.mkperson(pg_temp.pick(case when female then fem else masc end), s || ' ' || s2, 34 + random() * 14, hh, 'holder');
    b := pg_temp.mkperson(pg_temp.pick(case when female then masc else fem end), pg_temp.pick(sur) || ' ' || s, 33 + random() * 16, hh, 'partner');
    since := current_date - (200 + floor(random() * 3800))::int;
    if i >= 14 then since := current_date - (30 + floor(random() * 250))::int; end if;  -- altas recientes (pagan cuota de entrada)
    perform pg_temp.mkmember(a, 'familiar', since, true, case when i = 16 then 'pending' else 'active' end);
    perform pg_temp.mkmember(b, 'familiar', since, false, case when i = 16 then 'pending' else 'active' end);
    update public.memberships set entry_fee_due = (since > current_date - 400) where person_id in (a, b);
    kids := 1 + floor(random() * 3);
    for k in 1..kids loop
      age := 1 + floor(random() * 17);
      kid := pg_temp.mkperson(pg_temp.pick(case when random() < 0.5 then fem else masc end), s || ' ' || s2, age, hh, 'child');
      perform pg_temp.mkmember(kid, case when age <= 7 then 'beneficiari' else 'adherit' end, since, age > 7, case when i = 16 then 'pending' else 'active' end);
    end loop;
  end loop;

  -- Parejas sin hijos en casa (9) y jubilados (3 parejas)
  for i in 1..12 loop
    s := pg_temp.pick(sur); hh := pg_temp.mkhh(s);
    age := case when i <= 9 then 30 + random() * 30 else 66 + random() * 12 end;
    since := case when i <= 9 then current_date - (300 + floor(random() * 4000))::int else current_date - (4000 + floor(random() * 6000))::int end;
    a := pg_temp.mkperson(pg_temp.pick(fem), pg_temp.pick(sur) || ' ' || s, age, hh, 'holder');
    b := pg_temp.mkperson(pg_temp.pick(masc), s || ' ' || pg_temp.pick(sur), age + 2, hh, 'partner');
    perform pg_temp.mkmember(a, case when i <= 9 then 'familiar' else 'jubilat_familiar' end, since, true);
    perform pg_temp.mkmember(b, case when i <= 9 then 'familiar' else 'jubilat_familiar' end, since, false);
  end loop;

  -- Individuales (14), jubilados (4), jóvenes (7)
  for i in 1..25 loop
    s := pg_temp.pick(sur); hh := pg_temp.mkhh(s);
    typ := case when i <= 14 then 'individual' when i <= 18 then 'jubilat_individual' else 'jove' end;
    age := case typ when 'individual' then 24 + random() * 40 when 'jubilat_individual' then 66 + random() * 14 else 18 + random() * 5 end;
    since := case typ when 'jubilat_individual' then current_date - (4000 + floor(random() * 6000))::int else current_date - (60 + floor(random() * 3600))::int end;
    a := pg_temp.mkperson(pg_temp.pick(case when random() < 0.5 then fem else masc end), s || ' ' || pg_temp.pick(sur), age, hh, 'holder');
    perform pg_temp.mkmember(a, typ, since, true);
  end loop;

  -- Bajas (5) y pausas (3)
  for i in 1..8 loop
    s := pg_temp.pick(sur); hh := pg_temp.mkhh(s);
    a := pg_temp.mkperson(pg_temp.pick(case when random() < 0.5 then fem else masc end), s || ' ' || pg_temp.pick(sur), 25 + random() * 35, hh, 'holder', case when i <= 5 then 'left' else 'paused' end);
    perform pg_temp.mkmember(a, 'individual', current_date - (900 + floor(random() * 1500))::int, true, case when i <= 5 then 'ended' else 'paused' end);
  end loop;

  -- Clientes no socios (10)
  for i in 1..10 loop
    s := pg_temp.pick(sur);
    a := pg_temp.mkperson(pg_temp.pick(case when random() < 0.5 then fem else masc end), s || ' ' || pg_temp.pick(sur), 18 + random() * 45, null, 'other');
    update public.people set tags = '{client}' where id = a;
  end loop;
end $$;

-- Hogar del cliente demo (cuenta client@) sin cuota
update public.people set birth_date = current_date - 37 * 365 where email = 'client@cpsfit.demo';

-- Carnets (targeta d'usuari) para socios, personal y clientes con tarjeta
insert into public.cards (person_id, number)
select p.id, 'CPS-' || lpad(nextval('card_seq')::text, 6, '0')
from public.people p
where p.status <> 'left'
order by p.created_at, p.id;
update public.cards set status = 'lost' where id in (select id from public.cards order by random() limit 2);
update public.cards set status = 'blocked' where id in (select id from public.cards where status = 'active' order by random() limit 1);

-- Domiciliación (SEPA): una cuenta por titular facturable con cuota
insert into public.bank_accounts (person_id, iban, holder_name, mandate_id, mandate_signed_on)
select m.person_id, pg_temp.fake_iban((row_number() over (order by p.created_at, p.id))::int), p.first_name || ' ' || p.last_name,
  'CPS-M-' || lpad((row_number() over (order by p.created_at, p.id))::text, 5, '0'), m.started_on
from public.memberships m join public.people p on p.id = m.person_id join public.membership_types t on t.id = m.type_id
where m.billable and t.annual_fee_cents > 0 and m.status in ('active', 'paused');

-- Abonos de gimnàs vigentes (11 €/mes · 30 €/trimestre para socios) para los socios con gimnàs
insert into public.passes (person_id, product_id, valid_from, valid_until, nominal, status)
select p.id, pr.id, current_date - (5 + (row_number() over (order by p.id) % 20))::int, current_date + (10 + (row_number() over (order by p.id) % 60))::int, true, 'active'
from public.people p
join public.products pr on pr.code = case when (right(p.id::text, 1) in ('0','1','2','3','4','5','6','7')) then 'gym_month' else 'gym_quarter' end
where p.user_id is not null and p.email like 'soci%@cpsfit.demo' and p.email <> 'soci11@cpsfit.demo';

-- Abono mensual de gimnàs para ~25 socios más
insert into public.passes (person_id, product_id, valid_from, valid_until, nominal, status)
select m.person_id, pr.id, current_date - 8, current_date + 22, true, 'active'
from (select m.person_id from public.memberships m join public.people p on p.id = m.person_id
      where m.status = 'active' and p.user_id is null and m.billable order by random() limit 25) m
join public.products pr on pr.code = 'gym_month';

-- Sauna: un par de abonos de no socios
insert into public.passes (person_id, product_id, valid_from, valid_until, nominal, status)
select p.id, pr.id, current_date - 3, current_date + 27, true, 'active'
from (select id from public.people where 'client' = any(tags) order by random() limit 3) p join public.products pr on pr.code = 'sauna_month';

-- Dos solicitudes de alta online pendientes de aprobación
insert into public.membership_requests (applicant, type_code) values
 ('{"first_name":"Mariona","last_name":"Esteve Bosch","birth_date":"1991-04-02","email":"mariona.esteve@exemple.cat","phone":"600 111 222","note":"Vull el gimnàs"}', 'individual'),
 ('{"first_name":"Hugo","last_name":"Casals Prat","birth_date":"2009-11-20","email":"familia.casals@exemple.cat","phone":"600 333 444","note":"Fill de soci (Adherit)"}', 'adherit');

select (select count(*) from people) people, (select count(*) from households) hh, (select count(*) from memberships) m, (select count(*) from cards) cards, (select count(*) from bank_accounts) banks, (select count(*) from passes) passes;
