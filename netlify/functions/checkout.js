import Stripe from 'stripe';

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Store not configured' }), { status: 503, headers });
  }

  try {
    const { stripeId, name } = await req.json();
    if (!stripeId) {
      return new Response(JSON.stringify({ error: 'Missing price ID' }), { status: 400, headers });
    }

    const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY);
    const origin  = new URL(req.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: stripeId, quantity: 1 }],
      success_url: `${origin}/store/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${origin}/store`,
      metadata: { productName: name || 'Digital Product' },
    });

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
};

export const config = { path: '/api/checkout' };
