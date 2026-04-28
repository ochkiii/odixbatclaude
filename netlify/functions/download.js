import Stripe from 'stripe';
import { getStore } from '@netlify/blobs';

const STORE_NAME  = 'site-content';
const TOKEN_PREFIX = 'dl-token-';

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(req.url);

  // GET /api/download?token=xxx — verify token and redirect to file
  if (req.method === 'GET') {
    const token = url.searchParams.get('token');
    if (!token) return new Response(JSON.stringify({ error: 'No token' }), { status: 400, headers });

    try {
      const store = getStore(STORE_NAME);
      const data  = await store.get(TOKEN_PREFIX + token, { type: 'json' });
      if (!data) return new Response(JSON.stringify({ error: 'Invalid or expired link' }), { status: 410, headers });

      if (Date.now() > data.expiresAt) {
        await store.delete(TOKEN_PREFIX + token);
        return new Response(JSON.stringify({ error: 'Link expired' }), { status: 410, headers });
      }

      return new Response(null, {
        status: 302,
        headers: { ...headers, Location: data.fileUrl, 'Content-Type': 'text/plain' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
  }

  // POST /api/download — verify Stripe session, create token
  if (req.method === 'POST') {
    if (!process.env.STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Store not configured' }), { status: 503, headers });
    }

    try {
      const { sessionId } = await req.json();
      if (!sessionId) return new Response(JSON.stringify({ error: 'Missing session_id' }), { status: 400, headers });

      const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] });

      if (session.payment_status !== 'paid') {
        return new Response(JSON.stringify({ error: 'Payment not completed' }), { status: 402, headers });
      }

      // Find the product in our store by Stripe Price ID
      const priceId = session.line_items?.data?.[0]?.price?.id;
      const storeBlobs = getStore(STORE_NAME);
      const products   = await storeBlobs.get('store-products', { type: 'json' }).catch(() => []);
      const product    = (Array.isArray(products) ? products : []).find(p => p.stripeId === priceId);

      if (!product?.fileUrl) {
        return new Response(JSON.stringify({ error: 'Product file not found' }), { status: 404, headers });
      }

      // Create a 24-hour download token
      const token    = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      await storeBlobs.setJSON(TOKEN_PREFIX + token, { fileUrl: product.fileUrl, expiresAt });

      return new Response(
        JSON.stringify({ downloadUrl: `/api/download?token=${token}` }),
        { status: 200, headers }
      );
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
};

export const config = { path: '/api/download' };
