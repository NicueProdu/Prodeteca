import { supabase } from './supabase-client.js'
import { requireAuth } from './auth.js'
import { renderNav, loadNavPoints, showToast, renderSkeleton } from './ui.js'
import { formatMatchTime, formatRelativeDay } from './timezone.js'
import { getFlagHtml, localizeTeamName } from './flags.js'

const PHASE_LABELS = {
  group:        'Fase de Grupos',
  round_of_32:  '16avos de Final',
  round_of_16:  '8avos de Final',
  quarterfinal: 'Cuartos de Final',
  semifinal:    'Semifinal',
  third_place:  'Tercer Puesto',
  final:        'Final',
}

let currentUser = null
let allMatches = []
let openAccordions = new Set()
let activeRound = null

async function init() {
  const session = await requireAuth()
  if (!session) return

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  currentUser = profile || { id: session.user.id, email: session.user.email }

  renderNav('matches', currentUser)
  loadNavPoints(currentUser.id)

  document.getElementById('matches-container').innerHTML = renderSkeleton(8)

  await loadMatches()
  renderRoundFilter()
  renderMatches()
}

async function loadMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('match_datetime_utc', { ascending: true })

  if (error) { showToast('Error cargando partidos', 'error'); return }
  allMatches = data || []
}

function renderRoundFilter() {
  const container = document.getElementById('round-filter')
  if (!container) return

  const rounds = [
    { value: null, label: 'Todos' },
    { value: 'group-1', label: 'Jornada 1' },
    { value: 'group-2', label: 'Jornada 2' },
    { value: 'group-3', label: 'Jornada 3' },
    { value: 'round_of_32', label: '16avos' },
    { value: 'round_of_16', label: '8avos' },
    { value: 'quarterfinal', label: 'Cuartos' },
    { value: 'semifinal', label: 'Semis' },
    { value: 'final', label: 'Final' },
  ]

  container.innerHTML = `
    <div class="filter-bar" style="margin-bottom:20px">
      ${rounds.map(r => `
        <button class="filter-btn ${activeRound === r.value ? 'active' : ''}"
          data-round="${r.value ?? ''}">
          ${r.label}
        </button>`).join('')}
    </div>`

  container.querySelectorAll('[data-round]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeRound = btn.dataset.round === '' ? null : btn.dataset.round
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      renderMatches()
    })
  })
}

function getFilteredMatches() {
  if (!activeRound) return allMatches

  if (activeRound.startsWith('group-')) {
    const day = parseInt(activeRound.split('-')[1])
    return allMatches.filter(m => m.phase === 'group' && m.matchday === day)
  }

  return allMatches.filter(m => m.phase === activeRound)
}

function renderMatches() {
  const container = document.getElementById('matches-container')
  if (!container) return

  const filtered = getFilteredMatches()

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No hay partidos para esta selección.</p></div>`
    return
  }

  // Group by day
  const byDay = {}
  for (const m of filtered) {
    const day = formatRelativeDay(m.match_datetime_utc)
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(m)
  }

  const now = new Date()
  const html = Object.entries(byDay).map(([day, matches]) => {
    const isToday = day === 'Hoy'
    const matchCards = matches.map(m => renderMatchRow(m, now)).join('')
    return `
      <div class="day-header ${isToday ? 'today' : ''}">${day}</div>
      ${matchCards}`
  }).join('')

  container.innerHTML = html

  // Wire accordion toggles
  container.querySelectorAll('[data-accordion-match]').forEach(btn => {
    btn.addEventListener('click', () => toggleAccordion(parseInt(btn.dataset.accordionMatch)))
  })
}

function renderMatchRow(match, now) {
  const lockTime = new Date(match.lock_time_utc)
  const isLocked = now >= lockTime
  const { time } = formatMatchTime(match.match_datetime_utc)
  const isOpen = openAccordions.has(match.id)

  const phaseLabel = match.group_name
    ? `Grupo ${match.group_name}`
    : PHASE_LABELS[match.phase] || match.phase

  const statusBadge = match.status === 'finished'
    ? `<span class="badge badge-success">Finalizado</span>`
    : match.status === 'live'
      ? `<span class="badge badge-error">EN VIVO</span>`
      : isLocked
        ? `<span class="badge badge-locked">🔒 Bloqueado</span>`
        : `<span class="badge badge-muted">Próximo</span>`

  const resultHtml = match.home_score !== null
    ? `<strong class="num">${match.home_score} — ${match.away_score}</strong>`
    : `<span class="num" style="color:var(--color-text-muted)">vs</span>`

  const accordionHtml = isOpen
    ? `<div class="match-accordion" id="accordion-${match.id}">
        ${isLocked
          ? renderPredictionTable(match)
          : `<p style="color:var(--color-text-muted);font-size:0.85rem;padding:8px 0">
              🔒 Las predicciones se revelan 10 minutos antes del partido.
             </p>`}
      </div>`
    : ''

  return `
    <div class="match-card" style="margin-bottom:0;border-radius:${isOpen ? '12px 12px 0 0' : 'var(--radius)'}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer"
           data-accordion-match="${match.id}">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
            <span style="font-size:0.75rem;color:var(--color-text-muted)">${phaseLabel}</span>
            ${statusBadge}
          </div>
          <div style="display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden">
            <span class="team-flag" style="flex-shrink:0">${getFlagHtml(match.home_team)}</span>
            <span style="font-size:0.875rem;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${localizeTeamName(match.home_team)}</span>
            <span style="flex-shrink:0">${resultHtml}</span>
            <span style="font-size:0.875rem;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:right">${localizeTeamName(match.away_team)}</span>
            <span class="team-flag" style="flex-shrink:0">${getFlagHtml(match.away_team)}</span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;padding-left:4px">
          <div style="font-size:0.875rem;font-weight:600">${time} hs</div>
          <div style="font-size:1rem;color:var(--color-text-muted)">${isOpen ? '▲' : '▼'}</div>
        </div>
      </div>
    </div>
    ${accordionHtml}`
}

const predictionCache = {}

async function toggleAccordion(matchId) {
  if (openAccordions.has(matchId)) {
    openAccordions.delete(matchId)
    renderMatches()
    return
  }

  openAccordions.add(matchId)

  if (!predictionCache[matchId]) {
    await loadMatchPredictions(matchId)
  }

  renderMatches()
}

async function loadMatchPredictions(matchId) {
  const { data } = await supabase
    .from('predictions')
    .select(`
      home_score_pred, away_score_pred, points_earned,
      user:user_id (id, name, avatar_url, email)
    `)
    .eq('match_id', matchId)

  predictionCache[matchId] = data || []
}

// Maps points_earned to the same pill style used in the profile history
function ptsPill(pts) {
  if (pts == null) return { cls: 'locked',  label: 'Pendiente' }
  if (pts === 3)   return { cls: 'exact',   label: '+3 pts' }
  if (pts === 1)   return { cls: 'partial', label: '+1 pt' }
  return { cls: 'miss', label: '0 pts' }
}

function renderPredictionTable(match) {
  const preds = predictionCache[match.id] || []

  if (preds.length === 0) {
    return `<p style="color:var(--color-text-muted);font-size:0.85rem;padding:8px 0">
      Sin predicciones registradas para este partido.
    </p>`
  }

  const rows = preds.map(p => {
    const { cls, label } = ptsPill(p.points_earned)
    const initials = p.user?.name
      ? p.user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
      : '?'
    const isMe = p.user?.id === currentUser.id
    const avatarHtml = p.user?.avatar_url
      ? `<img src="${p.user.avatar_url}" alt="" class="rank-avatar">`
      : `<div class="rank-avatar-placeholder">${initials}</div>`

    return `
      <tr ${isMe ? 'style="background:rgba(0,61,165,0.05)"' : ''}>
        <td style="padding:10px 8px">
          <div style="display:flex;align-items:center;gap:8px;font-size:0.85rem;font-weight:500">
            ${avatarHtml}
            ${p.user?.name || p.user?.email?.split('@')[0] || 'Usuario'}
          </div>
        </td>
        <td style="padding:10px 8px;text-align:center" class="num">
          ${p.home_score_pred} — ${p.away_score_pred}
        </td>
        <td style="padding:10px 8px;text-align:right">
          <span class="status-pill ${cls}">${label}</span>
        </td>
      </tr>`
  }).join('')

  return `
    <table class="prediction-table" style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="font-size:0.7rem;color:var(--color-text-muted);border-bottom:1px solid var(--color-border);text-transform:uppercase;letter-spacing:0.08em">
          <th style="padding:6px 8px;text-align:left;font-weight:700">Jugador</th>
          <th style="padding:6px 8px;text-align:center;font-weight:700">Predicción</th>
          <th style="padding:6px 8px;text-align:right;font-weight:700">Puntos</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

init()
