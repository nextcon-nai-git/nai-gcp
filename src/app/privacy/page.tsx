import Link from "next/link";
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 text-slate-800">
      <h1 className="text-2xl font-bold">Privacidade no NAI</h1>
      <p>
        O NAI da Nextcon Saúde organiza solicitações de exames e documentos das empresas atendidas.
        O acesso à fila AVP depende do perfil e das empresas liberadas para a conta.
      </p>
      <p>
        A sincronização lê a planilha Google AVP e guarda uma versão da fila e o registro de
        alterações no ambiente Firebase da Nextcon. Uma cópia da fila pode permanecer no navegador
        da conta para continuidade durante falhas de conexão; encerrar a sessão remove essa cópia.
      </p>
      <p>
        A busca de clínicas envia cidade e UF ao Google Maps. Ela não envia nomes de colaboradores,
        documentos clínicos ou a chave PIX da planilha. Os links para sites e WhatsApp abrem
        serviços externos; o operador deve revisar a mensagem antes de enviar.
      </p>
      <p>
        Ao usar a busca, aplicam-se também a{" "}
        <a
          className="underline"
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Política de Privacidade do Google
        </a>{" "}
        e as regras do serviço escolhido.
      </p>
      <p>
        Dúvidas sobre dados e acesso:{" "}
        <a className="underline" href="mailto:nextcon@nextconsaude.com.br">
          nextcon@nextconsaude.com.br
        </a>
        .
      </p>
      <Link className="underline" href="/terms">
        Informações de uso
      </Link>
    </article>
  );
}
