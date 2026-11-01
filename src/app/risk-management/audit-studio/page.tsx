"use client";

import Link from "next/link";
import { ClipboardList, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NaiAuditStudio() {
  return (
    <main className="space-y-6 pb-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-primary">Auditoria de riscos</h1>
        <p className="max-w-3xl text-muted-foreground">
          A auditoria automática desta tela ainda está indisponível. Uma conclusão sobre o cliente
          exige evidências do local e revisão pelo profissional responsável.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Auditoria automática indisponível</CardTitle>
          <CardDescription id="audit-availability">
            Esta página não consulta documentos, medições ou eventos do eSocial. Nenhum achado, grau
            de risco ou resultado de auditoria é produzido aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled aria-describedby="audit-availability">
            Auditar automaticamente
          </Button>
        </CardContent>
      </Card>
      <section className="grid gap-4 md:grid-cols-2" aria-label="Módulos disponíveis">
        <Card>
          <CardHeader>
            <CardTitle>Inventário de riscos</CardTitle>
            <CardDescription>
              Registre os perigos identificados, avalie probabilidade e severidade e documente os
              controles com o responsável técnico.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/risk-management">
                <ClipboardList className="mr-2 size-4" /> Abrir inventário de riscos
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Importação de documentos</CardTitle>
            <CardDescription>
              Envie documentos ao NAI importa e confira as evidências e os rascunhos extraídos antes
              de confirmar os registros.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/nai-importa">
                <FileSearch className="mr-2 size-4" /> Abrir NAI importa
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
