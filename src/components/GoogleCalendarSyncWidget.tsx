import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function GoogleCalendarSyncWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-5" />
          Agenda de exames
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Consulte as solicitações no agendador de ASO. A sincronização automática com o Google
          Calendar ainda não está configurada.
        </p>
        <Button asChild variant="outline">
          <Link href="/aso-scheduler">Abrir agendador de ASO</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
