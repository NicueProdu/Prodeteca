import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  // Verify this is called by Vercel Cron
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Get today's matches in Argentina timezone (UTC-3)
  const now = new Date()
  const argOffset = -3 * 60 * 60 * 1000
  const argNow = new Date(now.getTime() + argOffset)
  const dayStart = new Date(argNow)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(argNow)
  dayEnd.setHours(23, 59, 59, 999)

  // Convert back to UTC for DB query
  const utcStart = new Date(dayStart.getTime() - argOffset).toISOString()
  const utcEnd = new Date(dayEnd.getTime() - argOffset).toISOString()

  const { data: todayMatches } = await supabase
    .from('matches')
    .select('*')
    .gte('match_datetime_utc', utcStart)
    .lte('match_datetime_utc', utcEnd)
    .order('match_datetime_utc', { ascending: true })

  if (!todayMatches || todayMatches.length === 0) {
    return res.status(200).json({ sent: 0, reason: 'No matches today' })
  }

  // Get all users
  const { data: users } = await supabase.from('users').select('id, email, name')
  if (!users || users.length === 0) return res.status(200).json({ sent: 0 })

  // Get predictions for today's matches
  const matchIds = todayMatches.map(m => m.id)
  const { data: predictions } = await supabase
    .from('predictions')
    .select('user_id, match_id, home_score_pred, away_score_pred')
    .in('match_id', matchIds)

  const predMap = {}
  for (const p of (predictions || [])) {
    if (!predMap[p.user_id]) predMap[p.user_id] = {}
    predMap[p.user_id][p.match_id] = p
  }

  const appUrl = process.env.VITE_APP_URL || 'https://prodeteca.vercel.app'
  let sent = 0, failed = 0

  for (const user of users) {
    const userPreds = predMap[user.id] || {}
    const missing = todayMatches.filter(m => !userPreds[m.id])
    const hasAll = missing.length === 0
    const displayName = user.name || user.email.split('@')[0]

    const subject = hasAll
      ? `🎉 ¡Ya estás listo/a para hoy! — ${todayMatches.length} partido${todayMatches.length !== 1 ? 's' : ''}`
      : `⚽ ¡Acordate del prode de hoy! — ${missing.length} predicción${missing.length !== 1 ? 'es' : ''} pendiente${missing.length !== 1 ? 's' : ''}`

    const matchRows = todayMatches.map(m => {
      const pred = userPreds[m.id]
      const matchDate = new Date(m.match_datetime_utc)
      const argTime = matchDate.toLocaleTimeString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
      })

      const phaseLabel = m.group_name ? `Grupo ${m.group_name}` : m.phase

      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #E9ECEF">
            <strong>${m.home_flag || '🏳️'} ${m.home_team} vs ${m.away_team} ${m.away_flag || '🏳️'}</strong><br>
            <span style="color:#6C757D;font-size:0.85rem">${phaseLabel} · ${argTime} hs (ARG)</span>
          </td>
          <td style="padding:12px;border-bottom:1px solid #E9ECEF;text-align:center">
            ${pred
              ? `<span style="color:#27AE60;font-weight:600">✅ ${pred.home_score_pred}—${pred.away_score_pred}</span>`
              : `<span style="color:#E74C3C;font-weight:600">⚠️ Sin pred.</span>`}
          </td>
        </tr>`
    }).join('')

    const html = `
<!DOCTYPE html>
<html lang="es">
<body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1A1A2E">
  <div style="background:linear-gradient(135deg,#003DA5,#C8102E);padding:24px;border-radius:12px;text-align:center;color:#fff;margin-bottom:20px">
    <div style="font-size:36px">⚽</div>
    <h2 style="margin:8px 0 0;font-size:1.2rem">Prodeteca — Hoy se juegan ${todayMatches.length} partido${todayMatches.length !== 1 ? 's' : ''}!</h2>
  </div>

  <p>Hola <strong>${displayName}</strong>,</p>
  ${hasAll
    ? `<p style="color:#27AE60;font-weight:600">🎉 ¡Ya completaste todas tus predicciones de hoy!</p>`
    : `<p style="color:#E74C3C;font-weight:600">⚠️ Te faltan ${missing.length} predicción${missing.length !== 1 ? 'es' : ''} para completar.</p>`}

  <table style="width:100%;border-collapse:collapse;margin:16px 0">
    <thead>
      <tr style="background:#F8F9FA">
        <th style="padding:10px;text-align:left;font-size:0.8rem;color:#6C757D">Partido</th>
        <th style="padding:10px;text-align:center;font-size:0.8rem;color:#6C757D">Tu predicción</th>
      </tr>
    </thead>
    <tbody>${matchRows}</tbody>
  </table>

  <div style="text-align:center;margin:24px 0">
    <a href="${appUrl}/predictions.html"
       style="background:#C8102E;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700">
      ${hasAll ? 'Ver el prode →' : 'Completar predicciones →'}
    </a>
  </div>

  <p style="color:#6C757D;font-size:0.75rem;text-align:center">
    Prodeteca · Parsimotion · Mundial 2026
  </p>
</body>
</html>`

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'prode@parsimotion.com',
        to: user.email,
        subject,
        html,
      })
      sent++
    } catch (err) {
      console.error(`Failed to send to ${user.email}:`, err.message)
      failed++
    }
  }

  return res.status(200).json({ sent, failed, matches: todayMatches.length })
}
