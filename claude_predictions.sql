-- =====================================================================================
-- Prodeteca · Usuario Claude + predicciones fase de grupos
-- Ejecutar en el SQL Editor de Supabase
-- =====================================================================================
-- Qué hace este script:
--   1. Crea el usuario "Claude" en auth.users (si no existe)
--   2. Asegura que exista en public.users con name = 'Claude'
--   3. Inserta las 72 predicciones de fase de grupos (más aliases de nombres FIFA)
--   4. Catch-all: 1-1 para cualquier partido de grupo que quede sin predicción
--      (incluye partidos TEST y cualquier alias de nombre no cubierto)
-- =====================================================================================


-- ── 1. Crear usuario Claude en auth.users ────────────────────────────────────────────

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  'c1a0de00-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'claude@prodeteca.bot',
  crypt('prodeteca-claude-bot-' || gen_random_uuid()::text, gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Claude"}',
  '', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'claude@prodeteca.bot'
);

-- ── 2. Asegurar registro en public.users ─────────────────────────────────────────────
-- El trigger on_auth_user_created debería haberlo creado automáticamente,
-- pero este INSERT es idempotente por si acaso.

INSERT INTO public.users (id, email, name)
SELECT id, email, 'Claude'
FROM auth.users
WHERE email = 'claude@prodeteca.bot'
ON CONFLICT (id) DO UPDATE SET name = 'Claude';


-- ── 3. Insertar predicciones de fase de grupos ───────────────────────────────────────
--
-- Se incluyen ambas variantes de nombre para los 4 equipos donde la fuente FIFA
-- difiere de los nombres canónicos de la app:
--   · Corea del Sur  ↔  Rep. Corea / República de Corea
--   · República Checa ↔  Rep. Checa / Rep.Checa
--   · Irán            ↔  RI de Irán
--   · Arabia Saudita  ↔  Arabia Saudí
-- ON CONFLICT DO NOTHING garantiza que no se dupliquen predicciones.

WITH
claude AS (
  SELECT id FROM public.users WHERE name = 'Claude' LIMIT 1
),
preds (home, away, h, a) AS (
  VALUES

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- GRUPO A · México · Sudáfrica · Corea del Sur · Rep. Checa
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- MD1
  ('México',            'Sudáfrica',          2, 0),
  ('Corea del Sur',     'República Checa',     1, 1),
  ('Rep. Corea',        'Rep.Checa',           1, 1),   -- alias FIFA
  ('República de Corea','República Checa',     1, 1),   -- alias FIFA
  ('Rep. Corea',        'República Checa',     1, 1),   -- alias FIFA mix
  ('Corea del Sur',     'Rep. Checa',          1, 1),   -- alias mix
  -- MD2
  ('México',            'Corea del Sur',       1, 1),
  ('México',            'Rep. Corea',          1, 1),   -- alias FIFA
  ('México',            'República de Corea',  1, 1),   -- alias FIFA
  ('Sudáfrica',         'República Checa',     1, 1),
  ('Sudáfrica',         'Rep.Checa',           1, 1),   -- alias FIFA
  ('Sudáfrica',         'Rep. Checa',          1, 1),   -- alias FIFA
  -- MD3
  ('República Checa',   'México',              1, 2),
  ('Rep.Checa',         'México',              1, 2),   -- alias FIFA
  ('Rep. Checa',        'México',              1, 2),   -- alias FIFA
  ('Sudáfrica',         'Corea del Sur',       1, 2),
  ('Sudáfrica',         'Rep. Corea',          1, 2),   -- alias FIFA
  ('Sudáfrica',         'República de Corea',  1, 2),   -- alias FIFA

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- GRUPO B · Canadá · Bosnia y Herzegovina · Catar · Suiza
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- MD1
  ('Canadá',               'Bosnia y Herzegovina', 2, 1),
  ('Catar',                'Suiza',                0, 2),
  -- MD2
  ('Suiza',                'Bosnia y Herzegovina', 2, 0),
  ('Canadá',               'Catar',                2, 0),
  -- MD3
  ('Suiza',                'Canadá',               1, 1),
  ('Bosnia y Herzegovina', 'Catar',                2, 1),

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- GRUPO C · Brasil · Marruecos · Haití · Escocia
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- MD1
  ('Brasil',    'Marruecos',  2, 1),
  ('Haití',     'Escocia',    0, 2),
  -- MD2
  ('Brasil',    'Haití',      3, 0),
  ('Escocia',   'Marruecos',  1, 1),
  -- MD3
  ('Escocia',   'Brasil',     0, 2),
  ('Marruecos', 'Haití',      2, 0),

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- GRUPO D · Estados Unidos · Paraguay · Australia · Turquía
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- MD1
  ('Estados Unidos', 'Paraguay',       2, 1),
  ('Australia',      'Turquía',        1, 2),
  -- MD2
  ('Estados Unidos', 'Australia',      2, 1),
  ('Turquía',        'Paraguay',       2, 1),
  -- MD3
  ('Turquía',        'Estados Unidos', 1, 2),
  ('Paraguay',       'Australia',      1, 1),

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- GRUPO E · Alemania · Curazao · Costa de Marfil · Ecuador
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- MD1
  ('Alemania',        'Curazao',         4, 0),
  ('Costa de Marfil', 'Ecuador',         1, 1),
  -- MD2
  ('Alemania',        'Costa de Marfil', 2, 1),
  ('Ecuador',         'Curazao',         2, 0),
  -- MD3
  ('Ecuador',         'Alemania',        1, 2),
  ('Curazao',         'Costa de Marfil', 0, 2),

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- GRUPO F · Países Bajos · Japón · Suecia · Túnez
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- MD1
  ('Países Bajos', 'Japón',         2, 1),
  ('Suecia',       'Túnez',         1, 1),
  -- MD2
  ('Países Bajos', 'Suecia',        2, 1),
  ('Túnez',        'Japón',         1, 2),
  -- MD3
  ('Japón',        'Suecia',        2, 1),
  ('Túnez',        'Países Bajos',  0, 2),

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- GRUPO G · Bélgica · Egipto · Irán · Nueva Zelanda
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- MD1
  ('Bélgica',       'Egipto',        2, 0),
  ('Irán',          'Nueva Zelanda', 2, 0),
  ('RI de Irán',    'Nueva Zelanda', 2, 0),   -- alias FIFA
  -- MD2
  ('Bélgica',       'Irán',          2, 0),
  ('Bélgica',       'RI de Irán',    2, 0),   -- alias FIFA
  ('Nueva Zelanda', 'Egipto',        0, 1),
  -- MD3
  ('Nueva Zelanda', 'Bélgica',       0, 2),
  ('Egipto',        'Irán',          1, 1),
  ('Egipto',        'RI de Irán',    1, 1),   -- alias FIFA

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- GRUPO H · España · Cabo Verde · Arabia Saudita · Uruguay
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- MD1
  ('España',         'Cabo Verde',      3, 0),
  ('Arabia Saudita', 'Uruguay',         1, 2),
  ('Arabia Saudí',   'Uruguay',         1, 2),   -- alias FIFA
  -- MD2
  ('España',         'Arabia Saudita',  3, 0),
  ('España',         'Arabia Saudí',    3, 0),   -- alias FIFA
  ('Uruguay',        'Cabo Verde',      2, 0),
  -- MD3
  ('Uruguay',        'España',          1, 2),
  ('Cabo Verde',     'Arabia Saudita',  0, 1),
  ('Cabo Verde',     'Arabia Saudí',    0, 1),   -- alias FIFA

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- GRUPO I · Francia · Senegal · Irak · Noruega
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- MD1
  ('Francia',  'Senegal',  2, 1),
  ('Irak',     'Noruega',  0, 2),
  -- MD2
  ('Francia',  'Irak',     3, 0),
  ('Noruega',  'Senegal',  1, 1),
  -- MD3
  ('Senegal',  'Irak',     2, 1),
  ('Francia',  'Noruega',  2, 1),

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- GRUPO J · Argentina · Argelia · Austria · Jordania
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- MD1
  ('Argentina', 'Argelia',   3, 0),
  ('Austria',   'Jordania',  2, 0),
  -- MD2
  ('Argentina', 'Austria',   2, 0),
  ('Jordania',  'Argelia',   0, 1),
  -- MD3
  ('Argelia',   'Austria',   1, 1),
  ('Jordania',  'Argentina', 0, 2),

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- GRUPO K · Portugal · RD Congo · Uzbekistán · Colombia
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- MD1
  ('Portugal',   'RD Congo',   3, 0),
  ('Uzbekistán', 'Colombia',   0, 2),
  -- MD2
  ('Portugal',   'Uzbekistán', 3, 0),
  ('Colombia',   'RD Congo',   2, 0),
  -- MD3
  ('Colombia',   'Portugal',   1, 2),
  ('RD Congo',   'Uzbekistán', 1, 1),

  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- GRUPO L · Inglaterra · Croacia · Ghana · Panamá
  -- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  -- MD1
  ('Inglaterra', 'Croacia',    2, 0),
  ('Ghana',      'Panamá',     1, 1),
  -- MD2
  ('Inglaterra', 'Ghana',      2, 0),
  ('Panamá',     'Croacia',    0, 2),
  -- MD3
  ('Panamá',     'Inglaterra', 0, 2),
  ('Croacia',    'Ghana',      1, 0)
)
INSERT INTO predictions (user_id, match_id, home_score_pred, away_score_pred)
SELECT claude.id, m.id, p.h, p.a
FROM preds p
JOIN matches m
  ON m.home_team = p.home
  AND m.away_team = p.away
  AND m.phase = 'group'
CROSS JOIN claude
ON CONFLICT (user_id, match_id) DO NOTHING;


-- ── 4. Catch-all: 1-1 para cualquier partido de grupo aún sin predicción ────────────
-- Cubre partidos TEST y cualquier partido cuyo nombre no coincidió arriba.

WITH claude AS (
  SELECT id FROM public.users WHERE name = 'Claude' LIMIT 1
)
INSERT INTO predictions (user_id, match_id, home_score_pred, away_score_pred)
SELECT claude.id, m.id, 1, 1
FROM matches m
CROSS JOIN claude
WHERE m.phase = 'group'
  AND NOT EXISTS (
    SELECT 1 FROM predictions p
    WHERE p.user_id = claude.id AND p.match_id = m.id
  )
ON CONFLICT (user_id, match_id) DO NOTHING;


-- ── Verificación (opcional, correr aparte) ───────────────────────────────────────────
-- SELECT m.home_team, m.away_team, p.home_score_pred, p.away_score_pred
-- FROM predictions p
-- JOIN matches m ON m.id = p.match_id
-- JOIN users u ON u.id = p.user_id
-- WHERE u.name = 'Claude' AND m.phase = 'group'
-- ORDER BY m.match_datetime_utc;
