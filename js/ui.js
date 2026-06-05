// Shared UI utilities — componentes reutilizados en todas las páginas:
//   showToast     → notificaciones flotantes
//   renderNav     → barra superior + tab bar móvil
//   loadNavPoints → actualiza el badge de puntos en el nav
//   openModal     → abre un overlay modal genérico
//   renderSkeleton → placeholders de carga
//   debounce      → util para retrasar llamadas frecuentes

// Deduplication: mismo mensaje no se muestra dos veces simultáneamente
const _activeToastMessages = new Set()

/**
 * Muestra un toast de notificación. Si el mismo mensaje ya está visible, se ignora.
 * @param {string} message
 * @param {'default'|'success'|'error'|'warning'} [type='default']
 * @param {number} [duration=3000]  Duración en ms
 */
export function showToast(message, type = 'default', duration = 3000) {
  if (_activeToastMessages.has(message)) return
  _activeToastMessages.add(message)

  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    document.body.appendChild(container)
  }

  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message
  container.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity 300ms'
    setTimeout(() => {
      toast.remove()
      _activeToastMessages.delete(message)
    }, 300)
  }, duration)
}

/**
 * Renderiza la barra de navegación superior y la tab bar móvil.
 * Los event listeners globales (dropdown, logout) se agregan una sola vez.
 *
 * @param {'predictions'|'ranking'|'matches'|'profile'|'admin'} activePage
 * @param {{ id: string, name?: string, email: string, avatar_url?: string, role?: string }} user
 */
export function renderNav(activePage, user) {
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const avatarHtml = user?.avatar_url
    ? `<img src="${user.avatar_url}" alt="avatar" class="nav-avatar" id="nav-avatar-btn">`
    : `<div class="nav-avatar-placeholder" id="nav-avatar-btn">${initials}</div>`

  const pages = [
    { href: '/predictions', label: 'Predicciones', key: 'predictions' },
    { href: '/ranking', label: 'Ranking', key: 'ranking' },
    { href: '/matches', label: 'Partidos', key: 'matches' },
  ]

  const tabsHtml = pages.map(p =>
    `<a href="${p.href}" class="nav-tab ${activePage === p.key ? 'active' : ''}">${p.label}</a>`
  ).join('')

  const bottomPages = [
    { href: '/predictions', label: 'Predicciones', key: 'predictions', icon: '⚽' },
    { href: '/ranking',     label: 'Ranking',       key: 'ranking',     icon: '🏆' },
    { href: '/matches',     label: 'Partidos',      key: 'matches',     icon: '📅' },
    { href: '/profile',     label: 'Perfil',        key: 'profile',     icon: '👤' },
  ]

  const bottomTabsHtml = bottomPages.map(p =>
    `<a href="${p.href}" class="bottom-tab ${activePage === p.key ? 'active' : ''}">
      <span class="tab-icon">${p.icon}</span>
      <span>${p.label}</span>
    </a>`
  ).join('')

  const navHtml = `
    <nav class="top-nav">
      <div class="top-nav-inner">
        <span class="nav-logo"><span class="word">PRODE</span><span class="word alt">TECA</span></span>
        <div class="nav-tabs">${tabsHtml}</div>
        <div class="nav-user">
          <span class="nav-points num" id="nav-total-pts">— pts</span>
          ${avatarHtml}
          <div class="dropdown-menu" id="user-dropdown">
            <a href="/profile" class="dropdown-item">Mi Perfil</a>
            ${user?.role === 'admin' ? `<a href="/admin" class="dropdown-item">Panel admin</a>` : ''}
            <button class="dropdown-item" id="logout-btn">Cerrar sesión</button>
          </div>
        </div>
      </div>
    </nav>
    <nav class="bottom-tabs">${bottomTabsHtml}</nav>
  `

  const navContainer = document.getElementById('nav-container')
  if (navContainer) navContainer.innerHTML = navHtml

  // Guardar sólo un par de listeners globales por sesión de página.
  // renderNav se llama una vez por página, pero si en el futuro se reutiliza
  // el componente, sin esta guarda los listeners se acumularían.
  if (!renderNav._listenersAttached) {
    renderNav._listenersAttached = true

    // Dropdown toggle
    document.addEventListener('click', (e) => {
      const btn = document.getElementById('nav-avatar-btn')
      const dropdown = document.getElementById('user-dropdown')
      if (!btn || !dropdown) return

      if (btn.contains(e.target)) {
        dropdown.classList.toggle('open')
      } else if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open')
      }
    })

    // Logout
    document.addEventListener('click', async (e) => {
      if (e.target.id === 'logout-btn') {
        const { signOut } = await import('./auth.js')
        await signOut()
      }
    })
  }
}

/**
 * Carga el total de puntos del usuario desde Supabase y actualiza el badge del nav.
 * @param {string} userId
 */
export async function loadNavPoints(userId) {
  const { supabase } = await import('./supabase-client.js')

  const { data } = await supabase
    .from('predictions')
    .select('points_earned')
    .eq('user_id', userId)

  const matchPts = (data || []).reduce((sum, p) => sum + (p.points_earned || 0), 0)

  const { data: champData } = await supabase
    .from('champion_predictions')
    .select('total_points')
    .eq('user_id', userId)
    .single()

  const champPts = champData?.total_points || 0
  const total = matchPts + champPts

  const el = document.getElementById('nav-total-pts')
  if (el) el.textContent = `${total} pts`
}

export function renderSkeleton(count = 3) {
  return Array.from({ length: count }, () => `
    <div class="match-card">
      <div class="skeleton" style="height:14px;width:40%;margin-bottom:12px"></div>
      <div style="display:flex;align-items:center;gap:12px;justify-content:center">
        <div class="skeleton" style="height:56px;width:80px;border-radius:8px"></div>
        <div class="skeleton" style="height:40px;width:80px;border-radius:8px"></div>
        <div class="skeleton" style="height:56px;width:80px;border-radius:8px"></div>
      </div>
    </div>
  `).join('')
}

/**
 * Abre un modal genérico con el HTML proporcionado.
 * Cierra al hacer clic fuera del modal o en cualquier elemento con clase `.modal-close`.
 *
 * @param {string} html  HTML interno del modal (sin el wrapper `.modal`)
 * @returns {HTMLElement} El overlay creado — útil para reemplazar el contenido después
 */
export function openModal(html) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `<div class="modal">${html}</div>`
  document.body.appendChild(overlay)

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })

  const closeBtn = overlay.querySelector('.modal-close')
  if (closeBtn) closeBtn.addEventListener('click', () => overlay.remove())

  return overlay
}

export function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
