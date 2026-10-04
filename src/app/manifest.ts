import type { MetadataRoute } from "next";

/**
 * Configuração de PWA para permitir instalação da plataforma NAI como App Nativo.
 * Garante que a interface seja carregada mesmo em ambientes sem internet.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NAI - Nextcon AI | Inteligência em SST",
    short_name: "NAI",
    description:
      "Plataforma Nextcon Intelligence para gestão estratégica de SST e Auditoria Médica.",
    start_url: "/",
    display: "standalone",
    background_color: "#001F3F",
    theme_color: "#001F3F",
    icons: [
      {
        src: "https://firebasestorage.googleapis.com/v0/b/studio-8439299034-125c7.firebasestorage.app/o/logo%2FAvatar%20Nextcon%20NAI.png?alt=media&token=1bd23213-6ca1-427b-bbb2-41fa944ae861",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "https://firebasestorage.googleapis.com/v0/b/studio-8439299034-125c7.firebasestorage.app/o/logo%2FAvatar%20Nextcon%20NAI.png?alt=media&token=1bd23213-6ca1-427b-bbb2-41fa944ae861",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
