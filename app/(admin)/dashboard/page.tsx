// app/(admin)/dashboard/page.tsx
"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from "react";
import { useIntersectionObserver } from '@/hooks/use-intersection-observer';
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { 
    Dialog, 
    DialogContent, 
    DialogTitle, 
    DialogDescription, 
    DialogHeader 
} from "@/components/ui/dialog";
import { 
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { 
    Trash2, 
    X, 
    ImageOff, 
    AlertTriangle, 
    Loader2, 
    FolderKanban, 
    PackageOpen,
    DownloadCloud,
    Download,
    ChevronLeft,
    ChevronRight 
} from "lucide-react";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";

const PHOTOS_PER_PAGE_ADMIN = 30;

// --- Interfețe ---
interface AdminPhoto {
  id: string;
  publicUrl: string | null;
  description: string | null;
  file_name: string | null;
  uploaded_at: string;
  album_name: string | null;
  guest_name: string | null;
  storage_path: string;
  guest_id?: string;
}

interface GuestForAdminList {
  id: string;
  name: string;
  photoCount: number;
}

interface ActionToConfirm {
  type: 'delete_guest_portfolio' | 'delete_all_portfolio' | 'delete_single_photo';
  targetId?: string;
  targetName?: string;
  storagePath?: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();

  // --- Stări ---
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [guestList, setGuestList] = useState<GuestForAdminList[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorLoadingData, setErrorLoadingData] = useState<string | null>(null);
  
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const selectedPhotoForModal = selectedPhotoIndex !== null && photos[selectedPhotoIndex] ? photos[selectedPhotoIndex] : null;

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<ActionToConfirm | null>(null);
  const [isFirstConfirmOpen, setIsFirstConfirmOpen] = useState(false);
  const [isSecondConfirmOpen, setIsSecondConfirmOpen] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [isFinalDeleteButtonEnabled, setIsFinalDeleteButtonEnabled] = useState(false);
  const [currentGlobalLanguage, setCurrentGlobalLanguage] = useState<string>('ro');
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);
  const [languageUpdateStatus, setLanguageUpdateStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- Funcții de Fetch ---
  const reloadAllData = useCallback(async () => {
    setIsLoading(true);
    setErrorLoadingData(null);
    try {
      const [photosResponse, guestsResponse, languageResponse] = await Promise.all([
        fetch('/api/admin/all-photos?page=1'),
        fetch('/api/gallery/guests'),
        fetch('/api/admin/settings/global-language')
      ]);

      if (!photosResponse.ok) {
        if (photosResponse.status === 401) { router.replace('/login'); return; }
        throw new Error((await photosResponse.json()).error || 'Nu s-au putut încărca fotografiile.');
      }
      const photosData = await photosResponse.json();
      setPhotos(photosData.photos || []);
      setHasNextPage(photosData.hasNextPage);
      setPage(1);

      type GuestFromApi = {
        id: string;
        fullName: string | null;
        isAnonymous: boolean;
        photoCount: number;
      };
      
      const guestsData: GuestFromApi[] = await guestsResponse.json();
      
      setGuestList(guestsData.map((g) => ({
        id: g.id, 
        name: g.isAnonymous ? 'ANONIM' : g.fullName || 'Oaspete fără nume', 
        photoCount: g.photoCount,
      })));

      if (languageResponse.ok) {
        const langData = await languageResponse.json();
        setCurrentGlobalLanguage(langData.value);
      }
    } catch (error) {
      console.error("Eroare la încărcarea datelor inițiale:", error);
      setErrorLoadingData(error instanceof Error ? error.message : "A apărut o eroare necunoscută");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const fetchMorePhotos = useCallback(async () => {
    if (isLoadingMore || !hasNextPage) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await fetch(`/api/admin/all-photos?page=${nextPage}`);
      if (!res.ok) throw new Error('Nu s-au putut încărca mai multe fotografii');
      const data = await res.json();
      setPhotos(prev => [...prev, ...data.photos]);
      setHasNextPage(data.hasNextPage);
      setPage(nextPage);
    } catch (error) {
      console.error("Failed to fetch more photos", error);
      setHasNextPage(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, hasNextPage, isLoadingMore]);

  // --- useEffect-uri ---
  useEffect(() => { reloadAllData(); }, [reloadAllData]);

  const { setTarget } = useIntersectionObserver({
    enabled: hasNextPage && !isLoadingMore && !isLoading,
    onIntersect: fetchMorePhotos,
  });

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (isSecondConfirmOpen && countdown > 0) {
      setIsFinalDeleteButtonEnabled(false);
      timerId = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    } else if (isSecondConfirmOpen && countdown === 0) {
      setIsFinalDeleteButtonEnabled(true);
    }
    return () => clearTimeout(timerId);
  }, [isSecondConfirmOpen, countdown]);

  const openPhotoModal = (clickedPhoto: AdminPhoto) => {
    const index = photos.findIndex(p => p.id === clickedPhoto.id);
    if (index !== -1) setSelectedPhotoIndex(index);
  };
  const closePhotoModal = () => { setSelectedPhotoIndex(null); };
  const goToNextPhoto = useCallback(() => {
    if (selectedPhotoIndex === null) return;
    const nextIndex = (selectedPhotoIndex + 1) % photos.length;
    setSelectedPhotoIndex(nextIndex);
  }, [selectedPhotoIndex, photos.length]);
  const goToPrevPhoto = useCallback(() => {
    if (selectedPhotoIndex === null) return;
    const prevIndex = (selectedPhotoIndex - 1 + photos.length) % photos.length;
    setSelectedPhotoIndex(prevIndex);
  }, [selectedPhotoIndex, photos.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (selectedPhotoIndex === null) return;
      if (event.key === 'ArrowRight') goToNextPhoto();
      else if (event.key === 'ArrowLeft') goToPrevPhoto();
      else if (event.key === 'Escape') closePhotoModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhotoIndex, goToNextPhoto, goToPrevPhoto]);

  // --- Handlers ---
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.replace('/login');
    } catch (error) { console.error("Logout failed", error); } 
    finally { setIsLoggingOut(false); }
  };
  
  const handleCancelAllConfirms = () => {
    setIsFirstConfirmOpen(false);
    setIsSecondConfirmOpen(false);
    setActionToConfirm(null);
    setCountdown(10);
    setIsFinalDeleteButtonEnabled(false);
  };

  const handleProceedToSecondConfirm = () => {
    if (!actionToConfirm) return;
    setIsFirstConfirmOpen(false);
    setCountdown(10);
    setIsFinalDeleteButtonEnabled(false);
    setIsSecondConfirmOpen(true);
  };

  const handleExecuteFinalDelete = async () => {
    if (!actionToConfirm) return;
    setIsDeleting(true);
    let endpoint = '', body: any = {}, successMessage = '';
    try {
      switch (actionToConfirm.type) {
        case 'delete_single_photo':
          endpoint = '/api/admin/delete-photo';
          body = { photoId: actionToConfirm.targetId, storagePath: actionToConfirm.storagePath };
          successMessage = `Fotografia „${actionToConfirm.targetName}” a fost ștearsă.`;
          break;
        case 'delete_guest_portfolio':
          endpoint = '/api/admin/delete-guest-portfolio';
          body = { guestId: actionToConfirm.targetId };
          successMessage = `Toate pozele pentru "${actionToConfirm.targetName}" au fost șterse.`;
          break;
        case 'delete_all_portfolio':
          endpoint = '/api/admin/delete-all-portfolio';
          body = {};
          successMessage = 'Întregul portofoliu a fost șters.';
          break;
      }
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Ștergerea a eșuat`);
      }
      console.log(successMessage);
      reloadAllData();
    } catch (error) {
      console.error(`Error during deletion:`, error);
      setErrorLoadingData(error instanceof Error ? error.message : "A apărut o eroare la ștergere.");
    } finally {
      handleCancelAllConfirms();
      setIsDeleting(false);
    }
  };

  const handleIndividualPhotoDownload = async (photo: AdminPhoto) => {
    if (!photo.publicUrl) return;
    try {
        const response = await fetch(photo.publicUrl);
        if (!response.ok) throw new Error(`Failed to fetch image`);
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = photo.file_name || `photo-${photo.id}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (error) { console.error("Error downloading photo:", error); }
  };

  const handleDownloadAllPortfolio = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/api/admin/download-all-portfolio');
      if (!response.ok) throw new Error((await response.json()).error || "Download failed.");
      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      let filename = "portfolio.zip";
      if (contentDisposition) {
          const match = contentDisposition.match(/filename="?(.+)"?/i);
          if (match?.[1]) filename = match[1];
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) { console.error("Error downloading portfolio:", error); } 
    finally { setIsDownloading(false); }
  };

  const handleDownloadGuestPortfolio = async (guestId: string, guestName: string) => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/admin/download-guest-portfolio?guestId=${encodeURIComponent(guestId)}`);
      if (!response.ok) throw new Error((await response.json()).error);
      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${guestName.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
      if (contentDisposition) {
          const match = contentDisposition.match(/filename="?(.+)"?/i);
          if (match?.[1]) filename = match[1];
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) { console.error(`Error downloading portfolio for ${guestName}:`, error); } 
    finally { setIsDownloading(false); }
  };

  const handleLanguageChange = async (newLanguage: string) => {
    setIsUpdatingLanguage(true);
    setLanguageUpdateStatus(null);
    try {
      const response = await fetch('/api/admin/settings/global-language', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: newLanguage }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const result = await response.json();
      setCurrentGlobalLanguage(newLanguage);
      setLanguageUpdateStatus({ type: 'success', message: result.message });
    } catch (error) {
      setLanguageUpdateStatus({ type: 'error', message: error instanceof Error ? error.message : 'Eroare.' });
    } finally {
      setIsUpdatingLanguage(false);
      setTimeout(() => setLanguageUpdateStatus(null), 4000);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Panou de administrare</h1>
        <Button onClick={handleLogout} variant="outline" disabled={isLoggingOut || isDeleting || isDownloading}>
          {isLoggingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Deconectare
        </Button>
      </div>

      {errorLoadingData && (
         <div className="mb-6 text-center py-4 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border">
            <AlertTriangle size={32} className="mx-auto text-red-500 mb-2" />
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">Eroare la încărcarea datelor</h3>
            <p className="text-red-600 dark:text-red-300">{errorLoadingData}</p>
        </div>
      )}

      <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 border-b pb-3">Limba globală a site-ului</h2>
        <div className="flex items-center space-x-4">
          <p className="text-muted-foreground">Limba actuală pentru toți invitații:</p>
          <Select value={currentGlobalLanguage} onValueChange={handleLanguageChange} disabled={isUpdatingLanguage}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ro">Română (Romanian)</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
          {isUpdatingLanguage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
        </div>
        {languageUpdateStatus && <p className={`mt-3 text-sm ${languageUpdateStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{languageUpdateStatus.message}</p>}
        <p className="text-xs text-muted-foreground mt-3">Această modificare va schimba imediat limba pe toate paginile pentru invitați.</p>
      </div>

      <Accordion type="multiple" defaultValue={['download-actions']} className="w-full mb-10 space-y-6">
        <AccordionItem value="download-actions" className="border dark:border-gray-700 rounded-lg shadow-sm">
          <AccordionTrigger className="px-6 py-4 hover:no-underline text-lg font-semibold"><div className="flex items-center gap-3"><DownloadCloud /> Acțiuni de descărcare</div></AccordionTrigger>
          <AccordionContent className="p-6 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                <h3 className="text-base font-semibold mb-3 border-b pb-2 flex items-center gap-2"><FolderKanban /> Descarcă portofoliu invitat</h3>
                {isLoading ? <Loader2 className="animate-spin" /> : guestList.length === 0 ? <p className="text-sm">Nu s-au găsit invitați.</p> :
                  <ul className="space-y-2 max-h-60 overflow-y-auto">{guestList.map(guest => (
                    <li key={`download-${guest.id}`} className="flex justify-between items-center p-2.5 border rounded-md">
                      <div><span className="font-medium text-sm">{guest.name}</span><span className="text-xs text-muted-foreground ml-2">({guest.photoCount} foto)</span></div>
                      <Button variant="outline" size="sm" onClick={() => handleDownloadGuestPortfolio(guest.id, guest.name)} disabled={isDownloading || guest.photoCount === 0}><Download className="mr-2 h-4 w-4" />Descarcă</Button>
                    </li>
                  ))}</ul>
                }
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-500">
                <h3 className="text-base font-semibold mb-3 text-blue-700 dark:text-blue-300 border-b pb-2 flex items-center gap-2"><PackageOpen /> Descarcă întreg portofoliul</h3>
                <p className="text-xs text-blue-600 dark:text-blue-200 mb-3">Descarcă toate fotografiile, organizate pe invitat și album.</p>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleDownloadAllPortfolio} disabled={isDownloading || photos.length === 0}>
                  {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />} Descarcă tot
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="delete-actions" className="border border-destructive/50 rounded-lg shadow-sm">
          <AccordionTrigger className="px-6 py-4 hover:no-underline text-lg font-semibold text-destructive"><div className="flex items-center gap-3"><AlertTriangle /> Acțiuni de ștergere</div></AccordionTrigger>
          <AccordionContent className="p-6 pt-2">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="p-4 bg-background dark:bg-gray-800/60 rounded-lg border">
                  <h3 className="text-base font-semibold mb-3 border-b pb-2 flex items-center gap-2"><FolderKanban /> Gestionare fotografii invitați</h3>
                  {isLoading ? <Loader2 className="animate-spin" /> : guestList.length === 0 ? <p className="text-sm">Nu s-au găsit invitați.</p> :
                    <ul className="space-y-2 max-h-60 overflow-y-auto">{guestList.map(guest => (
                      <li key={guest.id} className="flex justify-between items-center p-2.5 border rounded-md">
                        <div><span className="font-medium text-sm">{guest.name}</span><span className="text-xs text-muted-foreground ml-2">({guest.photoCount} foto)</span></div>
                        <Button variant="destructive" size="sm" onClick={() => { setActionToConfirm({ type: 'delete_guest_portfolio', targetId: guest.id, targetName: guest.name }); setIsFirstConfirmOpen(true); }} disabled={isDeleting || guest.photoCount === 0}>Șterge</Button>
                      </li>
                    ))}</ul>
                  }
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/40 rounded-lg border border-red-500">
                  <h3 className="text-base font-semibold mb-3 text-red-700 dark:text-red-300 border-b pb-2 flex items-center gap-2"><AlertTriangle /> Zonă de pericol</h3>
                  <p className="text-xs text-red-600 dark:text-red-200 mb-3">Aceasta va șterge permanent TOATE fotografiile.</p>
                  <Button variant="destructive" className="w-full bg-red-700 hover:bg-red-800 text-white" onClick={() => { setActionToConfirm({ type: 'delete_all_portfolio', targetName: 'Întregul Portofoliu' }); setIsFirstConfirmOpen(true); }} disabled={isDeleting || photos.length === 0}><PackageOpen className="mr-2 h-4 w-4" /> Șterge tot</Button>
                </div>
              </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-2">Grilă cu toate fotografiile încărcate</h2>
        {isLoading ? <Loader2 className="animate-spin" /> : <p className="text-sm text-muted-foreground">Total fotografii afișate: {photos.length}</p>}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-10">
          {Array.from({ length: 18 }).map((_, index) => (
            <Card key={`photo-skel-${index}`} className="aspect-square animate-pulse bg-gray-200 dark:bg-gray-700"></Card>
          ))}
        </div>
      ) : errorLoadingData ? (
        <div className="text-center py-10 bg-red-50 p-6 rounded-lg">
          <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
          <h3 className="text-xl font-semibold text-red-700">Eroare la încărcarea datelor</h3>
          <p className="text-red-600">{errorLoadingData}</p>
        </div>
      ) : (
        <>
          {photos.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-10">Nu au fost încă încărcate fotografii.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 mb-10">
              {photos.map((photo) => (
                <Card key={photo.id} className="group relative aspect-square overflow-hidden shadow-md hover:shadow-lg transition-all" onClick={() => openPhotoModal(photo)}>
                  {photo.publicUrl ? ( <Image src={photo.publicUrl} alt={photo.description || ''} fill sizes="20vw" className="object-cover"/> ) 
                  : ( <div className="w-full h-full bg-muted flex flex-col items-center justify-center text-muted-foreground"><ImageOff size={32} /><span className="text-xs mt-1">Fără previzualizare</span></div> )}
                  <div className="absolute bottom-0 p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-gradient-to-t from-black/80">
                    <p className="font-semibold truncate" title={photo.guest_name || ''}>De: {photo.guest_name}</p>
                    {photo.album_name && <p className="truncate" title={photo.album_name}>Album: {photo.album_name}</p>}
                  </div>
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-10">
                    <Button size="icon" variant="destructive" className="h-8 w-8 bg-red-600/60 hover:bg-red-500/90 rounded-full" onClick={(e) => { e.stopPropagation(); setActionToConfirm({ type: 'delete_single_photo', targetId: photo.id, targetName: photo.file_name || 'această poză', storagePath: photo.storage_path }); setIsFirstConfirmOpen(true); }} title="Șterge" disabled={isDeleting}><Trash2 size={16} /></Button>
                  </div>
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 z-10">
                    <Button size="icon" variant="outline" className="h-8 w-8 bg-background/60 hover:bg-background/90 rounded-full" onClick={(e) => { e.stopPropagation(); handleIndividualPhotoDownload(photo); }} title="Descarcă"><Download size={16} /></Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <div ref={setTarget} className="h-20 flex justify-center items-center">
            {hasNextPage && isLoadingMore && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
            {!hasNextPage && photos.length > PHOTOS_PER_PAGE_ADMIN && <p className="text-muted-foreground">Ai ajuns la final.</p>}
          </div>
        </>
      )}

      {selectedPhotoForModal && (
          <Dialog open={true} onOpenChange={(open) => { if (!open) closePhotoModal(); }}>
            <DialogContent className="p-0 !rounded-lg overflow-hidden w-max max-w-[90vw] h-max max-h-[90vh] flex flex-col">
              <DialogTitle className="sr-only">{selectedPhotoForModal.description || selectedPhotoForModal.file_name || "Fotografia selectată"}</DialogTitle>
              <button
                onClick={goToPrevPhoto}
                className="absolute left-2 sm:left-4 top-1/2 z-50 -translate-y-1/2 rounded-full border border-white/50 bg-black/40 p-1.5 text-white/80 backdrop-blur-sm transition-all hover:border-white/80 hover:bg-black/60 hover:text-white"
                aria-label="Fotografia precedentă"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={goToNextPhoto}
                className="absolute right-2 sm:right-4 top-1/2 z-50 -translate-y-1/2 rounded-full border border-white/50 bg-black/40 p-1.5 text-white/80 backdrop-blur-sm transition-all hover:border-white/80 hover:bg-black/60 hover:text-white"
                aria-label="Fotografia următoare"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <div className="relative flex-shrink flex-grow basis-auto overflow-hidden flex justify-center items-center">
                {selectedPhotoForModal.publicUrl && (
                  <Image 
                    src={selectedPhotoForModal.publicUrl} 
                    alt={selectedPhotoForModal.description || "Fotografia selectată"} 
                    width={1920} 
                    height={1080}
                    style={{display: 'block', maxWidth: '100%', maxHeight: 'calc(90vh - 60px)', width: 'auto', height: 'auto', objectFit: 'contain', borderRadius: '0.5rem'}}
                    sizes="90vw"
                    key={selectedPhotoForModal.id}
                  />
                )}
              </div>
              {selectedPhotoForModal.description && (<DialogDescription className="p-3 text-center text-sm text-muted-foreground flex-shrink-0">“{selectedPhotoForModal.description}”</DialogDescription>)}
              <button
                onClick={closePhotoModal}
                className="absolute top-3 right-3 z-50 rounded-full border border-white/50 bg-black/40 p-1.5 text-white/70 backdrop-blur-sm transition-all hover:border-white/80 hover:bg-black/60 hover:text-white"
                aria-label="Închide dialogul"
              >
                <X className="h-5 w-5" />
              </button>
            </DialogContent>
          </Dialog>
      )}

      {/* --- Dialogurile de Confirmare pentru Ștergere --- */}
      {/* Primul Dialog de Confirmare (Universal) */}
      <Dialog open={isFirstConfirmOpen} onOpenChange={(open) => !open && handleCancelAllConfirms()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmă Acțiunea: Șterge {actionToConfirm?.targetName}</DialogTitle>
            <DialogDescription>
              Ești sigur că vrei să continui cu ștergerea {' '}
              {actionToConfirm?.type === 'delete_single_photo' ? `fotografiei "${actionToConfirm.targetName}"` : ''}
              {actionToConfirm?.type === 'delete_guest_portfolio' ? `tuturor celor ${guestList.find(g=>g.id === actionToConfirm.targetId)?.photoCount || ''} fotografii ale invitatului "${actionToConfirm.targetName}"` : ''}
              {actionToConfirm?.type === 'delete_all_portfolio' ? `întregului portofoliu (${photos.length} fotografii)` : ''}?
              <br/>
              <span className="font-semibold text-destructive">Această acțiune este serioasă.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-3 mt-4">
            <Button variant="outline" onClick={handleCancelAllConfirms} disabled={isDeleting}>Anulează</Button>
            <Button variant="destructive" onClick={handleProceedToSecondConfirm} disabled={isDeleting}>
              Da, mergi la confirmarea finală
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Al Doilea Dialog de Confirmare (cu Countdown) */}
      <Dialog open={isSecondConfirmOpen} onOpenChange={(open) => !open && handleCancelAllConfirms()}>
        <DialogContent className="sm:max-w-lg border-destructive shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-destructive-foreground bg-destructive p-3 rounded-t-lg -mx-6 -mt-6 mb-4 flex items-center gap-2 text-lg">
              <AlertTriangle size={24} /> CONFIRMARE FINALĂ: Șterge {actionToConfirm?.targetName}
            </DialogTitle>
            <DialogDescription className="py-1 text-base">
              Ești pe cale să ștergi **PERMANENT** {' '}
              <strong>
                {actionToConfirm?.type === 'delete_single_photo' ? `fotografia: "${actionToConfirm.targetName}"` : ''}
                {actionToConfirm?.type === 'delete_guest_portfolio' ? `TOATE fotografiile pentru invitatul: "${actionToConfirm.targetName}"` : ''}
                {actionToConfirm?.type === 'delete_all_portfolio' ? `ÎNTREGUL PORTOFOLIU (${photos.length} fotografii)` : ''}
              </strong>.
              <br/>
              <span className="font-semibold text-destructive mt-2 block">Această acțiune NU POATE fi anulată. Toate datele asociate vor fi pierdute.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 p-3 bg-yellow-100 dark:bg-yellow-700/30 border border-yellow-400 dark:border-yellow-600 rounded-md text-center">
            <p className="text-yellow-700 dark:text-yellow-200 font-medium">
              {countdown > 0 
                ? `Poți confirma ștergerea în ${countdown} secund${countdown !== 1 ? 'e' : 'ă'}...`
                : "Acum poți confirma ștergerea."}
            </p>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <Button variant="outline" onClick={handleCancelAllConfirms} disabled={isDeleting}>Anulează</Button>
            <Button
              variant="destructive"
              onClick={handleExecuteFinalDelete}
              disabled={!isFinalDeleteButtonEnabled || isDeleting}
              className="bg-red-700 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700 text-white min-w-[120px]"
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {countdown > 0 ? `Așteaptă (${countdown})` : "Confirmă Ștergerea"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}