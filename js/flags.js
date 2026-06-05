/**
 * Prodeteca · flag helper
 * ---------------------------------------------------------------
 * Maps the 48 World Cup 2026 selections (and the playoff slots)
 * to ISO-3166 alpha-2 codes, then renders an SVG flag from the
 * open-source `flag-icons` library, served via jsDelivr.
 *
 *   import { getFlagHtml, flagFor } from './flags.js'
 *
 *   container.innerHTML = getFlagHtml('Argentina')       // -> <img...>
 *   const iso = flagFor('Estados Unidos')                // -> 'us'
 *
 * In `predictions.js` / `matches.js` / `admin.js`, swap any
 * usage of `match.home_flag` (which currently stores an emoji)
 * for `getFlagHtml(match.home_team)`.
 *
 *   <span class="team-flag">${getFlagHtml(match.home_team)}</span>
 *
 * For the 6 playoff/intercontinental slots that don't have a
 * country yet, the helper falls back to a neutral chip
 * showing the slot label (e.g. "UEFA · A").
 */

export const TEAM_FLAGS = {
  // CONMEBOL
  'Argentina':        'ar',
  'Brasil':           'br',
  'Uruguay':          'uy',
  'Colombia':         'co',
  'Ecuador':          'ec',
  'Paraguay':         'py',

  // CONCACAF (anfitriones + clasificados)
  'México':           'mx',
  'Canadá':           'ca',
  'Estados Unidos':   'us',
  'Haití':            'ht',
  'Curazao':          'cw',
  'Panamá':           'pa',

  // CAF (África)
  'Marruecos':        'ma',
  'Sudáfrica':        'za',
  'Túnez':            'tn',
  'Egipto':           'eg',
  'Senegal':          'sn',
  'Argelia':          'dz',
  'Ghana':            'gh',
  'Cabo Verde':       'cv',
  'Costa de Marfil':  'ci',
  'RD Congo':         'cd',

  // UEFA (Europa) — incluye subdivisiones GB-ENG / GB-SCT
  'Alemania':              'de',
  'Francia':               'fr',
  'España':                'es',
  'Inglaterra':            'gb-eng',
  'Escocia':               'gb-sct',
  'Portugal':              'pt',
  'Países Bajos':          'nl',
  'Bélgica':               'be',
  'Croacia':               'hr',
  'Suiza':                 'ch',
  'Austria':               'at',
  'Noruega':               'no',
  'República Checa':       'cz',
  'Bosnia y Herzegovina':  'ba',
  'Suecia':                'se',
  'Turquía':               'tr',

  // AFC (Asia)
  'Corea del Sur':    'kr',
  'Japón':            'jp',
  'Catar':            'qa',
  'Irán':             'ir',
  'Arabia Saudita':   'sa',
  'Australia':        'au',
  'Uzbekistán':       'uz',
  'Jordania':         'jo',
  'Irak':             'iq',

  // OFC (Oceanía)
  'Nueva Zelanda':    'nz',
}

// Playoff slots — get a confederation chip instead of a flag
const PLAYOFF_SLOTS = {
  'UEFA Playoff A':   { conf: 'UEFA',  slot: 'A' },
  'UEFA Playoff B':   { conf: 'UEFA',  slot: 'B' },
  'UEFA Playoff C':   { conf: 'UEFA',  slot: 'C' },
  'UEFA Playoff D':   { conf: 'UEFA',  slot: 'D' },
  'FIFA Playoff 1':   { conf: 'FIFA',  slot: '1' },
  'FIFA Playoff 2':   { conf: 'FIFA',  slot: '2' },
}

const FLAG_CDN = 'https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/flags/4x3'

/**
 * Returns the ISO-3166 alpha-2 (or subdivision) code for a team name.
 * Returns `null` for playoff/intercontinental slots and unknown teams.
 */
export function flagFor(teamName) {
  if (!teamName) return null
  return TEAM_FLAGS[teamName] || null
}

/**
 * Translates English FIFA bracket placeholders to Spanish.
 *   "Group A Winner"              → "1° Grupo A"
 *   "Group B Second Place"        → "2° Grupo B"
 *   "Third Place Group A/B/C/D/F" → "Mejor 3° Grupos A/B/C/D/F"
 */
export function localizeTeamName(name) {
  if (!name) return name
  let m
  if ((m = name.match(/^Group ([A-Z0-9]+) Winner$/)))        return `1° Grupo ${m[1]}`
  if ((m = name.match(/^Group ([A-Z0-9]+) Second Place$/)))  return `2° Grupo ${m[1]}`
  if ((m = name.match(/^Third Place Group (.+)$/)))          return `Mejor 3° Grupos ${m[1]}`
  return name
}

/**
 * Returns an HTML string with the rendered flag.
 * - Real country → <img> from flag-icons CDN (SVG 4:3 ratio)
 * - Playoff slot → confederation chip ("UEFA · A")
 * - Unknown      → neutral chip with the team's initials
 */
export function getFlagHtml(teamName) {
  const iso = flagFor(teamName)
  if (iso) {
    const alt = teamName.replace(/"/g, '&quot;')
    return `<img class="flag-img" src="${FLAG_CDN}/${iso}.svg" alt="${alt}" loading="lazy" decoding="async">`
  }

  const slot = PLAYOFF_SLOTS[teamName]
  if (slot) {
    return `<span class="flag-slot" data-conf="${slot.conf}">
      <em>${slot.conf}</em>
      <b>${slot.slot}</b>
    </span>`
  }

  // Unknown team — render initials as a placeholder
  const initials = (teamName || '?')
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return `<span class="flag-slot" data-conf="?">
    <b>${initials || '?'}</b>
  </span>`
}

/**
 * Convenience: returns a full <span class="team-flag"> wrapping
 * the flag. Use this if you're rendering teams from scratch
 * (e.g. for new screens). Existing screens already have a wrapper
 * around the flag, so use `getFlagHtml` directly there.
 */
export function teamFlag(teamName) {
  return `<span class="team-flag" title="${(teamName || '').replace(/"/g, '&quot;')}">${getFlagHtml(teamName)}</span>`
}

/**
 * Primary on-pitch colors per national team. Two-tone, used for the
 * subtle 3px team-color accent at the top of each .match-card.
 * Pair with markup like:
 *
 *   const { home, away } = teamColors(homeName, awayName)
 *   `<div class="match-card" data-team-colors
 *         style="--home-color:${home}; --away-color:${away}">…`
 */
export const TEAM_COLORS = {
  'Argentina':       '#75AADB',
  'Brasil':          '#FEDF00',
  'Uruguay':         '#5CB8E6',
  'Colombia':        '#FCD116',
  'Ecuador':         '#FFCD00',
  'Paraguay':        '#D62718',
  'México':          '#006847',
  'Canadá':          '#D52B1E',
  'Estados Unidos':  '#3C3B6E',
  'Haití':           '#00209F',
  'Curazao':         '#002B7F',
  'Panamá':          '#005AA7',
  'Marruecos':       '#C1272D',
  'Sudáfrica':       '#007749',
  'Túnez':           '#E70013',
  'Egipto':          '#CE1126',
  'Senegal':         '#00853F',
  'Argelia':         '#006233',
  'Ghana':           '#FCD116',
  'Cabo Verde':      '#003893',
  'Costa de Marfil': '#FF8200',
  'Alemania':        '#000000',
  'Francia':         '#0055A4',
  'España':          '#AA151B',
  'Inglaterra':      '#CE1124',
  'Escocia':         '#0065BD',
  'Portugal':        '#006600',
  'Países Bajos':    '#FF6C00',
  'Bélgica':         '#FAE042',
  'Croacia':         '#171796',
  'Suiza':           '#D52B1E',
  'Austria':         '#ED2939',
  'Noruega':         '#BA0C2F',
  'Corea del Sur':        '#003478',
  'Japón':                '#BC002D',
  'Catar':                '#8A1538',
  'Irán':                 '#239F40',
  'Arabia Saudita':       '#006C35',
  'RD Congo':             '#007FFF',
  'Australia':            '#FFCD00',
  'Uzbekistán':           '#1EB53A',
  'Jordania':             '#000000',
  'Irak':                 '#CE1126',
  'Nueva Zelanda':        '#000000',
  'República Checa':      '#D7141A',
  'Bosnia y Herzegovina': '#002395',
  'Suecia':               '#006AA7',
  'Turquía':              '#E30A17',
}

export function teamColor(teamName) {
  return TEAM_COLORS[teamName] || '#DCDEE9'    // ink-200 fallback
}

export function teamColors(home, away) {
  return { home: teamColor(home), away: teamColor(away) }
}
