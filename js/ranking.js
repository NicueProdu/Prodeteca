import { supabase } from './supabase-client.js'
import { requireAuth } from './auth.js'
import { renderNav, loadNavPoints, showToast, renderSkeleton, openModal } from './ui.js'
import { getFlagHtml } from './flags.js'

// The name (or email) of the Claude bot user. Adjust if you create the user
// with a different identifier.
const CLAUDE_NAME = 'Claude'
const STREAK_MATCHES = 3   // "Últimos N partidos" — used for hot/cold streak

let currentUser = null
let rankingData = []
let lastMatches = []   // last STREAK_MATCHES finished matches
let allPreds = []      // full predictions table (needed for streaks + Claude)
let claudeUser = null
let realtimeSub = null

async function init() {
  const session = await requireAuth()
  if (!session) return

  const { data: profile } = await supabase
    .from('users').select('*').eq('id', session.user.id).single()

  currentUser = profile || { id: session.user.id, email: session.user.email }

  renderNav('ranking', currentUser)
  loadNavPoints(currentUser.id)

  document.getElementById('ranking-list').innerHTML = renderSkeleton(6)

  await loadAll()
  renderStreaks()
  renderRanking()
  subscribeRealtime()
}

async function loadAll() {
  const [usersRes, predsRes, champsRes, matchesRes] = await Promise.all([
    supabase.from('users').select('id, name, avatar_url, email'),
    supabase.from('predictions').select('user_id, match_id, home_score_pred, away_score_pred, points_earned').limit(20000),
    supabase.from('champion_predictions').select('user_id, total_points'),
    supabase.from('matches')
      .select('id, status, match_datetime_utc, home_team, away_team')
      .eq('status', 'finished')
      .order('match_datetime_utc', { ascending: false })
      .limit(STREAK_MATCHES),
  ])

  if (usersRes.error) { showToast('Error cargando ranking', 'error'); return }

  const users = usersRes.data || []
  allPreds = predsRes.data || []
  lastMatches = matchesRes.data || []
  claudeUser = users.find(u => (u.name || '').toLowerCase() === CLAUDE_NAME.toLowerCase()
                            || (u.email || '').toLowerCase().startsWith('claude@')) || null

  // Aggregate per-user
  const predMap = {}
  for (const p of allPreds) {
    if (!predMap[p.user_id]) predMap[p.user_id] = { pts: 0, exact: 0, partial: 0, miss: 0, predicted: 0 }
    if (p.points_earned == null) continue
    predMap[p.user_id].predicted++
    if (p.points_earned === 3) { predMap[p.user_id].pts += 3; predMap[p.user_id].exact++ }
    else if (p.points_earned === 1) { predMap[p.user_id].pts += 1; predMap[p.user_id].partial++ }
    else predMap[p.user_id].miss++
  }

  const champMap = {}
  for (const c of (champsRes.data || [])) champMap[c.user_id] = c.total_points || 0

  rankingData = users.map(u => ({
    ...u,
    matchPts: predMap[u.id]?.pts || 0,
    exact:    predMap[u.id]?.exact || 0,
    partial:  predMap[u.id]?.partial || 0,
    miss:     predMap[u.id]?.miss || 0,
    predicted: predMap[u.id]?.predicted || 0,
    champPts: champMap[u.id] || 0,
    total: (predMap[u.id]?.pts || 0) + (champMap[u.id] || 0),
  })).sort((a, b) => b.total - a.total)
}

// Streaks: en racha / va para atrás / como Claude
function computeStreaks() {
  // ----- Last N finished matches -----
  const lastIds = new Set(lastMatches.map(m => m.id))

  // Per-user sum of points across the last N matches
  const sumLast = {}
  for (const p of allPreds) {
    if (!lastIds.has(p.match_id)) continue
    if (p.points_earned == null) continue
    sumLast[p.user_id] = (sumLast[p.user_id] || 0) + p.points_earned
  }
  // Mark users who predicted any of the last N matches
  const predictedAny = {}
  for (const p of allPreds) {
    if (!lastIds.has(p.match_id)) continue
    predictedAny[p.user_id] = true
  }

  const eligibleHot = Object.keys(predictedAny)
    .map(uid => ({ uid, sum: sumLast[uid] || 0 }))

  // EN RACHA: top 3 by sum DESC (ties → keep order)
  const hot = eligibleHot.slice().sort((a, b) => b.sum - a.sum).slice(0, 3)
  const hotUids = new Set(hot.map(e => e.uid))

  // VA PARA ATRÁS: top 3 by sum ASC, excluyendo a quienes ya aparecen en "En racha"
  // (con pocos jugadores activos, los mismos pueden aparecer en ambas listas)
  const cold = eligibleHot.slice()
    .sort((a, b) => a.sum - b.sum)
    .filter(e => !hotUids.has(e.uid))
    .slice(0, 3)

  // ----- COMO CLAUDE: most exact-score matches with Claude -----
  let claude = []
  if (claudeUser) {
    const claudePicks = {}
    for (const p of allPreds) {
      if (p.user_id === claudeUser.id) claudePicks[p.match_id] = p
    }
    // For each user, count exact matches with Claude's pick
    const counts = {}
    for (const p of allPreds) {
      if (p.user_id === claudeUser.id) continue
      const c = claudePicks[p.match_id]
      if (!c) continue
      if (p.home_score_pred === c.home_score_pred && p.away_score_pred === c.away_score_pred) {
        counts[p.user_id] = (counts[p.user_id] || 0) + 1
      }
    }
    claude = Object.entries(counts)
      .map(([uid, count]) => ({ uid, sum: count }))
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 3)
  }

  return { hot, cold, claude }
}

function renderStreaks() {
  const container = document.getElementById('streaks-section')
  if (!container) return

  // Sin partidos terminados todavía: ocultar la sección entera
  if (lastMatches.length === 0) {
    container.innerHTML = ''
    return
  }

  const { hot, cold, claude } = computeStreaks()
  const userMap = Object.fromEntries(rankingData.map(u => [u.id, u]))

  const renderRow = (entry, i, fmt) => {
    const u = userMap[entry.uid]
    if (!u) return ''
    const name = u.name || (u.email || '').split('@')[0] || 'Usuario'
    const isMe = u.id === currentUser.id
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    const avatar = u.avatar_url
      ? `<span class="avatar"><img src="${u.avatar_url}" alt=""></span>`
      : `<span class="avatar">${initials}</span>`
    return `
      <div class="streak-row">
        <span class="place">${i + 1}</span>
        ${avatar}
        <span class="name ${isMe ? 'me' : ''}">${name}${isMe ? ' (vos)' : ''}</span>
        <span class="value">${fmt(entry.sum)}</span>
      </div>`
  }

  const renderList = (entries, fmt, emptyMsg) =>
    entries.length === 0
      ? `<div class="empty">${emptyMsg}</div>`
      : `<div class="streak-list">${entries.map((e, i) => renderRow(e, i, fmt)).join('')}</div>`

  const claudeCardHtml = claudeUser ? `
    <div class="streak-card claude">
      <div class="streak-card-header">
        <span class="icon" aria-hidden="true"></span>
        <div>
          <div class="title">Claudiones</div>
          <div class="sub">Aciertos en común</div>
        </div>
      </div>
      ${renderList(claude, v => `${v}×`, 'Sin aciertos compartidos todavía.')}
    </div>` : ''

  container.innerHTML = `
    <div class="streak-card hot">
      <div class="streak-card-header">
        <span class="icon" aria-hidden="true"></span>
        <div>
          <div class="title">En racha</div>
          <div class="sub">Últimos ${lastMatches.length} partidos</div>
        </div>
      </div>
      ${renderList(hot, v => `+${v}`, 'No hay predicciones todavía.')}
    </div>

    <div class="streak-card cold">
      <div class="streak-card-header">
        <span class="icon" aria-hidden="true"></span>
        <div>
          <div class="title">Va para atrás</div>
          <div class="sub">Últimos ${lastMatches.length} partidos</div>
        </div>
      </div>
      ${renderList(cold, v => v === 0 ? '0' : `+${v}`, 'No hay predicciones todavía.')}
    </div>

    ${claudeCardHtml}`
}

function renderRanking() {
  const container = document.getElementById('ranking-list')
  if (!container) return

  if (rankingData.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No hay datos de ranking todavía.</p></div>`
    return
  }

  const top3 = rankingData.slice(0, 3)

  // Podium (only if we have 3+ users)
  const podiumHtml = top3.length >= 3 ? `
    <div class="podium">
      ${renderPodiumStep(top3[1], 2)}
      ${renderPodiumStep(top3[0], 1)}
      ${renderPodiumStep(top3[2], 3)}
    </div>` : ''

  // Full table
  const rowsHtml = rankingData.map((user, i) => {
    const pos = i + 1
    const isMe = user.id === currentUser.id
    const initials = (user.name || user.email || '').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
    const avatarHtml = user.avatar_url
      ? `<img src="${user.avatar_url}" alt="" class="rank-avatar">`
      : `<div class="rank-avatar-placeholder">${initials}</div>`
    const posClass = pos === 1 ? 'top1' : pos === 2 ? 'top2' : pos === 3 ? 'top3' : ''
    const displayName = (user.name || user.email.split('@')[0]) + (isMe ? ' (vos)' : '')

    return `
      <tr class="${isMe ? 'current-user' : ''}" data-user-id="${user.id}">
        <td><span class="rank-pos ${posClass}">${pos}</span></td>
        <td>
          <div class="rank-user">
            ${avatarHtml}
            <span>${displayName}</span>
          </div>
        </td>
        <td><span class="rank-pts">${user.total}</span></td>
        <td class="hide-mobile">${user.exact}</td>
        <td class="hide-mobile">${user.partial}</td>
        <td class="hide-mobile">
          ${user.champPts > 0
            ? `<span style="color:var(--trophy-gold-2);font-weight:700">+${user.champPts}</span>`
            : '—'}
        </td>
        <td>
          <button class="btn btn-sm btn-ghost" data-detail-user="${user.id}">Ver</button>
        </td>
      </tr>`
  }).join('')

  container.innerHTML = podiumHtml + `
    <div class="card" style="padding:0;overflow:hidden">
      <table class="ranking-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jugador</th>
            <th>Pts</th>
            <th class="hide-mobile">Exactos</th>
            <th class="hide-mobile">Parciales</th>
            <th class="hide-mobile">Bonus</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`

  container.querySelectorAll('[data-detail-user]').forEach(btn => {
    btn.addEventListener('click', () => showUserDetail(btn.dataset.detailUser))
  })
}

function renderPodiumStep(user, place) {
  const initials = (user.name || user.email || '').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
  const avatar = user.avatar_url
    ? `<div class="avatar"><img src="${user.avatar_url}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover"></div>`
    : `<div class="avatar">${initials}</div>`
  const name = user.name || user.email.split('@')[0]
  return `
    <div class="podium-step" data-place="${place}">
      ${avatar}
      <div class="name">${name}</div>
      <div class="pts"><b>${user.total}</b> pts</div>
      <div class="podium-block"><span class="medal">${place}°</span>${place}</div>
    </div>`
}

async function showUserDetail(userId) {
  const user = rankingData.find(u => u.id === userId)
  if (!user) return

  // Abrir el modal de inmediato con skeleton — el usuario sabe que respondió
  const overlay = openModal(`
    <button class="modal-close" aria-label="Cerrar">✕</button>
    <div style="padding:8px 0 16px">
      <div class="skeleton" style="height:22px;width:55%;margin-bottom:14px"></div>
      <div class="skeleton" style="height:14px;width:80%;margin-bottom:8px"></div>
      <div class="skeleton" style="height:14px;width:65%;margin-bottom:24px"></div>
      <div class="skeleton" style="height:48px;margin-bottom:8px"></div>
      <div class="skeleton" style="height:48px;margin-bottom:8px"></div>
      <div class="skeleton" style="height:48px"></div>
    </div>`)
  const modalEl = overlay.querySelector('.modal')

  const pos = rankingData.findIndex(u => u.id === userId) + 1

  const initials = (user.name || user.email || '').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
  const avatarHtml = user.avatar_url
    ? `<img src="${user.avatar_url}" alt="" class="dh-avatar-img">`
    : `<div class="dh-avatar">${initials}</div>`

  const posLabel = pos === 1 ? 'Posición #1 · líder'
                  : pos <= 3 ? `Posición #${pos} · podio`
                  : `Posición #${pos}`

  const [{ data: preds }, { data: champ }] = await Promise.all([
    supabase.from('predictions')
      .select(`*, match:match_id (
        home_team, away_team, home_score, away_score,
        match_datetime_utc, lock_time_utc, phase, group_name, matchday, status
      )`)
      .eq('user_id', userId)
      .order('match_id', { ascending: true }),
    supabase.from('champion_predictions')
      .select('*')
      .eq('user_id', userId)
      .single(),
  ])

  // Construir el HTML con los datos ya cargados
  const html = buildDetailHtml({ user, pos, posLabel, avatarHtml, preds: preds || [], champ })

  // Reemplazar el skeleton con el contenido real; re-cablear el botón de cierre
  // (el click-fuera del overlay sigue activo porque openModal lo cableó en el overlay)
  modalEl.innerHTML = html
  const closeBtn = modalEl.querySelector('.modal-close')
  if (closeBtn) closeBtn.addEventListener('click', () => overlay.remove())
}

/**
 * Construye el HTML del panel de detalle de un usuario.
 * Función pura: no toca el DOM, no hace fetch.
 *
 * @param {{ user, pos, posLabel, avatarHtml, preds, champ }} p
 * @returns {string} HTML listo para insertar en el modal
 */
function buildDetailHtml({ user, pos, posLabel, avatarHtml, preds, champ }) {
  const champHtml = champ ? renderChampionPick(champ) : ''

  const now = new Date()

  // Solo mostrar predicciones bloqueadas o terminadas — nunca las editables de otro usuario
  const visiblePreds = preds
    .filter(p => {
      const m = p.match
      if (!m) return false
      if (m.status === 'finished') return true
      return now >= new Date(m.lock_time_utc)
    })
    .sort((a, b) => {
      const da = new Date(a.match?.match_datetime_utc || 0)
      const db = new Date(b.match?.match_datetime_utc || 0)
      return db - da    // más recientes primero
    })

  const rows = visiblePreds.map(p => {
    const m = p.match
    if (!m) return ''

    let status, statusCls
    if (m.status === 'finished') {
      const pts = p.points_earned
      if (pts === 3)      { status = '+3 pts'; statusCls = 'exact' }
      else if (pts === 1) { status = '+1 pt';  statusCls = 'partial' }
      else                 { status = '0 pts';  statusCls = 'miss' }
    } else {
      status = 'Bloqueado'; statusCls = 'locked'
    }

    const predScore = `${p.home_score_pred}—${p.away_score_pred}`
    const realScore = m.home_score != null ? `${m.home_score}—${m.away_score}` : '—'

    return `
      <div class="history-row">
        <div class="teams">
          <span class="team-flag">${getFlagHtml(m.home_team)}</span>
          <span class="team-name">${m.home_team}</span>
          <span class="vs">vs</span>
          <span class="team-name">${m.away_team}</span>
          <span class="team-flag">${getFlagHtml(m.away_team)}</span>
        </div>
        <span class="pred-score">${predScore}</span>
        <span class="real-score">${realScore}</span>
        <span class="status-pill ${statusCls}">${status}</span>
      </div>`
  }).join('')

  const displayName = user.name || (user.email || '').split('@')[0] || 'Usuario'

  return `
    <div class="detail-hero">
      <button class="modal-close" aria-label="Cerrar">✕</button>
      <div class="dh-top">
        ${avatarHtml}
        <div class="dh-info">
          <span class="dh-rank">${posLabel}</span>
          <h3>${displayName}</h3>
          <span class="dh-email">${user.email || ''}</span>
        </div>
        <div class="dh-pts">${user.total}<span>pts</span></div>
      </div>
      <div class="dh-strip">
        <div class="gold"><b>#${pos}</b>Posición</div>
        <div><b>${user.exact}</b>Exactos</div>
        <div><b>${user.partial}</b>Parciales</div>
        <div><b>${user.champPts ? `+${user.champPts}` : '—'}</b>Bonus</div>
      </div>
    </div>
    <div class="detail-body">
      ${champHtml}
      <h4>Predicciones <span class="count">${visiblePreds.length} partidos</span></h4>
      <div class="history-list">
        ${rows || '<div class="empty-state"><p>Sin predicciones todavía.</p></div>'}
      </div>
    </div>`
}

function renderChampionPick(champ) {
  const pts = champ.total_points
  const pointsHtml = pts != null
    ? `<span class="points-earned">+${pts} pts</span>`
    : `<span class="points-earned" style="background:rgba(255,255,255,0.10);border-color:rgba(255,255,255,0.20);color:rgba(255,255,255,0.85)">Esperando final</span>`

  return `
    <div class="champion-card locked">
      <div class="meta"><span class="pill">Su final del Mundial</span></div>
      <h3>Pick para la <em>copa</em></h3>
      <div class="pick-readout">
        <div class="pick gold">
          ${getFlagHtml(champ.champion_team)}
          <div class="role-name"><small>Campeón</small><b>${champ.champion_team}</b></div>
        </div>
        <span class="vs">vs</span>
        <div class="pick silver">
          ${getFlagHtml(champ.runner_up_team)}
          <div class="role-name"><small>Subcampeón</small><b>${champ.runner_up_team}</b></div>
        </div>
      </div>
      <div class="champ-footer">
        <span>Cerrado · 50 pts si acertás los dos exactos</span>
        ${pointsHtml}
      </div>
    </div>`
}

function subscribeRealtime() {
  if (realtimeSub) realtimeSub.unsubscribe()
  realtimeSub = supabase
    .channel('ranking-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, async () => {
      await loadAll()
      renderStreaks()
      renderRanking()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'champion_predictions' }, async () => {
      await loadAll()
      renderStreaks()
      renderRanking()
    })
    .subscribe()
}

init()
