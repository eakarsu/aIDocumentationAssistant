import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getCurrentUser, createAuditLog } from '@/lib/auth';
import * as parser from 'comment-parser';

interface ParsedFunction {
  name: string;
  description: string;
  params: Array<{
    name: string;
    type: string;
    description: string;
    optional: boolean;
    default?: string;
  }>;
  returns?: {
    type: string;
    description: string;
  };
  examples: string[];
  deprecated?: string;
  since?: string;
  tags: Record<string, string>;
}

function parseJSDoc(content: string): ParsedFunction[] {
  const parsed = parser.parse(content);
  const functions: ParsedFunction[] = [];

  for (const block of parsed) {
    const func: ParsedFunction = {
      name: '',
      description: block.description,
      params: [],
      examples: [],
      tags: {},
    };

    for (const tag of block.tags) {
      switch (tag.tag) {
        case 'function':
        case 'method':
        case 'name':
          func.name = tag.name || tag.description;
          break;
        case 'param':
          func.params.push({
            name: tag.name,
            type: tag.type,
            description: tag.description,
            optional: tag.optional || false,
            default: tag.default,
          });
          break;
        case 'returns':
        case 'return':
          func.returns = {
            type: tag.type,
            description: tag.description,
          };
          break;
        case 'example':
          func.examples.push(tag.description);
          break;
        case 'deprecated':
          func.deprecated = tag.description || 'true';
          break;
        case 'since':
          func.since = tag.description;
          break;
        default:
          func.tags[tag.tag] = tag.description;
      }
    }

    if (func.name || func.description) {
      functions.push(func);
    }
  }

  return functions;
}

function generateMarkdown(functions: ParsedFunction[]): string {
  let markdown = '';

  for (const func of functions) {
    if (func.name) {
      markdown += `## ${func.name}\n\n`;
    }

    if (func.deprecated) {
      markdown += `> **Deprecated**: ${func.deprecated}\n\n`;
    }

    if (func.description) {
      markdown += `${func.description}\n\n`;
    }

    if (func.params.length > 0) {
      markdown += `### Parameters\n\n`;
      markdown += `| Name | Type | Description |\n`;
      markdown += `|------|------|-------------|\n`;
      for (const param of func.params) {
        const optional = param.optional ? ' (optional)' : '';
        const defaultVal = param.default ? ` = \`${param.default}\`` : '';
        markdown += `| \`${param.name}\`${optional} | \`${param.type}\` | ${param.description}${defaultVal} |\n`;
      }
      markdown += '\n';
    }

    if (func.returns) {
      markdown += `### Returns\n\n`;
      markdown += `\`${func.returns.type}\` - ${func.returns.description}\n\n`;
    }

    if (func.examples.length > 0) {
      markdown += `### Examples\n\n`;
      for (const example of func.examples) {
        markdown += `\`\`\`javascript\n${example}\n\`\`\`\n\n`;
      }
    }

    if (func.since) {
      markdown += `*Since: ${func.since}*\n\n`;
    }

    markdown += '---\n\n';
  }

  return markdown;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { content, language = 'javascript', filePath, repositoryId } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Parse JSDoc comments
    const functions = parseJSDoc(content);

    // Generate markdown documentation
    const markdown = generateMarkdown(functions);

    // If repositoryId provided, store parsed data
    if (repositoryId && filePath) {
      const repository = await prisma.repository.findUnique({
        where: { id: repositoryId },
      });

      if (repository && (user.role === 'ADMIN' || repository.createdById === user.id)) {
        const fileHash = require('crypto')
          .createHash('md5')
          .update(content)
          .digest('hex');

        await prisma.parsedCodeFile.upsert({
          where: {
            repositoryId_filePath: {
              repositoryId,
              filePath,
            },
          },
          create: {
            repositoryId,
            filePath,
            language,
            functions: JSON.parse(JSON.stringify(functions)),
            fileHash,
            lineCount: content.split('\n').length,
          },
          update: {
            functions: JSON.parse(JSON.stringify(functions)),
            fileHash,
            lineCount: content.split('\n').length,
            updatedAt: new Date(),
          },
        });
      }
    }

    await createAuditLog(user.id, 'CREATE', 'ParsedCodeFile', 'parse', null, { filePath, functionCount: functions.length }, req);

    res.status(200).json({
      functions,
      markdown,
      stats: {
        totalFunctions: functions.length,
        totalParams: functions.reduce((acc, f) => acc + f.params.length, 0),
        hasExamples: functions.filter(f => f.examples.length > 0).length,
        deprecated: functions.filter(f => f.deprecated).length,
      },
    });
  } catch (error) {
    console.error('Parse JSDoc error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
