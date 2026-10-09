import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'parksmart-jwt-secret-secure-key-2026'
);

const COOKIE_NAME = 'parksmart_session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  let session: { userId: string; role: 'ADMIN' | 'STAFF'; parkingAreaId: string } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      session = payload as any;
    } catch {
      session = null;
    }
  }

  // 1. Protection for Admin routes (/admin, /admin/staff, etc.)
  if (pathname.startsWith('/admin')) {
    if (!session) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.role !== 'ADMIN') {
      // Staff cannot access admin settings - redirect to staff terminal
      return NextResponse.redirect(new URL('/staff', req.url));
    }
    return NextResponse.next();
  }

  // 2. Protection for Staff routes (/staff, /staff/*)
  if (pathname.startsWith('/staff')) {
    if (!session) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // Both ADMIN and STAFF can view staff terminal
    return NextResponse.next();
  }

  // 3. If already logged in, redirect away from /login and /register
  if (pathname === '/login' || pathname === '/register') {
    if (session) {
      if (session.role === 'ADMIN') {
        return NextResponse.redirect(new URL('/admin', req.url));
      } else if (session.role === 'STAFF') {
        return NextResponse.redirect(new URL('/staff', req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*', '/login', '/register'],
};
