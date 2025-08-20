// lib/session.ts
import { IronSessionData, SessionOptions, getIronSession } from 'iron-session'; // Import getIronSession directly
import {
  GetServerSidePropsContext,
  NextApiRequest, // Import NextApiRequest
  NextApiResponse, // Import NextApiResponse
} from 'next';

// Ensure environment variables are set
if (!process.env.SESSION_SECRET) {
  throw new Error(
    'SESSION_SECRET environment variable is not set. Please generate a strong secret (at least 32 characters).'
  );
}
if (!process.env.SESSION_COOKIE_NAME) {
  throw new Error(
    'SESSION_COOKIE_NAME environment variable is not set (e.g., "wedding_app_admin_session").'
  );
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: process.env.SESSION_COOKIE_NAME as string,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production', // Cookie only sent over HTTPS in production
    httpOnly: true, // Prevents client-side JavaScript from accessing the cookie
    sameSite: 'lax', // CSRF protection
    maxAge: 60 * 60 * 24 * 7, // Session duration: 7 days (in seconds)
    // path: '/', // Default is root path
  },
};

// This is where we specify the typings of req.session.*
declare module 'iron-session' {
  interface IronSessionData {
    admin?: {
      id: string;
      email: string;
      isLoggedIn: true;
    };
  }
}

// Helper to get the session in API routes
export function getAdminIronSession(req: NextApiRequest, res: NextApiResponse) {
  return getIronSession<IronSessionData>(req, res, sessionOptions);
}

// Helper to get the session in SSR page props
export function getAdminIronSessionSsr(context: GetServerSidePropsContext) {
  return getIronSession<IronSessionData>(
    context.req,
    context.res,
    sessionOptions
  );
}