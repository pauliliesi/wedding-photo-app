// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession, IronSession } from 'iron-session';
import { sessionOptions } from './lib/session';
import { cookies } from 'next/headers';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect the Admin Dashboard route
  if (pathname === '/dashboard') {
    const session = await getIronSession<IronSession<any>>(await cookies(), sessionOptions);

    if (!session.admin?.isLoggedIn) {
      // If not logged in, redirect to the login page.
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Continue to the requested page if no redirection is needed.
  return NextResponse.next();
}

// Matcher to run the middleware ONLY on the paths that need it.
export const config = {
  matcher: [
    '/dashboard/:path*', // Protects /dashboard and any potential sub-paths
    '/login', // Run on login to potentially redirect logged-in users away later
  ],
};