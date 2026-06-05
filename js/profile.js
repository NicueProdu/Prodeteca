import { supabase } from './supabase-client.js'
import { requireAuth } from './auth.js'
import { renderNav, loadNavPoints, showToast } from './ui.js'
import { getFlagHtml, localizeTeamName } from './flags.js'

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
  const [matchesRes, predsRes, champRes, allPredsRes, allChampsRes] = await Promise.all([
    supabase.from('matches').select('*').order('match_datetime_utc', { ascending: false }),
    supabase.from('predictions').select('*').eq('user_id', currentUser.id),
    supabase.from('champion_predictions').select('*').eq('user_id', currentUser.id).maybeSingle(),
    supabase.from('predictions').select('user_id, points_earned'),
    supabase.from('champion_predictions').select('user_id, total_points'),
  ])

  allMatches = matchesRes.data || []
  allPreds = predsRes.data || []
  champ = champRes.data || null

  // Compute rank client-side (same logic as ranking.js)
  const predMap = {}
  for (const p of (allPredsRes.data || [])) {
    if (p.points_earned == null) continue
    predMap[p.user_id] = (predMap[p.user_id] || 0) + p.points_earned
  }
  const champMap = {}
  for (const c of (allChampsRes.data || [])) {
    champMap[c.user_id] = c.total_points || 0
  }
  const allUserIds = new Set([...Object.keys(predMap), ...Object.keys(champMap), currentUser.id])
  const sorted = [...allUserIds]
    .map(uid => (predMap[uid] || 0) + (champMap[uid] || 0))
    .sort((a, b) => b - a)
  const myTotal = (predMap[currentUser.id] || 0) + (champMap[currentUser.id] || 0)
  currentUser._rank = sorted.findIndex(t => t <= myTotal) + 1
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
      <span class="sub">${s.exact} × 3 = <b>${s.exact * 3} pts</b></span>
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
      if (activeFilter === 'miss')     return r.statusCls === 'miss'
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
          <span class="team-name">${localizeTeamName(m.home_team)}</span>
          <span class="vs">vs</span>
          <span class="team-name">${localizeTeamName(m.away_team)}</span>
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
      <button class="filter-btn ${activeFilter === 'miss' ? 'active' : ''}" data-filter="miss">Sin acierto</button>
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

  // Crear el formulario sin innerHTML interpolado (previene XSS en el valor)
  const form = document.createElement('div')
  form.className = 'name-edit-form'
  form.id = 'name-edit-form'
  form.innerHTML = `
    <input class="name-edit-input" id="name-input" maxlength="60">
    <button class="btn btn-sm btn-primary" id="save-name-btn">Guardar</button>
    <button class="btn btn-sm btn-ghost" id="cancel-name-btn">Cancelar</button>`
  // Asignar el valor via .value (no pasa por el parser HTML → no hay XSS)
  form.querySelector('#name-input').value = current
  nameEl.replaceWith(form)
  editBtn.style.display = 'none'

  document.getElementById('save-name-btn').addEventListener('click', saveName)
  document.getElementById('cancel-name-btn').addEventListener('click', () => {
    const f = document.getElementById('name-edit-form')
    const h2 = document.createElement('h2')
    h2.id = 'display-name'
    h2.textContent = current   // textContent escapa automáticamente
    f.replaceWith(h2)
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
  const saveBtn = document.getElementById('save-name-btn')
  const newName = input?.value.trim()
  if (!newName) return

  if (saveBtn) saveBtn.disabled = true

  const { error } = await supabase
    .from('users')
    .update({ name: newName })
    .eq('id', currentUser.id)

  if (error) {
    showToast('Error al guardar nombre', 'error')
    if (saveBtn) saveBtn.disabled = false
    return
  }

  currentUser.name = newName

  // Reemplazar el formulario con un h2 — usar textContent (no innerHTML) para evitar XSS.
  // El listener del botón "Editar" ya existe desde renderHeader y sigue activo,
  // no se agrega uno nuevo aquí para evitar duplicados.
  const form = document.getElementById('name-edit-form')
  const h2 = document.createElement('h2')
  h2.id = 'display-name'
  h2.textContent = newName
  form.replaceWith(h2)

  const editBtn = document.getElementById('edit-name-btn')
  if (editBtn) editBtn.style.display = ''

  showToast('Nombre actualizado', 'success')
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0]
  e.target.value = '' // reset so same file can be re-selected
  if (!file) return
  if (!file.type.startsWith('image/')) { showToast('Solo se permiten imágenes', 'error'); return }
  if (file.size > 20 * 1024 * 1024) { showToast('La imagen no puede superar 20MB', 'error'); return }
  showCropper(file)
}

function showCropper(file) {
  const reader = new FileReader()
  reader.onload = ev => {
    const img = new Image()
    img.onload = () => openCropModal(img)
    img.src = ev.target.result
  }
  reader.readAsDataURL(file)
}

// ─────────────────────────────────────────────────────────────────────────────
// Crop modal — dividido en 4 funciones con responsabilidades claras:
//   createCropState       → crea el estado mutable (escala + offsets)
//   clampCrop             → mantiene la imagen siempre cubriendo el círculo
//   attachCropInteractions → cablea mouse / rueda / touch sobre el canvas
//   exportCropAsBlob      → renderiza el recorte final como Blob JPEG
//   openCropModal         → orquesta todo lo anterior
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado inicial del recortador: escala mínima para cubrir el círculo,
 * imagen centrada dentro del área de recorte.
 * @param {HTMLImageElement} img
 * @param {number} cropSize Tamaño en px del área circular
 * @returns {{ scale: number, minScale: number, offsetX: number, offsetY: number }}
 */
function createCropState(img, cropSize) {
  const scale = Math.max(cropSize / img.width, cropSize / img.height)
  return {
    scale,
    minScale: scale,
    offsetX: (cropSize - img.width  * scale) / 2,
    offsetY: (cropSize - img.height * scale) / 2,
  }
}

/**
 * Restringe el offset para que la imagen siempre cubra el círculo de recorte
 * (nunca queda espacio negro visible).
 * @param {{ scale: number, offsetX: number, offsetY: number }} state
 * @param {HTMLImageElement} img
 * @param {number} cropSize
 */
function clampCrop(state, img, cropSize) {
  const iw = img.width  * state.scale
  const ih = img.height * state.scale
  state.offsetX = iw >= cropSize
    ? Math.min(0, Math.max(state.offsetX, cropSize - iw))
    : (cropSize - iw) / 2
  state.offsetY = ih >= cropSize
    ? Math.min(0, Math.max(state.offsetY, cropSize - ih))
    : (cropSize - ih) / 2
}

/**
 * Dibuja el frame actual de la imagen en el canvas de recorte.
 */
function drawCrop(ctx, img, state, cropSize) {
  ctx.clearRect(0, 0, cropSize, cropSize)
  ctx.drawImage(img, state.offsetX, state.offsetY, img.width * state.scale, img.height * state.scale)
}

/**
 * Agrega los manejadores de pan (mouse + touch) y zoom (rueda + pellizco)
 * al canvas del recortador. Llama a `onDraw` después de cada cambio de estado.
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLImageElement} img
 * @param {object} state  Referencia mutable — se modifica in-place
 * @param {number} cropSize
 * @param {() => void} onDraw  Función que redibuja el canvas
 */
function attachCropInteractions(canvas, img, state, cropSize, onDraw) {
  // ── Pan con mouse ─────────────────────────────────────────────
  let dragging = false, lastMX = 0, lastMY = 0
  canvas.addEventListener('mousedown', e => {
    dragging = true; lastMX = e.clientX; lastMY = e.clientY
  })
  window.addEventListener('mousemove', e => {
    if (!dragging) return
    state.offsetX += e.clientX - lastMX
    state.offsetY += e.clientY - lastMY
    lastMX = e.clientX; lastMY = e.clientY
    clampCrop(state, img, cropSize); onDraw()
  })
  window.addEventListener('mouseup', () => { dragging = false })

  // ── Zoom con rueda (zoom hacia el cursor) ─────────────────────
  canvas.addEventListener('wheel', e => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 0.08 : -0.08
    const newSc  = Math.max(state.minScale, Math.min(state.scale * (1 + factor), state.minScale * 6))
    const ratio  = newSc / state.scale
    const rect   = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    state.offsetX = cx - (cx - state.offsetX) * ratio
    state.offsetY = cy - (cy - state.offsetY) * ratio
    state.scale = newSc
    clampCrop(state, img, cropSize); onDraw()
  }, { passive: false })

  // ── Pan + pellizco táctil ─────────────────────────────────────
  let lastTouches = []
  canvas.addEventListener('touchstart', e => {
    e.preventDefault()
    lastTouches = [...e.touches]
  }, { passive: false })

  canvas.addEventListener('touchmove', e => {
    e.preventDefault()
    const touches = [...e.touches]

    if (touches.length === 1 && lastTouches.length >= 1) {
      // Un dedo → pan
      state.offsetX += touches[0].clientX - lastTouches[0].clientX
      state.offsetY += touches[0].clientY - lastTouches[0].clientY
      clampCrop(state, img, cropSize); onDraw()

    } else if (touches.length === 2 && lastTouches.length >= 2) {
      // Dos dedos → pellizco (zoom hacia el punto medio)
      const dOld = Math.hypot(
        lastTouches[1].clientX - lastTouches[0].clientX,
        lastTouches[1].clientY - lastTouches[0].clientY,
      )
      const dNew = Math.hypot(
        touches[1].clientX - touches[0].clientX,
        touches[1].clientY - touches[0].clientY,
      )
      if (dOld === 0) { lastTouches = touches; return }

      const newSc = Math.max(state.minScale, Math.min(state.scale * (dNew / dOld), state.minScale * 6))
      const ratio = newSc / state.scale
      const rect  = canvas.getBoundingClientRect()
      const cx = (touches[0].clientX + touches[1].clientX) / 2 - rect.left
      const cy = (touches[0].clientY + touches[1].clientY) / 2 - rect.top
      state.offsetX = cx - (cx - state.offsetX) * ratio
      state.offsetY = cy - (cy - state.offsetY) * ratio
      state.scale = newSc
      clampCrop(state, img, cropSize); onDraw()
    }

    lastTouches = touches
  }, { passive: false })

  canvas.addEventListener('touchend', () => { lastTouches = [] })
}

/**
 * Renderiza la región recortada en un canvas de outputSize × outputSize
 * y retorna el resultado como Blob JPEG.
 * @param {HTMLImageElement} img
 * @param {object} state  Estado del recortador (scale, offsetX, offsetY)
 * @param {number} cropSize   Tamaño del área de recorte en pantalla
 * @param {number} outputSize Tamaño del Blob de salida en px
 * @returns {Promise<Blob>}
 */
function exportCropAsBlob(img, state, cropSize, outputSize) {
  return new Promise((resolve, reject) => {
    const out = document.createElement('canvas')
    out.width = outputSize; out.height = outputSize
    out.getContext('2d').drawImage(
      img,
      -state.offsetX / state.scale,   // sx: columna de la imagen original donde empieza el recorte
      -state.offsetY / state.scale,   // sy: fila de la imagen original donde empieza el recorte
      cropSize / state.scale,          // sWidth: ancho en píxeles originales
      cropSize / state.scale,          // sHeight: alto en píxeles originales
      0, 0, outputSize, outputSize,    // destino: todo el canvas de salida
    )
    out.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob falló')), 'image/jpeg', 0.92)
  })
}

/**
 * Abre el modal de recorte de avatar.
 * Orquesta createCropState + attachCropInteractions + exportCropAsBlob.
 * @param {HTMLImageElement} sourceImg Imagen original cargada con FileReader
 */
function openCropModal(sourceImg) {
  const CROP_SIZE   = Math.min(280, window.innerWidth - 64)
  const OUTPUT_SIZE = 400

  const state = createCropState(sourceImg, CROP_SIZE)

  // ── Construir el overlay del modal ────────────────────────────
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.style.cssText = 'align-items:center;justify-content:center;'
  overlay.innerHTML = `
    <div class="modal crop-modal">
      <div class="crop-modal-header">
        <h3>Ajustar foto de perfil</h3>
        <button id="crop-close" class="crop-close-btn" aria-label="Cerrar">×</button>
      </div>
      <p class="crop-hint">Arrastrá para encuadrar · scroll o pellizco para zoom</p>
      <div class="crop-frame" style="width:${CROP_SIZE}px;height:${CROP_SIZE}px">
        <canvas id="crop-canvas" width="${CROP_SIZE}" height="${CROP_SIZE}"></canvas>
      </div>
      <div class="crop-actions">
        <button class="btn btn-ghost" id="crop-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" id="crop-save-btn">Guardar foto</button>
      </div>
    </div>`
  document.body.appendChild(overlay)

  const canvas = document.getElementById('crop-canvas')
  const ctx    = canvas.getContext('2d')
  const draw   = () => drawCrop(ctx, sourceImg, state, CROP_SIZE)
  draw()

  attachCropInteractions(canvas, sourceImg, state, CROP_SIZE, draw)

  // ── Cerrar ────────────────────────────────────────────────────
  const closeModal = () => overlay.remove()
  document.getElementById('crop-close').addEventListener('click', closeModal)
  document.getElementById('crop-cancel-btn').addEventListener('click', closeModal)
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal() })

  // ── Guardar foto ──────────────────────────────────────────────
  document.getElementById('crop-save-btn').addEventListener('click', async () => {
    const saveBtn = document.getElementById('crop-save-btn')
    saveBtn.disabled = true
    saveBtn.textContent = 'Procesando...'
    try {
      const blob = await exportCropAsBlob(sourceImg, state, CROP_SIZE, OUTPUT_SIZE)
      closeModal()
      uploadCroppedAvatar(blob)
    } catch {
      showToast('Error generando imagen', 'error')
      saveBtn.disabled = false
      saveBtn.textContent = 'Guardar foto'
    }
  })
}

async function uploadCroppedAvatar(blob) {
  showToast('Subiendo foto...', 'default', 10000)

  // Eliminar el avatar anterior del storage (evita que los archivos se acumulen indefinidamente)
  if (currentUser.avatar_url) {
    try {
      const oldPath = decodeURIComponent(currentUser.avatar_url).split('/avatars/')[1]?.split('?')[0]
      if (oldPath) await supabase.storage.from('avatars').remove([oldPath])
    } catch (_) { /* ignorar errores de borrado — no son bloqueantes */ }
  }

  const path = `${currentUser.id}/avatar-${Date.now()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) { showToast(`Error al subir la imagen: ${uploadError.message}`, 'error'); return }

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
  const { error: updateError } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', currentUser.id)
  if (updateError) { showToast(`Error al guardar la foto: ${updateError.message}`, 'error'); return }

  currentUser.avatar_url = publicUrl
  const imgEl = document.getElementById('avatar-img')
  const url   = publicUrl + `?t=${Date.now()}`
  if (imgEl) {
    imgEl.src = url
  } else {
    const ph = document.querySelector('.profile-avatar-placeholder')
    if (ph) ph.outerHTML = `<img src="${url}" alt="avatar" class="profile-avatar" id="avatar-img">`
  }
  showToast('Foto actualizada ✓', 'success')
}

init()
