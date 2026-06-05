import { supabase } from './supabase-client.js'
import { requireAuth, ensureProfile } from './auth.js'
import { renderNav, loadNavPoints, showToast, renderSkeleton, debounce } from './ui.js'
import { formatMatchTime } from './timezone.js'
import { getPredictionStatus } from './scoring.js'
import { getFlagHtml, teamColors, localizeTeamName } from './flags.js'
import { fireCardConfetti } from './confetti.js'
import { createDatePicker } from './date-picker.js'

const ALL_TEAMS = [
  'Alemania','Arabia Saudita','Argelia','Argentina','Australia','Austria',
  'Bélgica','Bosnia y Herzegovina','Brasil',
  'Cabo Verde','Canadá','Catar','Colombia','Corea del Sur','Costa de Marfil','Croacia','Curazao',
  'Ecuador','Egipto','Escocia','España','Estados Unidos',
  'Francia',
  'Ghana',
  'Haití',
  'Inglaterra','Irak','Irán',
  'Japón','Jordania',
  'Marruecos','México',
  'Noruega','Nueva Zelanda',
  'Países Bajos','Panamá','Paraguay','Portugal',
  'RD Congo','República Checa',
  'Senegal','Sudáfrica','Suecia','Suiza',
  'Túnez','Turquía',
  'Uruguay','Uzbekistán',
]

const PHASE_LABELS = {
  group:        'Fase de Grupos',
  round_of_32:  '16avos de Final',
  round_of_16:  '8avos de Final',
  quarterfinal: 'Cuartos de Final',
  semifinal:    'Semifinal',
  third_place:  'Tercer Puesto',
  final:        'Final',
}

const PHASE_ORDER = ['group','round_of_32','round_of_16','quarterfinal','semifinal','third_place','final']

let currentUser = null
let allMatches = []
let predictions = {}
let champPrediction = null
let activeFilters = JSON.parse(sessionStorage.getItem('pred-filters') || '{}')
const lockTimers = new Map()

async function init() {
  const session = await requireAuth()
  if (!session) return

  await ensureProfile(session)

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  currentUser = profile || { id: session.user.id, email: session.user.email, name: session.user.email.split('@')[0] }

  renderNav('predictions', currentUser)
  loadNavPoints(currentUser.id)

  document.getElementById('matches-list').innerHTML = renderSkeleton(5)

  await Promise.all([loadMatches(), loadPredictions(), loadChampionPrediction()])
  renderAll()
}

async function loadMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('match_datetime_utc', { ascending: true })

  if (error) { showToast('Error cargando partidos', 'error'); return }
  allMatches = data || []
}

async function loadPredictions() {
  const { data } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', currentUser.id)

  predictions = {}
  for (const p of (data || [])) {
    predictions[p.match_id] = p
  }
}

async function loadChampionPrediction() {
  const { data } = await supabase
    .from('champion_predictions')
    .select('*')
    .eq('user_id', currentUser.id)
    .single()

  champPrediction = data || null
}

function getFilteredMatches() {
  let matches = [...allMatches]

  if (activeFilters.day === 'today') {
    matches = matches.filter(m => {
      const { isToday } = formatMatchTime(m.match_datetime_utc)
      return isToday
    })
  } else if (activeFilters.day === 'tomorrow') {
    matches = matches.filter(m => {
      const { isTomorrow } = formatMatchTime(m.match_datetime_utc)
      return isTomorrow
    })
  } else if (activeFilters.date) {
    matches = matches.filter(m => {
      const d = new Date(m.match_datetime_utc).toLocaleDateString('en-CA')
      return d === activeFilters.date
    })
  }

  if (activeFilters.group && activeFilters.group !== 'all') {
    matches = matches.filter(m => m.group_name === activeFilters.group)
  }

  if (activeFilters.phase && activeFilters.phase !== 'all') {
    matches = matches.filter(m => m.phase === activeFilters.phase)
  }

  return matches
}

function renderAll() {
  renderChampionCard()
  renderFilters()
  renderMatches()
  scheduleAutoLock()
}

function scheduleAutoLock() {
  const now = Date.now()
  for (const match of allMatches) {
    if (lockTimers.has(match.id)) continue
    const msUntilLock = new Date(match.lock_time_utc).getTime() - now
    if (msUntilLock > 0 && msUntilLock <= 24 * 60 * 60 * 1000) {
      const timer = setTimeout(() => {
        lockTimers.delete(match.id)
        lockMatchCard(match.id)
      }, msUntilLock)
      lockTimers.set(match.id, timer)
    }
  }
}

// Los browsers throttlean setTimeout cuando la tab está en background (Safari: hasta minutos).
// Al volver a enfocar la tab, verificamos si algún partido debió haber cerrado mientras tanto.
function applyMissedLocks() {
  const now = Date.now()
  for (const match of allMatches) {
    if (new Date(match.lock_time_utc).getTime() > now) continue      // aún no cerró
    if (match.status === 'finished') continue                         // ya terminado
    const card = document.querySelector(`[data-match-id="${match.id}"]`)
    if (!card) continue
    // Si la card sigue mostrándose como editable (no tiene clase de estado final),
    // aplicar el bloqueo visual ahora que volvemos a tener el foco
    const isStillEditable = !card.classList.contains('locked')
      && !card.classList.contains('exact')
      && !card.classList.contains('partial')
      && !card.classList.contains('miss')
    if (isStillEditable) lockMatchCard(match.id)
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && allMatches.length > 0) applyMissedLocks()
})

function lockMatchCard(matchId) {
  const card = document.querySelector(`[data-match-id="${matchId}"]`)
  if (!card) return

  card.querySelectorAll('.score-input').forEach(input => { input.disabled = true })

  const scoreArea = card.querySelector('.match-score-area')
  if (scoreArea) {
    scoreArea.classList.add('locked-area')
    scoreArea.dataset.tooltip = 'Partido cerrado'
  }

  const saveBtn = card.querySelector('[data-save-btn]')
  if (saveBtn) saveBtn.remove()

  const statusEl = card.querySelector('.match-status')
  if (statusEl) statusEl.textContent = 'Bloqueado · esperando resultado'

  card.classList.remove('open', 'soon')
  card.classList.add('locked')
  showToast('Un partido acaba de cerrarse', 'warning', 4000)
}

function renderChampionCard() {
  const container = document.getElementById('champion-section')
  if (!container) return

  const firstGroupMatch = allMatches.find(m => m.phase === 'group')
  const lockTime = firstGroupMatch ? new Date(firstGroupMatch.lock_time_utc) : null
  const isLocked = lockTime && new Date() >= lockTime

  // ===== Locked, no pick made =====
  if (isLocked && !champPrediction) {
    container.innerHTML = `
      <div class="champion-card">
        <div class="meta"><span class="pill">Tu final del Mundial</span></div>
        <h3>Te quedaste sin <em>pick</em></h3>
        <p>El tiempo para cargar tu predicción especial ya pasó. Vas a perderte hasta 50 puntos.</p>
      </div>`
    return
  }

  // ===== Locked, with pick (Option A pick-readout) =====
  if (isLocked && champPrediction) {
    const champFlag = getFlagHtml(champPrediction.champion_team)
    const runnerFlag = getFlagHtml(champPrediction.runner_up_team)
    const pts = champPrediction.total_points
    const pointsHtml = pts != null
      ? `<span class="points-earned">+${pts} pts</span>`
      : `<span class="points-earned" style="background:rgba(255,255,255,0.10);border-color:rgba(255,255,255,0.20);color:rgba(255,255,255,0.85)">Esperando final</span>`

    container.innerHTML = `
      <div class="champion-card locked">
        <div class="meta"><span class="pill">Tu final del Mundial</span></div>
        <h3>Tu pick para la <em>copa</em></h3>
        <div class="pick-readout">
          <div class="pick gold">
            ${champFlag}
            <div class="role-name">
              <small>Campeón</small>
              <b>${champPrediction.champion_team}</b>
            </div>
          </div>
          <span class="vs">vs</span>
          <div class="pick silver">
            ${runnerFlag}
            <div class="role-name">
              <small>Subcampeón</small>
              <b>${champPrediction.runner_up_team}</b>
            </div>
          </div>
        </div>
        <div class="champ-footer">
          <span>Cerrado · 50 pts si acertás los dos exactos</span>
          ${pointsHtml}
        </div>
      </div>`
    return
  }

  // ===== Editable state =====
  const teamOptions = ALL_TEAMS.map(t =>
    `<option value="${t}" ${champPrediction?.champion_team === t ? 'selected' : ''}>${t}</option>`
  ).join('')
  const runnerOptions = ALL_TEAMS.map(t =>
    `<option value="${t}" ${champPrediction?.runner_up_team === t ? 'selected' : ''}>${t}</option>`
  ).join('')

  container.innerHTML = `
    <div class="champion-card">
      <div class="meta"><span class="pill">Predicción especial · 50 pts</span></div>
      <h3>¿Quién levanta la <em>copa</em>?</h3>
      <p>Elegí campeón y subcampeón antes del primer partido. Se cierra 10 min antes del inicio.<br>
      <small style="color:rgba(255,255,255,0.6)">🏆 Campeón exacto: <b>20 pts</b> · 🥈 Subcampeón exacto: <b>10 pts</b> · Ambos correctos: <b>+20 bonus</b> = 50 pts en total</small></p>
      <div class="champion-selects">
        <div class="champion-select-group">
          <label>Campeón <span class="champ-label-flag" id="champ-flag-champ"></span></label>
          <select class="champion-select" id="champ-team">
            <option value="">— Elegir equipo —</option>
            ${teamOptions}
          </select>
        </div>
        <div class="champion-vs">vs</div>
        <div class="champion-select-group">
          <label>Subcampeón <span class="champ-label-flag" id="champ-flag-runner"></span></label>
          <select class="champion-select" id="runner-team">
            <option value="">— Elegir equipo —</option>
            ${runnerOptions}
          </select>
        </div>
        <button class="btn btn-primary" id="save-champ-btn">Guardar</button>
      </div>
      <div id="champ-feedback"></div>
    </div>`

  document.getElementById('save-champ-btn').addEventListener('click', saveChampionPrediction)

  function updateFlag(selectId, flagId) {
    const team = document.getElementById(selectId)?.value
    const el = document.getElementById(flagId)
    if (el) el.innerHTML = team ? getFlagHtml(team) : ''
  }

  updateFlag('champ-team', 'champ-flag-champ')
  updateFlag('runner-team', 'champ-flag-runner')
  document.getElementById('champ-team').addEventListener('change', () => updateFlag('champ-team', 'champ-flag-champ'))
  document.getElementById('runner-team').addEventListener('change', () => updateFlag('runner-team', 'champ-flag-runner'))
}

async function saveChampionPrediction() {
  const champion = document.getElementById('champ-team').value
  const runner_up = document.getElementById('runner-team').value
  const feedback = document.getElementById('champ-feedback')

  if (!champion || !runner_up) {
    feedback.textContent = 'Elegí los dos equipos.'
    return
  }
  if (champion === runner_up) {
    feedback.textContent = 'El campeón y subcampeón deben ser diferentes.'
    return
  }

  const btn = document.getElementById('save-champ-btn')
  btn.disabled = true
  btn.textContent = 'Guardando...'

  const payload = {
    user_id: currentUser.id,
    champion_team: champion,
    runner_up_team: runner_up,
  }

  // Upsert garantiza atomicidad: si por alguna razón hay un registro previo
  // del que no tenemos referencia local, no genera duplicados.
  const { error } = await supabase
    .from('champion_predictions')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    feedback.textContent = 'Error al guardar. Intentá de nuevo.'
    btn.disabled = false
    btn.textContent = 'Guardar'
    return
  }

  champPrediction = payload
  showToast('¡Predicción especial guardada!', 'success')
  feedback.textContent = 'Guardado · podés editarlo hasta el primer partido.'
  btn.disabled = false
  btn.textContent = 'Guardar'
}

function renderFilters() {
  const container = document.getElementById('filters-section')
  if (!container) return

  const groups = [...new Set(allMatches.filter(m => m.group_name).map(m => m.group_name))].sort()
  const presentPhases = new Set(allMatches.map(m => m.phase))
  const phases = PHASE_ORDER.filter(p => presentPhases.has(p))

  const groupOptions = `<option value="all">Todos los grupos</option>` +
    groups.map(g => `<option value="${g}" ${activeFilters.group === g ? 'selected' : ''}>Grupo ${g}</option>`).join('')

  const phaseOptions = `<option value="all">Todas las fases</option>` +
    phases.map(p => `<option value="${p}" ${activeFilters.phase === p ? 'selected' : ''}>${PHASE_LABELS[p]}</option>`).join('')

  container.innerHTML = `
    <div class="filter-bar">
      <button class="filter-btn ${activeFilters.day === 'today' ? 'active' : ''}" data-day="today">Hoy</button>
      <button class="filter-btn ${activeFilters.day === 'tomorrow' ? 'active' : ''}" data-day="tomorrow">Mañana</button>
      <input type="date" class="filter-btn" id="filter-date-picker"
        value="${activeFilters.date || ''}"
        style="padding:8px 10px;cursor:pointer">
      <select class="filter-select" id="filter-group">${groupOptions}</select>
      <select class="filter-select" id="filter-phase">${phaseOptions}</select>
      ${Object.keys(activeFilters).length > 0
        ? `<button class="filter-btn" id="clear-filters-btn">✕ Limpiar</button>`
        : ''}
    </div>`

  const matchDates = new Set(allMatches.map(m => m.match_datetime_utc.slice(0, 10)))
  createDatePicker(document.getElementById('filter-date-picker'), {
    highlight: matchDates,
  })

  container.querySelectorAll('[data-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (activeFilters.day === btn.dataset.day) {
        delete activeFilters.day
      } else {
        activeFilters.day = btn.dataset.day
        delete activeFilters.date
        document.getElementById('filter-date-picker').value = ''
      }
      saveFilters()
      renderAll()
    })
  })

  document.getElementById('filter-date-picker').addEventListener('change', (e) => {
    if (e.target.value) {
      activeFilters.date = e.target.value
      delete activeFilters.day
    } else {
      delete activeFilters.date
    }
    saveFilters()
    renderAll()
  })

  document.getElementById('filter-group').addEventListener('change', (e) => {
    activeFilters.group = e.target.value
    saveFilters()
    renderMatches()
  })

  document.getElementById('filter-phase').addEventListener('change', (e) => {
    activeFilters.phase = e.target.value
    saveFilters()
    renderMatches()
  })

  document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
    activeFilters = {}
    saveFilters()
    renderAll()
  })
}

function saveFilters() {
  sessionStorage.setItem('pred-filters', JSON.stringify(activeFilters))
}

function renderMatches() {
  const container = document.getElementById('matches-list')
  if (!container) return

  const filtered = getFilteredMatches()

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No hay partidos para los filtros seleccionados.</p></div>`
    return
  }

  container.innerHTML = filtered.map(match => renderMatchCard(match)).join('')

  container.querySelectorAll('.score-input').forEach(input => {
    const matchId = parseInt(input.closest('[data-match-id]').dataset.matchId)
    input.addEventListener('input', debounce(() => savePrediction(matchId), 1000))
    input.addEventListener('change', () => savePrediction(matchId))
  })

  // Celebrate exact predictions on first render (after results land)
  container.querySelectorAll('.match-card.exact').forEach(card => {
    if (card.dataset.celebrated) return
    const matchId = parseInt(card.dataset.matchId)
    const match = allMatches.find(m => m.id === matchId)
    if (!match) return
    card.dataset.celebrated = '1'
    requestAnimationFrame(() => fireCardConfetti(card, match))
  })
}

function renderMatchCard(match) {
  const pred = predictions[match.id]
  const status = getPredictionStatus(match, pred)
  const { time, dateShort } = formatMatchTime(match.match_datetime_utc)
  const isLocked = new Date() >= new Date(match.lock_time_utc)

  const homeVal = pred?.home_score_pred ?? ''
  const awayVal = pred?.away_score_pred ?? ''

  const phaseLabel = match.group_name
    ? `Grupo ${match.group_name} · Jornada ${match.matchday}`
    : PHASE_LABELS[match.phase] || match.phase

  const resultHtml = match.home_score !== null
    ? `<div class="real-result">Resultado: <strong>${localizeTeamName(match.home_team)} ${match.home_score} — ${match.away_score} ${localizeTeamName(match.away_team)}</strong></div>`
    : ''

  const hasPred = pred && !isLocked

  const { home: homeColor, away: awayColor } = teamColors(match.home_team, match.away_team)

  return `
    <div class="match-card ${status.cls}" data-match-id="${match.id}"
         data-team-colors style="--home-color:${homeColor}; --away-color:${awayColor};">
      <div class="match-meta">
        <span class="match-phase">${phaseLabel}</span>
        <span class="match-time">${dateShort} · ${time} hs</span>
      </div>
      <div class="match-teams">
        <div class="team">
          <span class="team-flag">${getFlagHtml(match.home_team)}</span>
          <span class="team-name">${localizeTeamName(match.home_team)}</span>
        </div>
        <div class="match-score-area${isLocked ? ' locked-area' : ''}"
             ${isLocked ? 'data-tooltip="Partido cerrado"' : ''}>
          <input type="number" class="score-input num" min="0" max="20"
            value="${homeVal}" placeholder="—"
            ${isLocked ? 'disabled' : ''} aria-label="Goles ${match.home_team}">
          <span class="score-sep">—</span>
          <input type="number" class="score-input num" min="0" max="20"
            value="${awayVal}" placeholder="—"
            ${isLocked ? 'disabled' : ''} aria-label="Goles ${match.away_team}">
        </div>
        <div class="team">
          <span class="team-flag">${getFlagHtml(match.away_team)}</span>
          <span class="team-name">${localizeTeamName(match.away_team)}</span>
        </div>
      </div>
      ${resultHtml}
      <div class="match-footer">
        <span class="match-status">${status.label}</span>
        ${status.pts ? `<span class="match-points">${status.pts}</span>` : ''}
        ${!isLocked
          ? `<button class="btn btn-sm ${hasPred ? 'btn-saved' : 'btn-ghost'}" data-save-btn="${match.id}">${hasPred ? '✓ Guardado' : 'Guardar'}</button>`
          : ''}
      </div>
    </div>`
}

async function savePrediction(matchId) {
  const match = allMatches.find(m => m.id === matchId)
  if (match && new Date() >= new Date(match.lock_time_utc)) {
    showToast('Este partido ya cerró. No podés modificar tu predicción.', 'warning')
    renderMatches()
    return
  }

  const card = document.querySelector(`[data-match-id="${matchId}"]`)
  if (!card) return

  const inputs = card.querySelectorAll('.score-input')
  const homeVal = inputs[0].value
  const awayVal = inputs[1].value

  if (homeVal === '' || awayVal === '') return

  const home = parseInt(homeVal)
  const away = parseInt(awayVal)

  if (isNaN(home) || isNaN(away) || home < 0 || away < 0) return

  const payload = {
    user_id: currentUser.id,
    match_id: matchId,
    home_score_pred: home,
    away_score_pred: away,
  }

  const { error } = await supabase
    .from('predictions')
    .upsert(payload, { onConflict: 'user_id,match_id' })

  if (error) {
    console.error('Error guardando predicción:', error)
    showToast(`Error: ${error.message}`, 'error')
    return
  }

  predictions[matchId] = { ...predictions[matchId], ...payload }

  const btn = document.querySelector(`[data-save-btn="${matchId}"]`)
  if (btn) {
    btn.textContent = '✓ Guardado'
    btn.classList.replace('btn-ghost', 'btn-saved')
  }
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-save-btn]')
  if (btn) {
    const matchId = parseInt(btn.dataset.saveBtn)
    await savePrediction(matchId)
  }
})

document.addEventListener('input', (e) => {
  if (!e.target.classList.contains('score-input')) return
  const card = e.target.closest('[data-match-id]')
  if (!card) return
  const btn = card.querySelector('[data-save-btn]')
  if (btn && btn.classList.contains('btn-saved')) {
    btn.textContent = 'Guardar'
    btn.classList.replace('btn-saved', 'btn-ghost')
  }
})

init()
