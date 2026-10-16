-- Endurecimiento: extensión fuera de public y política explícita de "nadie" sobre el contador de facturas (solo triggers).
alter extension btree_gist set schema extensions;
create policy invoice_counters_none on public.invoice_counters for select to authenticated using (false);
