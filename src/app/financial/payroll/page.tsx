import Link from "next/link";
import { FileText, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PayrollManagementPage() {
  return (
    <main className="space-y-6 pb-16">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-primary">Folha de pagamento</h1>
        <p className="max-w-3xl text-muted-foreground">
          Acompanhe a disponibilidade do processamento da folha e acesse os cadastros relacionados.
        </p>
      </header>
      <Card>
        <CardHeader>
          <div>
            <Badge variant="outline">Processamento indisponível</Badge>
          </div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" /> Integração de folha pendente
          </CardTitle>
          <CardDescription>
            Esta tela ainda não está conectada a um serviço de cálculo, fechamento ou transmissão da
            folha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Valores de remuneração, encargos, holerites e recibos de transmissão só poderão ser
            apresentados após a implantação da integração e a conferência dos dados da competência.
          </p>
          <p>
            Para fechar a folha, transmitir eventos ou entregar documentos, utilize o sistema
            responsável pela folha da empresa. Nenhuma dessas operações é executada por esta tela.
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" /> Cadastro de equipe
            </CardTitle>
            <CardDescription>Consulte o cadastro de pessoas no módulo de equipe.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/nxc-team">Abrir equipe</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-5" /> Controle financeiro
            </CardTitle>
            <CardDescription>
              Registre títulos e acompanhe aprovações e baixas. O lançamento financeiro não confirma
              o fechamento da folha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/financial/operacoes">Abrir operações financeiras</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
