import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function DataLabPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">Análise de documentos e imagens</h1>
      <p>
        Escolha o fluxo. A análise produz uma proposta para revisão; salvar e organizar exigem
        confirmação na etapa seguinte.
      </p>
      <div className="flex flex-wrap gap-4">
        <Button asChild>
          <Link href="/nai-importa">Importar documento no NAI</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/field-inspection">Analisar imagem de inspeção</Link>
        </Button>
      </div>
    </main>
  );
}
