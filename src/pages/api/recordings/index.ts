import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

const uploadDir = path.join(process.cwd(), 'uploads', 'recordings');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { noteId, type, status, page = '1', limit = '20' } = req.query;
      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

      const where: any = { userId: user.id };

      if (noteId) where.noteId = noteId;
      if (type) where.type = type;
      if (status) where.status = status;

      const [recordings, total] = await Promise.all([
        prisma.recording.findMany({
          where,
          include: {
            note: {
              select: {
                id: true,
                patientName: true,
                encounterDate: true,
              },
            },
          },
          skip,
          take: parseInt(limit as string),
          orderBy: { recordedAt: 'desc' },
        }),
        prisma.recording.count({ where }),
      ]);

      res.status(200).json({
        recordings,
        pagination: {
          total,
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          totalPages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error('Get recordings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'POST') {
    try {
      const form = formidable({
        uploadDir,
        keepExtensions: true,
        maxFileSize: 500 * 1024 * 1024, // 500MB
      });

      const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          else resolve([fields, files]);
        });
      });

      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const noteId = Array.isArray(fields.noteId) ? fields.noteId[0] : fields.noteId;
      const type = (Array.isArray(fields.type) ? fields.type[0] : fields.type) || 'AUDIO';

      const recording = await prisma.recording.create({
        data: {
          noteId: noteId || null,
          userId: user.id,
          type: type as any,
          status: 'PROCESSING',
          fileName: file.originalFilename || 'recording',
          filePath: file.filepath,
          fileSize: file.size,
          mimeType: file.mimetype || 'audio/webm',
          recordedAt: new Date(),
        },
      });

      await createAuditLog(user.id, 'CREATE', 'Recording', recording.id, null, { fileName: recording.fileName }, req);

      res.status(201).json(recording);
    } catch (error) {
      console.error('Upload recording error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
