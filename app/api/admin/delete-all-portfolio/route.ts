// app/api/admin/delete-all-portfolio/route.ts
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
    // 1. Get all photo storage_paths
    const { data: allPhotos, error: fetchPhotosError } = await supabase
      .from('photos')
      .select('storage_path');
    if (fetchPhotosError) throw fetchPhotosError;

    // 2. Delete all photos from storage (if any)
    if (allPhotos && allPhotos.length > 0) {
      const allStoragePaths = allPhotos.map(p => p.storage_path);
      // Supabase remove can take an array of paths. Be mindful of limits if many thousands.
      const { error: storageError } = await supabase.storage
        .from('wedding-photos')
        .remove(allStoragePaths); // This might need to be batched for very large numbers
      if (storageError) console.error('Partial error deleting all photos from storage:', storageError.message);
    }

    // 3. Delete all photo records from DB
    const { error: dbPhotosError } = await supabase.from('photos').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (dbPhotosError) throw new Error('Failed to delete all photos from database.');

    // 4. Delete all album records from DB
    const { error: dbAlbumsError } = await supabase.from('albums').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (dbAlbumsError) throw new Error('Failed to delete all albums from database.');
    
    // 5. Optional: Delete all guest records (except ANONYMOUS if you want to keep its structure)
    // const { error: dbGuestsError } = await supabase.from('guests').delete().neq('is_anonymous', true);
    // if (dbGuestsError) console.warn('Could not delete guest records:', dbGuestsError.message);


    return NextResponse.json({ message: 'Entire photo portfolio deleted successfully.' });
  } catch (error) {
    console.error('API error deleting entire portfolio:', error);
    return NextResponse.json({ error: 'Failed to delete entire portfolio.' }, { status: 500 });
  }
}