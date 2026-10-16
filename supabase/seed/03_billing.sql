-- CPS Fit · seed 03 · facturación: cuotas de enero y junio (2026), cuota de entrada, abonos, remesas SEPA, impagos. FICTICIO.
select setseed(0.271);

-- Cuotas anuales en dos recibos (enero y junio) para cada titular facturable activo/en pausa.
-- Una factura por titular (suma las cuotas de su hogar facturables: familiar + hijos adheridos).
create temp table fee_base as
select h.id as household_id,
  (select p.id from public.people p where p.household_id = h.id and p.household_role = 'holder' limit 1) as payer,
  sum(t.annual_fee_cents) filter (where m.billable) as annual_cents,
  bool_or(m.entry_fee_due) as entry_due
from public.households h
join public.people p on p.household_id = h.id
join public.memberships m on m.person_id = p.id and m.status in ('active', 'paused') and m.started_on < date '2026-01-01'
join public.membership_types t on t.id = m.type_id
group by h.id;
delete from fee_base where payer is null or coalesce(annual_cents, 0) = 0;

-- Semestre 1 (enero) y 2 (junio)
do $$
declare r record; iid uuid; half int; ym text; paid boolean; ovd boolean; sem int; d date;
begin
  for sem in 1..2 loop
    d := case sem when 1 then date '2026-01-15' else date '2026-06-15' end;
    for r in select * from fee_base order by household_id loop
      half := (r.annual_cents + 1) / 2;
      paid := case when sem = 1 then random() > 0.01 else random() > 0.09 end;
      insert into public.invoices (person_id, kind, status, issued_on, due_on, source, notes, paid_at)
      values (r.payer, 'fee', case when paid then 'paid' else 'overdue' end::public.invoice_status, d, d + 15, 'fees',
              'Quota de soci ' || case sem when 1 then '(1r pagament · gener 2026)' else '(2n pagament · juny 2026)' end,
              case when paid then d + 3 end)
      returning id into iid;
      insert into public.invoice_lines (invoice_id, description, qty, unit_cents)
      values (iid, 'Quota anual de soci · ' || case sem when 1 then '1r pagament (gener)' else '2n pagament (juny)' end, 1, half);
      if paid then
        insert into public.payments (invoice_id, person_id, method, amount_cents, status, provider, paid_at)
        values (iid, r.payer, 'sepa', half, 'succeeded', 'sepa', d + 3);
      end if;
    end loop;
  end loop;
end $$;

-- Cuota de entrada (105 € por unidad familiar) de las altas del último año
insert into public.invoices (person_id, kind, status, issued_on, due_on, source, notes, paid_at)
select b.payer, 'fee', 'paid', m.started_on, m.started_on + 15, 'entry_fee', 'Quota d''entrada (única vegada)', m.started_on + 2
from fee_base b join lateral (select min(started_on) started_on from public.memberships mm join public.people pp on pp.id = mm.person_id where pp.household_id = b.household_id) m on true
where b.entry_due;
insert into public.invoice_lines (invoice_id, description, qty, unit_cents)
select i.id, 'Quota d''entrada (per unitat familiar)', 1, 10500 from public.invoices i where i.source = 'entry_fee';
insert into public.payments (invoice_id, person_id, method, amount_cents, status, provider, paid_at)
select i.id, i.person_id, 'card', 10500, 'succeeded', 'simulated', i.issued_on + 2 from public.invoices i where i.source = 'entry_fee';

-- Remesas SEPA (referencias y fechas de ejemplo). Los importes salen de las facturas de cuotas.
insert into public.sepa_batches (reference, kind, collection_date, status, total_cents)
values ('CPS-2026-01-REM', 'fees_jan', date '2026-01-20', 'closed', 0), ('CPS-2026-06-REM', 'fees_jun', date '2026-06-20', 'closed', 0);

insert into public.sepa_items (batch_id, invoice_id, person_id, mandate_id, iban_last4, amount_cents, status, return_reason)
select b.id, i.id, i.person_id, ba.mandate_id, right(ba.iban, 4), i.total_cents,
  case when i.status = 'paid' then 'collected' else 'returned' end,
  case when i.status <> 'paid' then (array['AC01 · Compte invàlid', 'AM04 · Fons insuficients', 'MD01 · Sense mandat'])[1 + floor(random() * 3)::int] end
from public.invoices i
join public.sepa_batches b on b.kind = case when i.notes like '%gener%' then 'fees_jan' else 'fees_jun' end
join public.bank_accounts ba on ba.person_id = i.person_id
where i.source = 'fees';
update public.sepa_batches b set total_cents = (select coalesce(sum(amount_cents), 0) from public.sepa_items s where s.batch_id = b.id);

-- Facturas de los abonos de gimnàs (pagadas en recepción o con tarjeta simulada)
do $$
declare r record; iid uuid; price int;
begin
  for r in select ps.id as pass_id, ps.person_id, pr.id as product_id, pr.name_ca, pr.price_member_cents, pr.price_non_member_cents, ps.valid_from,
                  (exists (select 1 from public.memberships m where m.person_id = ps.person_id and m.status = 'active')) as is_member
           from public.passes ps join public.products pr on pr.id = ps.product_id where ps.invoice_id is null loop
    price := case when r.is_member then r.price_member_cents else r.price_non_member_cents end;
    insert into public.invoices (person_id, kind, status, issued_on, source, paid_at) values (r.person_id, 'pass', 'paid', r.valid_from, 'shop', r.valid_from) returning id into iid;
    insert into public.invoice_lines (invoice_id, description, qty, unit_cents, product_id) values (iid, r.name_ca, 1, price, r.product_id);
    insert into public.payments (invoice_id, person_id, method, amount_cents, status, provider, paid_at)
    values (iid, r.person_id, case when random() < 0.5 then 'cash' else 'card' end, price, 'succeeded', 'simulated', r.valid_from);
    update public.passes set invoice_id = iid where id = r.pass_id;
  end loop;
end $$;

-- Una factura pendiente reciente y una rectificativa de ejemplo
insert into public.invoices (person_id, kind, status, issued_on, source, notes)
select p.id, 'other', 'pending', current_date - 2, 'shop', 'Samarreta del club' from public.people p where p.email = 'soci2@cpsfit.demo';
insert into public.invoice_lines (invoice_id, description, qty, unit_cents, vat_pct, product_id)
select i.id, 'Samarreta del club', 1, 1000, 21, pr.id from public.invoices i, public.products pr where i.notes = 'Samarreta del club' and pr.code = 'merch_samarreta';

select (select count(*) from invoices) invoices, (select count(*) from payments) payments, (select count(*) from invoices where status = 'overdue') overdue,
       (select count(*) from sepa_items) sepa_items, (select sum(total_cents) from invoices where status = 'paid') cobrat;
