import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

try {
  const email = String(process.env.DEMO_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.DEMO_PASSWORD || '');
  if (!email || password.length < 12) throw new Error('Local demo credentials are incomplete');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) throw new Error('Local demo administrator is not seeded; run the reviewed seed task first');

  await prisma.user.update({
    where: { email },
    data: { password: await bcrypt.hash(password, 10), isActive: true },
  });
  console.log('Provisioned local demo administrator.');
} finally {
  await prisma.$disconnect();
}
