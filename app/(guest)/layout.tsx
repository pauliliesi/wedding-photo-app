// app/(guest)/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";
import { cn } from "@/lib/utils";

function GuestHeader() {
  const pathname = usePathname();

  const navLinks = [
    { href: "/upload", label: "Încarcă Foto" },
    { href: "/gallery", label: "Galerie" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Containerul principal al header-ului, cu padding orizontal (px-4 sau px-6) */}
      <div className="container flex h-14 items-center">
        {/* Link-ul "Acasă" - acum singur, la începutul container-ului flex */}
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <Home className="h-6 w-6 ml-4" />
          <span className="font-bold hidden sm:inline-block">Acasă</span>
        </Link>
        
        {/* Navigația */}
        <nav className="flex items-center space-x-6 text-sm font-medium">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "transition-colors hover:text-primary pb-1",
                  isActive 
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground border-b-2 border-transparent"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Un div gol care va împinge totul la stânga. 
            Adaugă 'ml-auto' pentru a împinge elementele din dreapta la capăt. */}
        <div className="ml-auto flex items-center space-x-4">
          {/* Aici poți adăuga butoane în viitor, ex: <Button>Login</Button> */}
        </div>
      </div>
    </header>
  );
}

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <GuestHeader />
      <main>{children}</main>
    </div>
  );
}