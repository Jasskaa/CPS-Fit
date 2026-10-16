-- Informes: agregados calculados en la base de datos (security invoker => respetan RLS; solo ve cifras quien ya puede ver el dinero).

create or replace function public.report_revenue(p_from date, p_to date)
returns table (month date, kind text, method text, cents bigint, n bigint)
language sql stable security invoker set search_path = '' as $$
  select date_trunc('month', p.paid_at at time zone 'Europe/Madrid')::date as month, i.kind, p.method,
         sum(p.amount_cents)::bigint as cents, count(*)::bigint as n
  from public.payments p join public.invoices i on i.id = p.invoice_id
  where p.status = 'succeeded' and (p.paid_at at time zone 'Europe/Madrid')::date between p_from and p_to
  group by 1, 2, 3
  order by 1, 2, 3;
$$;

create or replace function public.report_daily_revenue(p_from date, p_to date)
returns table (day date, cents bigint)
language sql stable security invoker set search_path = '' as $$
  select (p.paid_at at time zone 'Europe/Madrid')::date as day, sum(p.amount_cents)::bigint
  from public.payments p
  where p.status = 'succeeded' and (p.paid_at at time zone 'Europe/Madrid')::date between p_from and p_to
  group by 1 order by 1;
$$;

create or replace function public.report_occupancy(p_from date, p_to date)
returns table (resource text, kind text, dow int, hour int, bookings bigint)
language sql stable security invoker set search_path = '' as $$
  select r.name, r.kind, extract(dow from b.starts_at at time zone 'Europe/Madrid')::int,
         extract(hour from b.starts_at at time zone 'Europe/Madrid')::int, count(*)::bigint
  from public.bookings b join public.resources r on r.id = b.resource_id
  where b.status in ('confirmed', 'no_show') and (b.starts_at at time zone 'Europe/Madrid')::date between p_from and p_to
  group by 1, 2, 3, 4;
$$;

create or replace function public.report_members(p_from date)
returns table (month date, joined bigint, ended bigint, active_end bigint)
language sql stable security invoker set search_path = '' as $$
  with months as (select generate_series(date_trunc('month', p_from)::date, date_trunc('month', current_date)::date, interval '1 month')::date as m)
  select m,
    (select count(*) from public.memberships x where date_trunc('month', x.started_on) = m)::bigint,
    (select count(*) from public.memberships x where x.ended_on is not null and date_trunc('month', x.ended_on) = m)::bigint,
    (select count(*) from public.memberships x where x.started_on < (m + interval '1 month') and (x.ended_on is null or x.ended_on >= (m + interval '1 month')) and x.status <> 'pending')::bigint
  from months order by m;
$$;

create or replace function public.report_debtors(p_limit int default 10)
returns table (person_id uuid, name text, invoices bigint, cents bigint, oldest date)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.first_name || ' ' || p.last_name, count(*)::bigint, sum(i.total_cents)::bigint, min(i.due_on)
  from public.invoices i join public.people p on p.id = i.person_id
  where i.status = 'overdue' group by p.id, p.first_name, p.last_name order by 4 desc limit p_limit;
$$;

create or replace function public.report_by_type()
returns table (code text, name_ca text, name_es text, members bigint, fee_cents integer)
language sql stable security invoker set search_path = '' as $$
  select t.code, t.name_ca, t.name_es, count(m.id) filter (where m.status = 'active')::bigint, t.annual_fee_cents
  from public.membership_types t left join public.memberships m on m.type_id = t.id
  group by t.id order by t.sort;
$$;

revoke execute on function public.report_revenue(date, date), public.report_daily_revenue(date, date), public.report_occupancy(date, date), public.report_members(date), public.report_debtors(int), public.report_by_type() from public, anon;
grant execute on function public.report_revenue(date, date), public.report_daily_revenue(date, date), public.report_occupancy(date, date), public.report_members(date), public.report_debtors(int), public.report_by_type() to authenticated;
