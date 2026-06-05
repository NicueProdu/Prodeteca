export const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

export function formatMatchTime(utcDateString) {
  const date = new Date(utcDateString)
  const now = new Date()

  const toLocalDay = (d) =>
    new Date(d.toLocaleString('en-US', { timeZone: userTimezone }))

  const localNow = toLocalDay(now)
  const localMatch = toLocalDay(date)

  const isToday =
    localNow.getFullYear() === localMatch.getFullYear() &&
    localNow.getMonth() === localMatch.getMonth() &&
    localNow.getDate() === localMatch.getDate()

  const tomorrow = new Date(localNow)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow =
    tomorrow.getFullYear() === localMatch.getFullYear() &&
    tomorrow.getMonth() === localMatch.getMonth() &&
    tomorrow.getDate() === localMatch.getDate()

  const time = date.toLocaleTimeString('es', {
    timeZone: userTimezone,
    hour: '2-digit',
    minute: '2-digit',
  })

  const dateLong = date.toLocaleDateString('es', {
    timeZone: userTimezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const dateShort = date.toLocaleDateString('es', {
    timeZone: userTimezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return { time, dateLong, dateShort, isToday, isTomorrow }
}

// Returns the UTC range that corresponds to "today" in the user's timezone
export function getTodayUtcRange() {
  const now = new Date()
  const localDateStr = now.toLocaleDateString('en-CA', { timeZone: userTimezone }) // YYYY-MM-DD
  const startLocal = new Date(`${localDateStr}T00:00:00`)
  const endLocal = new Date(`${localDateStr}T23:59:59`)
  // Approximate: adjust by timezone offset
  const offset = now.getTimezoneOffset() * 60 * 1000
  return {
    start: new Date(startLocal.getTime() + offset),
    end: new Date(endLocal.getTime() + offset),
  }
}

export function getTomorrowUtcRange() {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: userTimezone })
  const startLocal = new Date(`${tomorrowStr}T00:00:00`)
  const endLocal = new Date(`${tomorrowStr}T23:59:59`)
  const offset = now.getTimezoneOffset() * 60 * 1000
  return {
    start: new Date(startLocal.getTime() + offset),
    end: new Date(endLocal.getTime() + offset),
  }
}

export function formatRelativeDay(utcDateString) {
  const { isToday, isTomorrow, dateLong } = formatMatchTime(utcDateString)
  if (isToday) return 'Hoy'
  if (isTomorrow) return 'Mañana'
  return dateLong
}
