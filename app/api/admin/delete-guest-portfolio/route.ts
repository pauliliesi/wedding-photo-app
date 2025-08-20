// app/api/admin/delete-guest-portfolio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { IronSession, getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';

export async function DELETE(request: NextRequest) {
  const session = await getIronSession<IronSession<any>>(await cookies(), sessionOptions);
  if (!session.admin?.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { guestId } = await request.json();
    if (!guestId) {
      return NextResponse.json({ error: 'Guest ID is required.' }, { status: 400 });
    }

    // 1. Get all photo storage_paths for this guest
    const { data: photosToDel, error: fetchError } = await supabase
      .from('photos')
      .select('id, storage_path')
      .eq('guest_id', guestId);

    if (fetchError) throw fetchError;

    // 2. Delete photos from storage (if any)
    if (photosToDel && photosToDel.length > 0) {
      const storagePaths = photosToDel.map(p => p.storage_path);
      const { error: storageError } = await supabase.storage
        .from('wedding-photos')
        .remove(storagePaths);
      if (storageError) console.error('Partial error deleting guest photos from storage:', storageError.message);
    }

    // 3. Delete photo records from DB for this guest
    const { error: dbPhotosError } = await supabase
      .from('photos')
      .delete()
      .eq('guest_id', guestId);
    if (dbPhotosError) throw new Error('Failed to delete photos from database for guest.');
    
    // 4. Optional: Delete guest's albums (if they are now empty or by design)
    const { error: dbAlbumsError } = await supabase
      .from('albums')
      .delete()
      .eq('guest_id', guestId);
    if (dbAlbumsError) console.warn('Could not delete albums for guest:', dbAlbumsError.message);
    
    // 5. Optional: Delete the guest record itself if they have no more photos and no albums
    //    Or if business logic dictates guest record should be removed.
    //    For now, we'll leave the guest record.

    return NextResponse.json({ message: `All photos for guest ${guestId} deleted successfully.` });
  } catch (error) {
    console.error('API error deleting guest portfolio:', error);
    return NextResponse.json({ error: 'Failed to delete guest portfolio.' }, { status: 500 });
  }
}