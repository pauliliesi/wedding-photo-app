// app/api/admin/all-photos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { IronSession, getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';

// Define a type for album objects within the albums array
interface AlbumInfo {
  album_name: string | null; // Album name might be null or a string
}

// Define a type for guest objects within the guests array
interface GuestInfo {
  full_name: string | null;
  is_anonymous: boolean;
}

// Define a type for the photo object as returned by Supabase
interface PhotoFromSupabase {
  id: number; // Or string/any, depending on your schema
  storage_path: string;
  description: string | null;
  file_name: string;
  uploaded_at: string; // Consider using Date if you parse it
  mimetype: string;
  size_kb: number;
  album_id: number | null;
  albums: AlbumInfo[]; // CORRECTED: albums is an array of AlbumInfo objects
  guest_id: number | null;
  guests: GuestInfo[]; // guests is also an array
}

const PHOTOS_PER_PAGE_ADMIN = 30;

export async function GET(request: NextRequest) {
  const session = await getIronSession<IronSession<any>>(await cookies(), sessionOptions);

  if (!session.admin?.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);

  try {
    const from = (page - 1) * PHOTOS_PER_PAGE_ADMIN;
    const to = from + PHOTOS_PER_PAGE_ADMIN - 1;

    // Fetch data from Supabase
    const { data, error } = await supabase
      .from('photos')
      .select(`
        id,
        storage_path,
        description,
        file_name,
        uploaded_at,
        mimetype,
        size_kb,
        album_id,
        albums ( album_name ), 
        guest_id,
        guests ( full_name, is_anonymous )
      `)
      .order('uploaded_at', { ascending: false })
      .range(from, to); // ADAUGAT: Limitează rezultatele la pagina curentă

    if (error) {
      console.error('Error fetching all photos for admin:', error);
      throw error;
    }

    // Type assertion for the fetched data. If data is null, default to an empty array.
    const photos: PhotoFromSupabase[] = (data as PhotoFromSupabase[]) || [];

    const photosWithUrls = photos.map(photo => {
      const { data: publicUrlData } = supabase.storage
        .from('wedding-photos') // Your bucket name
        .getPublicUrl(photo.storage_path);

      // Determine album_name by checking the albums array
      let determined_album_name: string | null = null;
      if (photo.albums && photo.albums.length > 0) {
        const firstAlbum = photo.albums[0]; // Access the first album from the array
        // Check if firstAlbum itself and its album_name property exist
        if (firstAlbum && typeof firstAlbum.album_name === 'string') {
          determined_album_name = firstAlbum.album_name;
        }
      }

      // Determine guest_name by checking the guests array
      let guest_display_name: string = 'Unknown Guest';
      if (photo.guests && photo.guests.length > 0) {
        const firstGuest = photo.guests[0]; // Access the first guest from the array
        if (firstGuest.full_name) {
          guest_display_name = firstGuest.full_name;
        } else if (firstGuest.is_anonymous) {
          guest_display_name = 'ANONIM';
        }
      }

      return {
        ...photo,
        album_name: determined_album_name,
        guest_name: guest_display_name,
        publicUrl: publicUrlData?.publicUrl || null,
      };
    });

    return NextResponse.json({
      photos: photosWithUrls,
      hasNextPage: photosWithUrls.length === PHOTOS_PER_PAGE_ADMIN
    });

  } catch (error) {
    console.error('API error fetching all photos:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: `Failed to fetch photos: ${errorMessage}` }, { status: 500 });
  }
}