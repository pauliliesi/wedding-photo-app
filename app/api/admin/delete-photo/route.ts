// app/api/admin/delete-photo/route.ts
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
    const { photoId, storagePath } = await request.json();

    if (!photoId || !storagePath) {
      return NextResponse.json({ error: 'Photo ID and Storage Path are required.' }, { status: 400 });
    }

    // 1. Delete from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('wedding-photos') // Your bucket name
      .remove([storagePath]);

    if (storageError) {
      // Log the error but proceed to try deleting from DB, as the DB record is the source of truth for display
      console.error(`Error deleting '${storagePath}' from storage:`, storageError.message);
      // Depending on desired strictness, you could return an error here.
      // For now, we'll allow DB deletion even if storage deletion fails (e.g., file already gone).
    }

    // 2. Delete from 'photos' database table
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      console.error(`Error deleting photo ID '${photoId}' from database:`, dbError);
      throw new Error('Failed to delete photo from database.');
    }

    return NextResponse.json({ message: 'Photo deleted successfully.' }, { status: 200 });

  } catch (error) {
    console.error('Delete photo API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: `Failed to delete photo: ${errorMessage}` }, { status: 500 });
  }
}