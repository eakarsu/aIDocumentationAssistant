import { PrismaClient } from '@prisma/client';
import { allTemplates } from '../src/lib/docs/templates';

const prisma = new PrismaClient();

async function seedTemplates() {
  console.log('Seeding documentation templates...');

  for (const template of allTemplates) {
    const existing = await prisma.docTemplate.findFirst({
      where: {
        name: template.name,
        isSystem: true,
      },
    });

    if (existing) {
      console.log(`Template "${template.name}" already exists, updating...`);
      await prisma.docTemplate.update({
        where: { id: existing.id },
        data: {
          description: template.description,
          type: template.type as any,
          content: template.content,
        },
      });
    } else {
      console.log(`Creating template "${template.name}"...`);
      await prisma.docTemplate.create({
        data: {
          name: template.name,
          description: template.description,
          type: template.type as any,
          content: template.content,
          isSystem: true,
          isActive: true,
        },
      });
    }
  }

  console.log('Template seeding complete!');
}

seedTemplates()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
