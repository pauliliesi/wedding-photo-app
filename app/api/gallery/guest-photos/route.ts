// app/api/gallery/guest-photos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const ANONYMOUS_GUEST_ID = '00000000-0000-0000-0000-000000000000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const guestIdentifier = searchParams.get('identifier');
  
  if (!guestIdentifier) {
    return NextResponse.json({ error: 'Identificatorul invitatului este necesar' }, { status: 400 });
  }

  try {
    let guestId: string | null = null;
    
    // Identifică ID-ul invitatului (neschimbat)
    if (guestIdentifier.toLowerCase() === 'anonymous') {
      guestId = ANONYMOUS_GUEST_ID;
    } else {
      const { data: namedGuest } = await supabase.from('guests').select('id').eq('full_name', guestIdentifier).eq('is_anonymous', false).maybeSingle();
      if (!namedGuest) return NextResponse.json({ error: 'Invitat negăsit' }, { status: 404 });
      guestId = namedGuest.id;
    }
    if (!guestId) return NextResponse.json({ error: 'Invitatul nu a putut fi identificat' }, { status: 404 });

    // --- ÎNCĂRCAREA DATELOR INIȚIALE ---
    
    // 1. Fetch detalii invitat
    const { data: guestDetails } = await supabase.from('guests').select('id, full_name, is_anonymous').eq('id', guestId).single();

    // 2. Fetch albume (neschimbat)
    const { data: albums } = await supabase.from('albums').select('id, album_name, created_at').eq('guest_id', guestId).order('album_name');
    
    // 3. Fetch thumbnails pentru albume (neschimbat)
    const albumsWithThumbnails = await Promise.all(
        (albums || []).map(async (album) => {
            const { data: albumPhotos } = await supabase.from('photos').select('id, storage_path').eq('album_id', album.id).order('uploaded_at').limit(4);
            const thumbnails = (albumPhotos || []).map(p => ({ id: p.id, publicUrl: supabase.storage.from('wedding-photos').getPublicUrl(p.storage_path).data.publicUrl }));
            return { ...album, thumbnails };
        })
    );

    // 4. Fetch TOATE pozele pentru acest invitat (MODIFICARE AICI)
    const { data: allPhotos, error: photosError } = await supabase
      .from('photos')
      .select('id, album_id, storage_path, description, uploaded_at, file_name, mimetype')
      .eq('guest_id', guestId) // Filtrează după invitat
      // AM SCOS: .is('album_id', null) și .range()
      .order('uploaded_at', { ascending: false });

    if (photosError) throw photosError;

    const photosWithUrls = (allPhotos || []).map(photo => ({
      ...photo,
      publicUrl: supabase.storage.from('wedding-photos').getPublicUrl(photo.storage_path).data.publicUrl,
    }));

    // Returnează pachetul complet
    return NextResponse.json({
      guest: guestDetails,
      albums: albumsWithThumbnails,
      photos: photosWithUrls, // Acum conține TOATE pozele
    });

  } catch (error) {
    console.error('Eroare API la fetch-ul pozelor invitatului:', error);
    const errorMessage = error instanceof Error ? error.message : 'A apărut o eroare.';
    return NextResponse.json({ error: `Nu s-au putut încărca datele: ${errorMessage}` }, { status: 500 });
  }
}