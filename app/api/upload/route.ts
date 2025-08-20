// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const ANONYMOUS_GUEST_ID = '00000000-0000-0000-0000-000000000000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fullName = formData.get('fullName') as string | null;
    const albumName = formData.get('albumName') as string | null;
    const description = formData.get('description') as string | null;
    const photoFile = formData.get('photo') as File | null;

    if (!photoFile) {
      return NextResponse.json({ error: 'No photo file provided.' }, { status: 400 });
    }

    // --- Pasul 1: Determină Invitatul folosind Funcția RPC ---
    let guestId: string;
    const guestNameForProcessing = fullName?.trim() || "";

    if (!guestNameForProcessing) {
      guestId = ANONYMOUS_GUEST_ID;
    } else {
      // Apelează funcția din Supabase pentru a găsi sau crea invitatul atomic
      const { data, error } = await supabase.rpc('find_or_create_guest', {
        p_full_name: guestNameForProcessing
      });

      if (error) {
        console.error('Eroare RPC la find_or_create_guest:', error);
        throw new Error('Nu s-a putut procesa invitatul.');
      }
      guestId = data; // Funcția RPC returnează direct ID-ul
    }

    // --- Pasul 2: Determină Albumul (logica rămâne la fel) ---
    let albumId: string | null = null;
    if (guestId !== ANONYMOUS_GUEST_ID && albumName?.trim()) {
      const albumNameProcessed = albumName.trim();
      
      // La fel ca la invitați, putem crea o funcție RPC și pentru albume pentru a preveni race conditions
      // Dar pentru început, lăsăm așa - problema principală era la invitați.
      const { data: existingAlbum } = await supabase
        .from('albums')
        .select('id')
        .eq('guest_id', guestId)
        .eq('album_name', albumNameProcessed)
        .maybeSingle();

      if (existingAlbum) {
        albumId = existingAlbum.id;
      } else {
        const { data: newAlbum, error: newAlbumError } = await supabase
          .from('albums')
          .insert({ guest_id: guestId, album_name: albumNameProcessed })
          .select('id')
          .single();
        if (newAlbumError) throw newAlbumError;
        albumId = newAlbum!.id;
      }
    }

    // --- Pasul 3: Upload Poză (neschimbat) ---
    const fileExtension = photoFile.name.split('.').pop();
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    const storagePath = `guest-uploads/${guestId}/${albumId ? albumId + '/' : ''}${uniqueFileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('wedding-photos')
      .upload(storagePath, photoFile, { contentType: photoFile.type, upsert: false });

    if (uploadError) throw uploadError;

    // --- Pasul 4: Salvare Metadata Poză (neschimbat) ---
    const { error: photoDbError } = await supabase
      .from('photos')
      .insert({
        guest_id: guestId,
        album_id: albumId,
        storage_path: uploadData.path,
        file_name: photoFile.name,
        description: description?.trim() || null,
        mimetype: photoFile.type,
        size_kb: Math.round(photoFile.size / 1024),
      });

    if (photoDbError) {
      await supabase.storage.from('wedding-photos').remove([uploadData.path]); // Cleanup
      throw photoDbError;
    }

    return NextResponse.json({ message: 'Fotografie încărcată cu succes!' }, { status: 201 });

  } catch (error) {
    console.error('Eroare la upload API:', error);
    const errorMessage = error instanceof Error ? error.message : 'A apărut o eroare.';
    return NextResponse.json({ error: `Upload eșuat: ${errorMessage}` }, { status: 500 });
  }
}