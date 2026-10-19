import Link from "next/link";

const documents = [
  {
    year: "2024",
    type: "Balanço Patrimonial",
    href: "/financial/balanco",
    description: "Importar e consultar o balanço SPED de 2024.",
  },
  {
    year: "2024",
    type: "DRE contábil",
    href: "/financial/relatorios",
    description: "Registrar e consultar a DRE oficial de novembro a dezembro de 2024.",
  },
  {
    year: "2025",
    type: "Balanço Patrimonial",
    href: "/financial/balanco",
    description: "Importar e consultar o balanço SPED de 2025.",
  },
  {
    year: "2025",
    type: "DRE contábil",
    href: "/financial/relatorios",
    description: "Registrar e consultar a DRE oficial de janeiro a dezembro de 2025.",
  },
] as const;

export default function ContabilidadePage() {
  return (
    <main className="mx-auto max-w-6xl space-y-7 p-5 text-white md:p-8">
      <div>
        <Link href="/financial" className="text-sm text-cyan-200 underline">
          ← Financeiro
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">Contabilidade</h1>
        <p className="mt-2 text-slate-200">
          Balanços patrimoniais e DREs oficiais, sem conexão com o Omie.
        </p>
      </div>
      <section aria-label="Demonstrativos contábeis" className="grid gap-4 md:grid-cols-2">
        {documents.map((document) => (
          <article
            key={document.year + document.type}
            className="rounded-2xl border border-white/15 bg-[#102640] p-6"
          >
            <p className="text-sm text-cyan-200">Exercício {document.year}</p>
            <h2 className="mt-2 text-xl font-semibold">{document.type}</h2>
            <p className="mt-2 text-sm text-slate-200">{document.description}</p>
            <Link
              className="mt-5 inline-block rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-950"
              href={document.href}
            >
              Abrir acervo / importar PDF
            </Link>
          </article>
        ))}
      </section>
      <p className="rounded-lg border border-amber-300/40 p-4 text-sm text-amber-100">
        A presença do documento nesta lista não indica importação concluída. Consulte o acervo de
        destino para confirmar o PDF registrado. O acesso e a gravação exigem perfil financeiro
        autorizado.
      </p>
    </main>
  );
}
