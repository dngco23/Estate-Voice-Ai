import Stripe from 'stripe'
import type { Config } from '@netlify/functions'

export default async (req: Request) => {
  const secretKey = Netlify.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Netlify.env.get('STRIPE_WEBHOOK_SECRET')

  if (!secretKey || !webhookSecret) {
    return new Response('Stripe is not configured', { status: 500 })
  }

  const stripe = new Stripe(secretKey)
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    const rawBody = await req.text()
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      console.log(`Checkout completed: ${session.id} — customer: ${session.customer}`)
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      console.log(`Subscription cancelled: ${subscription.id}`)
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      console.log(`Payment failed for invoice: ${invoice.id}`)
      break
    }
    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  return Response.json({ received: true })
}

export const config: Config = {
  path: '/api/stripe-webhook',
  method: 'POST',
}
