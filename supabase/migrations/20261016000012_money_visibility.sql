-- Los datos económicos (facturas, pagos) solo los ven administración, junta, recepción y la propia familia.
-- Entrenadores y monitores ven a sus jugadores/socios pero no lo que han pagado.
create or replace function private.can_see_money(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select pid is not null and (
    private.is_finance_view()
    or exists (select 1 from public.people p where p.id = pid and p.user_id = (select auth.uid()))
    or exists (
      select 1 from public.people me join public.people p on p.household_id = me.household_id
      where me.user_id = (select auth.uid()) and me.household_id is not null
        and me.household_role in ('holder', 'partner') and p.id = pid
    )
  )
$$;
grant execute on function private.can_see_money(uuid) to authenticated;

drop policy if exists invoices_sel on public.invoices;
create policy invoices_sel on public.invoices for select to authenticated using (private.can_see_money(person_id));
drop policy if exists payments_sel on public.payments;
create policy payments_sel on public.payments for select to authenticated using (private.can_see_money(person_id));
drop policy if exists passes_sel on public.passes;
create policy passes_sel on public.passes for select to authenticated using (private.can_see_person(person_id));
