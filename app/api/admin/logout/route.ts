// app/api/admin/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { IronSession, getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const session = await getIronSession<IronSession<any>>(await cookies(), sessionOptions);
  
  session.destroy(); // Destroys the session data and removes the cookie

  // It's good practice to ensure the session is actually saved/cleared.
  // Depending on iron-session version and how it interacts with `cookies()`,
  // an explicit save after destroy might be redundant but doesn't hurt.
  await session.save(); 

  return NextResponse.json({ message: 'Logout successful' }, { status: 200 });
}