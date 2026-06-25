-- ============================================================
-- PRODETECA · Fase eliminatoria completa - Mundial 2026
-- Correr en Supabase SQL Editor
--
-- IMPORTANTE: Este script borra y recrea todos los partidos
-- de la fase eliminatoria. Es seguro hacerlo mientras no haya
-- predicciones cargadas para esos partidos (antes de Jun 28).
--
-- Los horarios son ART (UTC-3) convertidos a UTC.
-- Actualizados con fixture oficial FIFA.
-- ============================================================

-- Limpiar partidos eliminatorios existentes (incompletos)
DELETE FROM matches
WHERE phase IN ('round_of_32','round_of_16','quarterfinal','semifinal','third_place','final');

-- ============================================================
-- DIECISEISAVOS DE FINAL (16avos) · P73–P88 · 28 Jun – 3 Jul
-- ============================================================

INSERT INTO matches (match_datetime_utc, lock_time_utc, home_team, away_team, phase, status, venue)
VALUES

-- Domingo 28 Jun (solo 1 partido)
('2026-06-29 01:00:00+00','2026-06-29 00:50:00+00',
 'Group A Second Place','Group B Second Place',
 'round_of_32','upcoming','Estadio Los Ángeles'),          -- P73 · 21:00 ET

-- Lunes 29 Jun (3 partidos)
('2026-06-29 17:00:00+00','2026-06-29 16:50:00+00',
 'Group C Winner','Group F Second Place',
 'round_of_32','upcoming','Estadio Houston'),               -- P76 · 14:00 ART

('2026-06-29 20:30:00+00','2026-06-29 20:20:00+00',
 'Group E Winner','Third Place Group A/B/C/D/F',
 'round_of_32','upcoming','Estadio Boston'),                -- P74 · 17:30 ART

('2026-06-30 01:00:00+00','2026-06-30 00:50:00+00',
 'Group F Winner','Group C Second Place',
 'round_of_32','upcoming','Estadio Monterrey'),             -- P75 · 22:00 ART

-- Martes 30 Jun (3 partidos)
('2026-06-30 17:00:00+00','2026-06-30 16:50:00+00',
 'Group E Second Place','Group I Second Place',
 'round_of_32','upcoming','Estadio Dallas'),                -- P78 · 14:00 ART

('2026-06-30 21:00:00+00','2026-06-30 20:50:00+00',
 'Group I Winner','Third Place Group C/D/F/G/H',
 'round_of_32','upcoming','Estadio Nueva York Nueva Jersey'), -- P77 · 18:00 ART

('2026-07-01 01:00:00+00','2026-07-01 00:50:00+00',
 'Group A Winner','Third Place Group C/E/F/H/I',
 'round_of_32','upcoming','Estadio Ciudad de México'),      -- P79 · 22:00 ART

-- Miércoles 1 Jul (3 partidos)
('2026-07-01 16:00:00+00','2026-07-01 15:50:00+00',
 'Group L Winner','Third Place Group E/H/I/J/K',
 'round_of_32','upcoming','Estadio Atlanta'),               -- P80 · 13:00 ART

('2026-07-01 20:00:00+00','2026-07-01 19:50:00+00',
 'Group G Winner','Third Place Group A/E/H/I/J',
 'round_of_32','upcoming','Estadio Seattle'),               -- P82 · 17:00 ART

('2026-07-02 00:00:00+00','2026-07-01 23:50:00+00',
 'Group D Winner','Third Place Group B/E/F/I/J',
 'round_of_32','upcoming','Estadio Bahía de San Francisco'), -- P81 · 21:00 ART

-- Jueves 2 Jul (3 partidos)
('2026-07-02 19:00:00+00','2026-07-02 18:50:00+00',
 'Group H Winner','Group J Second Place',
 'round_of_32','upcoming','Estadio Los Ángeles'),           -- P84 · 16:00 ART

('2026-07-02 23:00:00+00','2026-07-02 22:50:00+00',
 'Group K Second Place','Group L Second Place',
 'round_of_32','upcoming','Estadio Toronto'),               -- P83 · 20:00 ART

('2026-07-03 01:30:00+00','2026-07-03 01:20:00+00',
 'Group K Winner','Third Place Group D/E/I/J/L',
 'round_of_32','upcoming','Estadio Kansas City'),           -- P87 · 22:30 ART

-- Viernes 3 Jul (3 partidos)
('2026-07-03 03:00:00+00','2026-07-03 02:50:00+00',
 'Group B Winner','Third Place Group E/F/G/I/J',
 'round_of_32','upcoming','Estadio BC Place Vancouver'),    -- P85 · 00:00 ART

('2026-07-03 19:00:00+00','2026-07-03 18:50:00+00',
 'Group D Second Place','Group G Second Place',
 'round_of_32','upcoming','Estadio Dallas'),                -- P88 · 16:00 ART

('2026-07-03 22:00:00+00','2026-07-03 21:50:00+00',
 'Group J Winner','Group H Second Place',
 'round_of_32','upcoming','Estadio Miami');                 -- P86 · 19:00 ART


-- ============================================================
-- OCTAVOS DE FINAL (8avos) · P89–P96 · 4–7 Jul
-- ============================================================

INSERT INTO matches (match_datetime_utc, lock_time_utc, home_team, away_team, phase, status, venue)
VALUES

-- Sábado 4 Jul
('2026-07-04 19:00:00+00','2026-07-04 18:50:00+00',
 'Gan. P74','Gan. P77',
 'round_of_16','upcoming','Estadio Filadelfia'),            -- P89 · 15:00 ET

('2026-07-05 00:00:00+00','2026-07-04 23:50:00+00',
 'Gan. P73','Gan. P75',
 'round_of_16','upcoming','Estadio Houston'),               -- P90 · 20:00 ET

-- Domingo 5 Jul
('2026-07-05 19:00:00+00','2026-07-05 18:50:00+00',
 'Gan. P76','Gan. P78',
 'round_of_16','upcoming','Estadio Nueva York Nueva Jersey'), -- P91 · 15:00 ET

('2026-07-06 00:00:00+00','2026-07-05 23:50:00+00',
 'Gan. P79','Gan. P80',
 'round_of_16','upcoming','Estadio Ciudad de México'),      -- P92 · 20:00 ET

-- Lunes 6 Jul
('2026-07-06 19:00:00+00','2026-07-06 18:50:00+00',
 'Gan. P83','Gan. P84',
 'round_of_16','upcoming','Estadio Dallas'),                -- P93 · 15:00 ET

('2026-07-07 00:00:00+00','2026-07-06 23:50:00+00',
 'Gan. P81','Gan. P82',
 'round_of_16','upcoming','Estadio Seattle'),               -- P94 · 20:00 ET

-- Martes 7 Jul
('2026-07-07 19:00:00+00','2026-07-07 18:50:00+00',
 'Gan. P86','Gan. P88',
 'round_of_16','upcoming','Estadio Atlanta'),               -- P95 · 15:00 ET

('2026-07-08 00:00:00+00','2026-07-07 23:50:00+00',
 'Gan. P85','Gan. P87',
 'round_of_16','upcoming','Estadio BC Place Vancouver');    -- P96 · 20:00 ET


-- ============================================================
-- CUARTOS DE FINAL · P97–P100 · 9–11 Jul
-- ============================================================

INSERT INTO matches (match_datetime_utc, lock_time_utc, home_team, away_team, phase, status, venue)
VALUES

-- Jueves 9 Jul
('2026-07-09 19:00:00+00','2026-07-09 18:50:00+00',
 'Gan. P89','Gan. P90',
 'quarterfinal','upcoming','Estadio Boston'),               -- P97 · 15:00 ET

-- Viernes 10 Jul
('2026-07-10 19:00:00+00','2026-07-10 18:50:00+00',
 'Gan. P93','Gan. P94',
 'quarterfinal','upcoming','Estadio Los Ángeles'),          -- P98 · 15:00 ET

-- Sábado 11 Jul
('2026-07-11 19:00:00+00','2026-07-11 18:50:00+00',
 'Gan. P91','Gan. P92',
 'quarterfinal','upcoming','Estadio Miami'),                -- P99 · 15:00 ET

('2026-07-12 00:00:00+00','2026-07-11 23:50:00+00',
 'Gan. P95','Gan. P96',
 'quarterfinal','upcoming','Estadio Kansas City');          -- P100 · 20:00 ET


-- ============================================================
-- SEMIFINALES · P101–P102 · 14–15 Jul
-- ============================================================

INSERT INTO matches (match_datetime_utc, lock_time_utc, home_team, away_team, phase, status, venue)
VALUES

-- Martes 14 Jul
('2026-07-14 20:00:00+00','2026-07-14 19:50:00+00',
 'Gan. P97','Gan. P98',
 'semifinal','upcoming','Estadio Dallas'),                  -- P101 · 16:00 ET

-- Miércoles 15 Jul
('2026-07-15 20:00:00+00','2026-07-15 19:50:00+00',
 'Gan. P99','Gan. P100',
 'semifinal','upcoming','Estadio Atlanta');                 -- P102 · 16:00 ET


-- ============================================================
-- TERCER PUESTO · P103 · 18 Jul
-- ============================================================

INSERT INTO matches (match_datetime_utc, lock_time_utc, home_team, away_team, phase, status, venue)
VALUES
('2026-07-18 19:00:00+00','2026-07-18 18:50:00+00',
 'Per. P101','Per. P102',
 'third_place','upcoming','Estadio Miami');                 -- P103 · 15:00 ET


-- ============================================================
-- FINAL · P104 · 19 Jul
-- ============================================================

INSERT INTO matches (match_datetime_utc, lock_time_utc, home_team, away_team, phase, status, venue)
VALUES
('2026-07-19 20:00:00+00','2026-07-19 19:50:00+00',
 'Gan. P101','Gan. P102',
 'final','upcoming','Estadio Nueva York Nueva Jersey');     -- P104 · 16:00 ET
