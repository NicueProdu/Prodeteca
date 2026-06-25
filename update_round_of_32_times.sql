-- ============================================================
-- PRODETECA · Actualización horarios 16avos de final
-- Horarios oficiales FIFA en ART (UTC-3) convertidos a UTC
-- Correr en Supabase SQL Editor
--
-- El trigger matches_set_lock_time actualiza lock_time_utc
-- automáticamente a match_datetime_utc - 10 minutos.
-- ============================================================

-- Lunes 29 Jun ------------------------------------------------

-- P76 · 1º Grupo C v 2º Grupo F · Houston · 14:00 ART → 17:00 UTC
UPDATE matches SET match_datetime_utc = '2026-06-29 17:00:00+00'
WHERE home_team = 'Group C Winner' AND away_team = 'Group F Second Place' AND phase = 'round_of_32';

-- P74 · 1º Grupo E v 3º Grupo A/B/C/D/F · Boston · 17:30 ART → 20:30 UTC
UPDATE matches SET match_datetime_utc = '2026-06-29 20:30:00+00'
WHERE home_team = 'Group E Winner' AND away_team = 'Third Place Group A/B/C/D/F' AND phase = 'round_of_32';

-- P75 · 1º Grupo F v 2º Grupo C · Monterrey · 22:00 ART → 30/Jun 01:00 UTC
UPDATE matches SET match_datetime_utc = '2026-06-30 01:00:00+00'
WHERE home_team = 'Group F Winner' AND away_team = 'Group C Second Place' AND phase = 'round_of_32';

-- Martes 30 Jun -----------------------------------------------

-- P78 · 2º Grupo E v 2º Grupo I · Dallas · 14:00 ART → 17:00 UTC
UPDATE matches SET match_datetime_utc = '2026-06-30 17:00:00+00'
WHERE home_team = 'Group E Second Place' AND away_team = 'Group I Second Place' AND phase = 'round_of_32';

-- P77 · 1º Grupo I v 3º Grupo C/D/F/G/H · New York NJ · 18:00 ART → 21:00 UTC
UPDATE matches SET match_datetime_utc = '2026-06-30 21:00:00+00'
WHERE home_team = 'Group I Winner' AND away_team = 'Third Place Group C/D/F/G/H' AND phase = 'round_of_32';

-- P79 · 1º Grupo A v 3º Grupo C/E/F/H/I · Cdad México · 22:00 ART → 1/Jul 01:00 UTC (sin cambio)
UPDATE matches SET match_datetime_utc = '2026-07-01 01:00:00+00'
WHERE home_team = 'Group A Winner' AND away_team = 'Third Place Group C/E/F/H/I' AND phase = 'round_of_32';

-- Miércoles 1 Jul ---------------------------------------------

-- P80 · 1º Grupo L v 3º Grupo E/H/I/J/K · Atlanta · 13:00 ART → 16:00 UTC
UPDATE matches SET match_datetime_utc = '2026-07-01 16:00:00+00'
WHERE home_team = 'Group L Winner' AND away_team = 'Third Place Group E/H/I/J/K' AND phase = 'round_of_32';

-- P82 · 1º Grupo G v 3º Grupo A/E/H/I/J · Seattle · 17:00 ART → 20:00 UTC
UPDATE matches SET match_datetime_utc = '2026-07-01 20:00:00+00'
WHERE home_team = 'Group G Winner' AND away_team = 'Third Place Group A/E/H/I/J' AND phase = 'round_of_32';

-- P81 · 1º Grupo D v 3º Grupo B/E/F/I/J · San Francisco · 21:00 ART → 2/Jul 00:00 UTC
UPDATE matches SET match_datetime_utc = '2026-07-02 00:00:00+00'
WHERE home_team = 'Group D Winner' AND away_team = 'Third Place Group B/E/F/I/J' AND phase = 'round_of_32';

-- Jueves 2 Jul ------------------------------------------------

-- P84 · 1º Grupo H v 2º Grupo J · Los Ángeles · 16:00 ART → 19:00 UTC
UPDATE matches SET match_datetime_utc = '2026-07-02 19:00:00+00'
WHERE home_team = 'Group H Winner' AND away_team = 'Group J Second Place' AND phase = 'round_of_32';

-- P83 · 2º Grupo K v 2º Grupo L · Toronto · 20:00 ART → 23:00 UTC
UPDATE matches SET match_datetime_utc = '2026-07-02 23:00:00+00'
WHERE home_team = 'Group K Second Place' AND away_team = 'Group L Second Place' AND phase = 'round_of_32';

-- P87 · 1º Grupo K v 3º Grupo D/E/I/J/L · Kansas City · 22:30 ART → 3/Jul 01:30 UTC
UPDATE matches SET match_datetime_utc = '2026-07-03 01:30:00+00'
WHERE home_team = 'Group K Winner' AND away_team = 'Third Place Group D/E/I/J/L' AND phase = 'round_of_32';

-- Viernes 3 Jul -----------------------------------------------

-- P85 · 1º Grupo B v 3º Grupo E/F/G/I/J · Vancouver · 00:00 ART → 03:00 UTC
UPDATE matches SET match_datetime_utc = '2026-07-03 03:00:00+00'
WHERE home_team = 'Group B Winner' AND away_team = 'Third Place Group E/F/G/I/J' AND phase = 'round_of_32';

-- P88 · 2º Grupo D v 2º Grupo G · Dallas · 16:00 ART → 19:00 UTC
UPDATE matches SET match_datetime_utc = '2026-07-03 19:00:00+00'
WHERE home_team = 'Group D Second Place' AND away_team = 'Group G Second Place' AND phase = 'round_of_32';

-- P86 · 1º Grupo J v 2º Grupo H · Miami · 19:00 ART → 22:00 UTC
UPDATE matches SET match_datetime_utc = '2026-07-03 22:00:00+00'
WHERE home_team = 'Group J Winner' AND away_team = 'Group H Second Place' AND phase = 'round_of_32';
