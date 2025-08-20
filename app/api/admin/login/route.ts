// app/api/admin/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs'; // For comparing passwords
import { IronSession, getIronSession } from 'iron-session'; // Using getIronSession for Route Handlers
import { sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers'; // For Route Handlers

export async function POST(request: NextRequest) {
  const res = new NextResponse(); // Needed for getIronSession to potentially set cookies on it
  const session = await getIronSession<IronSession<any>>(await cookies(), sessionOptions);

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    // Fetch admin user by email
    const { data: adminUser, error: dbError } = await supabase
      .from('admin_users')
      .select('id, email, password_hash')
      .eq('email', email)
      .single(); // Expect only one admin with this email

    if (dbError || !adminUser) {
      console.error('Admin user fetch error or not found:', dbError);
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Verify password
    const passwordIsValid = await bcrypt.compare(password, adminUser.password_hash);

    if (!passwordIsValid) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Password is valid, set up session
    session.admin = {
      id: adminUser.id,
      email: adminUser.email,
      isLoggedIn: true,
    };
    await session.save(); // Save the session data into the cookie

    // Use NextResponse to send response, iron-session under Route Handlers might rely on this
    // if it needs to set a cookie directly (though usually it works with cookies() from 'next/headers')
    const responseWithCookie = NextResponse.json({ message: 'Login successful' }, { status: 200 });
    
    // Manually append set-cookie header from session if needed (often iron-session handles this with `cookies()`)
    // This part can be tricky with Route Handlers vs Pages API.
    // getIronSession with `cookies()` from `next/headers` should handle cookie setting.

    return responseWithCookie;

  } catch (error) {
    console.error('Admin login API error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}