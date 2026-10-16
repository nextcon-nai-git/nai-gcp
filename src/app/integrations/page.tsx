import Link from "next/link";
import { ArrowRight, Network } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const availableModules = [
  {
    name: "SOC · Cadastros e ASOs",
    description:
      "Consulte empresas, colaboradores e ASOs emitidos. Confira matrículas e acompanhe as consultas do NAI com as credenciais configuradas.",
    href: "/integrations/soc",
    action: "Abrir central SOC",
  },
  {
    name: "RD Conversas · Tallos",
    description:
      "Consulte contatos, operadores, atendimentos e a operação de ASOs. Revise e autorize cada mensagem antes do envio.",
    href: "/integrations/rd-conversas",
    action: "Abrir central de atendimento",
  },
  {
    name: "Omie financeiro",
    description:
      "Confira a conexão e consulte contas a pagar e a receber com as credenciais configuradas.",
    href: "/financial/omie",
    action: "Conferir conexão e consultar",
  },
  {
    name: "Exportação para Omie",
    description:
      "Consulte cadastros, confira a prévia e autorize o envio de fornecedores homologados e títulos aprovados.",
    href: "/financial/omie/conectores",
    action: "Abrir conectores",
  },
  {
    name: "DRE Omie",
    description:
      "Consulte a demonstração de resultados retornada pelo provedor para o período selecionado.",
    href: "/financial/omie/dre",
    action: "Consultar DRE",
  },
  {
    name: "Notas fiscais",
    description:
      "Consulte os documentos disponíveis no provedor fiscal configurado. A tela informa erros e limitações de cada conexão.",
    href: "/financial/notas-fiscais",
    action: "Abrir consulta fiscal",
  },
];

export default function IntegrationsHubPage() {
  return (
    <main className="space-y-6 pb-16">
      <header className="space-y-3">
        <h1 className="flex items-center gap-3 text-3xl font-semibold text-primary">
          <Network className="size-8" /> Integrações
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Acesse os módulos disponíveis e confira a conexão em cada consulta. Este painel não mede o
          estado dos provedores nem executa sincronizações em conjunto.
        </p>
      </header>
      <section className="space-y-4" aria-labelledby="available-integrations">
        <h2 id="available-integrations" className="text-xl font-semibold">
          Módulos com operação implementada
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {availableModules.map((module) => (
            <Card key={module.href} className="flex flex-col">
              <CardHeader className="flex-1">
                <CardTitle>{module.name}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={module.href}>
                    {module.action}
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <Card>
        <CardHeader>
          <div>
            <Badge variant="outline">Integrações de RH não implementadas</Badge>
          </div>
          <CardTitle>Outros ERPs e folha</CardTitle>
          <CardDescription>
            TOTVS, Senior, Sankhya, SAP, Apdata e LG ainda não possuem sincronização operacional
            neste módulo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            A sincronização de funcionários, atestados, ASOs e rubricas depende de implementação e
            validação específicas para cada provedor. Nenhum envio ou agendamento é realizado por
            este painel.
          </p>
          <p>
            Indicadores de vidas sincronizadas, horários de execução e comprovantes de transmissão
            serão apresentados quando existirem respostas verificáveis do serviço responsável.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
