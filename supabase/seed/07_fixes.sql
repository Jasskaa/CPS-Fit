-- Correcciones posteriores a los seeds: motivos de acceso como códigos (la interfaz los traduce) y fechas de factura coherentes con la reserva.
update public.access_logs set reason = case reason when 'Targeta bloquejada' then 'blocked' when 'Quota pendent' then 'debt' when 'Fora d''horari' then 'closed' when 'Sense reserva' then 'needs_booking' when 'Abonament caducat' then 'needs_pass' else reason end
where reason not in ('ok','inactive','blocked','debt','no_rule','denied','closed','needs_booking','needs_pass','capacity');
update public.invoices i set issued_on = (b.starts_at at time zone 'Europe/Madrid')::date, due_on = (b.starts_at at time zone 'Europe/Madrid')::date, paid_at = coalesce(i.paid_at, b.starts_at - interval '1 day')
from public.bookings b where b.invoice_id = i.id and i.kind = 'booking' and i.issued_on > (b.starts_at at time zone 'Europe/Madrid')::date;
