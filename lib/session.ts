// lib/session.ts
import { SessionOptions } from 'iron-session';

// 1. Asigură-te că variabilele de mediu există
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is not set.');
}
if (!process.env.SESSION_COOKIE_NAME) {
  throw new Error('SESSION_COOKIE_NAME environment variable is not set.');
}

// 2. Exportă opțiunile de sesiune
export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET,
  cookieName: process.env.SESSION_COOKIE_NAME,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 zile
  },
};

// 3. Exportă interfața pentru datele sesiunii
//    Acesta este tipul pe care îl vom importa în API-urile noastre.
export interface AppSessionData {
  admin?: {
    id: string;
    email: string;
    isLoggedIn: true;
  };
}

// 4. Extinde tipul global IronSessionData
//    Acest pas îi permite lui `getIronSession` să știe ce tip de date conține sesiunea.
declare module 'iron-session' {
  interface IronSessionData extends AppSessionData {}
}