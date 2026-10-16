const att = { ca: { present: 'Present', absent: 'Absent', yes: 'Hi va', no: 'No hi va', maybe: 'Potser', unknown: 'Sense resposta' }, es: { present: 'Presente', absent: 'Ausente', yes: 'Va', no: 'No va', maybe: 'Quizá', unknown: 'Sin respuesta' } }
export default {
  ca: { club: { sections: {
    title: 'Seccions i equips', subtitle: 'Seccions esportives, equips, entrenaments, partits i esdeveniments del club.',
    tabs: { sections: 'Seccions', events: 'Esdeveniments', calendar: 'Calendari' },
    nTeams: '{n} equips', coordinator: 'Coordinació', founded: 'Fundada el {y}', discount: 'descompte soci', teams: 'Equips', newTeam: 'Nou equip', noTeams: 'Aquesta secció encara no té equips.', category: 'Categoria', gender: 'Gènere', league: 'Competició',
    roster: 'Plantilla', addMember: 'Afegeix membre', role: 'Rol', roles: { player: 'Jugador/a', coach: 'Entrenador/a', coordinator: 'Coordinador/a', staff: 'Staff' }, shirt: 'Dorsal', medical: 'Reconeixement', photo: 'Imatge', emptyRoster: 'Plantilla buida.',
    schedule: 'Entrenaments i partits', newSession: 'Nova sessió', end: 'Final', location: 'Lloc', opponent: 'Rival', home: 'Local', noSessions: 'Encara no hi ha sessions.', attendance: 'Convocatòria', result: 'Resultat', scoreFor: 'A favor', scoreAgainst: 'En contra',
    teamKinds: { training: 'Entrenament', match: 'Partit', trip: 'Sortida', other: 'Altres' }, att: att.ca, upcoming: 'Propers esdeveniments dels equips', noCalendar: 'No hi ha sessions properes.',
    newEvent: 'Nou esdeveniment', eventTitle: 'Títol', eventKind: 'Tipus', kinds: { event: 'Esdeveniment', campus: 'Campus', course: 'Curset', race: 'Cursa', casal: 'Casal' }, section: 'Secció', capacity: 'Aforament', priceMember: 'Preu soci (€)', priceNon: 'Preu no soci (€)', noEvents: 'Encara no hi ha esdeveniments', draft: 'Esborrany',
    open: 'Inscripcions obertes', closed: 'Inscripcions tancades', openReg: 'Obre inscripcions', closeReg: 'Tanca inscripcions', registrations: 'Inscripcions', register: 'Inscriu una persona', registerHint: 'Si queda plaça es crea la factura amb el preu de soci o no soci; si no, entra en llista d’espera.', noRegs: 'Encara no hi ha inscrits.',
    bib: 'Dorsal', payment: 'Pagament', time: 'Temps', position: 'Posició', regStatus: { registered: 'Inscrit', waitlist: 'En espera', cancelled: 'Cancel·lat' }, info: 'Dades',
  } } },
  es: { club: { sections: {
    title: 'Secciones y equipos', subtitle: 'Secciones deportivas, equipos, entrenamientos, partidos y eventos del club.',
    tabs: { sections: 'Secciones', events: 'Eventos', calendar: 'Calendario' },
    nTeams: '{n} equipos', coordinator: 'Coordinación', founded: 'Fundada en {y}', discount: 'descuento socio', teams: 'Equipos', newTeam: 'Nuevo equipo', noTeams: 'Esta sección todavía no tiene equipos.', category: 'Categoría', gender: 'Género', league: 'Competición',
    roster: 'Plantilla', addMember: 'Añadir miembro', role: 'Rol', roles: { player: 'Jugador/a', coach: 'Entrenador/a', coordinator: 'Coordinador/a', staff: 'Staff' }, shirt: 'Dorsal', medical: 'Reconocimiento', photo: 'Imagen', emptyRoster: 'Plantilla vacía.',
    schedule: 'Entrenamientos y partidos', newSession: 'Nueva sesión', end: 'Final', location: 'Lugar', opponent: 'Rival', home: 'Local', noSessions: 'Todavía no hay sesiones.', attendance: 'Convocatoria', result: 'Resultado', scoreFor: 'A favor', scoreAgainst: 'En contra',
    teamKinds: { training: 'Entrenamiento', match: 'Partido', trip: 'Salida', other: 'Otros' }, att: att.es, upcoming: 'Próximos eventos de los equipos', noCalendar: 'No hay sesiones próximas.',
    newEvent: 'Nuevo evento', eventTitle: 'Título', eventKind: 'Tipo', kinds: { event: 'Evento', campus: 'Campus', course: 'Cursillo', race: 'Carrera', casal: 'Casal' }, section: 'Sección', capacity: 'Aforo', priceMember: 'Precio socio (€)', priceNon: 'Precio no socio (€)', noEvents: 'Todavía no hay eventos', draft: 'Borrador',
    open: 'Inscripciones abiertas', closed: 'Inscripciones cerradas', openReg: 'Abrir inscripciones', closeReg: 'Cerrar inscripciones', registrations: 'Inscripciones', register: 'Inscribir a una persona', registerHint: 'Si queda plaza se crea la factura con el precio de socio o no socio; si no, entra en lista de espera.', noRegs: 'Todavía no hay inscritos.',
    bib: 'Dorsal', payment: 'Pago', time: 'Tiempo', position: 'Posición', regStatus: { registered: 'Inscrito', waitlist: 'En espera', cancelled: 'Cancelado' }, info: 'Datos',
  } } },
}
