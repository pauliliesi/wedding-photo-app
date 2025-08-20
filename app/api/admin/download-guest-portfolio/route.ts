// app/api/admin/download-guest-portfolio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { IronSession, getIronSession, IronSessionData } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';
import archiver from 'archiver';
import { PassThrough } from 'stream'; // PassThrough is sufficient for the response stream

// --- Start of type definitions (ensure these match your actual data structures) ---
interface AlbumInfo {
  album_name: string; // Assuming album_name is always present if AlbumInfo exists
}

interface PhotoInfoForGuest {
  id: string;
  storage_path: string;
  file_name: string | null;
  albums: AlbumInfo | AlbumInfo[] | null; // Can be a single album object, an array, or null
}
// --- End of type definitions ---

// Helper function to fetch a file from Supabase Storage as a Buffer
// (Copied from your working download-all-portfolio script)
async function getFileBufferFromSupabase(storagePath: string): Promise<Buffer | null> {
    try {
        const { data: blob, error } = await supabase.storage
            .from('wedding-photos') // Your bucket name
            .download(storagePath);

        if (error) {
            console.error(`Error downloading ${storagePath} from Supabase (to buffer):`, error.message);
            return null;
        }
        if (!blob) {
            console.warn(`No data (blob) returned for ${storagePath} from Supabase.`);
            return null;
        }

        const arrayBuffer = await blob.arrayBuffer();
        return Buffer.from(arrayBuffer); // Convert ArrayBuffer to Node.js Buffer
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error(`Exception downloading ${storagePath} (to buffer):`, errorMessage);
        return null;
    }
}


export async function GET(request: NextRequest) {
  const session = await getIronSession<IronSessionData>(await cookies(), sessionOptions);

  if (!session.admin?.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const guestId = searchParams.get('guestId');

  if (!guestId) {
    return NextResponse.json({ error: 'Guest ID is required.' }, { status: 400 });
  }

  // Main try-catch for initial setup. Errors here will send a JSON response.
  try {
    console.log(`Download Guest Portfolio API: Fetching guest info for ID: ${guestId}...`);
    const { data: guestData, error: guestError } = await supabase
      .from('guests')
      .select('full_name, is_anonymous')
      .eq('id', guestId)
      .single();

    if (guestError) {
      console.error(`Error fetching guest ${guestId}:`, guestError.message);
      if (guestError.code === 'PGRST116') { // PostgREST code for "Searched for one row, but found 0"
         return NextResponse.json({ error: 'Guest not found.' }, { status: 404 });
      }
      throw guestError; // Caught by main try-catch, leading to a 500
    }
    if (!guestData) { // Should ideally be caught by PGRST116, but as a defensive check
        return NextResponse.json({ error: 'Guest not found (no data returned).' }, { status: 404 });
    }

    const guestNameForFile = (guestData.is_anonymous ? 'ANONYMOUS' : guestData.full_name || 'Unknown_Guest')
                             .replace(/[^a-zA-Z0-9_.-]/g, '_');
    console.log(`Download Guest Portfolio API: Guest name for file: ${guestNameForFile}`);

    console.log(`Download Guest Portfolio API: Fetching photos for guest ID: ${guestId}...`);
    const { data: photosData, error: photosError } = await supabase
      .from('photos')
      .select(`
        id,
        storage_path,
        file_name,
        albums ( album_name )
      `)
      .eq('guest_id', guestId)
      .order('uploaded_at', { ascending: true });

    if (photosError) {
      console.error(`Error fetching photos for guest ${guestId}:`, photosError.message);
      throw photosError; // Caught by main try-catch
    }

    const photos: PhotoInfoForGuest[] = (photosData as any[]) || [];

    if (photos.length === 0) {
      return NextResponse.json({ error: 'No photos found for this guest.' }, { status: 404 });
    }
    console.log(`Download Guest Portfolio API: Found ${photos.length} photos for guest ${guestId} to archive.`);

    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression level
    });

    const passThroughForResponse = new PassThrough();
    archive.pipe(passThroughForResponse);

    // Critical error handling for the archiver and the stream being sent to the client.
    archive.on('error', (err) => {
      console.error('Archiver error (guest portfolio):', err);
      // Destroy the stream being sent to the client to signal an error.
      passThroughForResponse.destroy(err);
    });
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Archiver warning (guest portfolio - file not found?):', err);
      } else {
        console.warn('Archiver warning (guest portfolio):', err);
      }
    });

    // Asynchronously process and append files to the archive.
    // This IIFE runs without blocking the response return.
    (async () => {
      try {
        for (const photo of photos) {
          let actualAlbumName: string | null = null;
          if (photo.albums) {
            if (Array.isArray(photo.albums)) {
              if (photo.albums.length > 0 && photo.albums[0]?.album_name) {
                actualAlbumName = photo.albums[0].album_name;
              }
            } else if (photo.albums?.album_name) { // It's a single AlbumInfo object
              actualAlbumName = photo.albums.album_name;
            }
          }

          let entryName = '';
          if (actualAlbumName) {
            // Sanitize album name to be used as a directory path
            entryName += actualAlbumName.replace(/[\/\0<>:\?\*\"\|\\]/g, '_') + '/';
          }
          // Sanitize file name
          const defaultFileName = photo.storage_path.split('/').pop() || `${photo.id}.jpg`;
          const sanitizedFileName = (photo.file_name || defaultFileName)
                                    .replace(/[\/\0<>:\?\*\"\|\\]/g, '_');
          entryName += sanitizedFileName;

          const fileBuffer = await getFileBufferFromSupabase(photo.storage_path);
          if (fileBuffer) {
            console.log(`Download Guest Portfolio API: Adding to archive: ${entryName} (from ${photo.storage_path}, size: ${fileBuffer.length} bytes)`);
            archive.append(fileBuffer, { name: entryName });
          } else {
            console.warn(`Download Guest Portfolio API: Could not get buffer for ${photo.storage_path} (guest ${guestId}), skipping.`);
            // Optionally, add a placeholder text file to the archive indicating the missing file.
            // archive.append(`File ${photo.storage_path} could not be retrieved.`, { name: `${entryName}.error.txt` });
          }
        }
        
        console.log(`Download Guest Portfolio API: All files for guest ${guestId} processed for appending. Finalizing archive...`);
        await archive.finalize(); // Signals archiver that no more files will be appended.
        console.log(`Download Guest Portfolio API: Archive for guest ${guestId} finalized successfully.`);
      } catch (processingError) {
        const errorMsg = processingError instanceof Error ? processingError.message : String(processingError);
        console.error(`Download Guest Portfolio API: Error during file processing loop or finalization for guest ${guestId}:`, errorMsg, processingError);
        // If an error occurs in this async block, destroy the archive.
        // This will trigger the 'error' event on 'archive', which in turn destroys passThroughForResponse.
        archive.destroy(processingError instanceof Error ? processingError : new Error(errorMsg));
      }
    })(); // End of the async IIFE

    // Immediately return the response with the stream.
    // Data will flow into passThroughForResponse as the archive is built.
    const headers = new Headers();
    const filename = `${guestNameForFile}_photos_${new Date().toISOString().split('T')[0]}.zip`;
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

    // Using 'as any' for Node.js stream compatibility with NextResponse, same as the working example.
    return new NextResponse(passThroughForResponse as any, {
        status: 200,
        headers: headers,
    });

  } catch (error) { // Catches errors from the initial setup phase (DB queries, etc.)
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred.';
    console.error(`API error (guest portfolio ${guestId}) during setup:`, errorMessage, error);
    return NextResponse.json({ error: `Failed to generate guest portfolio ZIP: ${errorMessage}` }, { status: 500 });
  }
}