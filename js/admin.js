import { supabase } from './supabase-client.js'
import { requireAuth } from './auth.js'
import { renderNav, showToast } from './ui.js'
import { formatMatchTime } from './timezone.js'
import { getFlagHtml, localizeTeamName } from './flags.js'

let currentUser = null

async function init() {
  const session = await requireAuth()
  if (!session) return

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    window.location.href = '/predictions'
    return
  }

  currentUser = profile
  renderNav('admin', currentUser)

  await Promise.all([renderResultsSection(), renderUsersSection(), renderRecalculateSection()])
  renderFixtureSection()
}

async function renderResultsSection() {
  const container = document.getElementById('results-section')
  if (!container) return

  const now = new Date().toISOString()
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .lt('match_datetime_utc', now)
    .is('home_score', null)
    .order('match_datetime_utc', { ascending: true })

  if (error) { showToast('Error cargando partidos', 'error'); return }

  if (!matches || matches.length === 0) {
    container.innerHTML = `<p style="color:var(--color-text-muted)">No hay partidos sin resultado pendiente.</p>`
    return
  }

  const rows = matches.map(m => {
    const { dateShort, time } = formatMatchTime(m.match_datetime_utc)
    return `
      <div class="card" style="margin-bottom:12px" id="match-result-${m.id}">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <span style="font-size:0.8rem;color:var(--color-text-muted)">${dateShort} · ${time} hs</span>
            <div style="display:flex;align-items:center;gap:8px;font-weight:600;margin-top:4px">
              <span class="team-flag">${getFlagHtml(m.home_team)}</span>
              ${localizeTeamName(m.home_team)}
              <span style="color:var(--color-text-muted);font-weight:400">vs</span>
              ${localizeTeamName(m.away_team)}
              <span class="team-flag">${getFlagHtml(m.away_team)}</span>
            </div>
          </div>
          <button class="btn btn-sm btn-ghost" data-load-result="${m.id}"
            data-home="${m.home_team}" data-away="${m.away_team}">
            Cargar resultado
          </button>
        </div>
        <div id="result-form-${m.id}" style="display:none;margin-top:12px">
          <div class="result-form">
            <span style="font-size:0.875rem">${localizeTeamName(m.home_team)}</span>
            <input type="number" class="result-score-input" min="0" max="30"
              id="home-score-${m.id}" placeholder="0" aria-label="Goles local">
            <span style="color:var(--color-text-muted)">—</span>
            <input type="number" class="result-score-input" min="0" max="30"
              id="away-score-${m.id}" placeholder="0" aria-label="Goles visitante">
            <span style="font-size:0.875rem">${localizeTeamName(m.away_team)}</span>
            <button class="btn btn-sm btn-primary" data-confirm-result="${m.id}">Confirmar</button>
            <button class="btn btn-sm btn-ghost" data-cancel-result="${m.id}">Cancelar</button>
          </div>
          <div id="result-feedback-${m.id}" style="font-size:0.8rem;margin-top:8px;color:var(--color-text-muted)"></div>
        </div>
      </div>`
  }).join('')

  container.innerHTML = rows

  container.querySelectorAll('[data-load-result]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(`result-form-${btn.dataset.loadResult}`).style.display = 'block'
      btn.style.display = 'none'
    })
  })

  container.querySelectorAll('[data-cancel-result]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cancelResult
      document.getElementById(`result-form-${id}`).style.display = 'none'
      document.querySelector(`[data-load-result="${id}"]`).style.display = 'inline-flex'
    })
  })

  container.querySelectorAll('[data-confirm-result]').forEach(btn => {
    btn.addEventListener('click', () => loadResult(parseInt(btn.dataset.confirmResult)))
  })
}

// Carga el resultado del partido llamando al endpoint serverless /api/load-result,
// que verifica el rol admin server-side y usa la service role key.
// (Antes esta función operaba directo contra Supabase desde el browser con la anon key.)
async function loadResult(matchId) {
  const homeScore = parseInt(document.getElementById(`home-score-${matchId}`).value)
  const awayScore = parseInt(document.getElementById(`away-score-${matchId}`).value)
  const feedback  = document.getElementById(`result-feedback-${matchId}`)
  const confirmBtn = document.querySelector(`[data-confirm-result="${matchId}"]`)

  if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
    feedback.textContent = '⚠️ Ingresá ambos marcadores.'
    return
  }

  // Deshabilitar el botón para evitar doble envío
  if (confirmBtn) confirmBtn.disabled = true
  feedback.textContent = 'Guardando resultado...'

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    feedback.textContent = '❌ Sesión expirada. Recargá la página.'
    if (confirmBtn) confirmBtn.disabled = false
    return
  }

  const res = await fetch('/api/load-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ matchId, homeScore, awayScore }),
  })

  const result = await res.json()
  if (!res.ok) {
    feedback.textContent = `❌ Error: ${result.error}`
    if (confirmBtn) confirmBtn.disabled = false
    return
  }

  feedback.textContent = `✅ Listo. ${result.exact} exactos · ${result.partial} parciales · ${result.zero} sin puntos.`
  showToast('Resultado cargado correctamente', 'success')
  setTimeout(() => document.getElementById(`match-result-${matchId}`)?.remove(), 3000)
}

async function renderRecalculateSection() {
  const container = document.getElementById('recalculate-section')
  if (!container) return

  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'finished')
    .gte('match_datetime_utc', cutoff)
    .order('match_datetime_utc', { ascending: false })

  if (error) { container.innerHTML = `<p>Error: ${error.message}</p>`; return }

  if (!matches || matches.length === 0) {
    container.innerHTML = `<p style="color:var(--color-text-muted)">No hay partidos terminados en las últimas 24 hs.</p>`
    return
  }

  const rows = matches.map(m => {
    const { dateShort, time } = formatMatchTime(m.match_datetime_utc)
    return `
      <div class="card" style="margin-bottom:12px" id="recap-${m.id}">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div>
            <span style="font-size:0.8rem;color:var(--color-text-muted)">${dateShort} · ${time} hs</span>
            <div style="display:flex;align-items:center;gap:8px;font-weight:600;margin-top:4px">
              <span class="team-flag">${getFlagHtml(m.home_team)}</span>
              ${localizeTeamName(m.home_team)}
              <span style="color:var(--color-text-muted);font-weight:400">vs</span>
              ${localizeTeamName(m.away_team)}
              <span class="team-flag">${getFlagHtml(m.away_team)}</span>
            </div>
            <div style="font-size:0.8rem;color:var(--color-text-muted);margin-top:2px">
              Resultado actual: ${m.home_score} — ${m.away_score}
            </div>
          </div>
          <button class="btn btn-sm btn-ghost" data-open-recap="${m.id}">Recalcular</button>
        </div>
        <div id="recap-form-${m.id}" style="display:none;margin-top:12px">
          <div class="result-form">
            <span style="font-size:0.875rem">${localizeTeamName(m.home_team)}</span>
            <input type="number" class="result-score-input" min="0" max="30"
              id="recap-home-${m.id}" value="${m.home_score ?? ''}" aria-label="Goles local">
            <span style="color:var(--color-text-muted)">—</span>
            <input type="number" class="result-score-input" min="0" max="30"
              id="recap-away-${m.id}" value="${m.away_score ?? ''}" aria-label="Goles visitante">
            <span style="font-size:0.875rem">${localizeTeamName(m.away_team)}</span>
            <button class="btn btn-sm btn-primary" data-confirm-recap="${m.id}">Confirmar</button>
            <button class="btn btn-sm btn-ghost" data-cancel-recap="${m.id}">Cancelar</button>
          </div>
          <div id="recap-feedback-${m.id}" style="font-size:0.8rem;margin-top:8px;color:var(--color-text-muted)"></div>
        </div>
      </div>`
  }).join('')

  container.innerHTML = rows

  container.querySelectorAll('[data-open-recap]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(`recap-form-${btn.dataset.openRecap}`).style.display = 'block'
      btn.style.display = 'none'
    })
  })

  container.querySelectorAll('[data-cancel-recap]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.cancelRecap
      document.getElementById(`recap-form-${id}`).style.display = 'none'
      document.querySelector(`[data-open-recap="${id}"]`).style.display = 'inline-flex'
    })
  })

  container.querySelectorAll('[data-confirm-recap]').forEach(btn => {
    btn.addEventListener('click', () => recalculateResult(parseInt(btn.dataset.confirmRecap)))
  })
}

// Reutiliza el mismo endpoint /api/load-result para recalcular.
// El endpoint actualiza el score y recalcula puntos — idempotente sobre partidos ya finished.
async function recalculateResult(matchId) {
  const homeScore = parseInt(document.getElementById(`recap-home-${matchId}`).value)
  const awayScore = parseInt(document.getElementById(`recap-away-${matchId}`).value)
  const feedback   = document.getElementById(`recap-feedback-${matchId}`)
  const confirmBtn = document.querySelector(`[data-confirm-recap="${matchId}"]`)

  if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
    feedback.textContent = '⚠️ Ingresá ambos marcadores.'
    return
  }

  // Deshabilitar el botón para evitar doble envío
  if (confirmBtn) confirmBtn.disabled = true
  feedback.textContent = 'Actualizando resultado...'

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    feedback.textContent = '❌ Sesión expirada. Recargá la página.'
    if (confirmBtn) confirmBtn.disabled = false
    return
  }

  const res = await fetch('/api/load-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ matchId, homeScore, awayScore }),
  })

  const result = await res.json()
  if (!res.ok) {
    feedback.textContent = `❌ Error: ${result.error}`
    if (confirmBtn) confirmBtn.disabled = false
    return
  }

  feedback.textContent = `✅ Recalculado. ${result.exact} exactos · ${result.partial} parciales · ${result.zero} sin puntos.`
  showToast('Puntos recalculados', 'success')

  const card = document.getElementById(`recap-${matchId}`)
  const currentLabel = card?.querySelector('[style*="Resultado actual"]')
  if (currentLabel) currentLabel.textContent = `Resultado actual: ${homeScore} — ${awayScore}`
  document.getElementById(`recap-form-${matchId}`).style.display = 'none'
  card?.querySelector(`[data-open-recap="${matchId}"]`)?.style.setProperty('display', 'inline-flex')
}

async function renderUsersSection() {
  const container = document.getElementById('users-section')
  if (!container) return

  container.innerHTML = `<p style="color:var(--color-text-muted);font-size:0.9rem">Cargando usuarios...</p>`

  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('name', { ascending: true })

  if (error) { container.innerHTML = `<p>Error: ${error.message}</p>`; return }

  const ROW_HEIGHT = 44
  const INITIAL_VISIBLE = 5

  const rows = users.map(u => `
    <tr class="user-row">
      <td style="padding:10px">${u.name || '—'}</td>
      <td style="padding:10px;font-size:0.85rem">${u.email}</td>
      <td style="padding:10px">
        <span class="badge ${u.role === 'admin' ? 'badge-success' : 'badge-muted'}">${u.role}</span>
      </td>
      <td style="padding:10px">
        ${u.id !== currentUser.id
          ? `<button class="btn btn-sm btn-ghost" data-toggle-admin="${u.id}"
              data-current-role="${u.role}">
              ${u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
            </button>`
          : '<span style="color:var(--color-text-muted);font-size:0.8rem">Tú</span>'}
      </td>
    </tr>`).join('')

  // Una sola tabla con thead sticky — evita la desalineación de columnas entre dos tablas separadas.
  container.innerHTML = `
    <div style="margin-bottom:12px">
      <input type="text" id="user-search" placeholder="Buscar por nombre o email..."
        style="padding:8px 12px;border:1px solid var(--color-border);border-radius:8px;
               background:var(--color-bg);color:var(--color-text);font-size:0.9rem;width:100%;max-width:300px">
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <div id="users-scroll"
        style="max-height:${INITIAL_VISIBLE * ROW_HEIGHT}px;overflow-y:auto;overflow-x:auto;transition:max-height 0.3s ease">
        <table id="users-table"
          style="width:100%;border-collapse:collapse;font-size:0.9rem;min-width:480px">
          <thead style="position:sticky;top:0;z-index:1;background:var(--color-card)">
            <tr style="font-size:0.75rem;color:var(--color-text-muted);border-bottom:2px solid var(--color-border)">
              <th style="padding:10px;text-align:left">Nombre</th>
              <th style="padding:10px;text-align:left">Email</th>
              <th style="padding:10px;text-align:left">Rol</th>
              <th style="padding:10px"></th>
            </tr>
          </thead>
          <tbody id="users-tbody">${rows}</tbody>
        </table>
      </div>
    </div>`

  document.getElementById('user-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim()
    const scroll = document.getElementById('users-scroll')
    document.querySelectorAll('#users-tbody .user-row').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'
    })
    // Remover la cota de altura mientras se busca para mostrar todos los resultados
    scroll.style.maxHeight = q ? 'none' : `${INITIAL_VISIBLE * ROW_HEIGHT}px`
  })

  container.querySelectorAll('[data-toggle-admin]').forEach(btn => {
    btn.addEventListener('click', () => toggleAdmin(btn.dataset.toggleAdmin, btn.dataset.currentRole, btn))
  })
}

async function toggleAdmin(userId, currentRole, btn) {
  const newRole = currentRole === 'admin' ? 'user' : 'admin'
  btn.disabled = true

  const { error, count } = await supabase
    .from('users')
    .update({ role: newRole }, { count: 'exact' })
    .eq('id', userId)

  if (error) { showToast('Error actualizando rol', 'error'); btn.disabled = false; return }
  if (count === 0) { showToast('Sin permisos para cambiar este rol. Ejecutá el SQL en Supabase.', 'error'); btn.disabled = false; return }

  btn.textContent = newRole === 'admin' ? 'Quitar admin' : 'Hacer admin'
  btn.dataset.currentRole = newRole
  btn.disabled = false

  const badge = btn.closest('tr').querySelector('.badge')
  if (badge) {
    badge.textContent = newRole
    badge.className = `badge ${newRole === 'admin' ? 'badge-success' : 'badge-muted'}`
  }

  showToast(`Rol actualizado a ${newRole}`, 'success')
}

function renderFixtureSection() {
  const container = document.getElementById('fixture-section')
  if (!container) return

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <input type="file" id="ics-input" accept=".ics" style="display:none">
      <button class="btn btn-ghost" id="select-ics-btn">📁 Seleccionar archivo .ics</button>
      <span id="ics-filename" style="color:var(--color-text-muted);font-size:0.875rem"></span>
    </div>
    <div id="ics-preview" style="margin-top:12px"></div>
    <div id="ics-log" style="margin-top:12px;font-size:0.85rem;color:var(--color-text-muted)"></div>`

  let selectedFile = null

  document.getElementById('select-ics-btn').addEventListener('click', () => {
    document.getElementById('ics-input').click()
  })

  document.getElementById('ics-input').addEventListener('change', async (e) => {
    selectedFile = e.target.files[0]
    if (!selectedFile) return

    document.getElementById('ics-filename').textContent = selectedFile.name
    document.getElementById('ics-preview').innerHTML =
      `<p style="color:var(--color-text-muted);font-size:0.875rem">
        Archivo seleccionado: <strong>${selectedFile.name}</strong>
        (${Math.round(selectedFile.size / 1024)} KB)
       </p>
       <button class="btn btn-primary" id="import-ics-btn" style="margin-top:8px">
         Importar partidos
       </button>`

    document.getElementById('import-ics-btn').addEventListener('click', () => importIcs(selectedFile))
  })
}

async function importIcs(file) {
  const log = document.getElementById('ics-log')
  log.textContent = 'Importando...'

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/import-fixture', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  })

  const result = await res.json()
  if (!res.ok) {
    log.innerHTML = `<span style="color:var(--color-error)">❌ Error: ${result.error}</span>`
    return
  }

  log.innerHTML = `<span style="color:var(--color-success)">
    ✅ Importación completada: ${result.inserted} insertados, ${result.updated} actualizados.
    ${result.errors?.length ? `<br>⚠️ ${result.errors.length} errores.` : ''}
  </span>`
  showToast('Fixture importado', 'success')
}

init()
