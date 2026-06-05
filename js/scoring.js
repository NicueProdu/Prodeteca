// js/scoring.js — lógica de puntuación centralizada.
// Este módulo es la ÚNICA fuente de verdad para las reglas de puntos.
// admin.js y api/load-result.js deben usar estas funciones (o replicarlas con cuidado).

/**
 * Calcula los puntos de una predicción de resultado de partido.
 *
 * Reglas:
 *   3 pts → marcador exacto (ej: predijo 2-1, salió 2-1)
 *   1 pt  → ganador/empate correcto pero marcador distinto
 *   0 pts → ganador/empate incorrecto
 *
 * @param {{ home_score_pred: number, away_score_pred: number }} prediction
 * @param {{ home_score: number|null, away_score: number|null }} result
 * @returns {0|1|3|null} Puntos ganados, o null si el partido no terminó aún
 */
export function calculateMatchPoints(prediction, result) {
  if (result.home_score === null || result.away_score === null) return null

  if (
    prediction.home_score_pred === result.home_score &&
    prediction.away_score_pred === result.away_score
  ) {
    return 3
  }

  const realOutcome =
    result.home_score > result.away_score ? 'home' :
    result.home_score < result.away_score ? 'away' : 'draw'

  const predOutcome =
    prediction.home_score_pred > prediction.away_score_pred ? 'home' :
    prediction.home_score_pred < prediction.away_score_pred ? 'away' : 'draw'

  if (realOutcome === predOutcome) return 1

  return 0
}

/**
 * Calcula el total de puntos de la predicción especial (campeón + subcampeón).
 *
 * Reglas:
 *   20 pts → campeón exacto
 *   10 pts → subcampeón exacto
 *   +20 bonus → si ambos son correctos (total = 50 pts)
 *
 * @param {{ champion_team: string, runner_up_team: string }} prediction
 * @param {string} actualChampion
 * @param {string} actualRunnerUp
 * @returns {0|10|20|30|50}
 */
export function calculateChampionPoints(prediction, actualChampion, actualRunnerUp) {
  const correctChampion = prediction.champion_team === actualChampion
  const correctRunnerUp = prediction.runner_up_team === actualRunnerUp
  if (correctChampion && correctRunnerUp) return 50
  if (correctChampion) return 20
  if (correctRunnerUp) return 10
  return 0
}

/**
 * Igual que calculateChampionPoints pero retorna el desglose por componente.
 * Usar este para guardar en la base de datos (columnas champion_points, runner_up_points, etc.).
 *
 * @param {{ champion_team: string, runner_up_team: string }} prediction
 * @param {string} actualChampion
 * @param {string} actualRunnerUp
 * @returns {{ champion_points: number, runner_up_points: number, bonus_points: number, total_points: number }}
 */
export function calculateChampionBreakdown(prediction, actualChampion, actualRunnerUp) {
  const correctChampion = prediction.champion_team === actualChampion
  const correctRunnerUp = prediction.runner_up_team === actualRunnerUp
  return {
    champion_points: correctChampion ? 20 : 0,
    runner_up_points: correctRunnerUp ? 10 : 0,
    bonus_points: correctChampion && correctRunnerUp ? 20 : 0,
    total_points: calculateChampionPoints(prediction, actualChampion, actualRunnerUp),
  }
}

/**
 * Determina el estado visual de la predicción de un usuario para un partido.
 * No contiene emojis: los íconos los agrega CSS mediante `::before` en `.match-card`.
 *
 * @param {{ status: string, lock_time_utc: string, match_datetime_utc: string,
 *           home_score: number|null, away_score: number|null }} match
 * @param {{ home_score_pred: number, away_score_pred: number, points_earned: number|null }|null} prediction
 * @returns {{ label: string, cls: 'exact'|'partial'|'miss'|'locked'|'soon'|'open', pts: string|null }}
 */
export function getPredictionStatus(match, prediction) {
  const now = new Date()
  const lockTime = new Date(match.lock_time_utc)
  const matchTime = new Date(match.match_datetime_utc)
  const minutesToKickoff = (matchTime - now) / 60000

  if (match.status === 'finished' && prediction) {
    let pts = prediction.points_earned
    if (pts == null && match.home_score !== null) {
      pts = calculateMatchPoints(prediction, match)
    }
    if (pts === 3) return { label: 'Acierto exacto',       cls: 'exact',   pts: '+3 pts' }
    if (pts === 1) {
      const isDraw = match.home_score === match.away_score
      return { label: isDraw ? 'Acertaste el empate' : 'Acertaste el ganador', cls: 'partial', pts: '+1 pt' }
    }
    if (pts === 0) return { label: 'Sin acierto',          cls: 'miss',    pts: '0 pts' }
  }

  if (match.status === 'finished' && !prediction) {
    return { label: 'No cargaste predicción', cls: 'miss', pts: '0 pts' }
  }

  if (now >= lockTime) return { label: 'Bloqueado · esperando resultado', cls: 'locked', pts: null }
  if (minutesToKickoff <= 60) return { label: 'Cierra en menos de 1 hora', cls: 'soon', pts: null }
  if (prediction) return { label: 'Predicción guardada · podés editar', cls: 'open', pts: null }

  return { label: 'Sin predicción · cargá tu pronóstico', cls: 'open', pts: null }
}
