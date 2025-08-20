// app/(guest)/gallery/page.tsx
"use client"; // For useEffect, useState

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"; // For a nice touch
import { Users, Image as ImageIcon, ShieldQuestion } from 'lucide-react'; // Icons

interface GuestWithPhotoCount {
  id: string;
  fullName: string | null;
  isAnonymous: boolean;
  photoCount: number;
}

// Skeleton Card Component (can be moved to a separate file later)
const GuestCardSkeleton = () => (
  <Card className="animate-pulse">
    <CardHeader className="flex flex-row items-center gap-4">
      <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
        <div className="h-3 bg-gray-300 rounded w-1/2"></div>
      </div>
    </CardHeader>
    <CardContent>
      <div className="h-3 bg-gray-300 rounded w-1/4"></div>
    </CardContent>
  </Card>
);


export default function GalleryPage() {
  const [guests, setGuests] = useState<GuestWithPhotoCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGuests() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/gallery/guests');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch guests: ${response.statusText}`);
        }
        const data: GuestWithPhotoCount[] = await response.json();
        setGuests(data);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchGuests();
  }, []);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    const names = name.split(' ');
    if (names.length === 1) return names[0][0]?.toUpperCase() || "?";
    return (names[0][0] + (names[names.length - 1][0] || '')).toUpperCase();
  };

  if (error) {
    return (
      <div className="container mx-auto max-w-4xl py-12 px-4 text-center">
        <h1 className="text-3xl font-bold mb-8">Galerie foto</h1>
        <p className="text-red-500">Eroare încărcare galerie: {error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Contribuitorii noștri de fotografii</h1>
        <p className="text-muted-foreground mt-2">
          Răsfoiește fotografiile împărtășite de invitații noștri dragi.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <GuestCardSkeleton key={index} />
          ))}
        </div>
      ) : guests.length === 0 ? (
        <div className="text-center py-10">
          <Users size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-xl text-gray-600">Nu au fost încă încărcate fotografii..</p>
          <p className="text-gray-500 mt-2">Fii primul care își împărtășește amintirile!</p>
          <Link href="/upload" className="mt-4 inline-block px-6 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90">
            Încarcă fotografii
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {guests.map((guest) => (
            <Link key={guest.id} href={`/gallery/${guest.isAnonymous ? 'anonymous' : encodeURIComponent(guest.fullName || guest.id)}`} passHref>
              <Card className={`hover:shadow-lg transition-shadow duration-200 ease-in-out ${guest.isAnonymous ? 'border-2 border-primary bg-primary/5' : ''}`}>
                <CardHeader className="flex flex-row items-center gap-4">
                   <Avatar className="h-12 w-12">
                    {/* <AvatarImage src="/path-to-guest-image.jpg" alt={guest.fullName || 'Guest'} /> */}
                    <AvatarFallback className={guest.isAnonymous ? "bg-primary text-primary-foreground" : ""}>
                      {guest.isAnonymous ? <ShieldQuestion size={24} /> : getInitials(guest.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">
                      {guest.isAnonymous ? 'ANONIM' : guest.fullName}
                    </CardTitle>
                    {!guest.isAnonymous && guest.fullName && (
                       <CardDescription className="text-xs">Contribuitor</CardDescription>
                    )}
                     {guest.isAnonymous && (
                       <CardDescription className="text-xs">Fotografii de la diferiți invitați</CardDescription>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <ImageIcon size={16} className="mr-2" />
                    {guest.photoCount} Fotografi{guest.photoCount !== 1 ? 'i' : 'e'}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}