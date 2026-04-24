import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';

function escapeCsvField(field: any): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: any[][]): string {
  const headerLine = headers.map(escapeCsvField).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(','));
  return [headerLine, ...dataLines].join('\n');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type } = req.query;

  try {
    let csvContent = '';
    let filename = '';

    switch (type) {
      case 'notes': {
        const notes = await prisma.note.findMany({
          where: user.role !== 'ADMIN' ? { authorId: user.id } : undefined,
          orderBy: { createdAt: 'desc' },
        });
        const headers = ['ID', 'Patient Name', 'Patient ID', 'Note Type', 'Status', 'Author ID', 'Encounter Date', 'Created At'];
        const rows = notes.map((n) => [n.id, n.patientName, n.patientId, n.noteType, n.status, n.authorId, n.encounterDate.toISOString(), n.createdAt.toISOString()]);
        csvContent = toCsv(headers, rows);
        filename = 'notes_export.csv';
        break;
      }
      case 'users': {
        if (user.role !== 'ADMIN') {
          return res.status(403).json({ error: 'Only admins can export user data' });
        }
        const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
        const headers = ['ID', 'Email', 'First Name', 'Last Name', 'Role', 'Specialty', 'Active', 'Created At'];
        const rows = users.map((u) => [u.id, u.email, u.firstName, u.lastName, u.role, u.specialty || '', u.isActive ? 'Yes' : 'No', u.createdAt.toISOString()]);
        csvContent = toCsv(headers, rows);
        filename = 'users_export.csv';
        break;
      }
      case 'audit-logs': {
        if (user.role !== 'ADMIN' && user.role !== 'AUDITOR') {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        const logs = await prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 1000 });
        const headers = ['ID', 'User ID', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Timestamp'];
        const rows = logs.map((l) => [l.id, l.userId || '', l.action, l.entityType, l.entityId, l.ipAddress || '', l.timestamp.toISOString()]);
        csvContent = toCsv(headers, rows);
        filename = 'audit_logs_export.csv';
        break;
      }
      case 'recordings': {
        const recordings = await prisma.recording.findMany({
          where: user.role !== 'ADMIN' ? { userId: user.id } : undefined,
          orderBy: { createdAt: 'desc' },
        });
        const headers = ['ID', 'User ID', 'Type', 'Status', 'File Name', 'Duration (s)', 'Recorded At'];
        const rows = recordings.map((r) => [r.id, r.userId, r.type, r.status, r.fileName, r.duration || '', r.recordedAt.toISOString()]);
        csvContent = toCsv(headers, rows);
        filename = 'recordings_export.csv';
        break;
      }
      case 'docs': {
        const docs = await prisma.doc.findMany({
          where: user.role !== 'ADMIN' ? { authorId: user.id } : undefined,
          orderBy: { createdAt: 'desc' },
        });
        const headers = ['ID', 'Title', 'Status', 'Visibility', 'Author ID', 'Word Count', 'Created At'];
        const rows = docs.map((d) => [d.id, d.title, d.status, d.visibility, d.authorId, d.wordCount || '', d.createdAt.toISOString()]);
        csvContent = toCsv(headers, rows);
        filename = 'docs_export.csv';
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid export type. Use: notes, users, audit-logs, recordings, docs' });
    }

    await createAuditLog(user.id, 'EXPORT', type as string, 'csv-export', null, { type, recordCount: csvContent.split('\n').length - 1 }, req);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
}
