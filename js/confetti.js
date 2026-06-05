/**
 * Prodeteca · confetti
 * --------------------------------------------------------------
 * Fires a confetti burst when the user lands an exact prediction
 * (3 pts). Pure CSS animation + minimal JS — no canvas, no libs.
 *
 *   import { fireConfetti } from './confetti.js'
 *
 *   // After saving a prediction that turns out to be an exact match,
 *   // call:  fireConfetti()
 *
 *   // Optional: target a specific origin element (the match card
 *   // that triggered the celebration). Confetti will rain down
 *   // from its top edge rather than from the window edge.
 *   //   fireConfetti({ origin: cardEl })
 *
 *   // Optional: more or fewer pieces (default 90).
 *   //   fireConfetti({ count: 140 })
 */

const PALETTE = [
  '#0056D8',   // brand blue
  '#6F5FC9',   // brand violet
  '#F5A623',   // trophy gold
  '#12A66B',   // success green
  '#BF0A30',   // host red
  '#006847',   // host green
  '#FFFFFF',   // white
  '#B79BD9',   // brand lilac
]

let activeStages = 0

export function fireConfetti({
  count = 90,
  duration = 2400,
  origin = null,
  palette = PALETTE,
} = {}) {
  // Respect reduced-motion preference
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  // Limit concurrent bursts to avoid choking the page
  if (activeStages >= 3) return
  activeStages++

  const stage = document.createElement('div')
  stage.className = 'confetti-stage'
  document.body.appendChild(stage)

  // Determine the "rain origin" — usually full-width, but can be
  // anchored to an element so the confetti shoots out from there.
  let originRect = { left: 0, width: window.innerWidth, top: 0 }
  if (origin && origin.getBoundingClientRect) {
    originRect = origin.getBoundingClientRect()
  }

  const fragment = document.createDocumentFragment()

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div')
    piece.className = 'confetti-piece'

    const color = palette[Math.floor(Math.random() * palette.length)]
    const shape = Math.random()
    const size  = 6 + Math.random() * 10            // 6–16 px
    const left  = originRect.left + Math.random() * originRect.width
    const top   = (originRect.top || 0) - 20
    const dx    = (Math.random() - 0.5) * 320       // ±160 px lateral drift
    const dur   = duration * (0.7 + Math.random() * 0.7)
    const delay = Math.random() * 240               // 0–240 ms stagger

    piece.style.left   = `${left}px`
    piece.style.top    = `${top}px`
    piece.style.width  = `${size}px`
    piece.style.height = `${size * (shape > 0.5 ? 1.4 : 0.6)}px`
    piece.style.background = color
    piece.style.setProperty('--dx',  `${dx}px`)
    piece.style.setProperty('--dur', `${dur}ms`)
    piece.style.animationDelay = `${delay}ms`
    if (shape > 0.78) piece.style.borderRadius = '50%'   // some circles too

    fragment.appendChild(piece)
  }

  stage.appendChild(fragment)

  setTimeout(() => {
    stage.remove()
    activeStages--
  }, duration + 1200)
}

/**
 * Contained burst from inside a match card — only valid within 24 h
 * of the match kickoff. Confetti originates from the winning team's
 * side (left=home, right=away, center=draw) and is clipped by the
 * card's own overflow:hidden.
 */
export function fireCardConfetti(card, match) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  if (activeStages >= 3) return

  const hoursElapsed = (Date.now() - new Date(match.match_datetime_utc)) / 3600000
  if (hoursElapsed > 24) return

  activeStages++

  // Use a fixed overlay that matches the card's visual rect — this bypasses
  // any stacking-context / overflow+transform clipping issues in the DOM tree.
  const rect = card.getBoundingClientRect()
  const stage = document.createElement('div')
  stage.style.cssText = [
    'position:fixed',
    `left:${rect.left}px`,
    `top:${rect.top}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    'overflow:hidden',
    'pointer-events:none',
    'z-index:9999',
    `border-radius:${getComputedStyle(card).borderRadius}`,
  ].join(';')
  document.body.appendChild(stage)

  const w = rect.width
  const h = rect.height

  // Burst origin X: left area for home win, right for away, centre for draw
  let cx
  if      (match.home_score > match.away_score) cx = w * 0.18
  else if (match.home_score < match.away_score) cx = w * 0.82
  else                                          cx = w * 0.50

  const fragment = document.createDocumentFragment()

  for (let i = 0; i < 52; i++) {
    const el     = document.createElement('div')
    const color  = PALETTE[Math.floor(Math.random() * PALETTE.length)]
    const size   = 5 + Math.random() * 7
    const circle = Math.random() > 0.62
    const startX = cx + (Math.random() - 0.5) * w * 0.22
    const startY = h * (0.35 + Math.random() * 0.40)
    const dx     = (Math.random() - 0.5) * w * 0.90
    const dy     = -(h * (0.5 + Math.random() * 1.1))
    const dur    = 1200 + Math.random() * 700
    const delay  = Math.random() * 280

    el.style.cssText = [
      'position:absolute',
      `left:${startX}px`,
      `top:${startY}px`,
      `width:${size}px`,
      `height:${circle ? size : size * 1.5}px`,
      `background:${color}`,
      `border-radius:${circle ? '50%' : '2px'}`,
      `--dx:${dx}px`,
      `--dy:${dy}px`,
      `animation:cardConfetti ${dur}ms ${delay}ms cubic-bezier(.2,.65,.35,1) forwards`,
    ].join(';')

    fragment.appendChild(el)
  }

  stage.appendChild(fragment)
  setTimeout(() => { stage.remove(); activeStages-- }, 2400)
}
