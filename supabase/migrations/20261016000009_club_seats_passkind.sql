-- Recursos con aforo (sauna, clases): cada plaza es un "seat"; los recursos exclusivos (pistas) usan siempre seat = 1.
alter table public.bookings add column if not exists seat smallint not null default 1;
alter table public.bookings drop constraint bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap exclude using gist (resource_id with =, seat with =, tstzrange(starts_at, ends_at, '[)') with &&) where (status in ('confirmed', 'blocked'));
-- Tipo de acceso que concede un bono/abono (lo usan las reglas de acceso).
alter table public.products add column if not exists pass_kind text check (pass_kind in ('gym', 'pool', 'sauna'));
