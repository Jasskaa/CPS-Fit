-- El personal (admin/monitor) puede registrar acciones en el log de auditoría, siempre a su nombre.
create policy al_insert on public.audit_log for insert to authenticated
  with check (actor_id = (select auth.uid()) and private.is_staff());
