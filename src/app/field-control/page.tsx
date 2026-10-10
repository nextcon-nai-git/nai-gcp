import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function FieldControlPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-5 rounded-2xl border bg-white p-6 sm:p-8">
      <ShieldAlert className="size-9 text-amber-600" aria-hidden="true" />
      <h1 className="text-2xl font-semibold">Controle de acesso em campo</h1>
      <p className="text-slate-600">
        Integração de catraca, biometria e verificação de EPI indisponível. Nenhuma liberação ou
        bloqueio de acesso é executado por esta tela.
      </p>
      <p className="text-sm text-slate-500">
        Para operar este módulo, é necessário conectar o equipamento e validar as regras de acesso
        com dados e responsáveis definidos.
      </p>
      <div className="flex flex-wrap gap-4">
        <Link className="text-teal-700 underline" href="/field-inspection">
          Abrir inspeção de campo
        </Link>
        <Link className="text-teal-700 underline" href="/ppe-management">
          Consultar entregas de EPI
        </Link>
        <Link className="text-teal-700 underline" href="/health-control">
          Consultar saúde ocupacional
        </Link>
      </div>
    </section>
  );
}
