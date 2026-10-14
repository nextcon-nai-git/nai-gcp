import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ProviderAccessStateProps {
  loading: boolean;
  error: Error | null;
  authorized: boolean;
}

export function ProviderAccessState({ loading, error, authorized }: ProviderAccessStateProps) {
  if (loading) {
    return (
      <p role="status" className="p-8 text-center">
        Verificando autorização…
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="p-8 text-center text-destructive">
        Não foi possível verificar sua sessão. Atualize a página e tente novamente.
      </p>
    );
  }
  if (!authorized) {
    return (
      <Card role="alert" className="m-8 border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle>Acesso não autorizado</CardTitle>
          <CardDescription>
            Esta área está disponível somente para administradores internos autorizados.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return null;
}
