import { NextApiRequest, NextApiResponse } from 'next';
import prisma from './prisma';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
};

export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const { windowMs, maxRequests } = { ...defaultConfig, ...config };

  return async function rateLimitMiddleware(
    req: NextApiRequest,
    res: NextApiResponse
  ): Promise<boolean> {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `${typeof ip === 'string' ? ip : ip[0]}:${req.url}`;

    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMs);

      // Try to find existing entry
      const existing = await prisma.rateLimitEntry.findUnique({
        where: { key },
      });

      if (existing && existing.windowStart > windowStart) {
        // Within current window
        if (existing.count >= maxRequests) {
          const retryAfter = Math.ceil(
            (existing.windowStart.getTime() + windowMs - now.getTime()) / 1000
          );
          res.setHeader('X-RateLimit-Limit', maxRequests.toString());
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Reset', new Date(existing.windowStart.getTime() + windowMs).toISOString());
          res.setHeader('Retry-After', retryAfter.toString());
          res.status(429).json({
            error: 'Too many requests. Please try again later.',
            retryAfter,
          });
          return false;
        }

        // Increment count
        await prisma.rateLimitEntry.update({
          where: { key },
          data: { count: existing.count + 1 },
        });

        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', (maxRequests - existing.count - 1).toString());
        res.setHeader('X-RateLimit-Reset', new Date(existing.windowStart.getTime() + windowMs).toISOString());
      } else {
        // New window or expired - upsert
        await prisma.rateLimitEntry.upsert({
          where: { key },
          update: {
            count: 1,
            windowStart: now,
            expiresAt: new Date(now.getTime() + windowMs),
          },
          create: {
            key,
            count: 1,
            windowStart: now,
            expiresAt: new Date(now.getTime() + windowMs),
          },
        });

        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', (maxRequests - 1).toString());
        res.setHeader('X-RateLimit-Reset', new Date(now.getTime() + windowMs).toISOString());
      }

      return true;
    } catch (error) {
      // If rate limiting fails, allow the request through
      console.error('Rate limiting error:', error);
      return true;
    }
  };
}

// Strict rate limit for auth endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 attempts per 15 min
});

// Standard rate limit for API endpoints
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
});

// Relaxed rate limit for read endpoints
export const readRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 120,
});
