import { getStore } from '@netlify/blobs';

const STORE_NAME = 'site-content';
const BLOB_KEY   = 'printlab';

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  /* ── GET — public, anyone can read ── */
  if (req.method === 'GET') {
    try {
      const store = getStore(STORE_NAME);
      const data  = await store.get(BLOB_KEY, { type: 'json' });
      return new Response(JSON.stringify(data || null), { status: 200, headers });
    } catch (e) {
      return new Response(JSON.stringify(null), { status: 200, headers });
    }
  }

  /* ── POST — protected by token ── */
  if (req.method === 'POST') {
    const token    = req.headers.get('x-admin-token') || '';
    const expected = process.env.ADMIN_TOKEN || 'odix2026';

    if (token !== expected) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }

    try {
      const body  = await req.json();
      const store = getStore(STORE_NAME);
      await store.setJSON(BLOB_KEY, body);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
};

export const config = { path: '/api/content' };
