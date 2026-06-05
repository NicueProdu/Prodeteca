import { supabase } from './supabase-client.js'
import { requireAuth } from './auth.js'
import { renderNav, loadNavPoints, showToast } from './ui.js'
import { getFlagHtml } from './flags.js'

let currentUser = null
let allMatches = []
let allPreds = []
let champ = null
let activeFilter = 'all'    // all | exact | partial | pending

async function init() {
  const session = await requireAuth()
  if (!session) return

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  currentUser = profile || { id: session.user.id, email: session.user.email }
  renderNav('profile', currentUser)

  await Promise.all([renderHeader(), loadAll()])
  renderStats()
  renderChampion()
  renderHistory()
}

async function loadAll() {
  const [matchesRes, predsRes, champRes, rankingRes] = await Promise.all([
    supabase.from('matches').select('*').order('match_datetime_utc', { ascending: false }),
    supabase.from('predictions').select('*').eq('user_id', currentUser.id),
    supabase.from('champion_predictions').select('*').eq('user_id', currentUser.id).single(),
    // Pull just current user's rank if it's exposed via a view; otherwise we just
    // show their absolute points and a hyphen for rank.
    supabase.from('ranking_view').select('rank').eq('user_id', currentUser.id).single().catch(() => ({ data: null })),
  ])

  allMatches = matchesRes.data || []
  allPreds = predsRes.data || []
  champ = champRes.data || null
  currentUser._rank = rankingRes?.data?.rank ?? null
}

async function renderHeader() {
  const container = document.getElementById('profile-header')
  if (!container) return

  const name = currentUser.name || currentUser.email.split('@')[0]
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const avatarHtml = currentUser.avatar_url
    ? `<img src="${currentUser.avatar_url}" alt="avatar" class="profile-avatar" id="avatar-img">`
    : `<div class="profile-avatar-placeholder">${initials}</div>`

  container.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar-wrap">
        ${avatarHtml}
        <button class="profile-avatar-btn" id="change-avatar-btn" title="Cambiar foto" aria-label="Cambiar foto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l3.5-1 13-13a1 1 0 0 0 0-1.4l-2-2a1 1 0 0 0-1.5 0l-13 13z"/></svg>
        </button>
        <input type="file" id="avatar-input" accept="image/*" style="display:none">
      </div>
      <div class="profile-info">
        <div class="profile-eyebrow">Tu temporada</div>
        <div class="profile-name">
          <h2 id="display-name">${name}</h2>
          <button class="edit-name-btn" id="edit-name-btn" title="Editar nombre">Editar</button>
        </div>
        <div class="profile-email">${currentUser.email}</div>
      </div>
      <div class="profile-pts" id="total-pts">—<span>pts totales</span></div>
      <div class="profile-stat-strip" id="stat-strip"></div>
    </div>`

  document.getElementById('change-avatar-btn').addEventListener('click', () => {
    document.getElementById('avatar-input').click()
  })
  document.getElementById('avatar-input').addEventListener('change', handleAvatarUpload)
  document.getElementById('edit-name-btn').addEventListener('click', showNameEdit)

  await loadNavPoints(currentUser.id)
}

function computeStats() {
  let exact = 0, partial = 0, miss = 0, matchPts = 0, total = allMatches.length, predicted = 0
  for (const p of allPreds) {
    if (p.points_earned == null) continue
    predicted++
    if (p.points_earned === 3) { exact++; matchPts += 3 }
    else if (p.points_earned === 1) { partial++; matchPts += 1 }
    else miss++
  }
  const champPts = champ?.total_points || 0
  const totalPts = matchPts + champPts
  const accuracy = predicted > 0 ? Math.round(((exact + partial) / predicted) * 100) : 0
  return { exact, partial, miss, matchPts, champPts, totalPts, predicted, accuracy }
}

function renderStats() {
  const s = computeStats()

  // Total in hero
  const ptsEl = document.getElementById('total-pts')
  if (ptsEl) ptsEl.innerHTML = `${s.totalPts}<span>pts totales</span>`

  // Stat strip inside hero
  const strip = document.getElementById('stat-strip')
  if (strip) {
    const pos = currentUser._rank ? `#${currentUser._rank}` : '—'
    strip.innerHTML = `
      <div class="stat-cell gold"><span class="value">${pos}</span><span class="label">Posición</span></div>
      <div class="stat-cell"><span class="value">${s.exact}</span><span class="label">Exactos</span></div>
      <div class="stat-cell"><span class="value">${s.partial}</span><span class="label">Parciales</span></div>
      <div class="stat-cell"><span class="value">${s.accuracy}%</span><span class="label">Aciertos</span></div>
    `
  }

  // Stat grid
  const container = document.getElementById('points-breakdown')
  if (!container) return

  const champLabel = s.champPts > 0
    ? `<span class="sub"><b>+${s.champPts} pts</b> · acertaste ${s.champPts >= 50 ? 'los dos exactos' : s.champPts >= 20 ? 'el campeón' : 'el subcampeón'}</span>`
    : champ
      ? `<span class="sub">esperando final del Mundial</span>`
      : `<span class="sub">sin pick · perdiste hasta 50 pts</span>`

  container.innerHTML = `
    <div class="stat-card exact">
      <div class="icon"></div>
      <span class="big">${s.exact}</span>
      <span class="label">Exactos</span>
      <span class="sub">${s.exact} × 3 = <b>${s.matchPts - s.partial} pts</b></span>
    </div>
    <div class="stat-card partial">
      <div class="icon"></div>
      <span class="big">${s.partial}</span>
      <span class="label">Parciales</span>
      <span class="sub">${s.partial} × 1 = <b>${s.partial} pts</b></span>
    </div>
    <div class="stat-card miss">
      <div class="icon"></div>
      <span class="big">${s.miss}</span>
      <span class="label">Sin acierto</span>
      <span class="sub"><b>0 pts</b></span>
    </div>
    <div class="stat-card champ">
      <div class="icon"></div>
      <span class="big">${s.champPts ? `+${s.champPts}` : '—'}</span>
      <span class="label">Bonus campeón</span>
      ${champLabel}
    </div>`
}

function renderChampion() {
  const container = document.getElementById('champion-pick-section')
  if (!container) return

  if (!champ) {
    container.innerHTML = `
      <div class="champion-card">
        <div class="meta"><span class="pill">Tu final del Mundial</span></div>
        <h3>No completaste el <em>pick</em></h3>
        <p>Te perdés hasta 50 puntos por no haber elegido campeón y subcampeón.</p>
      </div>`
    return
  }

  const pts = champ.total_points
  const pointsHtml = pts != null
    ? `<span class="points-earned">+${pts} pts</span>`
    : `<span class="points-earned" style="background:rgba(255,255,255,0.10);border-color:rgba(255,255,255,0.20);color:rgba(255,255,255,0.85)">Esperando final</span>`

  container.innerHTML = `
    <div class="champion-card locked">
      <div class="meta"><span class="pill">Tu final del Mundial</span></div>
      <h3>Tu pick para la <em>copa</em></h3>
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

function renderHistory() {
  const container = document.getElementById('history-section')
  if (!container) return

  const predMap = {}
  for (const p of allPreds) predMap[p.match_id] = p

  const now = new Date()
  const rows = allMatches
    .map(m => {
      const p = predMap[m.id]
      const lockTime = new Date(m.lock_time_utc)
      const isLocked = now >= lockTime

      let status, statusCls, pts = null
      if (m.status === 'finished' && p) {
        pts = p.points_earned
        if (pts === 3)      { status = '+3 pts'; statusCls = 'exact' }
        else if (pts === 1) { status = '+1 pt';  statusCls = 'partial' }
        else                 { status = '0 pts';  statusCls = 'miss' }
      } else if (m.status === 'finished') {
        status = 'Sin predicción'; statusCls = 'miss'; pts = 0
      } else if (isLocked) {
        status = 'Bloqueado'; statusCls = 'locked'
      } else {
        status = p ? 'Editable' : 'Sin pred.'; statusCls = 'open'
      }

      return { match: m, pred: p, status, statusCls, pts }
    })
    .filter(r => {
      if (activeFilter === 'exact')    return r.statusCls === 'exact'
      if (activeFilter === 'partial')  return r.statusCls === 'partial'
      if (activeFilter === 'pending')  return r.statusCls === 'open' || r.statusCls === 'locked'
      return true
    })

  const rowHtml = rows.map(({ match: m, pred: p, status, statusCls }) => {
    const predScore = p ? `${p.home_score_pred}—${p.away_score_pred}` : '—'
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

  container.innerHTML = `
    <h3>Mi historial · ${allMatches.length} partidos</h3>
    <div class="history-filters">
      <button class="filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">Todos</button>
      <button class="filter-btn ${activeFilter === 'exact' ? 'active' : ''}" data-filter="exact">Exactos</button>
      <button class="filter-btn ${activeFilter === 'partial' ? 'active' : ''}" data-filter="partial">Parciales</button>
      <button class="filter-btn ${activeFilter === 'pending' ? 'active' : ''}" data-filter="pending">Pendientes</button>
    </div>
    <div class="history-list">
      ${rowHtml || '<div class="empty-state"><p>No hay partidos en esta vista.</p></div>'}
    </div>`

  container.querySelectorAll('[data-filter]').forEach(b => {
    b.addEventListener('click', () => {
      activeFilter = b.dataset.filter
      renderHistory()
    })
  })
}

function showNameEdit() {
  const nameEl = document.getElementById('display-name')
  const editBtn = document.getElementById('edit-name-btn')
  if (!nameEl || !editBtn) return

  const current = nameEl.textContent
  nameEl.outerHTML = `
    <div class="name-edit-form" id="name-edit-form">
      <input class="name-edit-input" id="name-input" value="${current}" maxlength="60">
      <button class="btn btn-sm btn-primary" id="save-name-btn">Guardar</button>
      <button class="btn btn-sm btn-ghost" id="cancel-name-btn">Cancelar</button>
    </div>`
  editBtn.style.display = 'none'

  document.getElementById('save-name-btn').addEventListener('click', saveName)
  document.getElementById('cancel-name-btn').addEventListener('click', () => {
    document.getElementById('name-edit-form').outerHTML = `<h2 id="display-name">${current}</h2>`
    editBtn.style.display = ''
  })
  document.getElementById('name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveName()
    if (e.key === 'Escape') document.getElementById('cancel-name-btn').click()
  })
  document.getElementById('name-input').focus()
  document.getElementById('name-input').select()
}

async function saveName() {
  const input = document.getElementById('name-input')
  const newName = input?.value.trim()
  if (!newName) return

  const { error } = await supabase
    .from('users')
    .update({ name: newName })
    .eq('id', currentUser.id)

  if (error) { showToast('Error al guardar nombre', 'error'); return }

  currentUser.name = newName
  document.getElementById('name-edit-form').outerHTML = `<h2 id="display-name">${newName}</h2>`
  const editBtn = document.getElementById('edit-name-btn')
  if (editBtn) {
    editBtn.style.display = ''
    editBtn.addEventListener('click', showNameEdit, { once: true })
  }
  showToast('Nombre actualizado', 'success')
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { showToast('Solo se permiten imágenes', 'error'); return }
  if (file.size > 5 * 1024 * 1024) { showToast('La imagen no puede superar 5MB', 'error'); return }

  showToast('Subiendo foto...', 'default', 10000)

  const ext = file.name.split('.').pop()
  const path = `${currentUser.id}/avatar-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file)
  if (uploadError) { showToast(`Error al subir la imagen: ${uploadError.message}`, 'error'); return }

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
  const { error: updateError } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', currentUser.id)
  if (updateError) { showToast(`Error al guardar la foto: ${updateError.message}`, 'error'); return }

  currentUser.avatar_url = publicUrl
  const img = document.getElementById('avatar-img')
  if (img) img.src = publicUrl
  else {
    const ph = document.querySelector('.profile-avatar-placeholder')
    if (ph) ph.outerHTML = `<img src="${publicUrl}" alt="avatar" class="profile-avatar" id="avatar-img">`
  }
  showToast('Foto actualizada', 'success')
}

init()
