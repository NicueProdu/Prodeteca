/**
 * Prodeteca · custom date picker
 * ---------------------------------------------------------------
 * Lightweight, vanilla JS picker that replaces a native
 * <input type="date">. Same value contract — the input still holds
 * the ISO date and fires a 'change' event when the user picks.
 *
 *   import { createDatePicker } from './date-picker.js'
 *   createDatePicker(document.getElementById('filter-date-picker'))
 *
 * Options:
 *   placeholder  — what the trigger shows when no date is selected
 *                  (default: "Elegir fecha")
 *   weekStart    — 0 (sun) or 1 (mon). Default 1.
 *   highlight    — Set<string> of ISO dates ("2026-06-12") to draw
 *                  a small dot under (e.g. days with matches).
 */

const ES = {
  weekdays: { 1: ['Lu','Ma','Mi','Ju','Vi','Sá','Do'], 0: ['Do','Lu','Ma','Mi','Ju','Vi','Sá'] },
  months: ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
           'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthsShort: ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'],
}

function toIso(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromIso(s) {
  return s ? new Date(s + 'T00:00:00') : null
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function createDatePicker(input, opts = {}) {
  if (!input || input.dataset.dpEnhanced) return
  input.dataset.dpEnhanced = '1'

  const placeholder = opts.placeholder || 'Elegir fecha'
  const weekStart   = opts.weekStart ?? 1
  const highlight   = opts.highlight || null     // Set<string>

  // Hide native input but keep it in the form
  input.type = 'hidden'

  // Wrapper
  const wrap = document.createElement('span')
  wrap.className = 'date-picker'

  // Trigger
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = 'date-picker-trigger filter-btn'
  trigger.setAttribute('aria-haspopup', 'dialog')

  // Popover
  const pop = document.createElement('div')
  pop.className = 'date-picker-popover'
  pop.setAttribute('role', 'dialog')

  input.parentNode.insertBefore(wrap, input)
  wrap.append(input, trigger, pop)

  // State
  let selected = fromIso(input.value)
  let view     = selected ? new Date(selected) : new Date()
  view.setDate(1)
  let isOpen = false

  function fmtTrigger(d) {
    if (!d) return placeholder
    return `${d.getDate()} ${ES.monthsShort[d.getMonth()]}. ${d.getFullYear()}`
  }

  function renderTrigger() {
    trigger.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
        <rect x="3" y="4.5" width="18" height="17" rx="2"/>
        <path d="M16 2.5v4M8 2.5v4M3 10h18"/>
      </svg>
      <span>${fmtTrigger(selected)}</span>
    `
    trigger.classList.toggle('has-value', !!selected)
    trigger.setAttribute('aria-expanded', String(isOpen))
  }

  function renderPopover() {
    const year  = view.getFullYear()
    const month = view.getMonth()
    const today = new Date()

    const firstDow = new Date(year, month, 1).getDay()
    const offset   = (firstDow - weekStart + 7) % 7
    const daysIn   = new Date(year, month + 1, 0).getDate()
    const daysInPrev = new Date(year, month, 0).getDate()

    const cells = []
    for (let i = offset - 1; i >= 0; i--) {
      cells.push({ d: daysInPrev - i, m: month - 1, y: year, other: true })
    }
    for (let d = 1; d <= daysIn; d++) {
      cells.push({ d, m: month, y: year, other: false })
    }
    while (cells.length < 42) {
      const next = cells.length - offset - daysIn + 1
      cells.push({ d: next, m: month + 1, y: year, other: true })
    }

    const weekdayHtml = ES.weekdays[weekStart]
      .map(w => `<span class="dp-weekday">${w}</span>`).join('')

    const dayHtml = cells.map(c => {
      const date = new Date(c.y, c.m, c.d)
      const iso = toIso(date)
      const cls = ['dp-day']
      if (c.other) cls.push('other')
      if (sameDay(date, today)) cls.push('today')
      if (sameDay(date, selected)) cls.push('selected')
      if (highlight && highlight.has(iso)) cls.push('marked')
      return `<button type="button" class="${cls.join(' ')}" data-iso="${iso}">${c.d}</button>`
    }).join('')

    pop.innerHTML = `
      <div class="dp-header">
        <button type="button" class="dp-nav-btn" data-nav="-1" aria-label="Mes anterior">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button type="button" class="dp-month-label" data-nav="0">${ES.months[month]} ${year}</button>
        <button type="button" class="dp-nav-btn" data-nav="1" aria-label="Mes siguiente">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div class="dp-grid">
        ${weekdayHtml}
        ${dayHtml}
      </div>
      <div class="dp-footer">
        <button type="button" class="dp-action" data-action="clear">Limpiar</button>
        <button type="button" class="dp-action primary" data-action="today">Hoy</button>
      </div>
    `
  }

  function render() {
    renderTrigger()
    if (isOpen) renderPopover()
  }

  function select(date) {
    selected = date
    input.value = date ? toIso(date) : ''
    input.dispatchEvent(new Event('change', { bubbles: true }))
    close()
  }

  function open() {
    if (isOpen) return
    isOpen = true
    if (selected) {
      view = new Date(selected)
      view.setDate(1)
    }
    wrap.classList.add('open')
    render()
  }

  function close() {
    if (!isOpen) return
    isOpen = false
    wrap.classList.remove('open')
    renderTrigger()
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation()
    isOpen ? close() : open()
  })

  pop.addEventListener('click', (e) => {
    e.stopPropagation()
    const nav = e.target.closest('[data-nav]')
    if (nav) {
      const dir = parseInt(nav.dataset.nav, 10)
      if (dir === 0) {
        // Click on month label → jump to today's month
        const t = new Date()
        view = new Date(t.getFullYear(), t.getMonth(), 1)
      } else {
        view = new Date(view.getFullYear(), view.getMonth() + dir, 1)
      }
      renderPopover()
      return
    }
    const day = e.target.closest('.dp-day')
    if (day) {
      select(fromIso(day.dataset.iso))
      return
    }
    const action = e.target.closest('[data-action]')
    if (action) {
      if (action.dataset.action === 'today') {
        const t = new Date()
        t.setHours(0,0,0,0)
        select(t)
      } else if (action.dataset.action === 'clear') {
        select(null)
      }
    }
  })

  // Outside click closes
  document.addEventListener('click', (e) => {
    if (isOpen && !wrap.contains(e.target)) close()
  })

  // Esc closes
  document.addEventListener('keydown', (e) => {
    if (isOpen && e.key === 'Escape') close()
  })

  // Sync if the underlying input value is changed programmatically
  const observer = new MutationObserver(() => {
    const newVal = input.value
    const newDate = fromIso(newVal)
    if (!sameDay(newDate, selected)) {
      selected = newDate
      render()
    }
  })
  observer.observe(input, { attributes: true, attributeFilter: ['value'] })

  render()

  return {
    open, close, render,
    getValue: () => input.value,
    setValue: (v) => { selected = fromIso(v); input.value = v || ''; render() },
    setHighlight: (set) => { Object.defineProperty(this, '_h', { value: set }); if (isOpen) renderPopover() },
  }
}
