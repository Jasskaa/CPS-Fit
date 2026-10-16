-- CPS Fit · RLS del dominio del club. Principio: cada persona ve lo suyo y lo de su hogar; el personal, según rol.
create function private.is_club_staff() returns boolean
language sql stable security definer set search_path = '' as $
  select private.has_role('{admin,board,reception,trainer,coordinator,coach}')
$;
grant execute on function private.is_club_staff() to authenticated;

create function private.my_household() returns uuid
language sql stable security definer set search_path = '' as $$
  select household_id from public.people where user_id = (select auth.uid())
$$;
grant execute on function private.my_household() to authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and not rowsecurity loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- Configuración visible para todos los usuarios; solo el admin la edita.
  foreach t in array array['membership_types','zones','access_rules','resources','pricing_rules','products','seasons','settings','club_history'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.has_role(''{admin}''))', t || '_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.has_role(''{admin}'')) with check (private.has_role(''{admin}''))', t || '_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.has_role(''{admin}''))', t || '_del', t);
  end loop;

  -- Contenido de comunicación: admin, recepción y coordinadores.
  foreach t in array array['club_events','event_categories','polls','gallery_photos'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_comms())', t || '_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_comms()) with check (private.is_comms())', t || '_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_comms())', t || '_del', t);
  end loop;

  -- Tablas de solo lectura mantenidas por triggers.
  foreach t in array array['zone_presence','booking_slots'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_sel', t);
  end loop;

  -- Datos ligados a una persona: lectura por visibilidad; escritura por recepción/admin.
  foreach t in array array['memberships','cards','access_overrides','passes'] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.can_see_person(person_id))', t || '_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_writer())', t || '_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_writer()) with check (private.is_writer())', t || '_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_writer())', t || '_del', t);
  end loop;

  -- Solo personal de gestión.
  foreach t in array array['facility_tasks','inventory_items'] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.is_finance_view())', t || '_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_writer())', t || '_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_writer()) with check (private.is_writer())', t || '_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.has_role(''{admin}''))', t || '_del', t);
  end loop;
end $$;

-- ───────── Personas y hogares ─────────
create policy people_sel on public.people for select to authenticated using (private.can_see_person(id));
create policy people_ins on public.people for insert to authenticated with check (private.is_writer());
create policy people_upd on public.people for update to authenticated
  using (private.is_writer() or user_id = (select auth.uid())) with check (private.is_writer() or user_id = (select auth.uid()));
create policy people_del on public.people for delete to authenticated using (private.has_role('{admin}'));

create policy households_sel on public.households for select to authenticated using (private.is_finance_view() or id = private.my_household());
create policy households_ins on public.households for insert to authenticated with check (private.is_writer());
create policy households_upd on public.households for update to authenticated using (private.is_writer()) with check (private.is_writer());
create policy households_del on public.households for delete to authenticated using (private.has_role('{admin}'));

create policy mreq_ins on public.membership_requests for insert to anon, authenticated
  with check (status = 'pending' and octet_length(applicant::text) < 4000);
create policy mreq_sel on public.membership_requests for select to authenticated using (private.is_writer());
create policy mreq_upd on public.membership_requests for update to authenticated using (private.is_writer()) with check (private.is_writer());

create policy bank_sel on public.bank_accounts for select to authenticated using (private.has_role('{admin,board}') or person_id = private.my_person());
create policy bank_ins on public.bank_accounts for insert to authenticated with check (private.has_role('{admin}') or person_id = private.my_person());
create policy bank_upd on public.bank_accounts for update to authenticated using (private.has_role('{admin}') or person_id = private.my_person()) with check (private.has_role('{admin}') or person_id = private.my_person());
create policy bank_del on public.bank_accounts for delete to authenticated using (private.has_role('{admin}'));

-- ───────── Accesos ─────────
create policy alog_sel on public.access_logs for select to authenticated using (private.is_finance_view() or person_id = private.my_person());
create policy alog_ins on public.access_logs for insert to authenticated with check (private.is_writer());

-- ───────── Reservas ─────────
create policy bookings_sel on public.bookings for select to authenticated using (private.can_see_person(person_id));
create policy bookings_ins on public.bookings for insert to authenticated
  with check (private.is_writer() or (kind = 'booking' and status = 'confirmed' and private.can_see_person(person_id)));
create policy bookings_upd on public.bookings for update to authenticated using (private.can_see_person(person_id) or private.is_writer()) with check (private.can_see_person(person_id) or private.is_writer());
create policy bookings_del on public.bookings for delete to authenticated using (private.is_writer());

create policy bextras_sel on public.booking_extras for select to authenticated using (exists (select 1 from public.bookings b where b.id = booking_id));
create policy bextras_ins on public.booking_extras for insert to authenticated with check (exists (select 1 from public.bookings b where b.id = booking_id and b.invoice_id is null));
create policy bextras_del on public.booking_extras for delete to authenticated using (exists (select 1 from public.bookings b where b.id = booking_id and b.invoice_id is null));

create policy bplayers_sel on public.booking_players for select to authenticated using (private.can_see_person(person_id) or private.is_finance_view());
create policy bplayers_ins on public.booking_players for insert to authenticated with check (person_id = private.my_person());
create policy bplayers_del on public.booking_players for delete to authenticated using (person_id = private.my_person() or private.is_writer());

create policy bwait_sel on public.booking_waitlist for select to authenticated using (private.can_see_person(person_id));
create policy bwait_ins on public.booking_waitlist for insert to authenticated with check (private.can_see_person(person_id));
create policy bwait_del on public.booking_waitlist for delete to authenticated using (private.can_see_person(person_id));

-- ───────── Facturación ─────────
create policy invoices_sel on public.invoices for select to authenticated using (private.can_see_person(person_id));
create policy invoices_ins on public.invoices for insert to authenticated with check (private.is_writer());
create policy invoices_upd on public.invoices for update to authenticated using (private.is_writer()) with check (private.is_writer());
create policy invoices_del on public.invoices for delete to authenticated using (private.has_role('{admin}'));

create policy ilines_sel on public.invoice_lines for select to authenticated using (exists (select 1 from public.invoices i where i.id = invoice_id));
create policy ilines_ins on public.invoice_lines for insert to authenticated with check (private.is_writer());
create policy ilines_upd on public.invoice_lines for update to authenticated using (private.is_writer()) with check (private.is_writer());
create policy ilines_del on public.invoice_lines for delete to authenticated using (private.is_writer());

-- Pago simulado: el titular (o su hogar) puede pagar el importe exacto de una factura pendiente.
-- En producción esto lo haría un webhook del proveedor con service_role (ver docs/MIGRACION.md).
create policy payments_sel on public.payments for select to authenticated using (private.can_see_person(person_id));
create policy payments_ins on public.payments for insert to authenticated with check (
  private.is_writer() or (
    method = 'simulated' and status = 'succeeded' and private.can_see_person(person_id)
    and exists (select 1 from public.invoices i where i.id = invoice_id and i.person_id = payments.person_id
                and i.total_cents = payments.amount_cents and i.status in ('pending', 'overdue'))));
create policy payments_upd on public.payments for update to authenticated using (private.is_writer()) with check (private.is_writer());
create policy payments_del on public.payments for delete to authenticated using (private.has_role('{admin}'));

create policy cash_sel on public.cash_sessions for select to authenticated using (private.is_writer());
create policy cash_ins on public.cash_sessions for insert to authenticated with check (private.is_writer());
create policy cash_upd on public.cash_sessions for update to authenticated using (private.is_writer()) with check (private.is_writer());

create policy sepab_sel on public.sepa_batches for select to authenticated using (private.has_role('{admin,board}'));
create policy sepab_ins on public.sepa_batches for insert to authenticated with check (private.has_role('{admin}'));
create policy sepab_upd on public.sepa_batches for update to authenticated using (private.has_role('{admin}')) with check (private.has_role('{admin}'));
create policy sepab_del on public.sepa_batches for delete to authenticated using (private.has_role('{admin}'));
create policy sepai_sel on public.sepa_items for select to authenticated using (private.has_role('{admin,board}'));
create policy sepai_ins on public.sepa_items for insert to authenticated with check (private.has_role('{admin}'));
create policy sepai_upd on public.sepa_items for update to authenticated using (private.has_role('{admin}')) with check (private.has_role('{admin}'));
create policy sepai_del on public.sepa_items for delete to authenticated using (private.has_role('{admin}'));

-- ───────── Secciones, equipos y eventos ─────────
create policy sections_sel on public.sections for select to authenticated using (true);
create policy sections_ins on public.sections for insert to authenticated with check (private.has_role('{admin}'));
create policy sections_upd on public.sections for update to authenticated using (private.can_manage_section(id)) with check (private.can_manage_section(id));
create policy sections_del on public.sections for delete to authenticated using (private.has_role('{admin}'));

create policy teams_sel on public.teams for select to authenticated using (true);
create policy teams_ins on public.teams for insert to authenticated with check (private.can_manage_section(section_id));
create policy teams_upd on public.teams for update to authenticated using (private.can_manage_section(section_id)) with check (private.can_manage_section(section_id));
create policy teams_del on public.teams for delete to authenticated using (private.can_manage_section(section_id));

create policy tmembers_sel on public.team_members for select to authenticated using (private.can_see_person(person_id) or private.can_manage_team(team_id));
create policy tmembers_ins on public.team_members for insert to authenticated with check (private.can_manage_team(team_id));
create policy tmembers_upd on public.team_members for update to authenticated using (private.can_manage_team(team_id)) with check (private.can_manage_team(team_id));
create policy tmembers_del on public.team_members for delete to authenticated using (private.can_manage_team(team_id));

create policy tevents_sel on public.team_events for select to authenticated using (
  private.can_manage_team(team_id) or exists (select 1 from public.team_members tm where tm.team_id = team_events.team_id and private.can_see_person(tm.person_id)));
create policy tevents_ins on public.team_events for insert to authenticated with check (private.can_manage_team(team_id));
create policy tevents_upd on public.team_events for update to authenticated using (private.can_manage_team(team_id)) with check (private.can_manage_team(team_id));
create policy tevents_del on public.team_events for delete to authenticated using (private.can_manage_team(team_id));

create policy tatt_sel on public.team_attendance for select to authenticated using (
  private.can_see_person(person_id) or exists (select 1 from public.team_events e where e.id = event_id and private.can_manage_team(e.team_id)));
create policy tatt_ins on public.team_attendance for insert to authenticated with check (
  private.can_see_person(person_id) or exists (select 1 from public.team_events e where e.id = event_id and private.can_manage_team(e.team_id)));
create policy tatt_upd on public.team_attendance for update to authenticated using (
  private.can_see_person(person_id) or exists (select 1 from public.team_events e where e.id = event_id and private.can_manage_team(e.team_id)))
  with check (private.can_see_person(person_id) or exists (select 1 from public.team_events e where e.id = event_id and private.can_manage_team(e.team_id)));
create policy tatt_del on public.team_attendance for delete to authenticated using (
  exists (select 1 from public.team_events e where e.id = event_id and private.can_manage_team(e.team_id)));

create policy ereg_sel on public.event_registrations for select to authenticated using (private.can_see_person(person_id) or private.is_comms());
create policy ereg_ins on public.event_registrations for insert to authenticated with check (private.can_see_person(person_id) or private.is_comms());
create policy ereg_upd on public.event_registrations for update to authenticated using (private.can_see_person(person_id) or private.is_comms()) with check (private.can_see_person(person_id) or private.is_comms());
create policy ereg_del on public.event_registrations for delete to authenticated using (private.is_comms());

create policy pvotes_sel on public.poll_votes for select to authenticated using (person_id = private.my_person() or private.has_role('{admin}'));
create policy pvotes_ins on public.poll_votes for insert to authenticated with check (person_id = private.my_person());

-- ───────── Comunicación ─────────
create policy news_sel on public.news for select to authenticated using ((status = 'published' and published_at <= now()) or private.is_comms());
create policy news_ins on public.news for insert to authenticated with check (private.is_comms());
create policy news_upd on public.news for update to authenticated using (private.is_comms()) with check (private.is_comms());
create policy news_del on public.news for delete to authenticated using (private.is_comms());

drop policy an_insert on public.announcements;
drop policy an_update on public.announcements;
drop policy an_delete on public.announcements;
create policy an_insert on public.announcements for insert to authenticated with check (private.is_staff() or private.is_comms());
create policy an_update on public.announcements for update to authenticated using (private.is_staff() or private.is_comms()) with check (private.is_staff() or private.is_comms());
create policy an_delete on public.announcements for delete to authenticated using (private.is_staff() or private.is_comms());

create policy notif_sel on public.notifications for select to authenticated using (person_id = private.my_person());
create policy notif_ins on public.notifications for insert to authenticated with check (private.is_comms());
create policy notif_upd on public.notifications for update to authenticated using (person_id = private.my_person()) with check (person_id = private.my_person());
create policy notif_del on public.notifications for delete to authenticated using (person_id = private.my_person() or private.is_comms());

create policy msg_sel on public.messages for select to authenticated using (person_id = private.my_person() or private.is_finance_view());
create policy msg_ins on public.messages for insert to authenticated with check (person_id = private.my_person() or private.is_writer());
create policy msg_upd on public.messages for update to authenticated using (private.is_writer()) with check (private.is_writer());
create policy mrep_sel on public.message_replies for select to authenticated using (exists (select 1 from public.messages m where m.id = message_id));
create policy mrep_ins on public.message_replies for insert to authenticated with check (
  author_id = (select auth.uid()) and (private.is_writer() or exists (select 1 from public.messages m where m.id = message_id and m.person_id = private.my_person())));

create policy shifts_sel on public.shifts for select to authenticated using (user_id = (select auth.uid()) or private.is_finance_view());
create policy shifts_ins on public.shifts for insert to authenticated with check (private.has_role('{admin}'));
create policy shifts_upd on public.shifts for update to authenticated using (private.has_role('{admin}')) with check (private.has_role('{admin}'));
create policy shifts_del on public.shifts for delete to authenticated using (private.has_role('{admin}'));

drop policy al_select on public.audit_log;
create policy al_select on public.audit_log for select to authenticated using (private.has_role('{admin,board}'));
drop policy al_insert on public.audit_log;
create policy al_insert on public.audit_log for insert to authenticated with check (actor_id = (select auth.uid()) and private.is_club_staff());

create policy "club media write" on storage.objects for insert to authenticated with check (bucket_id = 'club-media' and private.is_comms());
create policy "club media update" on storage.objects for update to authenticated using (bucket_id = 'club-media' and private.is_comms());
create policy "club media delete" on storage.objects for delete to authenticated using (bucket_id = 'club-media' and private.is_comms());
