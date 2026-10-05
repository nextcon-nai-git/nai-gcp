import Link from "next/link";
export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 text-slate-800">
      <h1 className="text-2xl font-bold">Informações de uso do NAI</h1>
      <p>
        A Nextcon Saúde disponibiliza o NAI às contas autorizadas para gestão das empresas
        atendidas. Mantenha os dados da planilha e as permissões de acesso atualizados.
      </p>
      <p>
        As opções de clínicas são sugestões para contato. Preço de ASO, disponibilidade, CNPJ, PIX e
        credenciamento precisam ser confirmados com a clínica. Abrir o WhatsApp não confirma o envio
        da mensagem.
      </p>
      <p>
        A análise por IA oferece apoio à triagem e exige revisão humana. Uma função indisponível
        permanece pendente e não comprova assinatura digital, transmissão fiscal ou backup.
      </p>
      <p>
        A busca no Google Maps está sujeita aos{" "}
        <a
          className="underline"
          href="https://maps.google.com/help/terms_maps/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Termos de Serviço do Google Maps
        </a>{" "}
        e à{" "}
        <a
          className="underline"
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Política de Privacidade do Google
        </a>
        .
      </p>
      <Link className="underline" href="/privacy">
        Privacidade no NAI
      </Link>
    </article>
  );
}
