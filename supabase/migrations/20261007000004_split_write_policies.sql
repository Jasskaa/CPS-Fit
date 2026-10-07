-- Rendimiento: las políticas "for all" solapaban con las de SELECT (varias políticas permisivas por acción).
-- Se sustituyen por políticas separadas de INSERT / UPDATE / DELETE con la misma lógica.
do $$
declare
  r record;
  base text;
begin
  for r in
    select tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and policyname in ('bm_write', 'md_write', 'pr_write', 'pp_write', 'rd_write', 're_write', 'ws_write', 'wset_write')
  loop
    base := regexp_replace(r.policyname, '_write$', '');
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', base || '_insert', r.tablename, coalesce(r.with_check, r.qual));
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', base || '_update', r.tablename, r.qual, coalesce(r.with_check, r.qual));
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', base || '_delete', r.tablename, r.qual);
  end loop;
end $$;
