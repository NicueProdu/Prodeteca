# Prodeteca

Prode corporativo del **Mundial 2026** para los empleados de Parsimotion (~100 participantes).  
Cada usuario predice el marcador exacto de cada partido y elige campeón y subcampeón.

**Producción:** https://prodeteca.vercel.app

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Vite 4 · Vanilla JS (MPA — una página por ruta) |
| Base de datos + Auth | Supabase (PostgreSQL · Auth OAuth · Realtime · Storage) |
| Serverless functions | Vercel Functions (`/api`) |
| Deploy | Vercel (clean URLs, sin `.html` en las rutas) |
| Email | Resend API |

---

## Estructura del proyecto

```
prodeteca-codigo/
│
├── js/
│   ├── auth.js          OAuth Google, domain check (@parsimotion.com), creación de perfil
│   ├── ui.js            Nav, toasts, modales, skeletons — compartido en todas las páginas
│   ├── scoring.js       Reglas de puntos (fuente única de verdad — ver sección más abajo)
│   │
│   ├── predictions.js   Página Predicciones
│   ├── matches.js       Página Partidos — acordeón con predicciones de todos los jugadores
│   ├── ranking.js       Página Ranking — podio, streaks, detalle de usuario
│   ├── profile.js       Página Perfil — stats, historial, recortador de avatar (Canvas)
│   ├── admin.js         Panel admin — cargar resultados, recalcular, importar fixture, roles
│   │
│   ├── flags.js         Emojis + estilos de banderas por equipo
│   ├── timezone.js      Formateo de fechas en la zona horaria del usuario
│   ├── confetti.js      Animación en aciertos exactos
│   ├── date-picker.js   Selector de fecha personalizado para los filtros
│   ├── redirect.js      Redirige `/` → `/predictions` o `/login` según sesión
│   └── supabase-client.js  Instancia compartida del cliente Supabase
│
├── css/
│   ├── main.css         Tokens de diseño (colores, tipografía, sombras), base, nav, layout
│   ├── components.css   Match cards, ranking, perfil, admin, crop modal, accordion rows
│   └── responsive.css   Breakpoints: ≤768px (mobile), ≤480px (muy chico), ≥1100px (grande)
│
├── api/
│   ├── load-result.js        POST — carga resultado + calcula puntos (requiere rol admin)
│   ├── import-fixture.js     POST — importa fixture desde archivo .ics
│   ├── send-welcome.js       POST — envía email de bienvenida (Resend)
│   └── cron/
│       └── daily-reminder.js Cron diario 12:00 UTC — recuerda a usuarios sin predicciones del día
│
├── *.html               Una por ruta: predictions, ranking, matches, profile, admin, login
├── vercel.json          cleanUrls + trailingSlash + cron schedule
└── package.json         Vite 4, @supabase/supabase-js, date-fns, resend, ical.js
```

---

## Setup local

### 1. Instalar

```bash
npm install
```

### 2. Variables de entorno

Crear `.env.local` en la raíz del proyecto:

```env
# Supabase (proyecto en https://supabase.com/dashboard)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Solo necesario para las functions /api (server-side)
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# URL base de la app — controla el redirectTo del OAuth
VITE_APP_URL=http://localhost:5173

# Solo se permite login con emails de este dominio
VITE_ALLOWED_DOMAIN=parsimotion.com

# Para emails de bienvenida y recordatorios
RESEND_API_KEY=re_...
```

### 3. Correr en desarrollo

```bash
npm run dev          # Vite en http://localhost:5173
```

Para probar las serverless functions localmente:

```bash
npm install -g vercel
vercel dev           # Levanta Vite + /api en http://localhost:3000
```

---

## Deploy

```bash
npm run build
vercel --prod
```

Vercel detecta automáticamente Vite. `cleanUrls: true` en `vercel.json` elimina `.html` de todas las rutas y redirige las URLs viejas.

---

## Sistema de puntos

### Partidos

| Resultado | Puntos |
|-----------|--------|
| Marcador exacto (predijo 2-1, salió 2-1) | **3 pts** |
| Ganador/empate correcto (predijo 2-0, salió 1-0) | **1 pt** |
| Resultado incorrecto | **0 pts** |

### Predicción especial — Campeón y subcampeón

| Acierto | Puntos |
|---------|--------|
| Campeón exacto | **20 pts** |
| Subcampeón exacto | **10 pts** |
| Ambos exactos (bonus incluido) | **50 pts** |

La lógica está centralizada en `js/scoring.js`. Es la única fuente de verdad — el endpoint `api/load-result.js` la aplica server-side al confirmar cada resultado.

---

## Autenticación

- Login exclusivo con Google OAuth, restringido al dominio `@parsimotion.com`
- Cualquier intento con otro dominio es bloqueado en `requireAuth()`
- El primer login crea automáticamente el perfil en la tabla `users` y envía un email de bienvenida
- La sesión persiste en `localStorage` vía Supabase Auth

---

## Roles

| Rol | Acceso |
|-----|--------|
| `user` | Predice partidos, ve el ranking, administra su perfil |
| `admin` | Todo lo anterior + panel admin: cargar resultados, recalcular puntos, importar fixture (.ics), gestionar roles de otros usuarios |

Los roles se asignan manualmente desde el panel admin (`/admin`).

---

## Base de datos (Supabase)

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `users` | Perfil extendido (name, avatar_url, role) |
| `matches` | Fixture completo: equipos, fecha, fase, lock_time_utc, resultado, status |
| `predictions` | Una fila por (user_id, match_id) con la predicción y los puntos calculados |
| `champion_predictions` | Predicción especial campeón + subcampeón por usuario |

### Storage

El bucket `avatars` guarda fotos de perfil como JPEG 400×400. Cada usuario tiene su carpeta `{user_id}/avatar-{timestamp}.jpg`. El avatar anterior se elimina automáticamente al subir uno nuevo.

### Realtime

La página de Ranking suscribe a cambios en `predictions` y `champion_predictions` para actualizar el ranking en tiempo real sin recargar.

---

## Notas de operación

- **Agregar admins:** panel admin → sección Usuarios → botón "Hacer admin"
- **Cargar resultados:** panel admin → sección Resultados → botón "Cargar resultado"
- **Recalcular si hubo error:** panel admin → sección Recalcular (últimas 24 hs)
- **Importar fixture:** panel admin → sección Fixture → cargar archivo `.ics`
- **Fase eliminatoria:** ejecutar `knockout_stage_insert.sql` en el SQL Editor de Supabase cuando comience esa fase
- **Cron de recordatorios:** se ejecuta diariamente a las 12:00 UTC (configurado en `vercel.json`)
