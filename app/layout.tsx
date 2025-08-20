// app/layout.tsx
import { Geist } from "next/font/google";
import './globals.css';
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// You can add Metadata here again if you like
export const metadata = {
  title: 'Aplicatie Foto Nunta', // Romanian Title
  description: 'Impartaseste si vezi fotografiile de la evenimentul nostru special.',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    // Set the lang to "ro" permanently
    <html lang="ro" suppressHydrationWarning>
      <body className={`${geistSans.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors />
      </body>
    </html>
  );
}