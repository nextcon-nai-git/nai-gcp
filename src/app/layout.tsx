import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { SgiProvider } from "@/contexts/sgi-context";
import * as React from "react";
import { AppContent } from "@/components/layout/app-content";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Montserrat:wght@700;900&display=swap"
          rel="stylesheet"
        />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect x='28' y='28' width='44' height='44' fill='none' stroke='%23334155' stroke-width='8'/><path d='M20 40 V85 L80 15 V60' fill='none' stroke='%23003366' stroke-width='10' stroke-linejoin='round' stroke-linecap='round'/></svg>"
        />
        <title>NAI - Nextcon AI | Inteligência em SST</title>
      </head>
      <body className="antialiased">
        <FirebaseClientProvider>
          <SgiProvider>
            <AppContent>{children}</AppContent>
            <Toaster />
          </SgiProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
