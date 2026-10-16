-- CPS Fit · funciones auxiliares, triggers y RPC del dominio del club.
alter table public.booking_slots add column if not exists players_joined smallint not null default 0;

-- ───────── Helpers de rol / visibilidad (schema privado) ─────────
create function private.has_role(roles public.user_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() = any (roles), false)
$$;

create function private.my_person() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.people where user_id = (select auth.uid())
$$;

create function private.is_writer() returns boolean  -- gestión diaria: admin y recepción
language sql stable security definer set search_path = '' as $$
  select private.has_role('{admin,reception}')
$$;

create function private.is_finance_view() returns boolean  -- ve todo el dinero y las personas
language sql stable security definer set search_path = '' as $$
  select private.has_role('{admin,board,reception}')
$$;

create function private.is_comms() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('{admin,reception,coordinator}')
$$;

create function private.coaches(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('{coordinator,coach}') and exists (
    select 1 from public.team_members tm
    join public.teams t on t.id = tm.team_id
    join public.sections s on s.id = t.section_id
    where tm.person_id = pid
      and (t.coach_person_id = private.my_person() or s.coordinator_person_id = private.my_person())
  )
$$;

create function private.can_see_person(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select pid is not null and (
    private.is_finance_view()
    or exists (select 1 from public.people p where p.id = pid and p.user_id = (select auth.uid()))
    or exists (
      select 1 from public.people me join public.people p on p.household_id = me.household_id
      where me.user_id = (select auth.uid()) and me.household_id is not null
        and me.household_role in ('holder', 'partner') and p.id = pid
    )
    or (private.has_role('{trainer}') and exists (
      select 1 from public.people p where p.id = pid and p.user_id is not null and private.manages(p.user_id)))
    or private.coaches(pid)
  )
$$;

create function private.can_manage_section(sid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('{admin}') or exists (
    select 1 from public.sections s where s.id = sid and s.coordinator_person_id = private.my_person())
$$;

create function private.can_manage_team(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('{admin}') or exists (
    select 1 from public.teams t join public.sections s on s.id = t.section_id
    where t.id = tid and (t.coach_person_id = private.my_person() or s.coordinator_person_id = private.my_person()))
$$;

-- ───────── Personas ─────────
create function private.people_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if (select auth.uid()) is not null and not private.is_writer() then
    new.household_id := old.household_id;
    new.household_role := old.household_role;
    new.status := old.status;
    new.user_id := old.user_id;
    new.tags := old.tags;
    new.notes := old.notes;
  end if;
  return new;
end $$;
create trigger people_guard before update on public.people for each row execute function private.people_guard();

-- Alta de usuario: crea también la persona (sin cuota hasta que el club apruebe el alta).
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare full_n text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
begin
  insert into public.profiles (id, email, full_name, locale, consent_at)
  values (new.id, new.email, full_n,
    case when new.raw_user_meta_data ->> 'locale' = 'es' then 'es' else 'ca' end,
    case when new.raw_user_meta_data ->> 'consent' = 'true' then now() end);
  insert into public.member_details (member_id) values (new.id);
  insert into public.people (user_id, first_name, last_name, email, locale, status, consent_data, consent_at)
  values (new.id, coalesce(nullif(split_part(full_n, ' ', 1), ''), 'Nou'), coalesce(nullif(trim(substr(full_n, length(split_part(full_n, ' ', 1)) + 1)), ''), 'Soci'),
    new.email, case when new.raw_user_meta_data ->> 'locale' = 'es' then 'es' else 'ca' end, 'prospect',
    new.raw_user_meta_data ->> 'consent' = 'true', case when new.raw_user_meta_data ->> 'consent' = 'true' then now() end);
  return new;
end $$;

-- ───────── Reservas: precio, validaciones y disponibilidad pública ─────────
create function private.booking_audience(pid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from public.memberships m where m.person_id = pid and m.status = 'active') then 'member' else 'non_member' end
$$;

-- Precio por tramos de 30 min según franja y socio/no socio (el precio lo decide QUIEN RESERVA).
create function private.booking_base_price(p_resource uuid, p_person uuid, p_start timestamptz, p_end timestamptz) returns integer
language sql stable security definer set search_path = '' as $$
  with r as (select kind from public.resources where id = p_resource),
  slices as (select s from generate_series(p_start, p_end - interval '30 minutes', interval '30 minutes') s)
  select coalesce(round(sum(pr.price_cents_hour * 0.5))::integer, 0)
  from slices
  cross join r
  join public.pricing_rules pr on pr.resource_kind = r.kind and pr.audience = private.booking_audience(p_person)
    and extract(dow from (slices.s at time zone 'Europe/Madrid'))::smallint = any (pr.weekdays)
    and (extract(hour from (slices.s at time zone 'Europe/Madrid')) + extract(minute from (slices.s at time zone 'Europe/Madrid')) / 60.0) >= pr.hour_from
    and (extract(hour from (slices.s at time zone 'Europe/Madrid')) + extract(minute from (slices.s at time zone 'Europe/Madrid')) / 60.0) < pr.hour_to
    and (pr.valid_from is null or (slices.s at time zone 'Europe/Madrid')::date >= pr.valid_from)
    and (pr.valid_to is null or (slices.s at time zone 'Europe/Madrid')::date <= pr.valid_to)
$$;

create function private.bookings_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare res public.resources%rowtype; local_start timestamp; local_end timestamp; mins int; actor boolean;
begin
  actor := (select auth.uid()) is not null and not private.is_writer();
  if new.kind in ('booking', 'rental') and new.person_id is not null then
    new.audience_applied := private.booking_audience(new.person_id);
    new.price_cents := private.booking_base_price(new.resource_id, new.person_id, new.starts_at, new.ends_at);
  end if;
  if tg_op = 'INSERT' and new.kind = 'booking' then
    select * into res from public.resources where id = new.resource_id;
    local_start := new.starts_at at time zone 'Europe/Madrid';
    local_end := new.ends_at at time zone 'Europe/Madrid';
    mins := extract(epoch from (new.ends_at - new.starts_at)) / 60;
    if actor then
      if new.starts_at < now() - interval '5 minutes' then raise exception 'in_the_past'; end if;
      if local_start::time < res.open_time or local_end::time > res.close_time or local_start::date <> local_end::date then raise exception 'outside_hours'; end if;
      if not (mins = any (res.durations)) then raise exception 'bad_duration'; end if;
      if new.starts_at > now() + (res.max_advance_days || ' days')::interval then raise exception 'too_far'; end if;
      if (select count(*) from public.bookings b where b.person_id = new.person_id and b.status = 'confirmed' and b.starts_at > now()
            and b.resource_id in (select id from public.resources where kind = res.kind)) >= res.max_active_per_person then raise exception 'limit_reached'; end if;
    end if;
  end if;
  if tg_op = 'UPDATE' and actor then  -- los usuarios solo pueden cancelar
    new.resource_id := old.resource_id; new.person_id := old.person_id; new.starts_at := old.starts_at; new.ends_at := old.ends_at;
    new.price_cents := old.price_cents; new.invoice_id := old.invoice_id; new.kind := old.kind;
    if new.status not in (old.status, 'cancelled') then new.status := old.status; end if;
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      select * into res from public.resources where id = old.resource_id;
      if old.starts_at - now() < (res.cancel_hours || ' hours')::interval then raise exception 'too_late_to_cancel'; end if;
      new.cancelled_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger bookings_before before insert or update on public.bookings for each row execute function private.bookings_before();

create function private.bookings_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare host text;
begin
  if tg_op = 'DELETE' then delete from public.booking_slots where id = old.id; return old; end if;
  if new.status in ('confirmed', 'blocked') then
    select p.first_name || ' ' || left(p.last_name, 1) || '.' into host from public.people p where p.id = new.person_id;
    insert into public.booking_slots (id, resource_id, starts_at, ends_at, status, kind, title, open_match, players_needed, host_name)
    values (new.id, new.resource_id, new.starts_at, new.ends_at, new.status, new.kind,
      case when new.kind in ('block', 'class', 'training', 'match') then new.title end, new.open_match, new.players_needed,
      case when new.open_match then host end)
    on conflict (id) do update set resource_id = excluded.resource_id, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
      status = excluded.status, kind = excluded.kind, title = excluded.title, open_match = excluded.open_match,
      players_needed = excluded.players_needed, host_name = excluded.host_name;
  else
    delete from public.booking_slots where id = new.id;
    -- avisa a quien esperaba este hueco
    if tg_op = 'UPDATE' and old.status = 'confirmed' and new.status = 'cancelled' then
      insert into public.notifications (person_id, channel, title, body, url)
      select w.person_id, 'push', 'S''ha alliberat una pista', 'Hi ha un hueco disponible el ' || to_char(new.starts_at at time zone 'Europe/Madrid', 'DD/MM HH24:MI'), '/app/reserves'
      from public.booking_waitlist w
      where w.resource_id = new.resource_id and w.notified_at is null and tstzrange(w.starts_at, w.ends_at) && tstzrange(new.starts_at, new.ends_at);
      update public.booking_waitlist w set notified_at = now()
      where w.resource_id = new.resource_id and w.notified_at is null and tstzrange(w.starts_at, w.ends_at) && tstzrange(new.starts_at, new.ends_at);
    end if;
  end if;
  return new;
end $$;
create trigger bookings_after after insert or update or delete on public.bookings for each row execute function private.bookings_after();

create function private.booking_extras_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare aud text;
begin
  select coalesce(b.audience_applied, 'non_member') into aud from public.bookings b where b.id = new.booking_id;
  select case when aud = 'member' then p.price_member_cents else p.price_non_member_cents end into new.unit_cents
  from public.products p where p.id = new.product_id;
  return new;
end $$;
create trigger booking_extras_before before insert on public.booking_extras for each row execute function private.booking_extras_before();

create function private.booking_extras_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare bid uuid := coalesce(new.booking_id, old.booking_id);
begin
  update public.bookings b set price_cents = private.booking_base_price(b.resource_id, b.person_id, b.starts_at, b.ends_at)
    + coalesce((select sum(e.qty * e.unit_cents) from public.booking_extras e where e.booking_id = b.id), 0)
  where b.id = bid and b.invoice_id is null;
  return coalesce(new, old);
end $$;
create trigger booking_extras_after after insert or delete on public.booking_extras for each row execute function private.booking_extras_after();

create function private.booking_players_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare bid uuid := coalesce(new.booking_id, old.booking_id);
begin
  update public.booking_slots s set players_joined = (select count(*) from public.booking_players p where p.booking_id = bid and p.status = 'joined') where s.id = bid;
  return coalesce(new, old);
end $$;
create trigger booking_players_after after insert or update or delete on public.booking_players for each row execute function private.booking_players_after();

-- ───────── Facturación ─────────
create function private.next_invoice_number(p_series text) returns text
language plpgsql security definer set search_path = '' as $$
declare y int := extract(year from now())::int; n int;
begin
  insert into public.invoice_counters (series, year, last_number) values (p_series, y, 1)
  on conflict (series, year) do update set last_number = public.invoice_counters.last_number + 1
  returning last_number into n;
  return p_series || '-' || y || '-' || lpad(n::text, 5, '0');
end $$;

create function private.invoices_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.number is null then new.number := private.next_invoice_number(new.series); end if;
  if new.due_on is null then new.due_on := new.issued_on + 15; end if;
  return new;
end $$;
create trigger invoices_before before insert on public.invoices for each row execute function private.invoices_before();

create function private.invoice_lines_before() returns trigger
language plpgsql set search_path = '' as $$
begin new.total_cents := round(new.qty * new.unit_cents)::integer; return new; end $$;
create trigger invoice_lines_before before insert or update on public.invoice_lines for each row execute function private.invoice_lines_before();

create function private.invoice_totals() returns trigger
language plpgsql security definer set search_path = '' as $$
declare iid uuid := coalesce(new.invoice_id, old.invoice_id); sub int; vat int;
begin
  select coalesce(sum(total_cents), 0), coalesce(sum(round(total_cents * vat_pct / 100.0)), 0)::int into sub, vat from public.invoice_lines where invoice_id = iid;
  update public.invoices set subtotal_cents = sub, vat_cents = vat, total_cents = sub + vat where id = iid;
  return coalesce(new, old);
end $$;
create trigger invoice_totals after insert or update or delete on public.invoice_lines for each row execute function private.invoice_totals();

-- Cuando un pago deja la factura cubierta, se marca pagada y se entregan bonos/abonos.
create function private.payments_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare inv public.invoices%rowtype; paid int;
begin
  select * into inv from public.invoices where id = new.invoice_id;
  select coalesce(sum(amount_cents), 0) into paid from public.payments where invoice_id = new.invoice_id and status = 'succeeded';
  if paid >= inv.total_cents and inv.status in ('pending', 'overdue', 'draft') then
    update public.invoices set status = 'paid', paid_at = now() where id = inv.id;
    insert into public.passes (person_id, product_id, uses_total, uses_left, valid_until, nominal, invoice_id)
    select inv.person_id, pr.id, pr.uses, pr.uses, case when pr.valid_days is not null then current_date + pr.valid_days end, pr.nominal, inv.id
    from public.invoice_lines l join public.products pr on pr.id = l.product_id
    where l.invoice_id = inv.id and pr.kind = 'pass' and not exists (select 1 from public.passes x where x.invoice_id = inv.id and x.product_id = pr.id);
  elsif new.status = 'refunded' then
    update public.invoices set status = 'refunded' where id = inv.id;
  end if;
  return new;
end $$;
create trigger payments_after after insert or update on public.payments for each row execute function private.payments_after();

-- RPC: factura la reserva (con extras) de una persona visible para el usuario; devuelve el id de la factura.
create function public.invoice_booking(p_booking uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; iid uuid; r public.resources%rowtype;
begin
  select * into b from public.bookings where id = p_booking;
  if b.id is null or not private.can_see_person(b.person_id) then raise exception 'not_allowed'; end if;
  if b.invoice_id is not null then return b.invoice_id; end if;
  select * into r from public.resources where id = b.resource_id;
  insert into public.invoices (person_id, kind, status, source, created_by, notes)
  values (b.person_id, 'booking', 'pending', 'booking', (select auth.uid()), r.name || ' · ' || to_char(b.starts_at at time zone 'Europe/Madrid', 'DD/MM/YYYY HH24:MI')) returning id into iid;
  insert into public.invoice_lines (invoice_id, description, qty, unit_cents)
  values (iid, 'Reserva ' || r.name || ' ' || to_char(b.starts_at at time zone 'Europe/Madrid', 'DD/MM HH24:MI') || '–' || to_char(b.ends_at at time zone 'Europe/Madrid', 'HH24:MI')
    || case when b.audience_applied = 'member' then ' (preu soci)' else ' (preu no soci)' end, 1,
    private.booking_base_price(b.resource_id, b.person_id, b.starts_at, b.ends_at));
  insert into public.invoice_lines (invoice_id, description, qty, unit_cents, product_id)
  select iid, p.name_ca, e.qty, e.unit_cents, p.id from public.booking_extras e join public.products p on p.id = e.product_id where e.booking_id = b.id;
  update public.bookings set invoice_id = iid where id = b.id;
  return iid;
end $$;

-- RPC: factura un producto del catálogo (entrada, bono, abono, gimnàs…) para una persona visible.
create function public.invoice_product(p_person uuid, p_product uuid, p_qty integer default 1) returns uuid
language plpgsql security definer set search_path = '' as $$
declare pr public.products%rowtype; iid uuid; unit int;
begin
  if p_qty < 1 or p_qty > 20 or not private.can_see_person(p_person) then raise exception 'not_allowed'; end if;
  select * into pr from public.products where id = p_product and active;
  if pr.id is null then raise exception 'no_product'; end if;
  unit := case when private.booking_audience(p_person) = 'member' then pr.price_member_cents else pr.price_non_member_cents end;
  insert into public.invoices (person_id, kind, status, source, created_by) values (p_person, case when pr.kind = 'pass' then 'pass' else 'other' end, 'pending', 'shop', (select auth.uid())) returning id into iid;
  insert into public.invoice_lines (invoice_id, description, qty, unit_cents, vat_pct, product_id) values (iid, pr.name_ca, p_qty, unit, pr.vat_pct, pr.id);
  return iid;
end $$;
revoke execute on function public.invoice_booking(uuid) from public, anon;
revoke execute on function public.invoice_product(uuid, uuid, integer) from public, anon;
grant execute on function public.invoice_booking(uuid) to authenticated;
grant execute on function public.invoice_product(uuid, uuid, integer) to authenticated;

-- ───────── Aforo en vivo ─────────
create function private.access_logs_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  select count(*) into n from (
    select distinct on (person_id) person_id, direction from public.access_logs
    where zone_id = new.zone_id and person_id is not null and allowed and at > now() - interval '6 hours'
    order by person_id, at desc) t where direction = 'in';
  insert into public.zone_presence (zone_id, present, updated_at) values (new.zone_id, n, now())
  on conflict (zone_id) do update set present = excluded.present, updated_at = now();
  return new;
end $$;
create trigger access_logs_after after insert on public.access_logs for each row execute function private.access_logs_after();

-- ───────── Auditoría (solo qué, quién y sobre qué; nunca valores sensibles) ─────────
create function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rid uuid;
begin
  rid := coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid);
  insert into public.audit_log (actor_id, action, entity, entity_id, detail)
  values ((select auth.uid()), lower(tg_op), tg_table_name, rid, jsonb_build_object('changed', case when tg_op = 'UPDATE' then
    (select coalesce(jsonb_agg(k), '[]') from jsonb_object_keys(to_jsonb(new)) k where to_jsonb(new) -> k is distinct from to_jsonb(old) -> k) end));
  return coalesce(new, old);
end $$;
create trigger audit_people after insert or update or delete on public.people for each row execute function private.audit();
create trigger audit_memberships after insert or update or delete on public.memberships for each row execute function private.audit();
create trigger audit_invoices after insert or update or delete on public.invoices for each row execute function private.audit();
create trigger audit_payments after insert or update or delete on public.payments for each row execute function private.audit();
create trigger audit_bookings after update or delete on public.bookings for each row execute function private.audit();
create trigger audit_overrides after insert or update or delete on public.access_overrides for each row execute function private.audit();
create trigger audit_settings after insert or update or delete on public.settings for each row execute function private.audit();
create trigger audit_sepa after insert or update on public.sepa_batches for each row execute function private.audit();

grant execute on all functions in schema private to authenticated;
alter publication supabase_realtime add table public.zone_presence, public.booking_slots, public.notifications;
