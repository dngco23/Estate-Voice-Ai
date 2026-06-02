import Stripe from 'stripe'
import type { Config } from '@netlify/functions'

const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  agent: Netlify.env.get('STRIPE_PRICE_AGENT_ID'),
  team: Netlify.env.get('STRIPE_PRICE_TEAM_ID'),
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const secretKey = Netlify.env.get('STRIPE_SECRET_KEY')
  if (!secretKey) {
    return Response.json({ error: 'Stripe is not configured' }, { status: 500 })
  }

  let plan: string
  try {
    const body = await req.json()
    plan = body.plan
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const origin = new URL(req.url).origin  // <-- Move this BEFORE the starter check

  if (plan === 'starter') {
    // For free plan, redirect to signup
    return Response.json({ url: `${origin}/signup.html` })
  }

  const priceId = PLAN_PRICE_IDS[plan]
  if (!priceId) {
    return Response.json({ error: 'Unknown plan' }, { status: 400 })
  }

  const stripe = new Stripe(secretKey)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
      allow_promotion_codes: true,
    })

    return Response.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/create-checkout-session',
  method: 'POST',
}
