import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify auth token
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' })

  // Verify admin role
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admin required' })

  const { matchId, homeScore, awayScore } = req.body

  if (!matchId || homeScore === undefined || awayScore === undefined) {
    return res.status(400).json({ error: 'matchId, homeScore and awayScore are required' })
  }

  if (homeScore < 0 || awayScore < 0 || homeScore > 30 || awayScore > 30) {
    return res.status(400).json({ error: 'Invalid score values' })
  }

  // Update match result
  const { error: matchError } = await supabase
    .from('matches')
    .update({ home_score: homeScore, away_score: awayScore, status: 'finished' })
    .eq('id', matchId)

  if (matchError) return res.status(500).json({ error: matchError.message })

  // Calculate points for all predictions of this match
  const { data: predictions } = await supabase
    .from('predictions')
    .select('id, home_score_pred, away_score_pred')
    .eq('match_id', matchId)

  let exact = 0, partial = 0, zero = 0

  const updates = (predictions || []).map(p => {
    let pts = 0
    if (p.home_score_pred === homeScore && p.away_score_pred === awayScore) {
      pts = 3; exact++
    } else {
      const realOutcome = homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw'
      const predOutcome = p.home_score_pred > p.away_score_pred ? 'home'
        : p.home_score_pred < p.away_score_pred ? 'away' : 'draw'
      if (realOutcome === predOutcome) { pts = 1; partial++ }
      else zero++
    }
    return supabase.from('predictions').update({ points_earned: pts }).eq('id', p.id)
  })

  await Promise.all(updates)

  // Check if this is the final — also process champion predictions
  const { data: match } = await supabase
    .from('matches')
    .select('phase, home_team, away_team')
    .eq('id', matchId)
    .single()

  if (match?.phase === 'final') {
    const champion = homeScore > awayScore ? match.home_team : match.away_team
    const runnerUp = homeScore > awayScore ? match.away_team : match.home_team

    const { data: champPreds } = await supabase
      .from('champion_predictions')
      .select('*')

    const champUpdates = (champPreds || []).map(cp => {
      const correctChamp = cp.champion_team === champion
      const correctRunner = cp.runner_up_team === runnerUp
      const champPts = correctChamp ? 20 : 0
      const runnerPts = correctRunner ? 10 : 0
      const bonusPts = correctChamp && correctRunner ? 20 : 0
      const total = champPts + runnerPts + bonusPts

      return supabase.from('champion_predictions').update({
        champion_points: champPts,
        runner_up_points: runnerPts,
        bonus_points: bonusPts,
        total_points: total,
      }).eq('id', cp.id)
    })

    await Promise.all(champUpdates)
  }

  return res.status(200).json({ exact, partial, zero })
}
