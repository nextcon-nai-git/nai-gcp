"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function FireSafetyCetesbPage() {
  return (
    <div className="space-y-6 p-6">
      <Link href="/reports">Voltar ao Hub</Link>
      <h1 className="text-3xl font-bold">Revisão de segurança contra incêndio — CETESB</h1>
      <p role="status">
        Parecer não verificado. A página anterior exibia valores fixos de licença e conformidade sem
        vínculo a documentos de origem. Eles não podem ser usados como comprovação de vistoria,
        AVCB, assinatura ou transmissão ao eSocial.
      </p>
      <p>
        Confira o laudo, a licença vigente, a data e o responsável técnico no acervo autorizado
        antes de emitir um parecer.
      </p>
      <Button disabled>Exportar Parecer Técnico — evidências pendentes</Button>
      <div className="flex gap-5">
        <Link href="/reports">Conferir acervo documental</Link>
        <Link href="/action-plans">Abrir Plano de Ação</Link>
      </div>
    </div>
  );
}
