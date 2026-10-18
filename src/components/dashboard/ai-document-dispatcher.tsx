import Link from "next/link";
import { ArrowRight, FileSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Retained for dashboard callers; all uploads use the reviewed import workspace. */
export function AiDocumentDispatcher() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <FileSearch className="size-5" aria-hidden="true" /> NAI importa
          </h3>
          <p className="text-sm text-muted-foreground">
            Analise documentos, confira as evidências e revise os dados antes de salvar. Documentos
            clínicos seguem as permissões do módulo.
          </p>
        </div>
        <Button asChild>
          <Link href="/nai-importa">
            Abrir importação de documentos <ArrowRight className="ml-2 size-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
