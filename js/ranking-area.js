import { supabase } from './supabase-client.js'
import { requireAuth } from './auth.js'
import { renderNav, loadNavPoints, showToast } from './ui.js'

const AREAS = [
  'Implementacion', 'Administracion/Comercial', 'Desarrollo',
  'Producto', 'Soporte', 'Customer Success',
]

const STREAK_MATCHES = 3

let currentUser = null

async function init() {
  const session = await requireAuth()
  if (!session) return

  const { data: profile } = await supabase
    .from('users').select('*').eq('id', session.user.id).single()

  currentUser = profile || { id: session.user.id, email: session.user.email }

  renderNav('ranking-area', currentUser)
  loadNavPoints(currentUser.id)

  renderSkeleton()
  await loadAndRender()
}

function renderSkeleton() {
  const root = document.getElementById('area-ranking-root')
  if (!root) return
  root.innerHTML = `
    <div class="area-ranking-grid">
      ${Array.from({ length: 6 }, () => `
        <div class="area-card">
          <div class="area-card-header">
            <div style="display:flex;flex-direction:column;gap:6px">
              <div class="skeleton" style="height:16px;width:55%;border-radius:6px"></div>
              <div class="skeleton" style="height:11px;width:35%;border-radius:6px"></div>
            </div>
            <div class="skeleton" style="height:38px;width:60px;border-radius:8px"></div>
          </div>
          <div style="padding:12px 14px">
            <div class="skeleton" style="height:32px;border-radius:8px"></div>
          </div>
        </div>
      `).join('')}
    </div>`
}

async function loadAndRender() {
  // Últimos N partidos terminados (para filtrar activos)
  const { data: lastMatches } = await supabase
    .from('matches')
    .select('id')
    .eq('status', 'finished')
    .order('match_datetime_utc', { ascending: false })
    .limit(STREAK_MATCHES)

  const lastMatchIds = (lastMatches || []).map(m => m.id)

  const baseQueries = [
    supabase.from('users').select('id, name, avatar_url, email, area'),
    supabase.from('predictions').select('user_id, points_earned').limit(100000),
    supabase.from('champion_predictions').select('user_id, total_points'),
  ]

  const [usersRes, predsRes, champsRes, recentPredsRes] = await Promise.all([
    ...baseQueries,
    lastMatchIds.length > 0
      ? supabase.from('predictions').select('user_id').in('match_id', lastMatchIds)
      : Promise.resolve({ data: [] }),
  ])

  if (usersRes.error) { showToast('Error cargando datos', 'error'); return }

  // Activos = hicieron al menos una predicción en los últimos 3 partidos
  const activeSet = new Set((recentPredsRes?.data || []).map(p => p.user_id))

  const predMap = {}
  for (const p of predsRes.data || []) {
    if (p.points_earned == null) continue
    predMap[p.user_id] = (predMap[p.user_id] || 0) + p.points_earned
  }
  const champMap = {}
  for (const c of champsRes.data || []) champMap[c.user_id] = c.total_points || 0

  const usersWithPts = (usersRes.data || []).map(u => ({
    ...u,
    total: (predMap[u.id] || 0) + (champMap[u.id] || 0),
    active: activeSet.has(u.id),
  }))

  // Agrupar por área y ordenar por total desc
  const areaMap = Object.fromEntries(AREAS.map(a => [a, []]))
  for (const u of usersWithPts) {
    if (u.area && areaMap[u.area] !== undefined) areaMap[u.area].push(u)
  }
  for (const area of AREAS) areaMap[area].sort((a, b) => b.total - a.total)

  // Calcular promedio solo con activos; ordenar áreas por promedio desc
  const areas = AREAS.map(name => {
    const users = areaMap[name]
    const activeUsers = users.filter(u => u.active)
    const avg = activeUsers.length > 0
      ? activeUsers.reduce((sum, u) => sum + u.total, 0) / activeUsers.length
      : null
    return { name, users, activeCount: activeUsers.length, avg }
  }).sort((a, b) => {
    if (a.avg === null && b.avg === null) return 0
    if (a.avg === null) return 1
    if (b.avg === null) return -1
    return b.avg - a.avg
  })

  render(areas)
}

function render(areas) {
  const root = document.getElementById('area-ranking-root')
  if (!root) return
  root.innerHTML = `<div class="area-ranking-grid">${areas.map(renderAreaCard).join('')}</div>`
}

function renderAreaCard({ name, users, activeCount, avg }) {
  const avgDisplay = avg !== null ? avg.toFixed(1) : '—'
  const membersLabel = users.length === 1 ? '1 jugador' : `${users.length} jugadores`
  const activeLabel = users.length > 0 ? ` · ${activeCount} activos` : ''

  const memberRows = users.map(u => {
    const initials = (u.name || u.email || '')
      .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
    const avatarHtml = u.avatar_url
      ? `<img src="${u.avatar_url}" alt="" class="area-avatar">`
      : `<div class="area-avatar area-avatar-placeholder">${initials}</div>`
    const displayName = u.name || (u.email || '').split('@')[0]
    const isMe = u.id === currentUser?.id

    return `
      <div class="area-member-row">
        ${avatarHtml}
        <span class="area-member-name${isMe ? ' me' : ''}">${displayName}${isMe ? ' (vos)' : ''}</span>
        <span class="area-member-pts">${u.total} pts</span>
        <span class="area-status-dot ${u.active ? 'active' : 'inactive'}"
          title="${u.active ? 'Jugó en los últimos 3 partidos' : 'Sin actividad reciente'}"></span>
      </div>`
  }).join('')

  return `
    <div class="area-card">
      <div class="area-card-header">
        <div>
          <span class="area-name">${name}</span>
          <span class="area-member-count">${membersLabel}${activeLabel}</span>
        </div>
        <div class="area-total-block">
          <span class="area-total-pts">${avgDisplay}</span>
          <span class="area-total-label">pts promedio</span>
        </div>
      </div>
      ${users.length > 0 ? `
        <details class="area-details">
          <summary class="area-details-summary">
            <span>Ver jugadores</span>
            <svg class="area-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </summary>
          <div class="area-members">${memberRows}</div>
        </details>
      ` : `<div class="area-empty">Sin integrantes asignados</div>`}
    </div>`
}

init()
