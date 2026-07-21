import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { verifyPassword, generateToken, createAuditLog } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      await createAuditLog(null, 'LOGIN', 'User', email, null, { success: false }, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      await createAuditLog(user.id, 'LOGIN', 'User', user.id, null, { success: false }, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        ipAddress: req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
      },
    });

    await createAuditLog(user.id, 'LOGIN', 'User', user.id, null, { success: true }, req);

    const memberships = await prisma.tenantMembership.findMany({
      where: { userId: user.id },
      select: { tenantId: true, role: true, tenant: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'asc' },
    });

    res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        specialty: user.specialty,
      },
      memberships,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
