import * as React from "react";
import { OccupationalClinicsMap } from "@/components/providers/occupational-clinics-map";

/**
 * @fileOverview Página Mestre de Busca de Clínicas Ocupacionais do Brasil com Mapa Interativo e WhatsApp.
 */

export const metadata = {
  title: "Buscador de Clínicas Ocupacionais do Brasil | NAI Nextcon",
  description:
    "Localize clínicas de saúde ocupacional em todo o Brasil com mapa interativo, detalhes de funcionamento e contato direto via WhatsApp.",
};

export default function OccupationalMapPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <OccupationalClinicsMap />
    </div>
  );
}
