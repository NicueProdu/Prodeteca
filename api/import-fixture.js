import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import fs from 'fs'
import ICAL from 'ical.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export const config = { api: { bodyParser: false } }

const TEAM_FLAGS = {
  'México': '🇲🇽', 'Mexico': '🇲🇽',
  'Sudáfrica': '🇿🇦', 'South Africa': '🇿🇦',
  'Corea del Sur': '🇰🇷', 'South Korea': '🇰🇷',
  'Canadá': '🇨🇦', 'Canada': '🇨🇦',
  'Qatar': '🇶🇦',
  'Suiza': '🇨🇭', 'Switzerland': '🇨🇭',
  'Brasil': '🇧🇷', 'Brazil': '🇧🇷',
  'Marruecos': '🇲🇦', 'Morocco': '🇲🇦',
  'Haití': '🇭🇹', 'Haiti': '🇭🇹',
  'Escocia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Estados Unidos': '🇺🇸', 'USA': '🇺🇸', 'United States': '🇺🇸',
  'Paraguay': '🇵🇾',
  'Australia': '🇦🇺',
  'Alemania': '🇩🇪', 'Germany': '🇩🇪',
  'Curazao': '🇨🇼', 'Curaçao': '🇨🇼',
  'Costa de Marfil': '🇨🇮', "Ivory Coast": '🇨🇮',
  'Ecuador': '🇪🇨',
  'Países Bajos': '🇳🇱', 'Netherlands': '🇳🇱',
  'Japón': '🇯🇵', 'Japan': '🇯🇵',
  'Túnez': '🇹🇳', 'Tunisia': '🇹🇳',
  'Bélgica': '🇧🇪', 'Belgium': '🇧🇪',
  'Egipto': '🇪🇬', 'Egypt': '🇪🇬',
  'Irán': '🇮🇷', 'Iran': '🇮🇷',
  'Nueva Zelanda': '🇳🇿', 'New Zealand': '🇳🇿',
  'España': '🇪🇸', 'Spain': '🇪🇸',
  'Cabo Verde': '🇨🇻', 'Cape Verde': '🇨🇻',
  'Arabia Saudita': '🇸🇦', 'Saudi Arabia': '🇸🇦',
  'Uruguay': '🇺🇾',
  'Francia': '🇫🇷', 'France': '🇫🇷',
  'Senegal': '🇸🇳',
  'Noruega': '🇳🇴', 'Norway': '🇳🇴',
  'Argentina': '🇦🇷',
  'Argelia': '🇩🇿', 'Algeria': '🇩🇿',
  'Austria': '🇦🇹',
  'Jordania': '🇯🇴', 'Jordan': '🇯🇴',
  'Portugal': '🇵🇹',
  'Uzbekistán': '🇺🇿', 'Uzbekistan': '🇺🇿',
  'Colombia': '🇨🇴',
  'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Croacia': '🇭🇷', 'Croatia': '🇭🇷',
  'Ghana': '🇬🇭',
  'Panamá': '🇵🇦', 'Panama': '🇵🇦',
}

function detectPhase(summary, description) {
  const text = `${summary} ${description}`.toLowerCase()
  if (text.includes('final') && !text.includes('semi') && !text.includes('third') && !text.includes('tercer')) return 'final'
  if (text.includes('third') || text.includes('tercer puesto') || text.includes('3rd')) return 'third_place'
  if (text.includes('semi')) return 'semifinal'
  if (text.includes('quarter') || text.includes('cuartos')) return 'quarterfinal'
  if (text.includes('round of 16') || text.includes('octavos') || text.includes('last 16')) return 'round_of_16'
  if (text.includes('round of 32') || text.includes('ronda de 32') || text.includes('last 32')) return 'round_of_32'
  return 'group'
}

function detectGroup(summary, description) {
  const text = `${summary} ${description}`
  const match = text.match(/[Gg]roup\s+([A-L])|[Gg]rupo\s+([A-L])/)
  return match ? (match[1] || match[2]) : null
}

function detectMatchday(summary, description) {
  const text = `${summary} ${description}`
  const match = text.match(/[Mm]atchday\s+(\d)|[Jj]ornada\s+(\d)|MD(\d)/)
  if (match) return parseInt(match[1] || match[2] || match[3])
  return null
}

function parseTeams(summary) {
  const parts = summary.split(/\s+vs\.?\s+|\s+-\s+/i)
  if (parts.length >= 2) {
    return { home: parts[0].trim(), away: parts[1].trim() }
  }
  return { home: summary, away: 'TBD' }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Invalid token' })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admin required' })

  // Parse multipart form
  const form = formidable({ maxFileSize: 10 * 1024 * 1024 })
  let icsContent

  try {
    const [, files] = await form.parse(req)
    const file = files.file?.[0]
    if (!file) return res.status(400).json({ error: 'No file uploaded' })
    icsContent = fs.readFileSync(file.filepath, 'utf-8')
  } catch (err) {
    return res.status(400).json({ error: `File parse error: ${err.message}` })
  }

  // Parse ICS
  let components
  try {
    const jcalData = ICAL.parse(icsContent)
    const comp = new ICAL.Component(jcalData)
    components = comp.getAllSubcomponents('vevent')
  } catch (err) {
    return res.status(400).json({ error: `ICS parse error: ${err.message}` })
  }

  const inserted = [], updated = [], errors = []

  for (const vevent of components) {
    try {
      const summary = vevent.getFirstPropertyValue('summary') || ''
      const description = vevent.getFirstPropertyValue('description') || ''
      const location = vevent.getFirstPropertyValue('location') || ''
      const dtstart = vevent.getFirstPropertyValue('dtstart')

      if (!dtstart || !summary) continue

      const startDate = dtstart.toJSDate ? dtstart.toJSDate() : new Date(dtstart)
      const { home, away } = parseTeams(summary)
      const phase = detectPhase(summary, description)
      const group = phase === 'group' ? detectGroup(summary, description) : null
      const matchday = phase === 'group' ? detectMatchday(summary, description) : null

      const record = {
        home_team: home,
        away_team: away,
        home_flag: TEAM_FLAGS[home] || '🏳️',
        away_flag: TEAM_FLAGS[away] || '🏳️',
        match_datetime_utc: startDate.toISOString(),
        phase,
        group_name: group,
        matchday,
        venue: location || null,
        status: 'upcoming',
      }

      // Check if match already exists (by teams + date within same day)
      const dayStart = new Date(startDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(startDate)
      dayEnd.setHours(23, 59, 59, 999)

      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('home_team', home)
        .eq('away_team', away)
        .gte('match_datetime_utc', dayStart.toISOString())
        .lte('match_datetime_utc', dayEnd.toISOString())
        .single()

      if (existing) {
        await supabase.from('matches').update(record).eq('id', existing.id)
        updated.push(`${home} vs ${away}`)
      } else {
        await supabase.from('matches').insert(record)
        inserted.push(`${home} vs ${away}`)
      }
    } catch (err) {
      errors.push(err.message)
    }
  }

  return res.status(200).json({
    inserted: inserted.length,
    updated: updated.length,
    errors,
  })
}
