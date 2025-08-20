// app/api/admin/download-all-portfolio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { IronSession, getIronSession } from 'iron-session';
import { sessionOptions } from '@/lib/session';
import { cookies } from 'next/headers';
import archiver from 'archiver';
// PassThrough is still needed for the response stream. Readable is not strictly needed for this version.
import { PassThrough } from 'stream';

// --- Start of shared/reused type definitions ---
interface AlbumInfo {
  album_name: string | null;
}

interface GuestInfo {
  full_name: string | null;
  is_anonymous: boolean;
}

interface PhotoMetadata {
  id: any;
  storage_path: string;
  file_name: string | null;
  albums: AlbumInfo;
  guests: GuestInfo;
}
// --- End of shared/reused type definitions ---


// Helper function to fetch a file from Supabase Storage as a Buffer
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
        console.error(`Exception downloading ${storagePath} (to buffer):`, e);
        return null;
    }
}


export async function GET(request: NextRequest) {
  const session = await getIronSession<IronSession<any>>(await cookies(), sessionOptions);

  if (!session.admin?.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
  }

  // Main try-catch for initial setup. Errors here will send a JSON response.
  try {
    console.log("Download All Portfolio API: Fetching photo metadata...");
    const { data, error: photosError } = await supabase
      .from('photos')
      .select(`
        id,
        storage_path,
        file_name,
        albums ( album_name ),
        guests ( full_name, is_anonymous )
      `)
      .order('uploaded_at', { ascending: true });

    if (photosError) {
      console.error('Error fetching photo metadata for download:', photosError);
      throw photosError; // Caught by main try-catch
    }

    const photos: PhotoMetadata[] = (data as any[]) || [];

    if (photos.length === 0) {
      return NextResponse.json({ error: 'No photos found in the portfolio.' }, { status: 404 });
    }
    console.log(`Download All Portfolio API: Found ${photos.length} photos to archive.`);

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    const passThroughForResponse = new PassThrough();
    archive.pipe(passThroughForResponse);

    // Critical error handling for the archiver and the stream being sent to the client.
    archive.on('error', (err) => {
      console.error('Archiver error:', err);
      // Destroy the stream being sent to the client to signal an error.
      passThroughForResponse.destroy(err);
    });
    archive.on('warning', function(err) { // Keep your existing warning handler
      if (err.code === 'ENOENT') {
        console.warn('Archiver warning (file not found?):', err);
      } else {
        console.warn('Archiver warning:', err);
      }
    });

    // Asynchronously process and append files to the archive.
    // This IIFE (Immediately Invoked Function Expression) runs without blocking the response return.
    (async () => {
      try {
        for (const photo of photos) {
          let determined_guest_name: string = 'Unknown_Guest';
          if (photo.guests) {
            const firstGuest = photo.guests;
            if (firstGuest.full_name) {
              determined_guest_name = firstGuest.full_name;
            } else if (firstGuest.is_anonymous) {
              determined_guest_name = 'ANONYMOUS';
            }
          }

          let determined_album_name: string | null = null;
          if (photo.albums) {
            const firstAlbum = photo.albums;
            if (firstAlbum && firstAlbum.album_name) {
              determined_album_name = firstAlbum.album_name;
            }
          }

          let entryName = determined_guest_name + '/';
          if (determined_album_name) {
            entryName += determined_album_name + '/';
          }
          entryName += photo.file_name || photo.storage_path.split('/').pop() || `${photo.id}.jpg`;
          entryName = entryName.replace(/[\/\0<>:\?\*\"\|\\]/g, '_');

          const fileBuffer = await getFileBufferFromSupabase(photo.storage_path);
          if (fileBuffer) {
            console.log(`Download All Portfolio API: Adding to archive: ${entryName} (from ${photo.storage_path}, size: ${fileBuffer.length} bytes)`);
            archive.append(fileBuffer, { name: entryName });
          } else {
            console.warn(`Download All Portfolio API: Could not get buffer for ${photo.storage_path}, skipping.`);
          }
        }
        // Once all files are appended, finalize the archive.
        // This signals to the archiver that no more files will be added.
        // The archiver will then finish writing data to passThroughForResponse and end it.
        console.log("Download All Portfolio API: All files processed for appending. Finalizing archive...");
        await archive.finalize();
        console.log("Download All Portfolio API: Archive finalized successfully.");
      } catch (processingError) {
        console.error("Download All Portfolio API: Error during file processing loop or finalization:", processingError);
        // If an error occurs in this async block, destroy the archive and the response stream.
        archive.destroy(processingError instanceof Error ? processingError : new Error(String(processingError)));
        // The 'error' event on 'archive' should then propagate to passThroughForResponse.destroy()
      }
    })(); // End of the async IIFE

    // Immediately return the response with the stream.
    // Data will flow into passThroughForResponse as the archive is built.
    const headers = new Headers();
    const filename = `wedding-photo-portfolio-${new Date().toISOString().split('T')[0]}.zip`.trim();
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

    return new NextResponse(passThroughForResponse as any, { // Using 'as any' for Node.js stream compatibility
        status: 200,
        headers: headers,
    });

  } catch (error) { // Catches errors from the initial setup phase
    console.error('API error during download-all-portfolio setup:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred.';
    return NextResponse.json({ error: `Failed to generate portfolio ZIP: ${errorMessage}` }, { status: 500 });
  }
}