import Link from "next/link";
export default function DocumentsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Documentos</h1>
      <p>
        Escolha o módulo responsável para consultar ou importar documentos da empresa selecionada.
      </p>
      <div className="flex flex-wrap gap-4">
        <Link className="rounded-xl border p-4 underline" href="/risk-management/pgr-analysis">
          PGR e ações de segurança
        </Link>
        <Link className="rounded-xl border p-4 underline" href="/health-control">
          ASO e controle de saúde
        </Link>
        <Link className="rounded-xl border p-4 underline" href="/medical-certificates">
          Triagem de atestados
        </Link>
      </div>
    </section>
  );
}
