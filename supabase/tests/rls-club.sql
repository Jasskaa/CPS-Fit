-- Verificación de RLS del modelo del club. Se ejecuta en una transacción que se revierte al final.
-- Uso: pegar en el editor SQL de Supabase (o con execute_sql). Devuelve una fila por comprobación; todas deben tener ok = true.
-- Requiere los usuarios de demostración (seed 02_people.sql).
begin;
create temp table _r (name text, ok boolean, detail text) on commit drop;
grant all on _r to authenticated, anon;

create or replace function pg_temp.as_user(p_email text) returns void language plpgsql as $$
declare uid uuid;
begin
  perform set_config('role', 'postgres', true);
  select id into uid from auth.users where email = p_email;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function pg_temp.chk(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin insert into _r values (p_name, p_ok, p_detail); end $$;
grant execute on function pg_temp.chk(text, boolean, text), pg_temp.as_user(text) to authenticated, anon;

-- Socio: solo ve lo suyo
select pg_temp.as_user('client@cpsfit.demo');
select pg_temp.chk('socio ve solo su hogar', (select count(*) from public.people) between 1 and 8, (select count(*)::text from public.people));
select pg_temp.chk('socio no ve facturas ajenas', (select count(*) from public.invoices where person_id <> private.my_person()) = 0);
select pg_temp.chk('socio no ve IBAN ajenos', (select count(*) from public.bank_accounts where person_id <> private.my_person()) = 0);
select pg_temp.chk('socio no ve remesas', (select count(*) from public.sepa_batches) = 0);
select pg_temp.chk('socio no ve auditoria', (select count(*) from public.audit_log) = 0);
select pg_temp.chk('socio no ve accesos ajenos', (select count(*) from public.access_logs where person_id <> private.my_person()) = 0);
select pg_temp.chk('socio ve disponibilidad publica', (select count(*) from public.booking_slots) > 0);
select pg_temp.chk('socio no ve pagos ajenos', (select count(*) from public.payments where person_id <> private.my_person()) = 0);

-- Recepción: ve y gestiona personas y facturas, no remesas ni IBAN
select pg_temp.as_user('recepcio@cpsfit.demo');
select pg_temp.chk('recepcion ve todas las personas', (select count(*) from public.people) > 150);
select pg_temp.chk('recepcion ve facturas', (select count(*) from public.invoices) > 500);
select pg_temp.chk('recepcion no ve remesas', (select count(*) from public.sepa_batches) = 0);
select pg_temp.chk('recepcion no ve IBAN', (select count(*) from public.bank_accounts) = 0);

-- Junta: lectura de todo, incluidas remesas e IBAN
select pg_temp.as_user('junta@cpsfit.demo');
select pg_temp.chk('junta ve personas', (select count(*) from public.people) > 150);
select pg_temp.chk('junta ve remesas', (select count(*) from public.sepa_batches) >= 1);
select pg_temp.chk('junta ve IBAN', (select count(*) from public.bank_accounts) > 50);

-- Monitor de sala: sus socios, nunca dinero
select pg_temp.as_user('monitor1@cpsfit.demo');
select pg_temp.chk('monitor no ve remesas', (select count(*) from public.sepa_batches) = 0);
select pg_temp.chk('monitor no ve facturas', (select count(*) from public.invoices) = 0);
select pg_temp.chk('monitor no ve pagos', (select count(*) from public.payments) = 0);
select pg_temp.chk('monitor no ve todas las personas', (select count(*) from public.people) < 100, (select count(*)::text from public.people));

-- Entrenador: solo su equipo, nunca dinero
select pg_temp.as_user('entrenador@cpsfit.demo');
select pg_temp.chk('entrenador no ve facturas', (select count(*) from public.invoices) = 0);
select pg_temp.chk('entrenador no ve pagos', (select count(*) from public.payments) = 0);
select pg_temp.chk('entrenador no ve remesas', (select count(*) from public.sepa_batches) = 0);
select pg_temp.chk('entrenador ve solo su equipo', (select count(*) from public.people) between 1 and 80, (select count(*)::text from public.people));

-- Admin: todo
select pg_temp.as_user('admin@cpsfit.demo');
select pg_temp.chk('admin ve remesas', (select count(*) from public.sepa_batches) >= 1);
select pg_temp.chk('admin ve IBAN', (select count(*) from public.bank_accounts) > 50);

-- Anónimo: nada
select set_config('role', 'anon', true);
select pg_temp.chk('anonimo no ve personas', (select count(*) from public.people) = 0);
select pg_temp.chk('anonimo no ve facturas', (select count(*) from public.invoices) = 0);

select set_config('role', 'postgres', true);
select name, ok, detail from _r order by ok, name;
rollback;
