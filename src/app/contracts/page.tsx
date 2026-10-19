"use client";

import * as React from "react";
import Link from "next/link";
import { collection, collectionGroup, limit, orderBy, query } from "firebase/firestore";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { useFirestore, useUser, useCollection, useMemoFirebase, useStorage } from "@/firebase";
import { getActionIdToken } from "@/lib/auth/action-token";
import { normalizeCnpj } from "@/lib/cnpj";
import { analyzeContract, type ContractAnalysisOutput } from "@/ai/flows/contract-analysis-flow";
import {
  ContractImportConfirmationPending,
  hashContractFile,
  integrateAnalyzedContract,
  preserveContractSource,
  type ContractSource,
} from "@/lib/contracts/integration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type QueueItem = {
  id: string;
  fileName: string;
  status: "analyzing" | "completed" | "error" | "integrating" | "success";
  result?: ContractAnalysisOutput;
  error?: string;
  source?: ContractSource;
  companyId?: string;
  sourceConfirmed?: boolean;
};
type StoredContract = {
  id: string;
  companyId?: string;
  companyName?: string;
  summary?: string;
  extractedCompanyDocument?: string;
  operationalTasks?: ContractAnalysisOutput["operationalTasks"];
};
type Company = {
  id: string;
  name?: string;
  razaoSocial?: string;
  cnpj?: string;
  active?: boolean;
  isDeleted?: boolean;
  deletedAt?: unknown;
  status?: string;
};
const statusNames = {
  analyzing: "Analisando",
  completed: "Aguardando sua revisão",
  error: "Requer atenção",
  integrating: "Confirmando gravação",
  success: "Integração confirmada",
};
const maxBatch = 5;
const visibleContracts = 200;
function readPdf(file: File, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const reader = new FileReader();
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => {
      reader.abort();
      cleanup();
      reject(new DOMException("Operação cancelada", "AbortError"));
    };
    reader.onload = () => {
      cleanup();
      if (signal.aborted) return reject(new DOMException("Operação cancelada", "AbortError"));
      if (typeof reader.result !== "string")
        return reject(new Error("Não foi possível ler o PDF."));
      resolve(reader.result);
    };
    reader.onerror = () => {
      cleanup();
      reject(new Error("Não foi possível ler o PDF. Selecione o arquivo novamente."));
    };
    reader.onabort = () => {
      cleanup();
      reject(new DOMException("Leitura cancelada", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      reader.readAsDataURL(file);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export default function ContractsManagement() {
  const { user, role, companyId, tenantId, isUserLoading, userError } = useUser();
  if (isUserLoading)
    return (
      <p role="status" className="p-8">
        Verificando autorização…
      </p>
    );
  if (userError)
    return (
      <p role="alert" className="p-8">
        Não foi possível verificar sua sessão. Atualize a página.
      </p>
    );
  const authorized =
    !!user &&
    (role === "SUPER_ADMIN" ||
      (["ADMIN", "OPERATIONS"].includes(role || "") &&
        !tenantId &&
        (!companyId || companyId === "nextcon")));
  if (!authorized)
    return (
      <p role="alert" className="p-8">
        Acesso às importações de contratos disponível somente à equipe interna autorizada.
      </p>
    );
  return <ContractsSession key={JSON.stringify([user.uid, role, companyId, tenantId])} />;
}
function ContractsSession() {
  const { user } = useUser();
  const db = useFirestore(),
    storage = useStorage();
  const { toast } = useToast();
  const scope = React.useRef(new AbortController());
  const processing = React.useRef(false),
    integrating = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (scope.current.signal.aborted) scope.current = new AbortController();
    const controller = scope.current;
    return () => controller.abort();
  }, []);
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [uploadBusy, setUploadBusy] = React.useState(false),
    [uploadError, setUploadError] = React.useState("");
  const [search, setSearch] = React.useState(""),
    [queryVersion, setQueryVersion] = React.useState(0);
  const [viewing, setViewing] = React.useState<StoredContract | null>(null);
  const contractsQuery = useMemoFirebase(
    () =>
      query(
        collectionGroup(db, "contracts"),
        orderBy("createdAt", "desc"),
        limit(visibleContracts + 1)
      ),
    [db, queryVersion]
  );
  const companiesQuery = useMemoFirebase(
    () => query(collection(db, "companies"), limit(1001)),
    [db, queryVersion]
  );
  const {
    data: contracts,
    isLoading: loadingContracts,
    error: contractsError,
  } = useCollection<StoredContract>(contractsQuery);
  const {
    data: companies,
    isLoading: loadingCompanies,
    error: companiesError,
  } = useCollection<Company>(companiesQuery);
  const companyLimit = (companies?.length || 0) > 1000;
  const available = (companies || [])
    .filter((c) => c.active === true && !c.isDeleted && !c.deletedAt && c.status !== "archived")
    .sort((a, b) =>
      (a.name || a.razaoSocial || a.id).localeCompare(b.name || b.razaoSocial || b.id, "pt-BR")
    );
  const directoryReady =
    !loadingCompanies && !companiesError && !companyLimit && companies !== null;
  const patch = (id: string, changes: Partial<QueueItem>) =>
    setQueue((previous) =>
      previous.map((item) => (item.id === id ? { ...item, ...changes } : item))
    );

  const processFile = async (file: File, signal: AbortSignal) => {
    signal.throwIfAborted();
    const id = crypto.randomUUID();
    setQueue((previous) => [...previous, { id, fileName: file.name, status: "analyzing" }]);
    try {
      const hash = await hashContractFile(file);
      signal.throwIfAborted();
      const source = await preserveContractSource(storage, file, hash, signal);
      signal.throwIfAborted();
      patch(id, { source });
      const base64 = await readPdf(file, signal);
      const token = await getActionIdToken();
      signal.throwIfAborted();
      const result = await analyzeContract({ pdfDataUri: base64 }, token);
      signal.throwIfAborted();
      patch(id, { status: "completed", result });
    } catch {
      if (!signal.aborted)
        patch(id, {
          status: "error",
          error:
            "Não foi possível concluir a análise deste PDF. Confira o arquivo e envie novamente; nenhum contrato foi integrado.",
        });
    }
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || processing.current) return;
    if (files.length > maxBatch) {
      setUploadError(`Selecione até ${maxBatch} PDFs por lote.`);
      return;
    }
    processing.current = true;
    setUploadBusy(true);
    setUploadError("");
    const signal = scope.current.signal;
    try {
      for (const file of files) {
        if (signal.aborted) break;
        await processFile(file, signal);
      }
    } finally {
      processing.current = false;
      if (!signal.aborted) setUploadBusy(false);
    }
  };
  const integrate = async (item: QueueItem) => {
    if (
      !user ||
      !item.result ||
      !item.source ||
      !item.sourceConfirmed ||
      !item.companyId ||
      !directoryReady ||
      integrating.current.has(item.id)
    )
      return;
    const company = available.find((c) => c.id === item.companyId);
    if (
      !company ||
      normalizeCnpj(company.cnpj || "") !== normalizeCnpj(item.result.clientInfo.cnpj)
    ) {
      patch(item.id, {
        status: "error",
        error: "Selecione um cliente ativo cujo CNPJ corresponda ao documento revisado.",
      });
      return;
    }
    integrating.current.add(item.id);
    const signal = scope.current.signal;
    patch(item.id, { status: "integrating", error: undefined });
    try {
      const result = await integrateAnalyzedContract(
        db,
        storage,
        item.result,
        item.companyId,
        item.source,
        user.uid,
        true,
        signal
      );
      signal.throwIfAborted();
      patch(item.id, { status: "success" });
      toast({
        title: result.created ? "Integração confirmada" : "Contrato já integrado",
        description: result.created
          ? "Contrato e tarefas vinculados ao cliente selecionado após confirmação da gravação."
          : "A mesma fonte já estava integrada; nenhum registro foi duplicado.",
      });
    } catch (error) {
      if (!signal.aborted)
        patch(item.id, {
          status: "error",
          error:
            error instanceof ContractImportConfirmationPending
              ? "Confirmação pendente. Confira o histórico e repita a integração da mesma fonte para confirmar sem duplicar."
              : "Não foi possível confirmar a integração. Confira o cliente e tente novamente.",
        });
    } finally {
      integrating.current.delete(item.id);
    }
  };
  const shown = (contracts || [])
    .slice(0, visibleContracts)
    .filter(
      (c) =>
        `${c.companyName || ""} ${c.companyId || ""} ${c.extractedCompanyDocument || ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.trim().toLocaleLowerCase("pt-BR")) ||
        (search.replace(/\D/g, "").length >= 8 &&
          (c.extractedCompanyDocument || "").includes(search.replace(/\D/g, "")))
    );
  return (
    <main className="space-y-6 pb-16">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">Importações de contratos</h1>
        <p className="text-sm text-muted-foreground">
          Este acervo preserva as importações anteriores e suas tarefas no SGI. Para acompanhar
          contrato, execução, faturamento e recebimento em uma única esteira, use a Central.
        </p>
        <Button asChild>
          <Link href="/production">Abrir Central de Contratos e Produção</Link>
        </Button>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Importar contrato para o SGI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            Até {maxBatch} PDFs por lote, cada um com menos de 10 MB. Os arquivos são analisados em
            sequência. A extração exige revisão antes da integração e não comprova assinatura ou
            execução.
          </p>
          <label className="block space-y-2 text-sm">
            <span>Selecionar PDFs para análise</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={uploadBusy}
              onChange={upload}
              className="block w-full rounded border p-2"
            />
          </label>
          {uploadBusy && (
            <p role="status" className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Analisando o lote…
            </p>
          )}
          {uploadError && <p role="alert">{uploadError}</p>}
          {loadingCompanies && <p role="status">Carregando clientes para conferência…</p>}
          {(companiesError || companyLimit) && (
            <p role="alert">
              {companyLimit
                ? "O diretório excede 1.000 clientes. Solicite paginação antes de integrar."
                : "Não foi possível consultar os clientes. Atualize antes de integrar."}
            </p>
          )}
        </CardContent>
      </Card>
      {queue.length > 0 && (
        <section aria-label="Fila de análise" className="space-y-3">
          <h2 className="text-lg font-semibold">Fila de análise</h2>
          {queue.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4" />
                  {item.fileName}
                </CardTitle>
                <p className="text-sm">{statusNames[item.status]}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {item.result && item.source && (
                  <>
                    <details className="rounded border p-3" open>
                      <summary className="font-medium">Revisar dados extraídos</summary>
                      <div className="mt-3 space-y-3 text-sm">
                        <p>
                          <strong>Cliente identificado:</strong> {item.result.clientInfo.name} ·
                          CNPJ {item.result.clientInfo.cnpj}
                        </p>
                        <p>{item.result.summary}</p>
                        <p>
                          <strong>Obrigações identificadas:</strong>
                        </p>
                        <ul className="list-disc pl-5">
                          {item.result.clauses.duties.map((duty, n) => (
                            <li key={n}>{duty}</li>
                          ))}
                        </ul>
                        <h3 className="font-medium">
                          Tarefas sugeridas ({item.result.operationalTasks.length})
                        </h3>
                        <ol className="list-decimal space-y-3 pl-5">
                          {item.result.operationalTasks.map((task, n) => (
                            <li key={n}>
                              <strong>{task.title}</strong> · {task.category} · {task.frequency}
                              <p>{task.description}</p>
                              <ul className="list-disc pl-5">
                                {task.checklist.map((step, index) => (
                                  <li key={index}>{step}</li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ol>
                        <p className="break-all text-xs text-muted-foreground">
                          Fonte preservada: {item.source.sha256}
                        </p>
                        <p>
                          Se houver erro no cliente, escopo ou tarefas, não confirme a integração.
                          Use a Central para revisar os campos e obrigações antes de salvar.
                        </p>
                      </div>
                    </details>
                    <fieldset
                      disabled={
                        item.status === "integrating" ||
                        item.status === "success" ||
                        !directoryReady
                      }
                      className="space-y-3"
                    >
                      <label className="block space-y-1 text-sm">
                        <span>Cliente cadastrado para {item.fileName}</span>
                        <select
                          className="w-full rounded border bg-background p-2"
                          value={item.companyId || ""}
                          onChange={(e) =>
                            patch(item.id, { companyId: e.target.value, sourceConfirmed: false })
                          }
                        >
                          <option value="">Selecione o cliente pelo nome e CNPJ</option>
                          {available.map((company) => (
                            <option key={company.id} value={company.id}>
                              {company.name || company.razaoSocial || company.id} ·{" "}
                              {company.cnpj || "CNPJ pendente"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={item.sourceConfirmed || false}
                          onChange={(e) => patch(item.id, { sourceConfirmed: e.target.checked })}
                        />
                        <span>
                          Conferi o PDF original, o cliente pelo CNPJ, as obrigações e cada tarefa
                          sugerida. Esta conferência não confirma assinatura nem execução.
                        </span>
                      </label>
                      {item.status !== "success" && (
                        <Button
                          type="button"
                          disabled={
                            !item.companyId ||
                            !item.sourceConfirmed ||
                            !directoryReady ||
                            item.status === "integrating"
                          }
                          onClick={() => integrate(item)}
                        >
                          Integrar SGI
                        </Button>
                      )}
                    </fieldset>
                  </>
                )}
                {item.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {item.error}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </section>
      )}
      <section className="space-y-3" aria-label="Acervo de contratos">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Contratos importados</h2>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              setViewing(null);
              setQueryVersion((n) => n + 1);
            }}
          >
            <RefreshCw className="mr-2 size-4" />
            Atualizar acervo e clientes
          </Button>
        </div>
        <label className="block space-y-1 text-sm">
          <span>Buscar cliente, CNPJ ou vínculo no acervo exibido</span>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        {(contracts?.length || 0) > visibleContracts && (
          <p role="status" className="text-sm">
            Exibindo os {visibleContracts} contratos mais recentes. A busca nesta tela abrange
            somente este recorte.
          </p>
        )}
        {contractsError ? (
          <p role="alert">
            Não foi possível consultar os contratos. Atualize o acervo ou confira sua permissão.
          </p>
        ) : loadingContracts ? (
          <p role="status">Carregando contratos…</p>
        ) : shown.length === 0 ? (
          <p>Nenhum contrato encontrado neste recorte.</p>
        ) : (
          <div className="space-y-2">
            {shown.map((contract) => (
              <button
                type="button"
                key={`${contract.companyId}:${contract.id}`}
                className="w-full rounded-lg border p-4 text-left hover:bg-muted"
                onClick={() => setViewing(contract)}
              >
                <span className="font-medium">{contract.companyName || "Cliente pendente"}</span>
                <span className="block text-xs text-muted-foreground">
                  Vínculo: {contract.companyId}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
      <Dialog
        open={!!viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.companyName || "Contrato importado"}</DialogTitle>
            <DialogDescription>
              Resumo e sugestões preservados na importação. Confira o original antes de decisões
              contratuais.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">{viewing?.summary}</p>
          <h3 className="font-semibold">Tarefas da importação</h3>
          <ul className="space-y-3">
            {viewing?.operationalTasks?.map((task, index) => (
              <li className="rounded border p-3 text-sm" key={index}>
                <strong>{task.title}</strong>
                <p>{task.description}</p>
                <p>
                  {task.category} · {task.frequency}
                </p>
              </li>
            ))}
          </ul>
          <Button type="button" onClick={() => setViewing(null)}>
            Fechar
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
