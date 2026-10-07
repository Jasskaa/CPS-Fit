-- Verificación de RLS con el seed demo. Ejecutar en el SQL editor (rol postgres).
-- Todo ocurre en una transacción con rollback: no deja datos. Resultado esperado: todas las filas con ok = true.
begin;
create temp table rls_results (test text, ok boolean);
grant all on rls_results to authenticated;

do $$
declare
  soci1 uuid := '000000a0-0000-4000-8000-00000000000a';
  soci2 uuid := '000000a0-0000-4000-8000-00000000000b';
  soci7 uuid := '000000a0-0000-4000-8000-000000000010';
  mon1  uuid := '000000a0-0000-4000-8000-000000000002';
  adm   uuid := '000000a0-0000-4000-8000-000000000001';
  n int; ok boolean;
begin
  -- Socio 1
  perform set_config('request.jwt.claims', json_build_object('sub', soci1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.profiles; insert into rls_results values ('socio solo ve su perfil', n = 1);
  select count(*) into n from public.workout_sessions where member_id <> soci1; insert into rls_results values ('socio no ve sesiones de otros', n = 0);
  select count(*) into n from public.workout_sets s join public.workout_sessions w on w.id = s.session_id where w.member_id <> soci1; insert into rls_results values ('socio no ve series de otros', n = 0);
  select count(*) into n from public.body_measurements where member_id <> soci1; insert into rls_results values ('socio no ve medidas de otros', n = 0);
  select count(*) into n from public.comments where member_id <> soci1; insert into rls_results values ('socio no ve comentarios de otros', n = 0);
  begin update public.profiles set role = 'admin' where id = soci1; ok := false; exception when others then ok := true; end;
  insert into rls_results values ('socio no puede auto-promocionarse a admin', ok);
  begin insert into public.workout_sessions (member_id) values (soci2); ok := false; exception when others then ok := true; end;
  insert into rls_results values ('socio no puede crear entrenos a nombre de otro', ok);
  begin insert into public.body_measurements (member_id, weight_kg) values (soci1, 70); ok := true; exception when others then ok := false; end;
  insert into rls_results values ('socio puede registrar sus propias medidas', ok);
  begin insert into public.exercises (slug, name_ca, name_es, primary_muscle) values ('hack', 'x', 'x', 'Pit'); ok := false; exception when others then ok := true; end;
  insert into rls_results values ('socio no puede crear ejercicios', ok);

  -- Monitor 1: solo sus socios (soci1..soci6)
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', mon1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.profiles where role = 'member'; insert into rls_results values ('monitor ve exactamente 6 socios', n = 6);
  select count(*) into n from public.workout_sessions where member_id = soci7; insert into rls_results values ('monitor no ve sesiones de socios de otro monitor', n = 0);
  begin insert into public.workout_sessions (member_id) values (soci2); ok := false; exception when others then ok := true; end;
  insert into rls_results values ('monitor no puede crear entrenos de sus socios (solo leer)', ok);

  -- Admin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.profiles; insert into rls_results values ('admin ve todos los perfiles', n = 15);
  reset role;
end $$;

select * from rls_results order by ok, test;
rollback;
