import { NextResponse } from 'next/server';
import { getUserIdFromRequest } from './lib/session';

export const runtime = 'nodejs';

export function middleware(req) {
  const userId = getUserIdFromRequest(req);
  const onLogin = req.nextUrl.pathname.startsWith('/login');
  if (!userId && !onLogin) return NextResponse.redirect(new URL('/login', req.url));
  if (userId && onLogin) return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
