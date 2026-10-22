"use client";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  type User,
} from "firebase/auth";
import { useAuth } from "@/firebase";
import type { ClinicalData, PortalRecord } from "@/lib/clinic-portal/schema";

type View = Pick<PortalRecord, "identity" | "clinicName" | "state" | "version" | "expiresAt"> &
  Partial<Pick<PortalRecord, "clinical" | "doctorName" | "crm" | "uf" | "exams" | "risks">> & {
    documentReceived?: boolean;
    role: "doctor" | "reception";
  };
const blank: ClinicalData = {
  attendanceDate: "",
  history: "",
  occupationalHistory: "",
  medications: "",
  complaints: "",
  vitalSigns: "",
  physicalExam: "",
  results: "",
  conduct: "",
  conclusion: "pendente",
  observations: "",
};
const states = {
  invited: "Convite criado",
  confirmed: "Recebimento confirmado",
  draft: "Em preenchimento",
  awaiting_signature: "Preenchido · aguardando assinatura médica",
};
export default function ClinicPortalPage() {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [view, setView] = useState<View | null>(null);
  const [form, setForm] = useState<ClinicalData>(blank);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [signedAttestation, setSignedAttestation] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const off = onAuthStateChanged(auth, (next) => {
      generation.current++;
      setUser(next);
      setBusy(false);
      setView(null);
      setForm(blank);
      setSignedFile(null);
      setSignedAttestation(false);
      setConfirmed(false);
      setMessage("");
    });
    return () => {
      generation.current++;
      off();
    };
  }, [auth, id]);
  async function call(action: string) {
    if (!user || busy) return;
    const current = generation.current;
    setBusy(true);
    setMessage("");
    try {
      await user.reload();
      if (current !== generation.current) return;
      const token = await user.getIdToken(true);
      if (current !== generation.current) return;
      const response = await fetch("/api/clinic-portal", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action,
          id,
          ...(action === "submit" ? { reviewed: confirmed } : {}),
          ...(view ? { version: view.version } : {}),
          ...(["save", "submit"].includes(action) ? { payload: form } : {}),
        }),
      });
      const data = await response.json();
      if (current !== generation.current) return;
      if (!response.ok) throw new Error(data.error);
      setView(data);
      setForm(data.clinical || blank);
      setConfirmed(false);
      setMessage(action === "read" ? "Atendimento carregado." : "Dados salvos com sucesso.");
    } catch (error) {
      if (current === generation.current)
        setMessage(error instanceof Error ? error.message : "Falha ao concluir.");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  async function login(mode: "login" | "create" | "reset") {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, credentials.email);
        setMessage("Se a conta estiver cadastrada, siga as instruções enviadas ao seu e-mail.");
      } else if (mode === "create") {
        const result = await createUserWithEmailAndPassword(
          auth,
          credentials.email,
          credentials.password
        );
        await sendEmailVerification(result.user);
        setMessage("Conta criada. Confirme seu e-mail antes de abrir o atendimento.");
      } else {
        await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      }
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      const errors: Record<string, string> = {
        "auth/invalid-credential":
          "E-mail ou senha não conferem. Use a senha da conta do NAI ou clique em Recuperar senha.",
        "auth/wrong-password":
          "E-mail ou senha não conferem. Use a senha da conta do NAI ou clique em Recuperar senha.",
        "auth/user-not-found":
          "E-mail ou senha não conferem. Use a senha da conta do NAI ou clique em Recuperar senha.",
        "auth/invalid-email": "Confira o formato do e-mail informado.",
        "auth/email-already-in-use":
          "Este e-mail já tem conta no NAI. Entre ou use Recuperar senha.",
        "auth/weak-password": "Para criar a conta, escolha uma senha com pelo menos 8 caracteres.",
        "auth/too-many-requests":
          "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
        "auth/network-request-failed":
          "Não foi possível conectar ao serviço de login. Confira a conexão e tente novamente.",
        "auth/operation-not-allowed":
          "O login com e-mail e senha está indisponível. Avise a equipe NAI.",
        "auth/user-disabled": "Esta conta está desativada. Solicite atendimento à equipe NAI.",
      };
      setMessage(
        errors[code] ||
          "Não foi possível concluir a autenticação. Tente novamente ou use Recuperar senha."
      );
    } finally {
      setCredentials((c) => ({ ...c, password: "" }));
      setBusy(false);
    }
  }
  async function uploadSigned() {
    if (!user || !signedFile || !signedAttestation || busy) return;
    const current = generation.current;
    setBusy(true);
    setMessage("");
    try {
      await user.reload();
      if (current !== generation.current) return;
      const token = await user.getIdToken(true);
      if (current !== generation.current) return;
      const data = new FormData();
      data.set("id", id);
      data.set("attestation", "true");
      data.set("file", signedFile);
      const response = await fetch("/api/clinic-portal/document", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });
      const result = await response.json();
      if (current !== generation.current) return;
      if (!response.ok) throw new Error(result.error);
      setView((current) => (current ? { ...current, documentReceived: true } : current));
      setMessage(result.message);
      setSignedFile(null);
      setSignedAttestation(false);
    } catch (error) {
      if (current === generation.current)
        setMessage(error instanceof Error ? error.message : "Falha no envio.");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-slate-950 text-white p-5 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <p className="text-cyan-300 font-bold">NEXTCON · NAI</p>
          <h1 className="text-3xl font-bold">Portal de atendimento ocupacional</h1>
          <p className="mt-2 text-slate-300">
            Acesso individual e restrito ao atendimento convidado.
          </p>
        </header>
        {!user ? (
          <form
            className="rounded-xl border border-slate-700 p-5 space-y-4 max-w-lg"
            onSubmit={(e) => {
              e.preventDefault();
              void login("login");
            }}
          >
            <h2 className="text-xl font-bold">Entrar com o e-mail convidado</h2>
            <label className="block">
              E-mail
              <input
                required
                type="email"
                autoComplete="username"
                className="block w-full rounded bg-slate-800 p-3"
                value={credentials.email}
                onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
              />
            </label>
            <label className="block">
              Senha
              <input
                required
                type="password"
                autoComplete="current-password"
                className="block w-full rounded bg-slate-800 p-3"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button disabled={busy} className="rounded bg-cyan-600 p-3">
                Entrar
              </button>
              <button
                disabled={busy || !credentials.email || credentials.password.length < 8}
                type="button"
                className="rounded border p-3"
                onClick={() => void login("create")}
              >
                Criar conta
              </button>
              <button
                disabled={busy || !credentials.email}
                type="button"
                className="rounded border p-3"
                onClick={() => void login("reset")}
              >
                Recuperar senha
              </button>
            </div>
          </form>
        ) : (
          <>
            <section className="rounded-xl border border-slate-700 p-4 space-y-3">
              <p>Conta: {user.email}</p>
              <p className="text-sm text-slate-300">
                {user.emailVerified
                  ? "E-mail confirmado."
                  : "Confirmação de e-mail pendente. Se já confirmou, clique em Atualizar confirmação e abrir."}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={busy}
                  className="rounded bg-cyan-600 p-3"
                  onClick={() => void call("read")}
                >
                  {view ? "Recarregar atendimento" : "Abrir atendimento"}
                </button>
                {!user.emailVerified && (
                  <button
                    disabled={busy}
                    className="rounded border p-3"
                    onClick={() => void call("read")}
                  >
                    Atualizar confirmação e abrir
                  </button>
                )}
                {!user.emailVerified && (
                  <button
                    disabled={busy}
                    className="rounded border p-3"
                    onClick={async () => {
                      try {
                        await sendEmailVerification(user);
                        setMessage("Confirmação enviada ao seu e-mail.");
                      } catch {
                        setMessage("Não foi possível enviar a confirmação.");
                      }
                    }}
                  >
                    Reenviar confirmação de e-mail
                  </button>
                )}
                <button
                  className="rounded border p-3"
                  onClick={() => {
                    generation.current++;
                    setView(null);
                    setForm(blank);
                    setBusy(false);
                    void signOut(auth);
                  }}
                >
                  Sair
                </button>
              </div>
            </section>
            {view && (
              <>
                <section className="rounded-xl border border-slate-700 p-5 space-y-2">
                  <h2 className="text-xl font-bold">{view.identity.employeeName}</h2>
                  <p>
                    {view.identity.companyName} · CNPJ {view.identity.cnpj}
                  </p>
                  <p>
                    CPF {view.identity.cpf} · {view.identity.roleTitle} · {view.identity.department}
                  </p>
                  <p>
                    {view.clinicName} · {view.identity.examType}
                  </p>
                  <p>
                    Situação:{" "}
                    {view.documentReceived ? "ASO recebido para conferência" : states[view.state]}
                  </p>
                  <p>Validade do acesso: {new Date(view.expiresAt).toLocaleDateString("pt-BR")}</p>
                  {view.state === "invited" && (
                    <button
                      disabled={busy}
                      className="rounded border p-3"
                      onClick={() => void call("confirm")}
                    >
                      Confirmar recebimento
                    </button>
                  )}
                </section>
                {view.role === "doctor" &&
                  view.state === "awaiting_signature" &&
                  !view.documentReceived && (
                    <section className="rounded-xl border border-cyan-700 p-5 space-y-3">
                      <h2 className="text-xl font-bold">Assinatura e devolução do ASO</h2>
                      <p>
                        Baixe a minuta, confira o PCMSO e as datas dos exames, complete os campos e
                        assine com seu procedimento habitual. Envie somente o ASO, sem ficha clínica
                        ou resultados detalhados.
                      </p>
                      <button
                        disabled={busy}
                        className="rounded border p-3"
                        onClick={async () => {
                          if (
                            view.clinical &&
                            view.exams &&
                            view.risks &&
                            view.doctorName &&
                            view.crm &&
                            view.uf
                          ) {
                            const { downloadAsoForSignature } =
                              await import("@/lib/clinic-portal/aso-pdf");
                            downloadAsoForSignature(
                              {
                                ...view,
                                exams: view.exams,
                                risks: view.risks,
                                doctorName: view.doctorName,
                                crm: view.crm,
                                uf: view.uf,
                              },
                              view.clinical
                            );
                          }
                        }}
                      >
                        Baixar ASO para completar e assinar
                      </button>
                      <label className="block">
                        ASO assinado em PDF (até 5 MB)
                        <input
                          disabled={busy}
                          type="file"
                          accept="application/pdf"
                          className="block"
                          onChange={(e) => setSignedFile(e.target.files?.[0] || null)}
                        />
                      </label>
                      <label className="flex gap-2">
                        <input
                          type="checkbox"
                          checked={signedAttestation}
                          onChange={(e) => setSignedAttestation(e.target.checked)}
                        />
                        Conferi e assinei o ASO. O arquivo contém somente o ASO deste colaborador.
                      </label>
                      <button
                        disabled={busy || !signedFile || !signedAttestation}
                        className="rounded bg-cyan-600 p-3 disabled:opacity-50"
                        onClick={() => void uploadSigned()}
                      >
                        Devolver ASO assinado
                      </button>
                    </section>
                  )}
                {view.role === "reception" ? (
                  <p>
                    Recebimento e identificação disponíveis. A ficha clínica é exclusiva do médico
                    convidado.
                  </p>
                ) : (
                  <form
                    className="space-y-4 rounded-xl border border-cyan-700 p-5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void call("save");
                    }}
                  >
                    <h2 className="text-xl font-bold">Ficha clínica · acesso médico</h2>
                    <p>
                      {view.doctorName} · CRM {view.crm}/{view.uf}
                    </p>
                    <p>
                      Riscos informados:{" "}
                      {view.risks?.join("; ") || "Não informados — conferir PGR/PCMSO."}
                    </p>
                    <p>Exames solicitados: {view.exams?.map((e) => e.name).join("; ")}</p>
                    <fieldset
                      disabled={busy || view.state === "awaiting_signature"}
                      className="space-y-4"
                    >
                      <label className="block">
                        Data efetiva do atendimento
                        <input
                          required
                          type="date"
                          className="block rounded bg-slate-800 p-3"
                          value={form.attendanceDate}
                          onChange={(e) => {
                            setForm({ ...form, attendanceDate: e.target.value });
                            setConfirmed(false);
                          }}
                        />
                      </label>
                      {(
                        [
                          ["history", "Anamnese / antecedentes pessoais e familiares"],
                          ["occupationalHistory", "História ocupacional, acidentes e afastamentos"],
                          ["medications", "Medicamentos e alergias"],
                          ["complaints", "Queixas atuais"],
                          ["vitalSigns", "Sinais vitais, peso e altura"],
                          ["physicalExam", "Exame físico"],
                          ["results", "Exames realizados, datas e resultados"],
                          ["conduct", "Conduta e encaminhamentos"],
                          ["observations", "Observações"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="block">
                          {label}
                          <textarea
                            rows={3}
                            maxLength={12000}
                            className="block w-full rounded bg-slate-800 p-3"
                            value={form[key]}
                            onChange={(e) => {
                              setForm({ ...form, [key]: e.target.value });
                              setConfirmed(false);
                            }}
                          />
                        </label>
                      ))}
                      <label className="block">
                        Conclusão médica
                        <select
                          className="block rounded bg-slate-800 p-3"
                          value={form.conclusion}
                          onChange={(e) => {
                            setForm({
                              ...form,
                              conclusion: e.target.value as ClinicalData["conclusion"],
                            });
                            setConfirmed(false);
                          }}
                        >
                          <option value="pendente">Pendente de avaliação</option>
                          <option value="apto">Apto</option>
                          <option value="inapto">Inapto</option>
                        </select>
                      </label>
                      <label className="flex gap-2">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          onChange={(e) => setConfirmed(e.target.checked)}
                        />
                        Revisei os dados e confirmo que registrei o atendimento realizado por mim.
                      </label>
                      <div className="flex gap-3">
                        <button className="rounded bg-cyan-600 p-3">Salvar rascunho</button>
                        <button
                          type="button"
                          disabled={!confirmed}
                          className="rounded border p-3 disabled:opacity-50"
                          onClick={() => void call("submit")}
                        >
                          Concluir preenchimento para assinatura
                        </button>
                      </div>
                    </fieldset>
                    <p className="text-sm text-amber-200">
                      Salvar ou concluir o preenchimento não constitui assinatura do ASO. O
                      documento permanece pendente de assinatura médica.
                    </p>
                  </form>
                )}
              </>
            )}
          </>
        )}
        {message && (
          <p role="status" className="rounded border border-slate-600 p-4">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
