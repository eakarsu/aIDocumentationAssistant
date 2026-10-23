import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'PUT' && req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  const b = req.body || {};
  try {
    const rows: unknown[] = await prisma.$queryRawUnsafe(
      `UPDATE tasks SET title=COALESCE($1,title), status=COALESCE($2,status), assignee=COALESCE($3,assignee),
       doc_id=COALESCE($4,doc_id), due_date=COALESCE($5,due_date), notes=COALESCE($6,notes), updated_at=NOW()
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      b.title ?? null, b.status ?? null, b.assignee ?? null, b.doc_id ?? null, b.due_date ?? null, b.notes ?? null,
      String(req.query.id), user.id);
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    return res.status(200).json(rows[0]);
  } catch (error: unknown) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Task update failed' });
  }
}
