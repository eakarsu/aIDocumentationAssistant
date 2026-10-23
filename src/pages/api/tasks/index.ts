import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
// @ts-ignore plain-JS helper module with adjacent .d.ts
import { validateTask } from '@/lib/featurePack.cjs';

let ensured: Promise<unknown> | null = null;
function ensureTable() {
  if (!ensured) {
    ensured = prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, status TEXT DEFAULT 'open', assignee TEXT, doc_id TEXT, due_date TEXT, notes TEXT, user_id TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`
    ).catch((e: unknown) => { ensured = null; throw e; });
  }
  return ensured;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await ensureTable();
    if (req.method === 'GET') {
      const rows: unknown[] = await prisma.$queryRawUnsafe('SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200', user.id);
      return res.status(200).json({ data: rows });
    }
    if (req.method === 'POST') {
      const t = validateTask(req.body || {});
      const id = randomUUID();
      const rows: unknown[] = await prisma.$queryRawUnsafe(
        'INSERT INTO tasks (id,title,status,assignee,doc_id,due_date,notes,user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        id, t.title, t.status, t.assignee, t.doc_id, t.due_date, t.notes, user.id);
      return res.status(201).json(rows[0]);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Task request failed';
    return res.status(message === 'title is required' ? 400 : 500).json({ error: message });
  }
}
