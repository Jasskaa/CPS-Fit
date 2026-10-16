export default {
  ca: { club: { access: {
    title: 'Accessos', subtitle: 'Control d’entrades, aforament en directe i regles per zona.',
    tabs: { live: 'En directe', reception: 'Recepció', log: 'Registre', rules: 'Regles' },
    zone: 'Zona', direction: 'Sentit', in: 'Entrada', out: 'Sortida', scanPh: 'Escaneja el QR o escriu el número de carnet…', check: 'Comprova', camera: 'Usar la càmera', stopCamera: 'Atura la càmera', manual: 'Cerca manual', manualPh: 'Nom o DNI…',
    allowed: 'ACCÉS PERMÈS', denied: 'ACCÉS DENEGAT', waiting: 'Esperant lectura…', errors: { empty: 'Escriu o escaneja un codi', not_found: 'Persona o carnet no trobats', invalid_qr: 'QR caducat o no vàlid', zone: 'Zona no vàlida', not_configured: 'Falta configurar el secret del QR', blocked: 'Carnet bloquejat' },
    insideNow: 'Dins ara', lastEntries: 'Últims moviments', noMovements: 'Encara no hi ha moviments.',
    log: { person: 'Persona', zone: 'Zona', when: 'Quan', result: 'Resultat', reason: 'Motiu', method: 'Mètode', all: 'Tots', onlyDenied: 'Només denegats', allowed: 'Permès', denied: 'Denegat', empty: 'Cap moviment amb aquests filtres', exportCsv: 'Exporta CSV' },
    rules: { audience: 'Públic', member: 'Socis', non_member: 'No socis', pass_holder: 'Amb bo', hours: 'Horari', days: 'Dies', season: 'Temporada', booking: 'Cal reserva', pass: 'Bo', allDay: 'Tot el dia', allSeason: 'Tot l’any', rule: 'Regla', deny: 'Denega', allow: 'Permet', d: ['dg', 'dl', 'dt', 'dc', 'dj', 'dv', 'ds'], hint: 'Les regles es defineixen com a dades: es poden canviar sense tocar codi.' },
    qr: { title: 'Carnet digital', hint: 'El codi canvia cada minut.', refresh: 'S’actualitza en {s} s', error: 'No s’ha pogut generar el codi' },
  } } },
  es: { club: { access: {
    title: 'Accesos', subtitle: 'Control de entradas, aforo en directo y reglas por zona.',
    tabs: { live: 'En directo', reception: 'Recepción', log: 'Registro', rules: 'Reglas' },
    zone: 'Zona', direction: 'Sentido', in: 'Entrada', out: 'Salida', scanPh: 'Escanea el QR o escribe el número de carnet…', check: 'Comprobar', camera: 'Usar la cámara', stopCamera: 'Parar la cámara', manual: 'Búsqueda manual', manualPh: 'Nombre o DNI…',
    allowed: 'ACCESO PERMITIDO', denied: 'ACCESO DENEGADO', waiting: 'Esperando lectura…', errors: { empty: 'Escribe o escanea un código', not_found: 'Persona o carnet no encontrados', invalid_qr: 'QR caducado o no válido', zone: 'Zona no válida', not_configured: 'Falta configurar el secreto del QR', blocked: 'Carnet bloqueado' },
    insideNow: 'Dentro ahora', lastEntries: 'Últimos movimientos', noMovements: 'Todavía no hay movimientos.',
    log: { person: 'Persona', zone: 'Zona', when: 'Cuándo', result: 'Resultado', reason: 'Motivo', method: 'Método', all: 'Todos', onlyDenied: 'Solo denegados', allowed: 'Permitido', denied: 'Denegado', empty: 'Ningún movimiento con estos filtros', exportCsv: 'Exportar CSV' },
    rules: { audience: 'Público', member: 'Socios', non_member: 'No socios', pass_holder: 'Con bono', hours: 'Horario', days: 'Días', season: 'Temporada', booking: 'Requiere reserva', pass: 'Bono', allDay: 'Todo el día', allSeason: 'Todo el año', rule: 'Regla', deny: 'Deniega', allow: 'Permite', d: ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'], hint: 'Las reglas se definen como datos: se pueden cambiar sin tocar código.' },
    qr: { title: 'Carnet digital', hint: 'El código cambia cada minuto.', refresh: 'Se actualiza en {s} s', error: 'No se ha podido generar el código' },
  } } },
}
