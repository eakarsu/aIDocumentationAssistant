import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import { Octokit } from '@octokit/rest';
import crypto from 'crypto';

const SUPPORTED_LANGS: Record<string, string> = {
  '.js': 'js', '.jsx': 'js', '.ts': 'ts', '.tsx': 'ts',
  '.py': 'py', '.go': 'go', '.rs': 'rust', '.java': 'java',
  '.rb': 'rb', '.php': 'php', '.cs': 'cs', '.cpp': 'cpp', '.c': 'c',
  '.md': 'md', '.mdx': 'md',
};

function detectLanguage(filePath: string): string | null {
  const i = filePath.lastIndexOf('.');
  if (i === -1) return null;
  return SUPPORTED_LANGS[filePath.substring(i).toLowerCase()] || null;
}

interface ParsedSummary {
  functions: { name: string; signature: string; comment: string }[];
  classes: { name: string; comment: string }[];
  interfaces: { name: string; comment: string }[];
  exports: { name: string }[];
  imports: { module: string }[];
  comments: string[];
}

function quickParse(source: string): ParsedSummary {
  const out: ParsedSummary = { functions: [], classes: [], interfaces: [], exports: [], imports: [], comments: [] };

  const fnRe = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g;
  for (const m of source.matchAll(fnRe)) {
    out.functions.push({ name: m[1], signature: `(${m[2]})`, comment: '' });
  }

  const arrowRe = /(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g;
  for (const m of source.matchAll(arrowRe)) {
    out.functions.push({ name: m[1], signature: `(${m[2]})`, comment: '' });
  }

  const classRe = /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g;
  for (const m of source.matchAll(classRe)) {
    out.classes.push({ name: m[1], comment: '' });
  }

  const ifaceRe = /(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/g;
  for (const m of source.matchAll(ifaceRe)) {
    out.interfaces.push({ name: m[1], comment: '' });
  }

  const importRe = /import\s+[^;]*?from\s+['"]([^'"]+)['"]/g;
  for (const m of source.matchAll(importRe)) {
    out.imports.push({ module: m[1] });
  }

  const exportRe = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const m of source.matchAll(exportRe)) {
    out.exports.push({ name: m[1] });
  }

  // Top-level block comments
  const commentRe = /\/\*\*([\s\S]*?)\*\//g;
  for (const m of source.matchAll(commentRe)) {
    const c = m[1].trim().substring(0, 500);
    out.comments.push(c);
  }

  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  try {
    const repository = await prisma.repository.findUnique({
      where: { id: id as string },
    });

    if (!repository) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Check access
    if (user.role !== 'ADMIN' && repository.createdById !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!repository.accessToken) {
      return res.status(400).json({ error: 'Repository has no access token configured' });
    }

    if (repository.provider !== 'GITHUB') {
      return res.status(400).json({ error: `Sync currently supports GITHUB only; got ${repository.provider}` });
    }

    const [owner, repo] = repository.fullName.split('/');
    if (!owner || !repo) {
      return res.status(400).json({ error: 'Invalid repository fullName; expected owner/repo' });
    }

    const octokit = new Octokit({ auth: repository.accessToken });

    // Get default branch tip and recursive tree
    const branchInfo = await octokit.repos.getBranch({ owner, repo, branch: repository.branch || 'main' });
    const treeSha = branchInfo.data.commit.sha;

    const tree = await octokit.git.getTree({ owner, repo, tree_sha: treeSha, recursive: 'true' });

    const syncPaths = (repository.syncPaths as string[] | null) || [];
    const candidates = (tree.data.tree || []).filter((node) => {
      if (node.type !== 'blob' || !node.path) return false;
      if (!detectLanguage(node.path)) return false;
      if (syncPaths.length > 0 && !syncPaths.some((p) => node.path!.startsWith(p))) return false;
      // sanity: skip files larger than 200KB to keep sync fast
      if (typeof node.size === 'number' && node.size > 200_000) return false;
      return true;
    }).slice(0, 50); // cap per-sync to 50 files

    let parsed = 0;
    let skipped = 0;
    let errors = 0;

    for (const node of candidates) {
      try {
        const content = await octokit.repos.getContent({ owner, repo, path: node.path!, ref: treeSha });
        // @ts-ignore
        if (content.data.encoding !== 'base64' || !content.data.content) { skipped++; continue; }
        // @ts-ignore
        const source = Buffer.from(content.data.content, 'base64').toString('utf-8');
        const fileHash = crypto.createHash('sha256').update(source).digest('hex');

        const existing = await prisma.parsedCodeFile.findUnique({
          where: { repositoryId_filePath: { repositoryId: repository.id, filePath: node.path! } },
        });
        if (existing && existing.fileHash === fileHash) { skipped++; continue; }

        const lang = detectLanguage(node.path!) || 'txt';
        const parsedOut = quickParse(source);

        await prisma.parsedCodeFile.upsert({
          where: { repositoryId_filePath: { repositoryId: repository.id, filePath: node.path! } },
          update: {
            language: lang,
            functions: parsedOut.functions,
            classes: parsedOut.classes,
            interfaces: parsedOut.interfaces,
            exports: parsedOut.exports,
            imports: parsedOut.imports,
            comments: parsedOut.comments,
            fileHash,
            lineCount: source.split('\n').length,
            updatedAt: new Date(),
          },
          create: {
            repositoryId: repository.id,
            filePath: node.path!,
            language: lang,
            functions: parsedOut.functions,
            classes: parsedOut.classes,
            interfaces: parsedOut.interfaces,
            exports: parsedOut.exports,
            imports: parsedOut.imports,
            comments: parsedOut.comments,
            fileHash,
            lineCount: source.split('\n').length,
          },
        });
        parsed++;
      } catch (e) {
        errors++;
      }
    }

    await prisma.repository.update({
      where: { id: id as string },
      data: {
        lastSyncAt: new Date(),
        lastCommitSha: treeSha,
      },
    });

    await createAuditLog(user.id, 'UPDATE', 'Repository', id as string, null, { action: 'sync_completed', parsed, skipped, errors }, req);

    res.status(200).json({
      message: 'Sync completed',
      repositoryId: id,
      status: 'COMPLETED',
      stats: { totalCandidates: candidates.length, parsed, skipped, errors },
      lastCommitSha: treeSha,
    });
  } catch (error: any) {
    console.error('Sync repository error:', error);
    res.status(500).json({ error: 'Sync failed', message: error?.message || 'Internal server error' });
  }
}
