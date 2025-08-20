// app/api/gallery/guests/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    // We want to fetch guests who have at least one photo.
    // We also want to count the number of photos for each guest.
    // And ensure ANONYMOUS is always first if it exists and has photos.

    // RPC (Remote Procedure Call - a database function) might be more efficient for complex ordering later,
    // but let's start with a query.

    const { data, error } = await supabase
      .from('guests')
      .select(`
        id,
        full_name,
        is_anonymous,
        photos ( count )
      `)
      .order('is_anonymous', { ascending: false }) // ANONYMOUS (true) comes before non-anonymous (false)
      .order('full_name', { ascending: true, nullsFirst: false }); // Then order by full_name

    if (error) {
      console.error('Error fetching guests with photo counts:', error);
      throw error;
    }

    // Filter out guests with no photos and format the data
    const guestsWithPhotos = data
      .map(guest => ({
        id: guest.id,
        fullName: guest.full_name,
        isAnonymous: guest.is_anonymous,
        // The count is an array with one object like [{ count: 5 }], so access it directly
        photoCount: guest.photos && guest.photos.length > 0 ? (guest.photos[0] as any).count : 0,
      }))
      .filter(guest => guest.photoCount > 0);

    return NextResponse.json(guestsWithPhotos);

  } catch (error) {
    console.error('API error fetching guests:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: `Failed to fetch guests: ${errorMessage}` }, { status: 500 });
  }
}