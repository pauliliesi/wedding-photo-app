// app/page.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, Images } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    // Container principal care va avea imaginea de fundal
    <main className="relative min-h-screen w-full flex items-center justify-center p-4">
      {/* Imaginea de fundal cu overlay întunecat */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/background.jpg" // Asigură-te că ai o imagine numită 'background.jpg' în folderul `public/`
          alt="Fundal cu tematică de nuntă"
          fill
          className="object-cover"
          priority // Prioritizează încărcarea imaginii de pe homepage
        />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      </div>

      {/* Cardul cu conținut, deasupra fundalului */}
      <Card className="z-10 w-full max-w-lg text-center bg-background/80 backdrop-blur-md border-2">
        <CardHeader>
          <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight">
            Nuntă Cristi & Alina
          </CardTitle>
          <CardDescription className="text-base sm:text-lg pt-2">
            Vă mulțumim că sunteți alături de noi! Contribuiți la albumul nostru de amintiri.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/upload">
                <Camera className="mr-2 h-5 w-5" />
                Încarcă o Fotografie
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/gallery">
                <Images className="mr-2 h-5 w-5" />
                Vezi Galeria Foto
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}