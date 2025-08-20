// app/(guest)/gallery/[guestIdentifier]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card } from "@/components/ui/card";
import { 
    AlertTriangle, 
    Image as ImageIcon, 
    FolderKanban, 
    UserCircle, 
    Home, 
    X,
    ChevronLeft,
    ChevronRight,
    ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";

// --- Interfețe ---
interface Photo {
  id: string;
  album_id: string | null;
  storage_path: string;
  description: string | null;
  uploaded_at: string;
  file_name: string | null;
  mimetype: string | null;
  publicUrl: string | null;
}
interface AlbumThumbnail { id: string; publicUrl: string | null; }
interface Album { id: string; album_name: string; created_at: string; thumbnails: AlbumThumbnail[]; }
interface GuestDetails { id: string; fullName: string | null; isAnonymous: boolean; }

// --- Componente Skeleton ---
const ItemSkeleton = () => ( <Card className="aspect-square animate-pulse bg-gray-200 dark:bg-gray-800 flex items-center justify-center"><ImageIcon className="h-12 w-12 text-gray-400 dark:text-gray-600" /></Card> );
const AlbumItemSkeleton = () => ( <Card className="aspect-square animate-pulse bg-gray-200 dark:bg-gray-800 p-2"><div className="grid grid-cols-2 grid-rows-2 gap-1 h-full">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-gray-300 dark:bg-gray-700 rounded-sm"></div>)}</div><div className="h-4 bg-gray-300 rounded mt-2 w-3/4 mx-auto"></div></Card> );

export default function GuestIdentifierPage() {
  const params = useParams();
  const guestIdentifier = params.guestIdentifier as string;

  // --- Stări ---
  const [guestDetails, setGuestDetails] = useState<GuestDetails | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]); // Stocăm TOATE pozele aici
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  // --- Date Derivate cu `useMemo` ---
  const photosInCurrentView = useMemo(() => {
    if (selectedAlbumId) {
      return allPhotos.filter(p => p.album_id === selectedAlbumId);
    }
    return allPhotos.filter(p => p.album_id === null);
  }, [allPhotos, selectedAlbumId]);
  
  const selectedAlbum = useMemo(() => {
    if (!selectedAlbumId) return null;
    return albums.find(a => a.id === selectedAlbumId);
  }, [albums, selectedAlbumId]);

  // --- Stări pentru modal (folosesc `photosInCurrentView`) ---
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const selectedPhoto = selectedPhotoIndex !== null ? photosInCurrentView[selectedPhotoIndex] : null;

  // --- Funcția de Fetch (fără paginare) ---
  const fetchGuestData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const apiIdentifier = decodeURIComponent(guestIdentifier);
      const response = await fetch(`/api/gallery/guest-photos?identifier=${encodeURIComponent(apiIdentifier)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Nu s-au putut încărca datele");
      }
      const data = await response.json();
      setGuestDetails(data.guest);
      setAlbums(data.albums || []);
      setAllPhotos(data.photos || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "A apărut o eroare necunoscută.");
    } finally {
      setIsLoading(false);
    }
  }, [guestIdentifier]);

  // --- useEffect-uri ---
  useEffect(() => { fetchGuestData(); }, [fetchGuestData]);

  // --- Logică pentru modal și navigare ---
  const handlePhotoClick = (clickedPhoto: Photo) => {
    const index = photosInCurrentView.findIndex(p => p.id === clickedPhoto.id);
    if (index !== -1) setSelectedPhotoIndex(index);
  };
  const handleModalClose = () => { setSelectedPhotoIndex(null); };

  const goToNextPhoto = useCallback(() => {
    if (selectedPhotoIndex === null || photosInCurrentView.length === 0) return;
    const nextIndex = (selectedPhotoIndex + 1) % photosInCurrentView.length;
    setSelectedPhotoIndex(nextIndex);
  }, [selectedPhotoIndex, photosInCurrentView.length]);

  const goToPrevPhoto = useCallback(() => {
    if (selectedPhotoIndex === null || photosInCurrentView.length === 0) return;
    const prevIndex = (selectedPhotoIndex - 1 + photosInCurrentView.length) % photosInCurrentView.length;
    setSelectedPhotoIndex(prevIndex);
  }, [selectedPhotoIndex, photosInCurrentView.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (selectedPhotoIndex === null) return;
      if (event.key === 'ArrowRight') goToNextPhoto();
      else if (event.key === 'ArrowLeft') goToPrevPhoto();
      else if (event.key === 'Escape') handleModalClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhotoIndex, goToNextPhoto, goToPrevPhoto]);

  const pageTitle = isLoading ? "Se încarcă..." : guestDetails?.isAnonymous ? "Fotografii de la invitați anonimi" : guestDetails?.fullName ? `Fotografiile lui ${guestDetails.fullName}`: "Fotografii invitați";

  return (
    <div className="container mx-auto max-w-6xl py-8 px-2 sm:px-4">
      <div className="mb-8 text-center">
         <Link href="/gallery" className="text-sm text-primary hover:underline inline-flex items-center mb-2">
            <Home className="mr-1.5 h-4 w-4" /> Înapoi la toți participanții
        </Link>
        {isLoading && !error ? (
          <div className="h-9 w-3/4 bg-gray-300 dark:bg-gray-700 animate-pulse mx-auto rounded-md mt-1"></div>
        ) : selectedAlbumId ? (
          <div className="flex flex-col items-center gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setSelectedAlbumId(null)} className="mb-2">
                <ArrowLeft className="mr-2 h-4 w-4"/> Înapoi la galeria invitatului
            </Button>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex items-center justify-center gap-3">
                <FolderKanban size={36} className="text-primary"/>
                {selectedAlbum?.album_name}
            </h1>
          </div>
        ) : guestDetails ? (
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex items-center justify-center gap-3">
            {guestDetails.isAnonymous ? <FolderKanban size={36} className="text-primary"/> : <UserCircle size={36} className="text-primary"/>}
            {pageTitle}
          </h1>
        ) : null}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
          {Array.from({ length: 15 }).map((_, index) => (
            index < 5 ? <AlbumItemSkeleton key={`album-skel-${index}`} /> : <ItemSkeleton key={`item-skel-${index}`} />
          ))}
        </div>
      ) : error ? (
        <div className="container mx-auto max-w-6xl py-12 px-4 text-center">
            <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
            <h1 className="text-2xl font-semibold mb-2">Eroare la încărcarea galeriei</h1>
            <p className="text-red-600 mb-6">{error}</p>
            <Link href="/gallery" passHref><Button variant="outline"><Home className="mr-2 h-4 w-4" /> Înapoi la galerie</Button></Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
            {!selectedAlbumId && albums.map((album) => (
              <Card key={`album-${album.id}`} className="group aspect-square overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-200 relative" onClick={() => setSelectedAlbumId(album.id)}>
                <div className="grid grid-cols-2 grid-rows-2 gap-0.5 h-full">
                  {(album.thumbnails.length > 0 ? album.thumbnails : Array(4).fill(null)).slice(0, 4).map((thumb, idx) => (
                    <div key={thumb ? thumb.id : `ph-${idx}`} className="bg-gray-100 dark:bg-gray-800 relative overflow-hidden">
                      {thumb?.publicUrl ? (<Image src={thumb.publicUrl} alt={`Thumb ${idx + 1}`} fill sizes="25vw" className="object-cover group-hover:scale-105 transition-transform"/>) 
                      : (<div className="w-full h-full bg-muted flex items-center justify-center"><ImageIcon size={20} className="text-muted-foreground/50" /></div>)}
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center p-2">
                  <div className="text-center">
                    <FolderKanban className="h-8 w-8 sm:h-10 sm:w-10 text-white mx-auto mb-1 opacity-80 group-hover:opacity-100"/>
                    <p className="text-white text-xs sm:text-sm font-semibold truncate group-hover:whitespace-normal">{album.album_name}</p>
                  </div>
                </div>
              </Card>
            ))}
            {photosInCurrentView.map((photo) => (
              <Card key={photo.id} className="group aspect-square overflow-hidden cursor-pointer hover:shadow-xl transition-shadow duration-200 relative" onClick={() => handlePhotoClick(photo)}>
                {photo.publicUrl ? (
                  <Image src={photo.publicUrl} alt={photo.description || photo.file_name || 'Poza nunta'} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover group-hover:scale-105 transition-transform"/>
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center"><ImageIcon size={40} className="text-muted-foreground/50" /></div>
                )}
                {photo.description && (<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity"><p className="text-white text-xs truncate">{photo.description}</p></div>)}
              </Card>
            ))}
          </div>
          
          {(photosInCurrentView.length === 0 && albums.length === 0 && !selectedAlbumId) && (
            <div className="text-center py-10"><ImageIcon size={48} className="mx-auto text-gray-400 mb-4" /><p className="text-xl">Nu s-au găsit fotografii.</p></div>
          )}
          {(photosInCurrentView.length === 0 && selectedAlbumId) && (
            <div className="text-center py-10"><ImageIcon size={48} className="mx-auto text-gray-400 mb-4" /><p className="text-xl">Acest album este gol.</p></div>
          )}
        </>
      )}

      {selectedPhoto && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) handleModalClose(); }}>
          <DialogContent className="p-0 !rounded-lg overflow-hidden w-max max-w-[90vw] h-max max-h-[90vh] flex flex-col">
            <DialogTitle className="sr-only">{selectedPhoto.description || selectedPhoto.file_name || "Fotografia selectată"}</DialogTitle>
            <button onClick={goToPrevPhoto} className="absolute left-2 sm:left-4 top-1/2 z-50 -translate-y-1/2 rounded-full border border-white/50 bg-black/40 p-1.5 text-white/80 backdrop-blur-sm transition-all hover:border-white/80 hover:bg-black/60 hover:text-white" aria-label="Fotografia precedentă"><ChevronLeft className="h-6 w-6" /></button>
            <button onClick={goToNextPhoto} className="absolute right-2 sm:right-4 top-1/2 z-50 -translate-y-1/2 rounded-full border border-white/50 bg-black/40 p-1.5 text-white/80 backdrop-blur-sm transition-all hover:border-white/80 hover:bg-black/60 hover:text-white" aria-label="Fotografia următoare"><ChevronRight className="h-6 w-6" /></button>
            <div className="relative flex-shrink flex-grow basis-auto overflow-hidden flex justify-center items-center">
              {selectedPhoto.publicUrl && (
                <Image 
                  src={selectedPhoto.publicUrl} 
                  alt={selectedPhoto.description || "Fotografia selectată"} 
                  width={1920} 
                  height={1080}
                  style={{display: 'block', maxWidth: '100%', maxHeight: 'calc(90vh - 60px)', width: 'auto', height: 'auto', objectFit: 'contain', borderRadius: '0.5rem'}}
                  sizes="90vw"
                  key={selectedPhoto.id}
                />
              )}
            </div>
            {selectedPhoto.description && (<DialogDescription className="p-3 text-center text-sm text-muted-foreground flex-shrink-0">“{selectedPhoto.description}”</DialogDescription>)}
            <button onClick={handleModalClose} className="absolute top-3 right-3 z-50 rounded-full border border-white/50 bg-black/40 p-1.5 text-white/70 backdrop-blur-sm transition-all hover:border-white/80 hover:bg-black/60 hover:text-white" aria-label="Închide dialogul"><X className="h-5 w-5" /></button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}