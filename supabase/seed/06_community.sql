-- CPS Fit · seed 06 · noticias, eventos y resultados, encuestas, mensajes, mantenimiento, turnos, galería. Contenido de EJEMPLO.
select setseed(0.404);

insert into public.club_events (slug, kind, title_ca, title_es, description_ca, description_es, location, starts_on, ends_on, capacity, price_member_cents, price_non_member_cents, registration_open, external_url, section_id, published) values
 ('cursa-roser-2026', 'race', 'Cursa Popular de la Festa del Roser', 'Carrera Popular de la Fiesta del Roser', 'La cursa popular de la festa major. Tres recorreguts per a totes les edats. (Data d''exemple)', 'La carrera popular de la fiesta mayor. Tres recorridos para todas las edades.', 'Sant Joan les Fonts', date '2026-10-04', null, 300, 500, 800, false, null, null, true),
 ('marxa-btt-2026', 'race', 'Marxa BTT Sant Joan les Fonts 2026', 'Marcha BTT Sant Joan les Fonts 2026', 'Marxa en bicicleta de muntanya per camins de la Garrotxa. Les inscripcions es fan a RockTheSport. (Data d''exemple)', 'Marcha en bicicleta de montaña por caminos de la Garrotxa. Inscripciones en RockTheSport.', 'Sant Joan les Fonts', date '2026-11-15', null, 400, 0, 0, true, 'https://www.rockthesport.com', null, true),
 ('marxa-santjoanenca-2027', 'race', 'Marxa Santjoanenca', 'Marcha Santjoanenca', 'La marxa a peu del club, oberta a tothom. (Data d''exemple)', 'La marcha a pie del club, abierta a todos.', 'Sant Joan les Fonts', date '2027-03-14', null, 500, 400, 600, true, null, (select id from public.sections where code = 'excursionisme'), true),
 ('campus-futbol-2027', 'campus', 'Campus de Futbol', 'Campus de Fútbol', 'Setmanes de campus d''estiu amb la secció de futbol. (Dates d''exemple)', 'Semanas de campus de verano con la sección de fútbol.', 'Camps de futbol', date '2027-06-28', date '2027-07-09', 60, 12000, 15000, true, null, (select id from public.sections where code = 'futbol'), true),
 ('campus-basquet-2027', 'campus', 'Campus de Bàsquet', 'Campus de Baloncesto', 'Campus d''estiu del CBGX Santjoanenc. (Dates d''exemple)', 'Campus de verano del CBGX Santjoanenc.', 'Pavelló', date '2027-07-12', date '2027-07-16', 40, 9000, 11500, true, null, (select id from public.sections where code = 'basquet'), true),
 ('casal-estiu-2027', 'casal', 'Casal d''Estiu Poliesportiu', 'Casal de Verano Polideportivo', 'Activitats esportives i lúdiques per a infants durant l''estiu. (Preus d''exemple)', 'Actividades deportivas y lúdicas para niños durante el verano.', 'Instal·lacions del club', date '2027-06-22', date '2027-08-27', 80, 6500, 8500, true, null, null, true),
 ('curset-natacio-hivern', 'course', 'Cursets de natació (hivern)', 'Cursos de natación (invierno)', 'Cursets per a totes les edats al Club Natació Olot. (Preus d''exemple)', 'Cursos para todas las edades en el Club Natació Olot.', 'Club Natació Olot', date '2026-11-02', date '2027-01-29', 40, 3500, 4800, true, null, (select id from public.sections where code = 'natacio'), true);

insert into public.event_categories (event_id, name, min_age, max_age, capacity, distance_km)
select e.id, c.name, c.mn, c.mx, c.cap, c.km from public.club_events e join (values
  ('cursa-roser-2026', 'Cursa 10 km', 16, null, 120, 10.0), ('cursa-roser-2026', 'Cursa 5 km', 12, null, 120, 5.0), ('cursa-roser-2026', 'Infantil 1,5 km', 5, 12, 60, 1.5),
  ('marxa-btt-2026', 'Llarga 60 km', 18, null, 150, 60.0), ('marxa-btt-2026', 'Curta 35 km', 16, null, 250, 35.0)) c(slug, name, mn, mx, cap, km) on c.slug = e.slug;

-- Cursa del Roser (ya celebrada): inscritos, dorsales y resultados de ejemplo
insert into public.event_registrations (event_id, category_id, person_id, status, bib, result_seconds)
select e.id, (select c.id from public.event_categories c where c.event_id = e.id and c.name = x.cat), x.pid, 'registered', (row_number() over (order by random()))::int,
  (case x.cat when 'Cursa 10 km' then 2300 + floor(random() * 1800) when 'Cursa 5 km' then 1200 + floor(random() * 1100) else 480 + floor(random() * 300) end)::int
from public.club_events e,
  lateral (select p.id pid, case when extract(year from age(p.birth_date)) < 12 then 'Infantil 1,5 km' when random() < 0.45 then 'Cursa 10 km' else 'Cursa 5 km' end cat
           from (select id, birth_date from public.people where status = 'active' order by random() limit 44) p) x
where e.slug = 'cursa-roser-2026';
update public.event_registrations r set result_position = x.pos
from (select id, row_number() over (partition by category_id order by result_seconds) pos from public.event_registrations) x where x.id = r.id;

-- Inscripciones abiertas: unos cuantos para la Marxa Santjoanenca y el curset
insert into public.event_registrations (event_id, person_id, status)
select e.id, p.id, 'registered' from public.club_events e join lateral (select id from public.people where status = 'active' and birth_date < current_date - 20 * 365 order by random() limit 22) p on true where e.slug = 'marxa-santjoanenca-2027';

insert into public.news (slug, title_ca, title_es, excerpt_ca, excerpt_es, body_ca, body_es, category, status, published_at, pinned) values
 ('temporada-2026-27', 'Comença la temporada 2026-27', 'Empieza la temporada 2026-27', 'Futbol, bàsquet i natació tornen a la feina amb més de 200 esportistes.', 'Fútbol, baloncesto y natación vuelven a la actividad con más de 200 deportistas.',
  E'Les seccions esportives del CPS arrenquen una nova temporada.\n\n- **Futbol:** Segona Catalana, Quarta Catalana i tot el futbol base.\n- **Bàsquet:** el CBGX Santjoanenc, de pre-mini a sènior.\n- **Natació:** entrenaments a Olot a l''hivern i a la nostra piscina a l''estiu.\n\nBona temporada a tothom!', E'Las secciones deportivas del CPS arrancan una nueva temporada.\n\n- **Fútbol:** Segunda Catalana, Cuarta Catalana y todo el fútbol base.\n- **Baloncesto:** el CBGX Santjoanenc, de pre-mini a sénior.\n- **Natación:** entrenamientos en Olot en invierno y en nuestra piscina en verano.', 'seccions', 'published', now() - interval '12 days', true),
 ('marxa-btt-inscripcions', 'Marxa BTT: ja pots inscriure''t', 'Marcha BTT: ya puedes inscribirte', 'Les inscripcions de la Marxa BTT Sant Joan les Fonts 2026 es fan a RockTheSport.', 'Las inscripciones de la Marcha BTT Sant Joan les Fonts 2026 se hacen en RockTheSport.',
  E'Obrim inscripcions per a la **Marxa BTT Sant Joan les Fonts 2026**. Hi ha dos recorreguts, llarg i curt, per camins de la Garrotxa.\n\nInscripcions a través de RockTheSport.', E'Abrimos inscripciones para la **Marcha BTT Sant Joan les Fonts 2026**. Hay dos recorridos, largo y corto, por caminos de la Garrotxa.', 'esdeveniments', 'published', now() - interval '6 days', false),
 ('roser-resultats', 'Resultats de la Cursa Popular del Roser', 'Resultados de la Carrera Popular del Roser', 'Gràcies a tots els participants! Consulta els temps a l''app.', '¡Gracias a todos los participantes! Consulta los tiempos en la app.',
  E'La Cursa Popular de la Festa del Roser va ser un èxit. Els resultats per categories ja són a l''apartat **Esdeveniments**.', E'La Carrera Popular de la Fiesta del Roser fue un éxito. Los resultados por categorías ya están en el apartado **Eventos**.', 'esdeveniments', 'published', now() - interval '9 days', false),
 ('sauna-reglament', 'Recorda el reglament de la sauna', 'Recuerda el reglamento de la sauna', 'Gratuïta per a socis. Horari de dilluns a divendres i dissabte al matí.', 'Gratuita para socios. Horario de lunes a viernes y sábado por la mañana.',
  E'La sauna està oberta de dilluns a divendres de 9 a 13 h i de 16:30 a 21 h, i dissabtes de 10:30 a 13:30. Diumenges i festius, tancada. Consulta el reglament a recepció.', E'La sauna está abierta de lunes a viernes de 9 a 13 h y de 16:30 a 21 h, y sábados de 10:30 a 13:30. Domingos y festivos, cerrada.', 'serveis', 'published', now() - interval '20 days', false),
 ('padel-reserves', 'Reserva la teva pista de pàdel des de l''app', 'Reserva tu pista de pádel desde la app', 'Preu de soci o de no soci al moment, pagament a l''app i recordatoris.', 'Precio de socio o no socio al instante, pago en la app y recordatorios.',
  E'Des de l''app pots veure la disponibilitat de les 2 pistes, triar 60, 90 o 120 minuts i pagar amb el preu que et correspon. **El preu depèn de qui fa la reserva.**', E'Desde la app puedes ver la disponibilidad de las 2 pistas, elegir 60, 90 o 120 minutos y pagar con el precio que te corresponde. **El precio depende de quien hace la reserva.**', 'serveis', 'published', now() - interval '3 days', true),
 ('gimnas-nou-horari', 'El gimnàs: monitor de sala matí i tarda', 'El gimnasio: monitor de sala mañana y tarde', 'Assessorament i rutina personalitzada per a tots els abonats.', 'Asesoramiento y rutina personalizada para todos los abonados.',
  E'El monitor de sala és al gimnàs de 8 a 12 h i de 17 a 21 h. Demana la teva rutina personalitzada i fes-ne el seguiment a l''app.', E'El monitor de sala está en el gimnasio de 8 a 12 h y de 17 a 21 h. Pide tu rutina personalizada y haz el seguimiento en la app.', 'gimnas', 'published', now() - interval '1 day', false),
 ('cursets-natacio', 'Obertes les inscripcions als cursets de natació', 'Abiertas las inscripciones a los cursos de natación', 'Per a totes les edats. Places limitades.', 'Para todas las edades. Plazas limitadas.',
  E'Cursets de natació d''hivern per a infants i adults. Preus de socis i no socis.', E'Cursos de natación de invierno para niños y adultos. Precios de socios y no socios.', 'seccions', 'published', now() - interval '2 days', false),
 ('rep-50-anys', 'Els 50 anys del CPS, en imatges', 'Los 50 años del CPS, en imágenes', 'Repàs fotogràfic a mig segle d''història del club.', 'Repaso fotográfico a medio siglo de historia del club.',
  E'Repassa la història del club des de 1971 a la secció **Història** de l''app.', E'Repasa la historia del club desde 1971 en la sección **Historia** de la app.', 'club', 'scheduled', now() + interval '5 days', false);

insert into public.announcements (title_ca, title_es, body_ca, body_es, starts_at, ends_at, pinned, audience)
values ('Només socis: sessió d''informació del gimnàs', 'Solo socios: sesión informativa del gimnasio', 'Dijous a les 19 h, a la sala de dirigides.', 'Jueves a las 19 h, en la sala de dirigidas.', now(), now() + interval '8 days', false, 'members');

insert into public.polls (question_ca, question_es, options, closes_at) values
 ('Quin horari prefereixes per a les classes dirigides?', '¿Qué horario prefieres para las clases dirigidas?', '["Matins (9–11 h)","Migdia (13–15 h)","Tardes (18–20 h)","Caps de setmana"]', now() + interval '12 days');
insert into public.poll_votes (poll_id, person_id, option_idx)
select (select id from public.polls limit 1), p.id, floor(random() * 4)::int from (select id from public.people where status = 'active' and user_id is not null order by random() limit 7) p;

insert into public.messages (channel, category, person_id, from_name, from_contact, subject, body, status, created_at)
select m.ch, m.cat, (select id from public.people where email = m.email), coalesce(m.name, (select first_name || ' ' || last_name from public.people where email = m.email)), m.contact, m.subj, m.body, m.st, now() - m.ago::interval
from (values
  ('whatsapp', 'query', null, 'Anna (no socia)', '+34 600 111 111', 'Reserva de pàdel', 'Hola! Puc reservar pista sense ser sòcia?', 'new', '35 minutes'),
  ('email', 'query', 'soci1@cpsfit.demo', null, 'soci1@cpsfit.demo', 'Quota familiar', 'Els meus fills poden fer servir la piscina amb la quota familiar?', 'open', '1 day'),
  ('app', 'suggestion', 'soci6@cpsfit.demo', null, null, 'Més bicicletes estàtiques', 'Estaria bé tenir una bicicleta estàtica més al gimnàs a l''hora punta.', 'new', '3 hours'),
  ('app', 'incident', 'soci2@cpsfit.demo', null, null, 'Dutxa vestidor 2', 'La dutxa del vestidor 2 no escalfa.', 'open', '5 hours'),
  ('phone', 'query', null, 'Pere (pare)', '972 000 000', 'Inscripció a futbol', 'Vull apuntar el meu fill de 9 anys al futbol, què cal fer?', 'closed', '4 days'),
  ('email', 'query', 'client@cpsfit.demo', null, 'client@cpsfit.demo', 'Abonament de sauna', 'Quant costa l''abonament mensual de la sauna per a no socis?', 'closed', '6 days')
) as m(ch, cat, email, name, contact, subj, body, st, ago);
insert into public.message_replies (message_id, author_id, body)
select m.id, (select id from auth.users where email = 'recepcio@cpsfit.demo'), 'Hola! Sí: pots reservar sent no sòcia amb el preu de no soci. Cal que passis a fer-te la targeta d''usuari en horari de recepció.'
from public.messages m where m.subject = 'Reserva de pàdel';
insert into public.message_replies (message_id, author_id, body)
select m.id, (select id from auth.users where email = 'recepcio@cpsfit.demo'), 'L''abonament mensual de la sauna per a no socis és de 20 €.' from public.messages m where m.subject = 'Abonament de sauna';

insert into public.notifications (person_id, channel, title, body, url)
select p.id, 'push', t.title, t.body, t.url from public.people p, (values
  ('Recordatori de reserva', 'Demà tens pista de pàdel a les 19:00', '/app/reserves'),
  ('Nova factura', 'Tens un rebut pendent de pagar', '/app/pagaments'),
  ('Marxa BTT', 'Ja pots inscriure''t a la Marxa BTT 2026', '/app/esdeveniments')) t(title, body, url)
where p.email in ('soci1@cpsfit.demo', 'soci2@cpsfit.demo', 'client@cpsfit.demo');

insert into public.facility_tasks (kind, zone_id, title, description, priority, status, assigned_to, due_on, created_at)
select t.kind, (select id from public.zones where code = t.zone), t.title, t.descr, t.prio, t.st, (select id from auth.users where email = 'recepcio@cpsfit.demo'), current_date + t.due, now() - (abs(t.due) + 2 || ' days')::interval
from (values
  ('incident', 'gym', 'Dutxa vestidor 2 sense aigua calenta', 'Avisat pels socis. Revisar escalfador.', 'high', 'open', 1),
  ('maintenance', 'padel', 'Canvi de xarxa pista 2', 'Programat amb el bloqueig de la pista.', 'normal', 'in_progress', 3),
  ('maintenance', 'pool', 'Revisió de la depuradora (tancament de temporada)', 'Buidat i neteja segons protocol.', 'normal', 'open', 10),
  ('task', 'social', 'Preparar la sala per a la junta', 'Cadires i projector.', 'low', 'open', 6),
  ('incident', 'poli', 'Cistella minibàsquet solta', 'Cal fixar el suport.', 'urgent', 'in_progress', 0),
  ('task', 'gym', 'Renovar rètols de normes', 'Imprimir en català i castellà.', 'low', 'resolved', -3)) t(kind, zone, title, descr, prio, st, due);
update public.facility_tasks set resolved_at = now() - interval '2 days' where status = 'resolved';

insert into public.inventory_items (zone_id, name, qty, min_qty, notes)
select (select id from public.zones where code = t.zone), t.name, t.qty, t.min, t.note from (values
  ('padel', 'Pales de pàdel (lloguer)', 12, 8, null), ('padel', 'Pots de pilotes (venda)', 14, 20, 'Fer comanda'), ('gym', 'Tovalloles', 60, 30, null),
  ('gym', 'Desinfectant d''aparells', 5, 4, null), ('pool', 'Cloramina (litres)', 80, 50, null), ('social', 'Cadires plegables', 120, 100, null)) t(zone, name, qty, min, note);

insert into public.shifts (user_id, role, zone_id, starts_at, ends_at)
select u.id, 'monitor', (select id from public.zones where code = 'gym'),
  ((d::date + t.s::time)::timestamp at time zone 'Europe/Madrid'), ((d::date + t.e::time)::timestamp at time zone 'Europe/Madrid')
from generate_series(current_date - 3, current_date + 10, interval '1 day') d
join (values ('monitor1@cpsfit.demo', '08:00', '12:00', array[1, 3, 5]), ('monitor2@cpsfit.demo', '17:00', '21:00', array[1, 2, 3, 4, 5]), ('monitor1@cpsfit.demo', '17:00', '21:00', array[2, 4]), ('monitor2@cpsfit.demo', '08:00', '12:00', array[2, 4])) t(email, s, e, dow) on extract(dow from d)::int = any (t.dow)
join auth.users u on u.email = t.email;
insert into public.shifts (user_id, role, zone_id, starts_at, ends_at)
select u.id, 'reception', null, ((d::date + time '16:00')::timestamp at time zone 'Europe/Madrid'), ((d::date + time '22:00')::timestamp at time zone 'Europe/Madrid')
from generate_series(current_date - 3, current_date + 10, interval '1 day') d, auth.users u where u.email = 'recepcio@cpsfit.demo' and extract(dow from d)::int between 1 and 5;

insert into public.gallery_photos (album, caption, url, taken_on) values
 ('50 anys', 'Logotip del 50è aniversari', '/brand/logo-50anys.jpg', date '2021-03-07'),
 ('Club', 'Escut del club', '/brand/emblem-256.webp', null);

select (select count(*) from news) news, (select count(*) from club_events) events, (select count(*) from event_registrations) regs, (select count(*) from messages) msgs, (select count(*) from shifts) shifts, (select count(*) from facility_tasks) tasks;
