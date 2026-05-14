import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS middleware: only allows origins listed in CORS_ORIGINS env var (comma-separated).
 * If env var is unset, falls back to NEXT_PUBLIC_APP_URL or http://localhost:3000.
 * Wildcard "*" is supported but discouraged.
 */
export function middleware(request: NextRequest) {
  const allowed = (process.env.CORS_ORIGINS || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const origin = request.headers.get('origin');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  if (!isApiRoute) return NextResponse.next();

  const matched = origin && (allowed.includes('*') || allowed.includes(origin));

  // Preflight
  if (request.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 });
    if (matched) {
      res.headers.set('Access-Control-Allow-Origin', origin!);
      res.headers.set('Access-Control-Allow-Credentials', 'true');
      res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.headers.set('Access-Control-Allow-Headers', request.headers.get('access-control-request-headers') || 'Content-Type, Authorization');
      res.headers.set('Access-Control-Max-Age', '86400');
    }
    return res;
  }

  const res = NextResponse.next();
  if (matched) {
    res.headers.set('Access-Control-Allow-Origin', origin!);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Vary', 'Origin');
  }
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
