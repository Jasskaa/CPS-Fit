-- CPS Fit · seed 04 · reservas de pàdel (≈100 días), poliesportiva, sauna, clases de ejemplo, bloqueos y facturas de reservas. FICTICIO.
select setseed(0.577);

do $$
declare
  d date; r record; t numeric; dur int; booker uuid; st timestamptz; en timestamptz; bid uuid; n int := 0; st_txt public.booking_status;
  pool uuid[]; pool_n int; rnd double precision;
begin
  select array_agg(id) into pool from public.people p
   where p.status = 'active' and p.birth_date < current_date - 16 * 365 and not ('staff' = any (p.tags));
  pool_n := array_length(pool, 1);

  for d in select generate_series(current_date - 90, current_date + 9, interval '1 day')::date loop
    for r in select id, code from public.resources where kind = 'padel' loop
      t := 8;
      while t <= 20.5 loop
        rnd := random();
        -- más actividad por la tarde y en fines de semana, y en los últimos 30 días
        if rnd < (case when t >= 17 then 0.62 else 0.28 end) * (case when extract(dow from d) in (0, 6) then 1.2 else 1 end) * (case when d < current_date - 30 then 0.7 else 1 end) then
          dur := (array[60, 60, 90, 90, 120])[1 + floor(random() * 5)::int];
          if t + dur / 60.0 > 22 then dur := 60; end if;
          if t + dur / 60.0 <= 22 then
            booker := pool[1 + floor(random() * pool_n)::int];
            st := ((d + (floor(t)::int || ' hours')::interval + (case when t - floor(t) > 0 then interval '30 minutes' else interval '0' end))::timestamp) at time zone 'Europe/Madrid';
            en := st + (dur || ' minutes')::interval;
            begin
              st_txt := case when d < current_date and random() < 0.05 then 'cancelled' when d < current_date and random() < 0.03 then 'no_show' else 'confirmed' end;
              insert into public.bookings (resource_id, person_id, starts_at, ends_at, status, kind, open_match, players_needed, cancelled_at)
              values (r.id, booker, st, en, st_txt, 'booking', d >= current_date and random() < 0.3, 1 + floor(random() * 3)::int, case when st_txt = 'cancelled' then st - interval '2 days' end)
              returning id into bid;
              if random() < 0.2 and st_txt = 'confirmed' then
                insert into public.booking_extras (booking_id, product_id, qty) select bid, id, (case code when 'extra_pala' then 2 else 1 end) from public.products where code = (array['extra_pala', 'extra_pilotes'])[1 + floor(random() * 2)::int];
              end if;
              n := n + 1;
              t := t + dur / 60.0 + (case when random() < 0.5 then 0 else 0.5 end);
            exception when exclusion_violation then t := t + 0.5;
            end;
          else t := t + 0.5;
          end if;
        else
          t := t + 0.5;
        end if;
      end loop;
    end loop;
  end loop;
  raise notice 'reservas de pàdel: %', n;
end $$;

-- open matches: algunos jugadores ya apuntados
insert into public.booking_players (booking_id, person_id, status)
select b.id, p.id, 'joined'
from (select id, players_needed from public.bookings where open_match and status = 'confirmed' and starts_at > now()) b
join lateral (select id from public.people where status = 'active' and birth_date < current_date - 18 * 365 order by random() limit 1) p on true
where random() < 0.6;

-- Bloqueos: torneo (próximo sábado) y mantenimiento. Antes se liberan las reservas que coincidan.
delete from public.bookings where resource_id in (select id from public.resources where kind = 'padel') and kind = 'booking'
  and tstzrange(starts_at, ends_at) && tstzrange(((current_date + ((13 - extract(dow from current_date)::int) % 7))::timestamp + interval '9 hours') at time zone 'Europe/Madrid', ((current_date + ((13 - extract(dow from current_date)::int) % 7))::timestamp + interval '14 hours') at time zone 'Europe/Madrid');
delete from public.bookings where resource_id = (select id from public.resources where code = 'padel-2') and kind = 'booking'
  and tstzrange(starts_at, ends_at) && tstzrange(((current_date + 3)::timestamp + interval '8 hours') at time zone 'Europe/Madrid', ((current_date + 3)::timestamp + interval '10 hours') at time zone 'Europe/Madrid');
insert into public.bookings (resource_id, starts_at, ends_at, status, kind, title, notes)
select r.id, ((current_date + ((13 - extract(dow from current_date)::int) % 7))::timestamp + interval '9 hours') at time zone 'Europe/Madrid',
  ((current_date + ((13 - extract(dow from current_date)::int) % 7))::timestamp + interval '14 hours') at time zone 'Europe/Madrid', 'blocked', 'block', 'Torneig social de pàdel', 'Exemple'
from public.resources r where r.kind = 'padel';
insert into public.bookings (resource_id, starts_at, ends_at, status, kind, title)
select r.id, ((current_date + 3)::timestamp + interval '8 hours') at time zone 'Europe/Madrid', ((current_date + 3)::timestamp + interval '10 hours') at time zone 'Europe/Madrid', 'blocked', 'block', 'Manteniment (xarxa i línies)'
from public.resources r where r.code = 'padel-2';

-- Pista poliesportiva (uso libre con reserva) y sauna con aforo (cada plaza es un seat)
do $$
declare d date; p uuid; r record; h int; k int; n int := 0;
begin
  select id into r from public.resources where code = 'poli-1';
  for d in select generate_series(current_date - 20, current_date + 5, interval '1 day')::date loop
    for h in select unnest(array[17, 19, 20]) loop
      if random() < 0.6 then
        select p2.id into p from public.people p2 join public.memberships m on m.person_id = p2.id and m.status = 'active' where p2.birth_date < current_date - 16 * 365 order by random() limit 1;
        begin
          insert into public.bookings (resource_id, person_id, starts_at, ends_at, kind, title)
          values (r.id, p, (d + (h || ' hours')::interval)::timestamp at time zone 'Europe/Madrid', (d + ((h + 1) || ' hours')::interval)::timestamp at time zone 'Europe/Madrid', 'booking', 'Ús lliure');
          n := n + 1;
        exception when exclusion_violation then null; end;
      end if;
    end loop;
  end loop;
  select id into r from public.resources where code = 'sauna-1';
  for d in select generate_series(current_date - 3, current_date + 2, interval '1 day')::date loop
    for h in select unnest(array[10, 17, 18, 19, 20]) loop
      for k in 1..(1 + floor(random() * 5)::int) loop
        select p2.id into p from public.people p2 join public.passes ps on ps.person_id = p2.id join public.products pr on pr.id = ps.product_id and pr.pass_kind = 'sauna' order by random() limit 1;
        if p is null then select p2.id into p from public.people p2 join public.memberships m on m.person_id = p2.id and m.status = 'active' where p2.birth_date < current_date - 16 * 365 order by random() limit 1; end if;
        begin
          insert into public.bookings (resource_id, person_id, starts_at, ends_at, kind, seat)
          values (r.id, p, (d + (h || ' hours')::interval)::timestamp at time zone 'Europe/Madrid', (d + ((h + 1) || ' hours')::interval)::timestamp at time zone 'Europe/Madrid', 'booking', k);
        exception when exclusion_violation then null; end;
      end loop;
    end loop;
  end loop;
end $$;

-- Clases dirigidas de ejemplo (kind 'class'); los socios se apuntan con booking_players (cupo 25).
insert into public.bookings (resource_id, starts_at, ends_at, status, kind, title, players_needed, notes)
select r.id, (d::timestamp + c.t::time) at time zone 'Europe/Madrid', (d::timestamp + c.t::time + interval '1 hour') at time zone 'Europe/Madrid', 'confirmed', 'class', c.title, 25, 'Horari d''exemple (editable)'
from public.resources r
cross join generate_series(current_date, current_date + 13, interval '1 day') d
join (values (1, '18:30', 'Cicle indoor virtual'), (3, '19:30', 'Estiraments'), (2, '18:30', 'Cicle indoor virtual'), (4, '19:30', 'Estiraments'), (6, '10:00', 'Gimnàs actiu')) c(dow, t, title)
  on c.dow = extract(dow from d)::int
where r.code = 'classes-room'
on conflict do nothing;
insert into public.booking_players (booking_id, person_id, status)
select b.id, p.id, 'joined'
from public.bookings b
join lateral (select id from public.people where user_id is null and status = 'active' and birth_date < current_date - 16 * 365 order by random() limit 8) p on true
where b.kind = 'class'
on conflict do nothing;

-- Facturas de las reservas ya jugadas: ≈88 % pagadas (tarjeta/efectivo), el resto pendientes; futuras: 35 % ya pagadas.
do $$
declare b record; iid uuid; r public.resources%rowtype; paid boolean;
begin
  for b in select * from public.bookings where kind = 'booking' and status in ('confirmed', 'no_show') and price_cents > 0 and invoice_id is null loop
    select * into r from public.resources where id = b.resource_id;
    paid := case when b.starts_at < now() then random() < 0.88 else random() < 0.35 end;
    insert into public.invoices (person_id, kind, status, issued_on, due_on, source, notes, paid_at)
    values (b.person_id, 'booking', case when paid then 'paid' else 'pending' end::public.invoice_status, (b.created_at at time zone 'Europe/Madrid')::date, b.starts_at::date, 'booking',
      r.name || ' · ' || to_char(b.starts_at at time zone 'Europe/Madrid', 'DD/MM/YYYY HH24:MI'), case when paid then b.starts_at - interval '1 day' end)
    returning id into iid;
    insert into public.invoice_lines (invoice_id, description, qty, unit_cents)
    values (iid, 'Reserva ' || r.name || ' ' || to_char(b.starts_at at time zone 'Europe/Madrid', 'DD/MM HH24:MI') || '–' || to_char(b.ends_at at time zone 'Europe/Madrid', 'HH24:MI')
      || case when b.audience_applied = 'member' then ' (preu soci)' else ' (preu no soci)' end, 1, private.booking_base_price(b.resource_id, b.person_id, b.starts_at, b.ends_at));
    insert into public.invoice_lines (invoice_id, description, qty, unit_cents, product_id)
    select iid, p.name_ca, e.qty, e.unit_cents, p.id from public.booking_extras e join public.products p on p.id = e.product_id where e.booking_id = b.id;
    if paid then
      insert into public.payments (invoice_id, person_id, method, amount_cents, status, provider, paid_at)
      select iid, b.person_id, case when random() < 0.6 then 'card' else 'cash' end, i.total_cents, 'succeeded', 'simulated', coalesce(i.paid_at, now()) from public.invoices i where i.id = iid;
    end if;
    update public.bookings set invoice_id = iid where id = b.id;
  end loop;
end $$;

select (select count(*) from bookings) bookings, (select count(*) from bookings where kind = 'booking' and resource_id in (select id from resources where kind = 'padel')) padel,
       (select count(*) from invoices where source = 'booking') inv, (select count(*) from booking_slots) slots;
