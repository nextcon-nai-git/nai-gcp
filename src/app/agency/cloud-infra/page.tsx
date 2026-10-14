import { Cloud, CreditCard, ExternalLink, FileSearch, ShieldQuestion } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { firebaseConfig } from "@/firebase/config";

export default function CloudInfraPage() {
  const projectId = firebaseConfig.projectId;
  const project = encodeURIComponent(projectId);
  return (
    <main className="space-y-6 pb-16">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-primary">Infraestrutura Google Cloud</h1>
        <p className="max-w-3xl text-muted-foreground">
          Acesse os consoles responsáveis pela hospedagem, pelos registros e pelo faturamento do
          ambiente.
        </p>
      </header>
      <Card>
        <CardHeader>
          <div>
            <Badge variant="outline">Status não consultado</Badge>
          </div>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="size-5" /> Hospedagem
          </CardTitle>
          <CardDescription>
            Projeto configurado na aplicação: <code>{projectId}</code>. A configuração identifica o
            destino; a disponibilidade e a versão em produção precisam ser conferidas no console.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Este painel não consulta a saúde dos serviços nem inicia implantações. Confira o
            resultado do rollout e o domínio no Firebase App Hosting.
          </p>
          <Button asChild variant="outline">
            <a
              href={`https://console.firebase.google.com/project/${project}/apphosting`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir Firebase App Hosting <ExternalLink className="ml-2 size-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="size-5" /> Registros do ambiente
            </CardTitle>
            <CardDescription>
              Consulte os registros disponíveis com sua permissão no Google Cloud.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <a
                href={`https://console.cloud.google.com/logs/query?project=${project}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir registros <ExternalLink className="ml-2 size-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5" /> Faturamento
            </CardTitle>
            <CardDescription>
              A conta de cobrança e sua situação não são consultadas por esta tela.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <a
                href={`https://console.cloud.google.com/billing?project=${project}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir faturamento <ExternalLink className="ml-2 size-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldQuestion className="size-5" /> Evidências de segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Certificados, políticas de acesso, proteção de rede e controles de conformidade precisam
          ser verificados nas configurações e evidências do ambiente. Este painel não certifica
          esses controles.
        </CardContent>
      </Card>
    </main>
  );
}
