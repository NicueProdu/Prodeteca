import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, name } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })

  const appUrl = process.env.VITE_APP_URL || 'https://prodeteca.vercel.app'
  const displayName = name || email.split('@')[0]

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'prode@parsimotion.com',
      to: email,
      subject: '¡Bienvenido/a al Prodeteca — Mundial 2026! 🏆',
      html: `
<!DOCTYPE html>
<html lang="es">
<body style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1A1A2E">
  <div style="background:linear-gradient(135deg,#003DA5,#C8102E);padding:32px;border-radius:12px;text-align:center;color:#fff;margin-bottom:24px">
    <div style="font-size:48px;margin-bottom:8px">⚽</div>
    <h1 style="font-size:28px;margin:0;font-weight:700">Prodeteca</h1>
    <p style="opacity:0.9;margin:8px 0 0">Mundial 2026</p>
  </div>

  <p>Hola <strong>${displayName}</strong>,</p>
  <p>¡Ya estás dentro del Prodeteca de Parsimotion! 🎉</p>

  <h3>¿Cómo funciona?</h3>
  <ul>
    <li>Antes de cada partido, cargá tu predicción del marcador.</li>
    <li><strong>Resultado exacto</strong>: 3 puntos</li>
    <li><strong>Resultado correcto</strong> (ganador o empate): 1 punto</li>
    <li>Las predicciones se cierran <strong>10 minutos antes del partido</strong>.</li>
  </ul>

  <div style="background:#FFF8E1;border-left:4px solid #F5A623;padding:16px;border-radius:0 8px 8px 0;margin:20px 0">
    <strong>⚠️ Importante:</strong> Cargá tu predicción de <strong>Campeón y Subcampeón</strong>
    antes del primer partido del Mundial (11 de junio).
    Acertar los dos vale <strong>50 puntos</strong>.
  </div>

  <div style="text-align:center;margin:28px 0">
    <a href="${appUrl}/predictions.html"
       style="background:#C8102E;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px">
      Ir al Prodeteca →
    </a>
  </div>

  <p style="color:#6C757D;font-size:0.8rem;text-align:center;margin-top:32px">
    Prodeteca · Parsimotion · Mundial 2026
  </p>
</body>
</html>`,
    })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Welcome email error:', err)
    return res.status(500).json({ error: err.message })
  }
}
