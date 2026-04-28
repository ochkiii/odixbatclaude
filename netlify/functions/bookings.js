import { getStore } from '@netlify/blobs';

const STORE_NAME = 'site-content';
const BLOB_KEY   = 'bookings';

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // Public POST — client submits booking form
  if (req.method === 'POST') {
    const token = req.headers.get('x-admin-token') || '';
    const expected = process.env.ADMIN_TOKEN || 'odix2026';

    // Admin write (full replace — used by admin panel to update statuses)
    if (token === expected) {
      try {
        const body  = await req.json();
        const store = getStore(STORE_NAME);
        await store.setJSON(BLOB_KEY, body);
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
      }
    }

    // Public submission — append new booking
    try {
      const body    = await req.json();
      const { name, email, service, budget, timeline, message } = body;
      if (!name || !email) {
        return new Response(JSON.stringify({ error: 'Name and email are required' }), { status: 400, headers });
      }
      const store    = getStore(STORE_NAME);
      const existing = await store.get(BLOB_KEY, { type: 'json' }).catch(() => []);
      const all      = Array.isArray(existing) ? existing : [];
      all.unshift({ id: Date.now(), name, email, service, budget, timeline, message, status: 'new', createdAt: Date.now() });
      await store.setJSON(BLOB_KEY, all);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
  }

  // Admin GET — returns all bookings (requires token)
  if (req.method === 'GET') {
    const token    = req.headers.get('x-admin-token') || new URL(req.url).searchParams.get('token') || '';
    const expected = process.env.ADMIN_TOKEN || 'odix2026';
    if (token !== expected) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }
    try {
      const store = getStore(STORE_NAME);
      const data  = await store.get(BLOB_KEY, { type: 'json' });
      return new Response(JSON.stringify(data || []), { status: 200, headers });
    } catch (e) {
      return new Response('[]', { status: 200, headers });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
};

export const config = { path: '/api/bookings' };
