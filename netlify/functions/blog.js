import { getStore } from '@netlify/blobs';

const STORE_NAME = 'site-content';
const BLOB_KEY   = 'blog';

export default async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method === 'GET') {
    try {
      const store = getStore(STORE_NAME);
      const data  = await store.get(BLOB_KEY, { type: 'json' });
      const posts = Array.isArray(data) ? data : [];
      // Strip body from index response if ?index=1
      const url   = new URL(req.url);
      if (url.searchParams.get('index') === '1') {
        return new Response(
          JSON.stringify(posts.map(p => ({ ...p, body: undefined }))),
          { status: 200, headers }
        );
      }
      // Single post by slug
      const slug = url.searchParams.get('slug');
      if (slug) {
        const post = posts.find(p => p.slug === slug);
        if (!post) return new Response(JSON.stringify(null), { status: 404, headers });
        return new Response(JSON.stringify(post), { status: 200, headers });
      }
      return new Response(JSON.stringify(posts), { status: 200, headers });
    } catch (e) {
      return new Response('[]', { status: 200, headers });
    }
  }

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

export const config = { path: '/api/blog' };
