-- CPS Fit · seed 01 · configuración real del club (datos publicados en cpsantjoanenc.org).
-- Los valores marcados "ejemplo" NO son del club (no publicados): son configurables desde el panel.

insert into public.zones (code, name_ca, name_es, kind, capacity, color, sort) values
 ('gym', 'Gimnàs · sala de musculació', 'Gimnasio · sala de musculación', 'fitness', 40, '#263cb9', 1),
 ('classes', 'Sala d''activitats dirigides', 'Sala de dirigidas', 'fitness', 25, '#5b73f0', 2),
 ('pool', 'Piscina gran (25×13,70 m)', 'Piscina grande', 'water', 120, '#1c9bd6', 3),
 ('pool_kids', 'Piscina infantil', 'Piscina infantil', 'water', 30, '#59c1ee', 4),
 ('sauna', 'Sauna', 'Sauna', 'wellness', 8, '#c2570c', 5),
 ('padel', 'Pistes de pàdel', 'Pistas de pádel', 'racket', 8, '#0b7a45', 6),
 ('poli', 'Pista poliesportiva', 'Pista polideportiva', 'court', 30, '#8a4fd0', 7),
 ('pavello', 'Pavelló poliesportiu', 'Pabellón polideportivo', 'court', 150, '#b8328a', 8),
 ('field11', 'Camp de futbol 11 (gespa natural)', 'Campo de fútbol 11 (césped natural)', 'field', 60, '#3f9e3a', 9),
 ('field7', 'Camp de futbol 7 (gespa artificial)', 'Campo de fútbol 7 (césped artificial)', 'field', 30, '#6cc04a', 10),
 ('social', 'Local social', 'Local social', 'area', 60, '#7a8aa3', 11);

-- Reglas de acceso (0 = diumenge). El gimnàs requiere abono de gimnàs (socios: 11 €/mes · 30 €/trimestre).
insert into public.access_rules (zone_id, audience, weekdays, time_from, time_to, season_from, season_to, requires_booking, requires_pass_kind, note_ca, sort)
select z.id, r.audience, r.weekdays, r.t_from::time, r.t_to::time, r.s_from::date, r.s_to::date, r.req_booking, r.req_pass, r.note, r.sort
from (values
  ('gym', 'pass_holder', '{1,2,3,4,5}'::smallint[], '07:00', '21:30', null, null, false, 'gym', 'Abonament de gimnàs vigent', 1),
  ('gym', 'pass_holder', '{6}', '08:00', '20:00', null, null, false, 'gym', 'Abonament de gimnàs vigent', 2),
  ('gym', 'pass_holder', '{0}', '08:00', '14:00', null, null, false, 'gym', 'Abonament de gimnàs vigent', 3),
  ('classes', 'pass_holder', '{1,2,3,4,5}', '07:00', '21:30', null, null, false, 'gym', 'Quan no hi ha activitat (cicle indoor virtual)', 1),
  ('classes', 'pass_holder', '{6}', '08:00', '20:00', null, null, false, 'gym', 'Quan no hi ha activitat', 2),
  ('classes', 'pass_holder', '{0}', '08:00', '14:00', null, null, false, 'gym', 'Quan no hi ha activitat', 3),
  ('pool', 'member', '{0,1,2,3,4,5,6}', '09:00', '20:00', '2026-06-20', '2026-09-06', false, null, 'Gratuït per a socis (temporada d''estiu · exemple de dates)', 1),
  ('pool', 'pass_holder', '{0,1,2,3,4,5,6}', '09:00', '20:00', '2026-06-20', '2026-09-06', false, 'pool', 'Entrada, bo o abonament de temporada', 2),
  ('pool_kids', 'member', '{0,1,2,3,4,5,6}', '09:00', '20:00', '2026-06-20', '2026-09-06', false, null, 'Gratuït per a socis', 1),
  ('pool_kids', 'pass_holder', '{0,1,2,3,4,5,6}', '09:00', '20:00', '2026-06-20', '2026-09-06', false, 'pool', 'Entrada, bo o abonament', 2),
  ('sauna', 'member', '{1,2,3,4,5}', '09:00', '13:00', null, null, false, null, 'Gratuïta per a socis', 1),
  ('sauna', 'member', '{1,2,3,4,5}', '16:30', '21:00', null, null, false, null, 'Gratuïta per a socis', 2),
  ('sauna', 'member', '{6}', '10:30', '13:30', null, null, false, null, 'Gratuïta per a socis', 3),
  ('sauna', 'pass_holder', '{1,2,3,4,5}', '09:00', '13:00', null, null, false, 'sauna', 'Abonament mensual (no socis: 20 €/mes)', 4),
  ('sauna', 'pass_holder', '{1,2,3,4,5}', '16:30', '21:00', null, null, false, 'sauna', 'Abonament mensual', 5),
  ('sauna', 'pass_holder', '{6}', '10:30', '13:30', null, null, false, 'sauna', 'Abonament mensual', 6),
  ('padel', 'member', '{0,1,2,3,4,5,6}', '08:00', '22:00', null, null, true, null, 'Cal reserva (2 pistes)', 1),
  ('padel', 'non_member', '{0,1,2,3,4,5,6}', '08:00', '22:00', null, null, true, null, 'Cal reserva i targeta d''usuari', 2),
  ('poli', 'member', '{0,1,2,3,4,5,6}', '09:00', '22:00', null, null, true, null, 'Ús lliure amb reserva prèvia (des de gener 2024)', 1),
  ('pavello', 'member', '{0,1,2,3,4,5,6}', '08:00', '23:00', null, null, true, null, 'Només amb reserva (entrenaments)', 1),
  ('field11', 'member', '{0,1,2,3,4,5,6}', '08:00', '23:00', null, null, true, null, 'Només amb reserva (entrenaments i partits)', 1),
  ('field7', 'member', '{0,1,2,3,4,5,6}', '08:00', '23:00', null, null, true, null, 'Només amb reserva', 1),
  ('social', 'member', '{1,2,3,4,5}', '16:00', '22:00', null, null, false, null, 'Horari de recepció', 1)
) as r(zone, audience, weekdays, t_from, t_to, s_from, s_to, req_booking, req_pass, note, sort)
join public.zones z on z.code = r.zone;

insert into public.resources (zone_id, code, name, kind, slot_min, open_time, close_time, durations, max_advance_days, cancel_hours, max_active_per_person, capacity)
select z.id, r.code, r.name, r.kind, 30, r.o::time, r.c::time, r.dur, r.adv, r.canc, r.maxp, r.cap
from (values
  ('padel', 'padel-1', 'Pista pàdel 1', 'padel', '08:00', '22:00', '{60,90,120}'::smallint[], 14, 24, 3, null::smallint),
  ('padel', 'padel-2', 'Pista pàdel 2', 'padel', '08:00', '22:00', '{60,90,120}'::smallint[], 14, 24, 3, null),
  ('poli', 'poli-1', 'Pista poliesportiva', 'court', '09:00', '22:00', '{60,90,120}', 7, 12, 2, null),
  ('classes', 'classes-room', 'Sala de dirigides', 'room', '07:00', '21:30', '{60}', 14, 6, 4, 25),
  ('sauna', 'sauna-1', 'Sauna', 'sauna', '09:00', '21:00', '{60}', 3, 2, 2, 8),
  ('pavello', 'pavello-1', 'Pavelló poliesportiu', 'hall', '08:00', '23:00', '{60,90,120}', 30, 24, 5, null),
  ('field11', 'field-11', 'Camp futbol 11', 'field', '08:00', '23:00', '{90,120}', 30, 24, 5, null),
  ('field7', 'field-7', 'Camp futbol 7', 'field', '08:00', '23:00', '{60,90}', 30, 24, 5, null)
) as r(zone, code, name, kind, o, c, dur, adv, canc, maxp, cap)
join public.zones z on z.code = r.zone;

-- Tarifas de pàdel por pista y hora (reales): socio 10,50 € (08–16) / 14,50 € (16–22) · no socio 16,50 € / 20,50 €. Luz incluida.
insert into public.pricing_rules (resource_kind, audience, hour_from, hour_to, price_cents_hour, note) values
 ('padel', 'member', 8, 16, 1050, 'Socio · mañana'),
 ('padel', 'member', 16, 22, 1450, 'Socio · tarde'),
 ('padel', 'non_member', 8, 16, 1650, 'No socio · mañana'),
 ('padel', 'non_member', 16, 22, 2050, 'No socio · tarde');

insert into public.membership_types (code, name_ca, name_es, description_ca, annual_fee_cents, min_age, max_age, needs_adult_link, needs_pair, min_seniority_years, retiree, sort) values
 ('familiar', 'Soci Familiar', 'Socio Familiar', '2 adults de parella; cal justificant d''empadronament a la mateixa vivenda', 11300, 18, null, false, true, null, false, 1),
 ('individual', 'Soci Individual', 'Socio Individual', 'Adults a partir de 24 anys', 8700, 24, null, false, false, null, false, 2),
 ('jove', 'Soci Jove', 'Socio Joven', 'De 18 a 23 anys', 6050, 18, 23, false, false, null, false, 3),
 ('adherit', 'Soci Adherit', 'Socio Adherido', 'De 8 a 17 anys, vinculat a un soci adult', 3300, 8, 17, true, false, null, false, 4),
 ('beneficiari', 'Beneficiari Menor', 'Beneficiario Menor', 'Fins a 7 anys, vinculat a un adult. Gratuït', 0, 0, 7, true, false, null, false, 5),
 ('jubilat_individual', 'Jubilat individual', 'Jubilado individual', '25 % de la quota individual (≥ 10 anys d''antiguitat)', 2175, 60, null, false, false, 10, true, 6),
 ('jubilat_familiar', 'Jubilat familiar', 'Jubilado familiar', '25 % de la quota familiar (≥ 10 anys d''antiguitat)', 2800, 60, null, false, true, 10, true, 7);

insert into public.products (code, name_ca, name_es, kind, price_member_cents, price_non_member_cents, vat_pct, uses, valid_days, nominal, season_only, age_min, age_max, example, pass_kind, sort) values
 ('extra_pala', 'Lloguer de pala de pàdel', 'Alquiler de pala de pádel', 'extra', 200, 200, 0, null, null, false, false, null, null, false, null, 1),
 ('extra_pilotes', 'Pot de pilotes', 'Bote de pelotas', 'extra', 600, 600, 0, null, null, false, false, null, null, false, null, 2),
 ('fee_entry', 'Quota d''entrada (per unitat familiar)', 'Cuota de entrada (por unidad familiar)', 'fee', 10500, 10500, 0, null, null, false, false, null, null, false, null, 3),
 ('pool_wd', 'Entrada piscina (dill.–div.)', 'Entrada piscina (L–V)', 'ticket', 0, 680, 0, null, null, false, false, 8, null, false, null, 10),
 ('pool_wd_eve', 'Entrada piscina (dill.–div. des de les 18 h)', 'Entrada piscina (L–V desde las 18 h)', 'ticket', 0, 420, 0, null, null, false, false, 8, null, false, null, 11),
 ('pool_we', 'Entrada piscina (cap de setmana i festius)', 'Entrada piscina (fin de semana y festivos)', 'ticket', 0, 900, 0, null, null, false, false, 8, null, false, null, 12),
 ('pool_we_eve', 'Entrada piscina (cap de setmana, des de les 18 h)', 'Entrada piscina (fin de semana, desde las 18 h)', 'ticket', 0, 500, 0, null, null, false, false, 8, null, false, null, 13),
 ('pool_free_kid', 'Entrada piscina fins a 7 anys', 'Entrada piscina hasta 7 años', 'ticket', 0, 0, 0, null, null, false, false, 0, 7, false, null, 14),
 ('pool_season', 'Abonament de temporada piscina', 'Abono de temporada piscina', 'pass', 0, 10000, 0, null, 90, true, true, 18, null, false, 'pool', 15),
 ('pool_season_kid', 'Abonament de temporada piscina infantil (8–17)', 'Abono de temporada piscina infantil (8–17)', 'pass', 0, 5500, 0, null, 90, true, true, 8, 17, false, 'pool', 16),
 ('pool_bono10', 'Bo 10 banys', 'Bono 10 baños', 'pass', 0, 5200, 0, 10, 120, false, true, null, null, false, 'pool', 17),
 ('pool_bono15', 'Bo 15 banys', 'Bono 15 baños', 'pass', 0, 6800, 0, 15, 120, false, true, null, null, false, 'pool', 18),
 ('sauna_month', 'Sauna · abonament mensual', 'Sauna · abono mensual', 'pass', 0, 2000, 0, null, 30, true, false, 16, null, false, 'sauna', 20),
 ('gym_month', 'Gimnàs · abonament mensual', 'Gimnasio · abono mensual', 'pass', 1100, 2500, 0, null, 30, true, false, 16, null, true, 'gym', 30),
 ('gym_quarter', 'Gimnàs · abonament trimestral', 'Gimnasio · abono trimestral', 'pass', 3000, 6500, 0, null, 90, true, false, 16, null, true, 'gym', 31),
 ('natacio_curset', 'Curset de natació (trimestre)', 'Curso de natación (trimestre)', 'course', 3500, 4800, 0, null, null, true, false, 4, null, true, null, 40),
 ('merch_samarreta', 'Samarreta del club', 'Camiseta del club', 'merch', 1000, 1400, 21, null, null, false, false, null, null, true, null, 50),
 ('merch_ampolla', 'Ampolla del club', 'Botella del club', 'merch', 600, 800, 21, null, null, false, false, null, null, true, null, 51);

insert into public.seasons (name, starts_on, ends_on, is_current) values
 ('2025-26', '2025-09-01', '2026-06-30', false),
 ('2026-27', '2026-09-01', '2027-06-30', true);

insert into public.sections (code, name_ca, name_es, description_ca, description_es, email, color, discount_pct, founded_year, sort) values
 ('futbol', 'Futbol', 'Fútbol', 'Més de 100 jugadors. Temporada 2026-27: Segona Catalana, Quarta Catalana, cadets, infantils, alevins, benjamins i pre-benjamins. Coordinador: Arnau Pujolar.', 'Más de 100 jugadores. Temporada 2026-27: Segunda Catalana, Cuarta Catalana, cadetes, infantiles, alevines, benjamines y pre-benjamines.', 'cpsfutbol@gmail.com', '#3f9e3a', 25, null, 1),
 ('basquet', 'Bàsquet (CBGX Santjoanenc)', 'Baloncesto (CBGX Santjoanenc)', 'Fundat el 1977, colors negre i blanc. 8 equips de pre-mini a sènior masculí i femení, amb Director Tècnic.', 'Fundado en 1977, colores negro y blanco. 8 equipos de pre-mini a sénior masculino y femenino.', 'cbgxcps@gmail.com', '#1c2532', 25, 1977, 2),
 ('natacio', 'Natació', 'Natación', 'El primer esport del club i el principal. A l''hivern entrena al Club Natació Olot els divendres de 20 a 21 h; a l''estiu cada dia a la piscina del CPS. Copa Pirineus i Challenge David Moner.', 'El primer deporte del club. En invierno entrena en el Club Natació Olot los viernes de 20 a 21 h; en verano a diario en la piscina del CPS.', 'cpsnatacio@gmail.com', '#1c9bd6', 25, 1970, 3),
 ('excursionisme', 'Excursionisme', 'Excursionismo', 'Afiliat a la FEEC. Tramitació de llicència federativa.', 'Afiliado a la FEEC. Tramitación de licencia federativa.', 'info@cpsantjoanenc.org', '#8a5a2b', 0, null, 4);

insert into public.club_history (year, title_ca, title_es, body_ca, body_es) values
 (1970, 'La piscina', 'La piscina', 'Es construeix la piscina, el primer gran equipament del club.', 'Se construye la piscina, el primer gran equipamiento del club.'),
 (1971, 'Naixement del CPS', 'Nace el CPS', 'El 7 de març de 1971 64 socis fundadors creen el Club Poliesportiu Santjoanenc.', 'El 7 de marzo de 1971, 64 socios fundadores crean el Club Polideportivo Santjoanenc.'),
 (1977, 'Neix el bàsquet', 'Nace el baloncesto', 'Es funda la secció de bàsquet.', 'Se funda la sección de baloncesto.'),
 (1983, 'El pavelló', 'El pabellón', 'S''inaugura el pavelló poliesportiu.', 'Se inaugura el pabellón polideportivo.'),
 (2001, 'Un títol per recordar', 'Un título para recordar', 'Un any de títols per a les seccions esportives (dades a confirmar amb el club).', 'Un año de títulos para las secciones deportivas (datos por confirmar con el club).'),
 (2012, 'Un altre títol', 'Otro título', 'Nou èxit esportiu (dades a confirmar amb el club).', 'Nuevo éxito deportivo (datos por confirmar con el club).'),
 (2018, 'Piscina nova i gimnàs', 'Piscina nueva y gimnasio', 'Es reforma la piscina i el gimnàs passa a la nova ubicació; s''equipa el 2019.', 'Se reforma la piscina y el gimnasio pasa a la nueva ubicación; se equipa en 2019.'),
 (2021, '50 anys', '50 años', 'El club celebra el seu 50è aniversari.', 'El club celebra su 50 aniversario.'),
 (2023, 'La sauna', 'La sauna', 'El 17 de novembre s''estrena la sauna.', 'El 17 de noviembre se estrena la sauna.'),
 (2024, 'Pista poliesportiva d''ús lliure', 'Pista polideportiva de uso libre', 'Des del gener, ús lliure per als socis amb reserva prèvia.', 'Desde enero, uso libre para socios con reserva previa.');

insert into public.settings (key, value) values
 ('club', '{"name":"Club Poliesportiu Santjoanenc","address":"C/ Paperera Torras, 2, 17857 Sant Joan les Fonts","phone":"972 29 22 37","whatsapp":"621 204 722","email":"info@cpsantjoanenc.org","founded":"1971-03-07","reception":"L–V 16–22 h","members_count":1217,"booking_url":"https://cpsantjoanenc.poliwincloud.com/cat#ModCont"}'),
 ('billing', '{"series":"F","due_days":15,"iban":"ES9121000418450200051332","creditor_id":"ES21000G00000000","creditor_name":"Club Poliesportiu Santjoanenc","vat_default":0,"entry_fee_cents":10500,"fee_months":[1,6],"example":true}'),
 ('access', '{"block_on_debt":true,"debt_days":30,"qr_window_seconds":30}'),
 ('bookings', '{"no_show_strikes":3,"waitlist":true}'),
 ('sections', '{"discount_pct":25}');
