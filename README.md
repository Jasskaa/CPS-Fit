# CPS Fit

App de rutinas y seguimiento para el gimnàs del **Club Poliesportiu Santjoanenc** (Sant Joan les Fonts). *«El teu entrenament, al teu club.»*

Un único proyecto Next.js con dos experiencias:

- **`/app` — App del socio (PWA instalable, mobile-first)**: rutina asignada, modo entreno en vivo con temporizador de descanso, funciona sin conexión, progreso, récords, medidas, fotos opcionales, rutinas propias, información del club.
- **`/admin` — Panel del monitor y administración (desktop/tablet)**: socios, biblioteca de ejercicios (108), constructor de rutinas con drag & drop, plantillas, asignación a uno o varios socios, seguimiento, comentarios, avisos y gestión de monitores.

Interfaz en **catalán y castellano** (selector en todas las pantallas), modo claro/oscuro, colores y logo extraídos del club. **Prototipo con datos 100 % ficticios.**

## Arrancar

Requisitos: Node 20+ y un proyecto Supabase (el de pruebas ya está configurado en `.env.local`).

```bash
npm install
cp .env.example .env.local     # y rellena las claves (ver abajo)
npm run dev                    # http://localhost:3000
```

> En Windows, si `next dev` falla con `ERR_SWC_NATIVE_CACHE`, define `SWC_NATIVE_BINDING_CACHE` apuntando a una carpeta propia (p. ej. `.swc-cache/`, ya ignorada por git). Es un problema de permisos de la caché de SWC, no de la app.

### Cuentas de demo

Contraseña de todas: **`Demo1234!`**

| Rol | Correo | Qué ver |
|---|---|---|
| Admin | `admin@cpsfit.demo` | Todo, gestión de monitores y validación de altas |
| Monitor 1 | `monitor1@cpsfit.demo` | Socios 1–6 |
| Monitor 2 | `monitor2@cpsfit.demo` | Socios 7–12 |
| Socio | `soci1@cpsfit.demo` … `soci12@cpsfit.demo` | `soci4` y `soci9` llevan días sin venir; `soci8` está en pausa; `soci11` está pendiente de validar |

### Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sí | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sí | clave pública (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | no* | **Secreta, solo servidor.** Habilita invitar socios por correo y el borrado completo de cuenta |
| `NEXT_PUBLIC_SITE_URL` | no | URL pública para los enlaces de invitación |

\* Sin ella todo funciona: los socios se registran solos y el admin los valida en *Monitores → Altas pendientes*.
`.env.local` está en `.gitignore`; no hay secretos en el repositorio.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` / `build` / `start` | desarrollo / compilación / producción |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Vitest: lógica de 1RM, volumen, PRs, rachas, adherencia (13 tests) |
| `npm run test:e2e` | Playwright contra la **build de producción** (`npm run build` antes): login y roles, entreno, modo offline + sincronización, constructor de rutinas y accesibilidad WCAG (axe) en claro y oscuro |
| `node scripts/i18n-keys.mjs` | verifica que todas las claves de traducción existan en `ca` y `es` |
| `node scripts/gen-seed.mjs` | regenera `supabase/seed.sql` |
| `node scripts/import-members.mjs` | importación CSV de socios (simulación por defecto) |

Los tests E2E escriben unas pocas filas en la base de demo (entrenos de `soci9`/`soci10`, una plantilla «Prova E2E»); si quieres, bórralas después.

## Base de datos

Todo vive en `supabase/`:

- `migrations/` — esquema versionado, RLS y buckets de Storage.
- `seed.sql` — 108 ejercicios (catalán/castellano), 5 plantillas, 1 admin, 2 monitores, 12 socios con ~6 semanas de historial, avisos y comentarios.
- `tests/rls.sql` — verifica que un socio no puede leer datos de otro, que un monitor solo ve a sus socios, etc. (13 comprobaciones, todas `true`).

Modelo: `profiles`, `member_details`, `trainer_members`, `exercises`, `routines` (+ `routine_days`, `routine_exercises`; las **plantillas son rutinas con `is_template = true`**), `routine_assignments`, `workout_sessions`, `workout_sets`, `personal_records`, `body_measurements`, `progress_photos`, `comments`, `announcements`, `audit_log`.

**Seguridad (RLS estricta desde el inicio):** el socio solo ve y edita lo suyo; el monitor solo ve a sus socios asignados; el admin ve todo; los ejercicios son de lectura para todos y de escritura para monitor/admin. Las funciones auxiliares viven en un esquema privado no expuesto por la API. Un *trigger* impide que alguien se promocione a admin o cambie su propio estado. Los avisos de seguridad de Supabase (`get_advisors`) están a cero.

Migrar a la base real del club: ver [`docs/MIGRACION.md`](docs/MIGRACION.md) (incluye checklist RGPD).

## Estructura

```
src/
  app/
    login · register · (legal)/privacy|terms · auth/callback
    app/        ← PWA del socio: page (inicio), rutina, rutines, entreno, progres, club, perfil, onboarding
    admin/      ← panel: page (tauler), socis, rutines, exercicis, comentaris, avisos, monitors
    api/        ← workouts (alta idempotente), snapshot (rutina offline), export (RGPD)
  components/   ← routine-editor (drag & drop), ui, theme
  lib/          ← training.ts (lógica pura testeada), routines.ts, snapshot.ts, offline.ts (IndexedDB), supabase/*
  messages/     ← ca.json · es.json
  proxy.ts      ← sesión + protección de /app y /admin (Next 16: «proxy» = antiguo middleware)
public/         ← sw.js (service worker), offline.html, brand/, icons/
e2e/ · scripts/ · supabase/ · docs/
```

## Decisiones técnicas

- **Next.js 16 (App Router) + TypeScript + Tailwind 4**, Supabase (Auth, Postgres, Storage, RLS), Recharts, dnd-kit, next-intl, Vitest, Playwright. Sin shadcn/ui: se usó un sistema propio de componentes con *tokens* de marca para no tener estética de plantilla y evitar dependencias.
- **Idioma sin prefijo de URL** (cookie + `profiles.locale`) para que `/app` sea siempre la URL instalable de la PWA.
- **Offline**: service worker propio (sin dependencias; Serwist no es compatible con Turbopack). La rutina activa y las referencias de la última vez se guardan en IndexedDB; el entreno en curso se guarda como borrador y los terminados entran en una cola (*outbox*) que se envía al recuperar la red. El alta de entrenos es idempotente (UUID generado en el móvil). El E2E lo verifica con la red cortada.
- **Asignar = copiar**: al asignar una plantilla se crea una copia personal para cada socio, de modo que el monitor puede adaptarla sin afectar a los demás. «Nueva versión» archiva una copia de la anterior y sube el contador sin romper el historial.
- **Récords personales** calculados en servidor al guardar cada entreno (1RM estimado con Epley, peso máximo).
- **Fuera de alcance (preparado, no implementado):** pagos, reservas de clases, control de acceso e integración con Poliwin. La app solo enlaza a la zona de reservas del club.

## Identidad visual

Extraída del logo oficial (`public/brand/logo-cps.jpg`): **azul eléctrico ≈ `#2030FF`**, **amarillo ≈ `#F8F800`**, negro y blanco. Tokens en `src/app/globals.css` con variantes clara/oscura (azul algo más claro en oscuro para mantener contraste). Tipografías: *Barlow Condensed* (títulos, carácter deportivo) e *Inter* (datos). El emblema circular con fondo transparente y los iconos PWA se generan con `scripts/gen-icons.mjs`.

## Licencias y contenido

El logo es propiedad del club; se usa solo para este prototipo. Los textos legales son un **borrador de ejemplo pendiente de revisión legal**.
