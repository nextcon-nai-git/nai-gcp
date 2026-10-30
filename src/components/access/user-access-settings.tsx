"use client";
import * as React from "react";
import { Settings } from "lucide-react";
import { useUser } from "@/firebase";
import { getActionIdToken } from "@/lib/auth/action-token";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  STAFF_ACCESS_ROLES,
  STAFF_ROLE_LABELS,
  type AccessSubjectKind,
} from "@/lib/user-access-policy";
interface Preview {
  revision: string;
  name: string;
  email: string;
  active: boolean;
  warning: string;
  busy: boolean;
  companies: { id: string; name: string; cnpj: string }[];
  account: null | {
    uid: string;
    enabled: boolean;
    role: string;
    companyIds: string[];
    emailVerified: boolean;
    lastSignInTime: string | null;
  };
}
export function UserAccessSettings({
  kind,
  id,
  name,
}: {
  kind: AccessSubjectKind;
  id: string;
  name: string;
}) {
  const { user, role } = useUser();
  const [open, setOpen] = React.useState(false);
  if (role !== "SUPER_ADMIN") return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="ml-2 h-8 w-8 shrink-0"
        aria-label={`Configurar acesso de ${name}`}
        title="Configurar login e permissões"
        onClick={() => setOpen(true)}
      >
        <Settings size={16} />
      </Button>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Login e permissões</DialogTitle>
          <DialogDescription>
            Administração de acesso de {name}. Nenhum e-mail será enviado automaticamente.
          </DialogDescription>
        </DialogHeader>
        {open && <AccessForm key={`${user?.uid}:${kind}:${id}`} kind={kind} id={id} />}
      </DialogContent>
    </Dialog>
  );
}
function AccessForm({ kind, id }: { kind: AccessSubjectKind; id: string }) {
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [role, setRole] = React.useState(kind === "provider" ? "SCOPED_PROVIDER" : "");
  const [companies, setCompanies] = React.useState<string[]>([]);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [resetLink, setResetLink] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [confirmed, setConfirmed] = React.useState(false);
  const mounted = React.useRef(true),
    lock = React.useRef(false);
  async function load(signal?: AbortSignal) {
    const token = await getActionIdToken();
    const response = await fetch(
      `/api/admin/user-access?kind=${kind}&id=${encodeURIComponent(id)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha ao consultar o acesso.");
    if (!mounted.current || signal?.aborted) return;
    setPreview(data);
    setRole(data.account?.role || (kind === "provider" ? "SCOPED_PROVIDER" : ""));
    setCompanies(data.account?.companyIds || []);
    setConfirmed(false);
  }
  React.useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void (async () => {
      try {
        await load(controller.signal);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Falha na consulta.");
      }
    })();
    return () => {
      mounted.current = false;
      controller.abort();
    };
    // Identity changes remount this component, discarding credentials and previous results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function submit(action: string) {
    if (!preview || lock.current || !confirmed) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    setResetLink("");
    try {
      const token = await getActionIdToken();
      const response = await fetch("/api/admin/user-access", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          id,
          revision: preview.revision,
          action,
          role,
          companyIds: companies,
          ...(action === "create" ? { password } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Resultado não confirmado. Atualize antes de repetir.");
      if (!mounted.current) return;
      setPassword("");
      setMessage(data.message);
      setResetLink(data.resetLink || "");
      await load();
    } catch (e) {
      if (mounted.current) {
        setPassword("");
        setError(e instanceof Error ? e.message : "Falha ao atualizar acesso.");
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!preview && !error && <p>Consultando login e vínculos…</p>}
      {preview && (
        <>
          <p className="font-semibold">
            {preview.name} · {preview.email || "E-mail não informado"}
          </p>
          <p>
            {preview.account
              ? preview.account.enabled
                ? "Login ativo"
                : "Login suspenso"
              : "Sem login cadastrado"}
          </p>
          {preview.account && (
            <p className="text-sm">
              E-mail {preview.account.emailVerified ? "verificado" : "não verificado"}. Último
              login: {preview.account.lastSignInTime || "nenhum registrado"}.
            </p>
          )}
          {!preview.active && (
            <p className="text-amber-600">Cadastro inativo. Só é possível suspender o acesso.</p>
          )}
          {preview.warning && <p role="alert">{preview.warning}</p>}
          <fieldset disabled={busy || preview.busy} className="space-y-4">
            {kind === "provider" ? (
              <p>
                Consulta de CNPJs e cards das empresas selecionadas. Sem contratos, faturamento,
                prontuários ou edição.
              </p>
            ) : (
              <label className="block">
                Perfil de acesso
                <select
                  aria-label="Perfil de acesso"
                  className="block w-full border rounded p-2 bg-background"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setCompanies([]);
                    setConfirmed(false);
                  }}
                >
                  <option value="">Selecione um perfil</option>
                  {STAFF_ACCESS_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {STAFF_ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {role === "OPERATIONS" ? (
              <p className="rounded border p-3">
                Este perfil permite operação geral da NEXTCON, incluindo cadastros e documentos
                operacionais de todos os clientes. Não é um acesso restrito por empresa e não libera
                prontuários.
              </p>
            ) : (
              <fieldset className="max-h-48 overflow-auto border rounded p-3">
                <legend>Empresas autorizadas</legend>
                {preview.companies.map((c) => (
                  <label key={c.id} className="flex gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={companies.includes(c.id)}
                      onChange={(e) => {
                        setCompanies((v) =>
                          e.target.checked ? [...v, c.id] : v.filter((x) => x !== c.id)
                        );
                        setConfirmed(false);
                      }}
                    />
                    {c.name} {c.cnpj && `· ${c.cnpj}`}
                  </label>
                ))}
                {!preview.companies.length && (
                  <p>Nenhuma empresa disponível. Revise os vínculos do cadastro.</p>
                )}
              </fieldset>
            )}
            {kind === "employee" && role !== "OPERATIONS" && (
              <p className="text-sm">
                As permissões seguem o perfil e as regras do sistema. Perfis clínicos acessam dados
                de saúde autorizados; engenharia, RH e técnico aceitam uma empresa por login.
              </p>
            )}
            {!preview.account && (
              <label className="block">
                Senha inicial
                <input
                  aria-label="Senha inicial"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  className="block w-full border rounded p-2 bg-background"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Conferi a identidade, o perfil e o alcance do acesso.
            </label>
            <div className="flex flex-wrap gap-2">
              {!preview.account ? (
                <Button
                  disabled={
                    !confirmed ||
                    !!preview.warning ||
                    !preview.active ||
                    password.length < 8 ||
                    !role
                  }
                  onClick={() => void submit("create")}
                >
                  Criar login
                </Button>
              ) : (
                <>
                  <Button
                    disabled={!confirmed || !preview.active}
                    onClick={() => void submit("update")}
                  >
                    Salvar permissões
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!confirmed || (!preview.account.enabled && !preview.active)}
                    onClick={() => void submit(preview.account!.enabled ? "disable" : "enable")}
                  >
                    {preview.account.enabled ? "Suspender login" : "Reativar login"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!confirmed || !preview.active}
                    onClick={() => void submit("reset-password")}
                  >
                    Gerar link para redefinir senha
                  </Button>
                </>
              )}
            </div>
          </fieldset>
          {busy && <p role="status">Atualizando acesso…</p>}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setResetLink("");
              setError("");
              void load().catch((e) => setError(e.message));
            }}
          >
            Atualizar consulta
          </Button>
        </>
      )}
      {resetLink && (
        <label className="block text-sm">
          Link privado para redefinir senha — copie e entregue somente ao titular
          <input
            aria-label="Link privado para redefinir senha"
            readOnly
            value={resetLink}
            className="block w-full border rounded p-2 bg-background"
            onFocus={(e) => e.target.select()}
          />
        </label>
      )}
    </div>
  );
}
