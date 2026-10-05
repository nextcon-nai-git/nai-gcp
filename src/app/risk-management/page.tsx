"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useSgi } from "@/contexts/sgi-context";
import { usePgrCollection } from "@/hooks/use-pgr-workspace";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  calculateRiskScore,
  getDocumentedRiskScore,
  getRiskLevel,
  getRiskLevelColor,
  getRiskLevelLabel,
  RISK_CATEGORIES,
  type OccupationalRisk,
  type RiskCategory,
} from "@/lib/risk-assessment";
import { cn } from "@/lib/utils";

const INITIAL_FORM = {
  hazard: "",
  category: "acidente" as RiskCategory,
  source: "",
  ghe: "",
  exposedPeople: 1,
  probability: 1,
  severity: 1,
  controls: "",
  owner: "",
  dueDate: "",
};

export default function RiskInventoryPGR() {
  return (
    <React.Suspense fallback={<div className="p-6">Carregando inventário…</div>}>
      <RiskInventoryContent />
    </React.Suspense>
  );
}
function RiskInventoryContent() {
  const params = useSearchParams();
  const { activeClientId } = useSgi();
  const pgrSource = params.get("source") === "pgr";
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [form, setForm] = React.useState(INITIAL_FORM);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile, isLoading: isLoadingProfile } = useDoc(profileRef);
  const companyId =
    params.get("company") ||
    (activeClientId !== "all" && activeClientId !== "unauthorized"
      ? activeClientId
      : profile?.companyId) ||
    null;
  const importedRisks = usePgrCollection<OccupationalRisk>("risks", companyId, pgrSource);

  const risksRef = useMemoFirebase(() => {
    if (!db || !companyId || pgrSource) return null;
    return collection(db, "companies", companyId, "risks");
  }, [db, companyId, pgrSource]);
  const {
    data: legacyRisks,
    isLoading: legacyLoadingRisks,
    error: legacyError,
  } = useCollection<OccupationalRisk>(risksRef);
  const risks = pgrSource ? importedRisks.data : legacyRisks;
  const isLoadingRisks = pgrSource ? importedRisks.loading : legacyLoadingRisks;
  const error = pgrSource ? importedRisks.error : legacyError;

  const role = String(profile?.role ?? "").toUpperCase();
  const canManage = ["SUPER_ADMIN", "ADMIN", "CLIENT_ADMIN"].includes(role);
  const sortedRisks = React.useMemo(
    () =>
      [...(risks ?? [])].sort((a, b) => {
        const scoreA = getDocumentedRiskScore(a) ?? -1;
        const scoreB = getDocumentedRiskScore(b) ?? -1;
        return scoreB - scoreA;
      }),
    [risks]
  );

  const summary = React.useMemo(() => {
    const open = sortedRisks.filter((risk) => risk.status !== "controlled").length;
    const critical = sortedRisks.filter((risk) => {
      const score = getDocumentedRiskScore(risk);
      return score !== null && getRiskLevel(score) === "critico";
    }).length;
    const exposed = sortedRisks.reduce((total, risk) => total + Number(risk.exposedPeople || 0), 0);
    return { open, critical, exposed };
  }, [sortedRisks]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!risksRef || !user || !companyId) return;

    if (
      !form.hazard.trim() ||
      !form.ghe.trim() ||
      !form.source.trim() ||
      !form.owner.trim() ||
      !form.dueDate
    ) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Perigo, fonte, GHE, responsável e prazo são necessários.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(risksRef, {
        ...form,
        companyId,
        status: "identified",
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      setForm(INITIAL_FORM);
      setIsOpen(false);
      toast({
        title: "Risco registrado",
        description: "O item já aparece no inventário e na matriz de priorização.",
      });
    } catch {
      toast({
        title: "Não foi possível salvar",
        description: "Confira sua permissão e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(risk: OccupationalRisk) {
    if (!db || !companyId || !canManage) return;
    try {
      await deleteDoc(doc(db, "companies", companyId, "risks", risk.id));
      toast({ title: "Risco removido", description: `${risk.hazard} foi retirado do inventário.` });
    } catch {
      toast({ title: "Não foi possível remover", variant: "destructive" });
    }
  }

  const isLoading = isLoadingProfile || isLoadingRisks;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            GRO · NR-01
          </Badge>
          <h1 className="text-3xl font-black tracking-tight text-primary">Inventário de riscos</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Identifique perigos, avalie probabilidade e severidade e priorize controles com
            responsáveis e prazos.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              disabled={!canManage || !companyId || pgrSource}
              className="h-11 gap-2 px-6 font-bold"
            >
              <Plus className="size-4" /> Registrar risco
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-3xl p-7">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-primary">
                Novo risco ocupacional
              </DialogTitle>
              <DialogDescription>
                Os campos alimentam o inventário e a matriz 5 × 5. Revise a avaliação com o
                responsável técnico.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Perigo ou agente *">
                  <Input
                    value={form.hazard}
                    onChange={(e) => setForm({ ...form, hazard: e.target.value })}
                    placeholder="Ex.: ruído contínuo"
                  />
                </Field>
                <Field label="Categoria *">
                  <Select
                    value={form.category}
                    onValueChange={(value: RiskCategory) => setForm({ ...form, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RISK_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Fonte ou circunstância *">
                  <Input
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    placeholder="Ex.: serra circular"
                  />
                </Field>
                <Field label="Setor / GHE *">
                  <Input
                    value={form.ghe}
                    onChange={(e) => setForm({ ...form, ghe: e.target.value })}
                    placeholder="Ex.: produção A"
                  />
                </Field>
                <Field label="Pessoas expostas">
                  <Input
                    min={1}
                    type="number"
                    value={form.exposedPeople}
                    onChange={(e) => setForm({ ...form, exposedPeople: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Responsável *">
                  <Input
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                    placeholder="Nome ou função"
                  />
                </Field>
                <Field label="Probabilidade (1–5)">
                  <Input
                    min={1}
                    max={5}
                    type="number"
                    value={form.probability}
                    onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Severidade (1–5)">
                  <Input
                    min={1}
                    max={5}
                    type="number"
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Prazo da ação *">
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </Field>
                <div className="flex items-end">
                  <div className="w-full rounded-xl border bg-slate-50 p-3 text-sm">
                    Escore <strong>{calculateRiskScore(form.probability, form.severity)}</strong> ·{" "}
                    {getRiskLevelLabel(
                      getRiskLevel(calculateRiskScore(form.probability, form.severity))
                    )}
                  </div>
                </div>
              </div>
              <Field label="Controles existentes ou propostos">
                <Textarea
                  value={form.controls}
                  onChange={(e) => setForm({ ...form, controls: e.target.value })}
                  placeholder="Descreva medidas de eliminação, substituição, engenharia, administrativas ou EPI."
                />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}Salvar no inventário
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {!canManage && profile && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Seu perfil possui acesso de consulta. Um administrador da empresa deve registrar ou
          excluir riscos.
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={ClipboardCheck}
          label="Riscos mapeados"
          value={sortedRisks.length}
          tone="blue"
        />
        <SummaryCard icon={ShieldAlert} label="Ações em aberto" value={summary.open} tone="amber" />
        <SummaryCard
          icon={Users}
          label="Exposições registradas"
          value={summary.exposed}
          tone="violet"
        />
      </section>

      <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
        <CardHeader className="border-b bg-slate-50/70">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-black text-primary">
                Priorização do inventário
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Ordenado pelo escore de risco inerente (probabilidade × severidade).
              </p>
            </div>
            {summary.critical > 0 && (
              <Badge className="bg-red-100 text-red-800">
                <AlertTriangle className="mr-1 size-3" />
                {summary.critical} crítico(s)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <EmptyState
              title="Inventário indisponível"
              description="Não foi possível consultar os riscos desta empresa. Verifique sua permissão."
            />
          ) : !companyId ? (
            <EmptyState
              title="Empresa não configurada"
              description="Associe seu perfil a uma empresa para usar o inventário."
            />
          ) : sortedRisks.length === 0 ? (
            <EmptyState
              title="Nenhum risco registrado"
              description="Comece identificando o perigo, a fonte e o grupo exposto. Não exibimos dados simulados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Perigo</TableHead>
                  <TableHead>GHE / fonte</TableHead>
                  <TableHead>P × S</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead>Plano de controle</TableHead>
                  <TableHead className="pr-6 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRisks.map((risk) => {
                  const score = getDocumentedRiskScore(risk);
                  const level = score === null ? null : getRiskLevel(score);
                  return (
                    <TableRow key={risk.id}>
                      <TableCell className="pl-6">
                        <p className="font-bold text-primary">{risk.hazard}</p>
                        <p className="text-xs capitalize text-muted-foreground">{risk.category}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{risk.ghe}</p>
                        <p className="max-w-40 truncate text-xs text-muted-foreground">
                          {risk.source}
                        </p>
                        {risk.sourceEvidence && (
                          <details className="mt-2 max-w-xs text-xs text-muted-foreground">
                            <summary className="cursor-pointer">
                              Fonte: página {risk.sourceEvidence.pagina}
                            </summary>
                            <p className="mt-1">{risk.sourceEvidence.trecho}</p>
                          </details>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-black">
                          {score === null
                            ? "Pendente de avaliação"
                            : String(risk.probability) + " × " + risk.severity + " = " + score}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border-0",
                            level ? getRiskLevelColor(level) : "bg-slate-100 text-slate-700"
                          )}
                        >
                          {level ? getRiskLevelLabel(level) : "A revisar"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-52 truncate text-xs">
                          {risk.controls || "Controle ainda não informado"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {risk.owner} · {formatDate(risk.dueDate)}
                        </p>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button
                          aria-label={`Excluir ${risk.hazard}`}
                          disabled={!canManage || risk.sourceType === "pgr"}
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(risk)}
                        >
                          <Trash2 className="size-4 text-slate-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section className="rounded-3xl bg-[#071b33] p-6 text-white">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/10 p-3">
              <Activity className="size-6 text-cyan-300" />
            </div>
            <div>
              <h2 className="font-black">Decisão técnica, não automática</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-300">
                A matriz ajuda a ordenar a análise. Classificação, medidas e eficácia devem ser
                revisadas pelo responsável técnico e com participação dos trabalhadores.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="size-4" /> Dados reais da empresa
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: "blue" | "amber" | "violet";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <Card className="rounded-2xl border-slate-200">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("rounded-xl p-3", tones[tone])}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-2xl font-black text-primary">{value}</p>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
      <ClipboardCheck className="mb-3 size-9 text-slate-300" />
      <p className="font-bold text-primary">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "sem prazo";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`)
  );
}
