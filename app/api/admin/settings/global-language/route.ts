// app/api/admin/settings/global-language/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { IronSession, getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';

const LANGUAGE_SETTING_KEY = 'global_language';

// GET current global language
export async function GET(request: NextRequest) {
  const session = await getIronSession<IronSession<any>>(await cookies(), sessionOptions);
  if (!session.admin?.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', LANGUAGE_SETTING_KEY)
      .maybeSingle(); // Use maybeSingle as the setting might not exist yet

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found, which is okay here
      console.error('Error fetching language setting:', error);
      throw error;
    }

    if (!data || !data.setting_value) {
      // If not found, we can return a default or indicate it's not set
      return NextResponse.json({ value: 'ro' }, { status: 200 }); // Default to 'ro' if not set
    }

    return NextResponse.json({ value: data.setting_value });
  } catch (error) {
    console.error('API error fetching language setting:', error);
    return NextResponse.json({ error: 'Failed to fetch language setting.' }, { status: 500 });
  }
}

// PUT (update) global language
export async function PUT(request: NextRequest) {
  const session = await getIronSession<IronSession<any>>(await cookies(), sessionOptions);
  if (!session.admin?.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { language } = await request.json();
    if (!language || !['ro', 'en'].includes(language)) {
      return NextResponse.json({ error: 'Invalid language value. Must be "en" or "ro".' }, { status: 400 });
    }

    // Upsert the setting: update if exists, insert if not
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { setting_key: LANGUAGE_SETTING_KEY, setting_value: language },
        { onConflict: 'setting_key' } // If setting_key conflicts, it will update
      );

    if (error) {
      console.error('Error updating language setting:', error);
      throw error;
    }

    return NextResponse.json({ message: `Global language updated to ${language}.` });
  } catch (error) {
    console.error('API error updating language setting:', error);
    return NextResponse.json({ error: 'Failed to update language setting.' }, { status: 500 });
  }
}