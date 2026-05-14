// OpenAPI generator: use existing docs parser output (or accept inline JSDoc
// objects) to emit a minimal Swagger 3.0 spec. v0 maps paths from input.
import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const limit = rateLimit({ windowMs: 60 * 60 * 1000, maxRequests: 30 });

interface JsDocEntry {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  params?: { name: string; in: string; required?: boolean; type?: string }[];
  responses?: Record<string, { description: string }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const allowed = await limit(req, res);
  if (!allowed) return;

  const { entries, title, version, server_url } = req.body || {};
  const items: JsDocEntry[] = Array.isArray(entries) ? entries : [];
  if (!items.length) {
    return res.status(400).json({ error: 'entries[] (jsdoc-parsed endpoints) required' });
  }

  const paths: Record<string, any> = {};
  for (const e of items) {
    if (!e?.path || !e?.method) continue;
    const m = e.method.toLowerCase();
    paths[e.path] = paths[e.path] || {};
    paths[e.path][m] = {
      summary: e.summary || `${m.toUpperCase()} ${e.path}`,
      description: e.description || '',
      parameters: (e.params || []).map((p) => ({
        name: p.name,
        in: p.in || 'query',
        required: !!p.required,
        schema: { type: p.type || 'string' },
      })),
      responses: e.responses || { '200': { description: 'OK' } },
    };
  }

  const spec = {
    openapi: '3.0.3',
    info: {
      title: typeof title === 'string' ? title : 'AI Documentation Assistant API',
      version: typeof version === 'string' ? version : '1.0.0',
      description: 'Auto-generated from JSDoc by /api/ai/openapi-generator',
    },
    servers: [{ url: typeof server_url === 'string' ? server_url : 'http://localhost:3000' }],
    paths,
  };

  return res.status(200).json({
    path_count: Object.keys(paths).length,
    spec,
  });
}
