import { NextRequest, NextResponse } from 'next/server';

const WINDOW_MS = 60_000; 
const MAX_REQUESTS = 120; 
const buckets = new Map<string, { count: number; resetAt: number }>(); 
const CLEANUP_INTERVAL = 5 * 60 * 1000;

let lastCleanup = Date.now();

function cleanupExpiredBuckets() { 
  const now = Date.now(); 
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  let removed = 0; 
  for (const [ip, bucket] of buckets.entries()) { 
    if (bucket.resetAt <= now) { 
      buckets.delete(ip); 
      removed++; 
    } 
  }

  lastCleanup = now; 
  console.log(`[RateLimit] Cleaned ${removed} expired buckets. Active: ${buckets.size}`); 
}

function getClientIp(request: NextRequest) { 
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')?.trim(); 
  const realIp = request.headers.get('x-real-ip')?.trim(); 
  return forwardedFor || realIp || 'unknown'; 
}

function rateLimit(ip: string) { 
  const now = Date.now(); 
  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt <= now) { 
    const resetAt = now + WINDOW_MS; 
    buckets.set(ip, { count: 1, resetAt }); 
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt }; 
  }

  bucket.count += 1; 
  return { 
    allowed: bucket.count <= MAX_REQUESTS, 
    remaining: Math.max(0, MAX_REQUESTS - bucket.count), 
    resetAt: bucket.resetAt, 
  }; 
}

export function middleware(request: NextRequest) { 
  cleanupExpiredBuckets();

  const ip = getClientIp(request); 
  const result = rateLimit(ip); 
  const resetSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);

  if (!result.allowed) { 
    return NextResponse.json( 
      { error: 'Too many requests. Please slow down and try again shortly.' }, 
      { 
        status: 429, 
        headers: { 
          'Retry-After': String(resetSeconds), 
          'X-RateLimit-Limit': String(MAX_REQUESTS), 
          'X-RateLimit-Remaining': '0', 
          'X-RateLimit-Reset': String(result.resetAt), 
        }, 
      }, 
    ); 
  }

  const response = NextResponse.next(); 
  response.headers.set('X-RateLimit-Limit', String(MAX_REQUESTS)); 
  response.headers.set('X-RateLimit-Remaining', String(result.remaining)); 
  response.headers.set('X-RateLimit-Reset', String(result.resetAt)); 
  return response; 
}

export const config = { 
  matcher: '/api/:path*', 
};
