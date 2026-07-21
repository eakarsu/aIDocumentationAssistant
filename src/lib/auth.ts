import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextApiRequest } from 'next';
import prisma from './prisma';

const TOKEN_EXPIRY = '24h';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32 || /fallback|default|change|replace|example|your[-_ ]?secret/i.test(secret)) {
    throw new Error('JWT_SECRET must be a non-placeholder secret of at least 32 bytes');
  }
  return secret;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_EXPIRY, algorithm: 'HS256' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as TokenPayload;
  } catch {
    return null;
  }
}

export async function getTenantContext(req: NextApiRequest, userId: string) {
  const requested = req.headers['x-tenant-id'];
  const requestedTenantId = Array.isArray(requested) ? requested[0] : requested;
  const memberships = await prisma.tenantMembership.findMany({
    where: {
      userId,
      ...(requestedTenantId ? { tenantId: requestedTenantId } : {}),
    },
    select: { tenantId: true, role: true },
    take: requestedTenantId ? 1 : 2,
  });
  if (!memberships.length) return null;
  if (!requestedTenantId && memberships.length !== 1) return null;
  return memberships[0];
}

export function getTokenFromRequest(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Also check cookies
  const cookieToken = req.cookies?.token;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

export async function getCurrentUser(req: NextApiRequest) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      specialty: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

export async function createAuditLog(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  oldValues?: object | null,
  newValues?: object | null,
  req?: NextApiRequest
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action: action as any,
      entityType,
      entityId,
      oldValues: oldValues || undefined,
      newValues: newValues || undefined,
      ipAddress: req?.socket?.remoteAddress || null,
      userAgent: req?.headers['user-agent'] || null,
    },
  });
}

export function requireAuth(handler: Function) {
  return async (req: NextApiRequest, res: any) => {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = user;
    return handler(req, res);
  };
}

export function requireRole(roles: string[]) {
  return (handler: Function) => {
    return async (req: NextApiRequest, res: any) => {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!roles.includes(user.role)) {
        await createAuditLog(user.id, 'ACCESS_DENIED', 'API', req.url || '', null, null, req);
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.user = user;
      return handler(req, res);
    };
  };
}

// Extend NextApiRequest to include user
declare module 'next' {
  interface NextApiRequest {
    user?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      specialty: string | null;
      isActive: boolean;
    };
  }
}
