# Migración de la base temporal a la base real del club

La app no depende de nada que no esté en `supabase/migrations/` y `supabase/seed.sql`. Pasar a producción es reproducir las migraciones en otro proyecto Supabase.

> Estado actual: proyecto de pruebas `cps-fit-dev` (plan gratuito, región UE París, `eu-west-3`) con **solo datos ficticios**.

## 1. Crear el proyecto definitivo

1. Crea un proyecto en [supabase.com](https://supabase.com) en una **región de la UE** (por ejemplo `eu-west-3` París o `eu-central-1` Fráncfort). Titular: el club (no una cuenta personal).
2. Plan: el gratuito sirve para empezar; ten en cuenta que **pausa los proyectos inactivos** tras 7 días y no incluye copias de seguridad diarias. Para datos reales de socios recomendamos el plan Pro (copias de seguridad + sin pausa).
3. En *Authentication → URL Configuration* define `Site URL` (dominio final) y añade `https://tu-dominio/auth/callback` a *Redirect URLs*.
4. En *Authentication → Providers → Email*: activa confirmación de correo. Configura un SMTP propio (el SMTP integrado de Supabase está limitado a unos pocos correos por hora).

## 2. Aplicar el esquema

Con la CLI de Supabase (`npm i -g supabase` o `npx supabase`):

```bash
supabase login
supabase link --project-ref <ref-del-proyecto-real>
supabase db push            # aplica supabase/migrations/*.sql en orden
```

Sin CLI: abre el *SQL editor* y ejecuta, en orden, los ficheros de `supabase/migrations/`.

**No ejecutes `seed.sql` en el proyecto real**: contiene usuarios y entrenamientos ficticios. Solo necesitas la biblioteca de ejercicios y las plantillas. Para eso, ejecuta únicamente los bloques de `seed.sql` que insertan en `public.exercises` (y su `update` de textos) y, si quieres, las plantillas (`insert into public.routines … is_template = true`). Las plantillas usan como autor al monitor demo: cámbialo por un monitor real (`created_by`).

## 3. Variables de entorno (Vercel)

| Variable | Dónde se obtiene | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API | pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys | pública (la clave `sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys | **secreta**, solo servidor. Habilita invitaciones por correo y el borrado completo de cuenta |
| `NEXT_PUBLIC_SITE_URL` | tu dominio | usada en enlaces de invitación |

## 4. Primer administrador

1. Regístrate normalmente en la app con el correo del responsable del club.
2. En el *SQL editor*:
   ```sql
   update public.profiles set role = 'admin', status = 'active' where email = 'responsable@cpsantjoanenc.org';
   ```
3. A partir de ahí, el admin da de alta monitores (invitación + `update public.profiles set role = 'trainer'`), y los monitores invitan a socios desde `/admin/socis`.

## 5. Importación de socios

Prepara un CSV (ver cabecera en `scripts/import-members.mjs`) y ejecuta primero una simulación:

```bash
node --env-file=.env.local scripts/import-members.mjs socios.csv          # simulación
node --env-file=.env.local scripts/import-members.mjs socios.csv --apply  # crea e invita
```

Cada socio recibe un correo de invitación y **debe aceptar la política de privacidad** antes de usar la app. Importa solo los campos mínimos (nombre, correo, objetivo, nivel).

## 6. Checklist RGPD antes de usar datos reales

- [ ] Política de privacidad y términos **revisados por un profesional legal** (los textos actuales son un borrador de ejemplo en `src/messages/*.json` → `legal.*`).
- [ ] Designado el responsable del tratamiento y el contacto de privacidad (hoy: `info@cpsantjoanenc.org`).
- [ ] Contrato de encargado del tratamiento (DPA) firmado con Supabase y con Vercel. Región de datos de la UE verificada.
- [ ] Registro de actividades de tratamiento actualizado (datos de salud = categoría especial, art. 9 RGPD → base: consentimiento explícito).
- [ ] Valorar una **evaluación de impacto (EIPD)** por tratarse de datos de salud a escala del club.
- [ ] Consentimiento explícito en el alta (ya implementado: casilla obligatoria y fecha en `profiles.consent_at`). Los socios invitados por el club aceptan al primer acceso.
- [ ] Exportación y borrado de cuenta funcionando (`/api/export`, perfil → *Eliminar mi cuenta*). Con `SUPABASE_SERVICE_ROLE_KEY` el borrado elimina también el usuario de Auth.
- [ ] Fotos de progreso privadas por defecto (bucket privado + URL firmadas); el monitor solo las ve si el socio activa compartirlas.
- [ ] Sin analítica de terceros que identifique usuarios (no hay ninguna instalada). Si se añade, anonimizar y pedir consentimiento.
- [ ] Logs sin datos sensibles: `audit_log` solo guarda quién, qué acción y sobre qué entidad.
- [ ] Copias de seguridad cifradas y plan de retención/borrado definido.
- [ ] Procedimiento de brechas de seguridad (aviso a la AEPD / APDCAT en 72 h) documentado.
- [ ] Ejecutar `get_advisors` de Supabase (seguridad y rendimiento) y `supabase/tests/rls.sql` en el proyecto real tras migrar.
- [ ] Rotar claves: nunca reutilices las del proyecto temporal. Elimina el proyecto `cps-fit-dev` cuando termine el piloto.

## 7. Integraciones futuras (no implementadas)

La arquitectura está preparada, sin acoplamiento a Poliwin:

- **Pagos / reservas / control de acceso**: añade tablas propias (`memberships`, `bookings`, `access_events`) con su RLS y una columna externa (`external_id`) en `profiles` para enlazar con el software del club. La app solo enlaza a la zona de reservas existente.
- **Notificaciones push**: la PWA ya tiene service worker; falta añadir Web Push (VAPID) y una tabla `push_subscriptions`.
