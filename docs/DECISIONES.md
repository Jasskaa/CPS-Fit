# Decisiones de diseño y arquitectura

> Documento vivo. Registra qué se decidió y por qué. Las decisiones de la fase 1 (rutinas de gimnàs) están en el README.

## Plan por fases

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Identidad (web real del club), plan, sistema de diseño base | ✅ |
| 1 | Modelo de dominio y RLS: personas, familias, tipos de cuota, zonas, accesos, recursos, reservas, facturación, secciones, eventos, comunicación | ⏳ |
| 2 | Panel admin: shell nuevo, paleta de comandos ⌘K, dashboard en vivo, directorio y ficha 360º | ⏳ |
| 3 | Accesos: carnet QR rotatorio, pantalla de recepción, aforo en vivo | ⏳ |
| 4 | Reservas: motor de precios, calendario de pàdel, reglas, lista de espera | ⏳ |
| 5 | Facturación: facturas PDF, cuotas enero/junio, remesa SEPA, TPV, pagos simulados | ⏳ |
| 6 | App del socio/cliente: carnet, reservas, pagos, familia, noticias | ⏳ |
| 7 | Secciones, eventos, comunicación, historia del club, mapa | ⏳ |
| 8 | Informes, auditoría, pulido visual, tests, documentación, despliegue | ⏳ |

## Decisiones

**D1 · Tokens de marca tomados de la web real.** Se midió `cpsantjoanenc.org` con el navegador: azul de fondo `#263CB9`, barra de menú `#AADBFF`, azul marino `#003154`, azul medio `#0063A9`; titulares en *League Spartan*; texto en *DIN Next* (licencia de pago, no se puede incrustar → *Inter*). El amarillo `#F8F800` del escudo se mantiene como acento. El primario pasa a ser el azul de la web (contraste 8,6:1 con blanco).

**D2 · Se extiende el esquema existente, no se rehace.** `profiles` (ligado a `auth.users`) sigue siendo la identidad de login y de la parte de gimnàs. Se añade `people`, que representa a *cualquier persona* del club (con o sin cuenta: niños, no socios, clientes ocasionales) y se enlaza con `profiles` por `user_id`. Así las rutinas, entrenos y RLS ya probados siguen funcionando.

**D3 · Roles.** Se amplía `user_role` con `board` (junta), `reception`, `coordinator` (coordinador de sección) y `coach` (entrenador). Se mantienen `admin`, `trainer` (monitor de sala) y `member` (socio o cliente con cuenta). Los permisos finos viven en `src/lib/permissions.ts` (qué módulos ve cada rol) y en RLS (qué filas).

**D4 · Reglas del club en datos, no en código.** Tarifas (`pricing_rules`), tipos de cuota (`membership_types`), zonas y reglas de acceso (`access_rules`), catálogo (`products`) y ajustes (`settings`) están en tablas editables desde el panel. Los valores no publicados por el club se siembran marcados como *ejemplo*.

**D5 · Familias.** `households` agrupa personas; la cuota **Familiar** (2 adultos) se factura una vez al titular. Los menores se vinculan a un adulto de su hogar. Validaciones (edad, antigüedad ≥ 10 años para jubilado, empadronamiento) en `src/modules/membership/rules.ts`, con tests.

**D6 · Reservas sin solapes garantizado por la base de datos.** Restricción `EXCLUDE USING gist` sobre `(resource_id, tstzrange)` para que dos reservas confirmadas no puedan coincidir aunque haya concurrencia. El precio lo decide quien reserva (socio / no socio) y se calcula con un motor puro y testeado (`src/modules/booking/pricing.ts`).

**D7 · Accesos con evaluación pura.** `evaluateAccess()` recibe persona, zona, hora y contexto y devuelve `{allowed, reason}` — sin I/O, fácil de testear. El hardware real se conectaría detrás de la interfaz `AccessControlProvider`.

**D8 · Carnet QR rotatorio.** El QR contiene un token firmado con HMAC-SHA256 y una ventana de 30 s (`CARD_QR_SECRET`, solo servidor). Caduca solo, así que una captura de pantalla no sirve.

**D9 · Pagos simulados detrás de una interfaz.** `PaymentProvider` con implementación `SimulatedProvider` (tarjeta de prueba). Stripe en modo test sería una segunda implementación; no se guardan datos de tarjeta.

**D10 · IBAN.** Datos ficticios, en una tabla aparte (`bank_accounts`) visible solo para admin/junta y el propio titular; la interfaz solo muestra los 4 últimos dígitos. Para producción: cifrado con Supabase Vault/pgsodium (documentado en `MIGRACION.md`).

**D11 · Tiempo real.** Supabase Realtime sobre `access_logs` y `bookings` para aforo y calendario en vivo.

**D12 · Módulos por dominio.** Código nuevo en `src/modules/<dominio>/` (reglas puras, consultas, acciones, componentes). Lo de gimnàs de la fase 1 se queda donde está y se documenta.
