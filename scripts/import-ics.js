/**
 * Import Mundial 2026 fixture from .ics file into Supabase.
 * Usage: node scripts/import-ics.js path/to/fixture.ics
 */
//toy re locoo

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import ICAL from 'ical.js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Known groups from the 2026 fixture
const TEAM_TO_GROUP = {
  'Mexico': 'A', 'South Africa': 'A', 'Korea Republic': 'A', 'Czech Republic': 'A',
  'Canada': 'B', 'Bosnia and Herzegovina': 'B', 'Qatar': 'B', 'Switzerland': 'B',
  'Brazil': 'C', 'Morocco': 'C', 'Haiti': 'C', 'Scotland': 'C',
  'United States of America': 'D', 'Paraguay': 'D', 'Australia': 'D', 'Turkey': 'D',
  'Germany': 'E', 'Curacao': 'E', 'Ivory Coast': 'E', 'Ecuador': 'E',
  'Netherlands': 'F', 'Japan': 'F', 'Sweden': 'F', 'Tunisia': 'F',
  'Belgium': 'G', 'Egypt': 'G', 'Iran': 'G', 'New Zealand': 'G',
  'Spain': 'H', 'Cape Verde': 'H', 'Saudi Arabia': 'H', 'Uruguay': 'H',
  'France': 'I', 'Senegal': 'I', 'Iraq': 'I', 'Norway': 'I',
  'Argentina': 'J', 'Algeria': 'J', 'Austria': 'J', 'Jordan': 'J',
  'Portugal': 'K', 'DR Congo': 'K', 'Uzbekistan': 'K', 'Colombia': 'K',
  'England': 'L', 'Croatia': 'L', 'Ghana': 'L', 'Panama': 'L',
}

// Display names (Spanish) mapped from English
const DISPLAY_NAME = {
  'Mexico': 'México',
  'South Africa': 'Sudáfrica',
  'Korea Republic': 'Corea del Sur',
  'Czech Republic': 'República Checa',
  'Canada': 'Canadá',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina',
  'Qatar': 'Qatar',
  'Switzerland': 'Suiza',
  'Brazil': 'Brasil',
  'Morocco': 'Marruecos',
  'Haiti': 'Haití',
  'Scotland': 'Escocia',
  'United States of America': 'Estados Unidos',
  'Paraguay': 'Paraguay',
  'Australia': 'Australia',
  'Turkey': 'Turquía',
  'Germany': 'Alemania',
  'Curacao': 'Curazao',
  'Ivory Coast': 'Costa de Marfil',
  'Ecuador': 'Ecuador',
  'Netherlands': 'Países Bajos',
  'Japan': 'Japón',
  'Sweden': 'Suecia',
  'Tunisia': 'Túnez',
  'Belgium': 'Bélgica',
  'Egypt': 'Egipto',
  'Iran': 'Irán',
  'New Zealand': 'Nueva Zelanda',
  'Spain': 'España',
  'Cape Verde': 'Cabo Verde',
  'Saudi Arabia': 'Arabia Saudita',
  'Uruguay': 'Uruguay',
  'France': 'Francia',
  'Senegal': 'Senegal',
  'Iraq': 'Irak',
  'Norway': 'Noruega',
  'Argentina': 'Argentina',
  'Algeria': 'Argelia',
  'Austria': 'Austria',
  'Jordan': 'Jordania',
  'Portugal': 'Portugal',
  'DR Congo': 'R.D. Congo',
  'Uzbekistan': 'Uzbekistán',
  'Colombia': 'Colombia',
  'England': 'Inglaterra',
  'Croatia': 'Croacia',
  'Ghana': 'Ghana',
  'Panama': 'Panamá',
}

const FLAGS = {
  'Mexico': '🇲🇽', 'South Africa': '🇿🇦', 'Korea Republic': '🇰🇷', 'Czech Republic': '🇨🇿',
  'Canada': '🇨🇦', 'Bosnia and Herzegovina': '🇧🇦', 'Qatar': '🇶🇦', 'Switzerland': '🇨🇭',
  'Brazil': '🇧🇷', 'Morocco': '🇲🇦', 'Haiti': '🇭🇹', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'United States of America': '🇺🇸', 'Paraguay': '🇵🇾', 'Australia': '🇦🇺', 'Turkey': '🇹🇷',
  'Germany': '🇩🇪', 'Curacao': '🇨🇼', 'Ivory Coast': '🇨🇮', 'Ecuador': '🇪🇨',
  'Netherlands': '🇳🇱', 'Japan': '🇯🇵', 'Sweden': '🇸🇪', 'Tunisia': '🇹🇳',
  'Belgium': '🇧🇪', 'Egypt': '🇪🇬', 'Iran': '🇮🇷', 'New Zealand': '🇳🇿',
  'Spain': '🇪🇸', 'Cape Verde': '🇨🇻', 'Saudi Arabia': '🇸🇦', 'Uruguay': '🇺🇾',
  'France': '🇫🇷', 'Senegal': '🇸🇳', 'Iraq': '🇮🇶', 'Norway': '🇳🇴',
  'Argentina': '🇦🇷', 'Algeria': '🇩🇿', 'Austria': '🇦🇹', 'Jordan': '🇯🇴',
  'Portugal': '🇵🇹', 'DR Congo': '🇨🇩', 'Uzbekistan': '🇺🇿', 'Colombia': '🇨🇴',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Croatia': '🇭🇷', 'Ghana': '🇬🇭', 'Panama': '🇵🇦',
}

function parseTeams(summary) {
  // Format: "Team A v Team B"
  const parts = summary.split(' v ')
  if (parts.length >= 2) {
    return { home: parts[0].trim(), away: parts.slice(1).join(' v ').trim() }
  }
  return null
}

function detectPhase(summary) {
  const s = summary.toLowerCase()
  if (s.includes('semi-final') && s.includes('loser')) return 'third_place'
  if (s.includes('semi-final') && s.includes('winner')) return 'final'
  if (s.includes('semi-final')) return 'semifinal'
  if (s.includes('quarter-final')) return 'quarterfinal'
  if (s.includes('round of sixteen')) return 'round_of_16'
  if (s.includes('round of thirty-two')) return 'round_of_32'
  if (s.includes('group') && (s.includes('winner') || s.includes('second place') || s.includes('third place'))) return 'round_of_32'
  return 'group'
}

function isWorldCupMatch(startDate, summary) {
  // Only import matches from June 2026 onwards (filter out qualifiers)
  const cutoff = new Date('2026-06-01T00:00:00Z')
  return startDate >= cutoff
}

async function main() {
  const icsPath = process.argv[2]
  if (!icsPath) {
    console.error('Usage: node scripts/import-ics.js path/to/fixture.ics')
    process.exit(1)
  }

  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const content = readFileSync(resolve(icsPath), 'utf-8')
  const jcalData = ICAL.parse(content)
  const comp = new ICAL.Component(jcalData)
  const vevents = comp.getAllSubcomponents('vevent')

  console.log(`Found ${vevents.length} total events in .ics`)

  // First pass: collect all group-stage matches to figure out matchdays
  const groupMatches = {} // groupLetter -> [{ home, away, date }]

  const allEvents = []
  for (const vevent of vevents) {
    const summary = vevent.getFirstPropertyValue('summary') || ''
    const location = vevent.getFirstPropertyValue('location') || ''
    const dtstart = vevent.getFirstPropertyValue('dtstart')
    if (!dtstart) continue

    const startDate = dtstart.toJSDate ? dtstart.toJSDate() : new Date(dtstart)
    if (!isWorldCupMatch(startDate, summary)) continue

    const phase = detectPhase(summary)
    const parsed = parseTeams(summary)

    if (phase === 'group' && parsed) {
      const group = TEAM_TO_GROUP[parsed.home]
      if (group) {
        if (!groupMatches[group]) groupMatches[group] = []
        groupMatches[group].push({ home: parsed.home, away: parsed.away, date: startDate })
      }
    }

    allEvents.push({ summary, location, startDate, phase, parsed })
  }

  // Sort group matches by date to assign matchdays
  const matchdayMap = {} // "home|away" -> matchday
  for (const [group, matches] of Object.entries(groupMatches)) {
    matches.sort((a, b) => a.date - b.date)
    // Each 4-team group has 6 matches: days 1-2, 3-4, 5-6 => matchday 1, 2, 3
    // We split into 3 rounds of 2 matches each based on date clusters
    const dates = [...new Set(matches.map(m => m.date.toISOString().slice(0, 10)))].sort()
    const dateToMatchday = {}
    let md = 1
    let prevDate = null
    for (const d of dates) {
      if (prevDate && md < 3) {
        // Check if this date is significantly later (next round)
        const daysDiff = (new Date(d) - new Date(prevDate)) / (1000 * 60 * 60 * 24)
        if (daysDiff >= 5) md++
      }
      dateToMatchday[d] = md
      prevDate = d
    }

    for (const m of matches) {
      const dateKey = m.date.toISOString().slice(0, 10)
      const key = `${m.home}|${m.away}`
      matchdayMap[key] = dateToMatchday[dateKey]
    }
  }

  console.log('\nImporting matches...\n')

  let inserted = 0, updated = 0, skipped = 0, errors = 0

  for (const { summary, location, startDate, phase, parsed } of allEvents) {
    try {
      let homeRaw, awayRaw, homeName, awayName

      if (phase === 'group' && parsed) {
        homeRaw = parsed.home
        awayRaw = parsed.away
        homeName = DISPLAY_NAME[homeRaw] || homeRaw
        awayName = DISPLAY_NAME[awayRaw] || awayRaw
      } else {
        // Knockout: use summary as team names (they're placeholders like "Group A Winner")
        homeName = summary.split(' v ')[0]?.trim() || summary
        awayName = summary.split(' v ').slice(1).join(' v ').trim() || 'TBD'
        homeRaw = homeName
        awayRaw = awayName
      }

      const group = phase === 'group' ? (TEAM_TO_GROUP[homeRaw] || null) : null
      const matchdayKey = `${homeRaw}|${awayRaw}`
      const matchday = phase === 'group' ? (matchdayMap[matchdayKey] || null) : null

      const record = {
        home_team: homeName,
        away_team: awayName,
        home_flag: FLAGS[homeRaw] || '🏳️',
        away_flag: FLAGS[awayRaw] || '🏳️',
        match_datetime_utc: startDate.toISOString(),
        phase,
        group_name: group,
        matchday,
        venue: location || null,
        status: 'upcoming',
      }

      // Check for existing match (same teams, same day)
      const dayStart = new Date(startDate)
      dayStart.setUTCHours(0, 0, 0, 0)
      const dayEnd = new Date(startDate)
      dayEnd.setUTCHours(23, 59, 59, 999)

      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('home_team', homeName)
        .eq('away_team', awayName)
        .gte('match_datetime_utc', dayStart.toISOString())
        .lte('match_datetime_utc', dayEnd.toISOString())
        .maybeSingle()

      if (existing) {
        const { error } = await supabase.from('matches').update(record).eq('id', existing.id)
        if (error) throw error
        console.log(`  ↻ UPDATED: ${homeName} vs ${awayName}`)
        updated++
      } else {
        const { error } = await supabase.from('matches').insert(record)
        if (error) throw error
        const groupLabel = group ? ` [Grupo ${group} · J${matchday}]` : ` [${phase}]`
        console.log(`  ✓ INSERTED: ${homeName} vs ${awayName}${groupLabel}`)
        inserted++
      }
    } catch (err) {
      console.error(`  ✗ ERROR (${summary}): ${err.message}`)
      errors++
    }
  }

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`✓ Inserted : ${inserted}`)
  console.log(`↻ Updated  : ${updated}`)
  console.log(`✗ Errors   : ${errors}`)
  console.log(`  Skipped  : ${skipped} (qualifiers)`)
  console.log(`${'─'.repeat(50)}`)
}

main()
