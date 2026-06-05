import { supabase } from './supabase-client.js'

const ALLOWED_DOMAIN = import.meta.env.VITE_ALLOWED_DOMAIN || 'parsimotion.com'
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${APP_URL}/predictions`,
      queryParams: {
        hd: ALLOWED_DOMAIN,
        prompt: 'select_account',
      },
    },
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  window.location.href = '/login'
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getCurrentUser() {
  const session = await getSession()
  if (!session) return null

  const email = session.user.email
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await signOut()
    return null
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  return profile
}

// Redirect to login if no session. Call on protected pages.
export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    window.location.href = '/login'
    return null
  }

  const email = session.user.email
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await supabase.auth.signOut()
    window.location.href = '/login?error=domain'
    return null
  }

  return session
}

// Redirect to predictions if already logged in. Call on login page.
export async function redirectIfLoggedIn() {
  const session = await getSession()
  if (session) {
    const email = session.user.email
    if (email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      window.location.href = '/predictions'
    }
  }
}

// Ensure user profile exists (called after login)
export async function ensureProfile(session) {
  const { data: existing, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('id', session.user.id)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = row not found (esperado para usuarios nuevos); cualquier otro error es real
    console.error('[ensureProfile] Error checking existing profile:', fetchError)
    // No bloqueamos al usuario — podría seguir usando la app con funcionalidad reducida
    return
  }

  if (!existing) {
    const meta = session.user.user_metadata
    const name = meta.full_name || meta.name || session.user.email.split('@')[0]

    const { error: insertError } = await supabase.from('users').insert({
      id: session.user.id,
      email: session.user.email,
      name,
      avatar_url: meta.avatar_url || meta.picture || null,
      role: 'user',
    })

    if (insertError) {
      console.error('[ensureProfile] Error creating profile:', insertError)
      // El usuario continuará pero sin fila en `users`, lo que puede degradar la UX.
      // Si esto ocurre sistemáticamente, revisar las RLS policies en Supabase.
      return
    }

    // Send welcome email via serverless function
    fetch('/api/send-welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: session.user.email, name }),
    }).catch(() => {})
  }
}
