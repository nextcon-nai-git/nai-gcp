"use client";
import { getActionIdToken } from "@/lib/auth/action-token";

import * as React from "react";
import Link from "next/link";
import {
  MapPin,
  Plus,
  Search,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle2,
  Stethoscope,
  Globe,
  Zap,
  ShieldCheck,
  Building2,
  ExternalLink,
  Activity,
  HeartPulse,
  Sparkles,
  Camera,
  ImageIcon,
  Hospital,
  X,
  BadgeCheck,
  Mail,
  MessageCircle,
  Star,
  User,
  Copy,
  Printer,
  FileUp,
  Check,
  Briefcase,
  Info,
  Paperclip,
  FileSearch,
  FileText,
  Users,
  RefreshCw,
  ReceiptText,
  QrCode,
  Barcode,
  Calculator,
  Landmark,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ProviderAssessment,
  type ProviderAssessmentValues,
} from "@/components/providers/provider-assessment";
import { ProviderAccessState } from "@/components/providers/provider-access-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useCollection, useMemoFirebase, useStorage } from "@/firebase";
import { collection, query, orderBy, doc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";

import { enriquecerDadosEmpresa } from "@/actions/company-enrichment";
import { analyzeProviderContract } from "@/ai/flows/provider-contract-analysis-flow";
import Papa from "papaparse";
import { useSgi } from "@/contexts/sgi-context";
import { generateProviderInviteMessage } from "@/lib/domain-config";
import {
  canKeepProviderActive,
  createFirestoreProviderConditionalWriteStore,
  createFirestoreProviderReservationStore,
  hashProviderIdentifier,
  isProviderAssociatedWithCompany,
  isProviderCsvSizeAllowed,
  isValidProviderIdentifier,
  MAX_PROVIDER_CSV_BYTES,
  normalizeProviderName,
  previewProviderCsvRows,
  providerIdForIdentityHash,
  reserveAndWriteProvider,
  updateProviderIfCurrent,
  type ProviderCsvPreviewRow,
} from "@/lib/provider-integrity";

const providerSchema = z.object({
  name: z.string().min(3, "Nome obrigatório"),
  cnpj: z.string().optional().or(z.literal("")),
  profession: z.string().optional().or(z.literal("")),
  operationalFunction: z.string().optional().or(z.literal("")),
  councilNumber: z.string().optional(),
  rqe: z.string().optional(),
  type: z
    .enum(["CLINIC", "LAB", "DOCTOR", "HOSPITAL", "NURSE", "ENGINEER", "TECH_NURSE"])
    .optional(),
  specialty: z.string().optional().or(z.literal("")),
  cep: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  active: z.boolean().default(false),
  rating: z.number().min(1).max(5).optional(),
  contractUrl: z.string().optional(),
  photoUrl: z.string().optional(),
  councilCardUrl: z.string().optional(),
  servedCompanies: z.array(z.string()).default([]),
});

type ProviderFormValues = z.infer<typeof providerSchema>;
export interface ProviderItem extends Partial<ProviderFormValues>, Record<string, any> {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  aiContractAnalysis?: Record<string, unknown>;
}

type ProviderCsvImportResult = {
  rowNumber: number;
  status: "confirmed" | "duplicate" | "not_committed" | "committed_unconfirmed" | "outcome_unknown";
  message?: string;
};

function RatingStars({
  rating,
  onChange,
  readonly = false,
}: {
  rating: number;
  onChange?: (n: number) => void;
  readonly?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-0.5"
      role="img"
      aria-label={rating >= 1 && rating <= 5 ? `${rating} de 5 estrelas` : "Sem avaliação"}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={12}
          className={cn(
            "transition-all",
            star <= rating ? "fill-accent text-accent" : "text-slate-200 fill-none",
            !readonly && "cursor-pointer hover:scale-125"
          )}
          onClick={() => !readonly && onChange?.(star)}
        />
      ))}
    </div>
  );
}

export default function ProvidersManagement() {
  const { toast } = useToast();
  const { user, role, companyId, tenantId, isUserLoading, userError } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { activeClientId } = useSgi();
  const [isPending, startTransition] = React.useTransition();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [editingProvider, setEditingProvider] = React.useState<any>(null);
  const [selectedAdelmoPgr, setSelectedAdelmoPgr] = React.useState<any>(null);
  const [selectedNfse, setSelectedNfse] = React.useState<any>(null);
  const [selectedBoleto, setSelectedBoleto] = React.useState<any>(null);
  const [copiedPix, setCopiedPix] = React.useState(false);
  const [copiedBoleto, setCopiedBoleto] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isFetchingCnpj, setIsFetchingCnpj] = React.useState(false);
  const [isFetchingCep, setIsFetchingCep] = React.useState(false);
  const [isImportingCsv, setIsImportingCsv] = React.useState(false);
  const importedCsvIdentities = React.useRef<
    Map<string, { name: string; cnpj: string; taxIdStatus: string }>
  >(new Map());
  const manualProviderAttempts = React.useRef(new Map<string, string>());
  const [csvPreview, setCsvPreview] = React.useState<{
    rows: ProviderCsvPreviewRow[];
    errors: string[];
    results?: ProviderCsvImportResult[];
  } | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = React.useState(false);

  const [tempContract, setTempContract] = React.useState<File | null>(null);
  const [tempPhoto, setTempPhoto] = React.useState<File | null>(null);
  const [tempCouncilCard, setTempCouncilCard] = React.useState<File | null>(null);

  const isGlobalAdmin = React.useMemo(
    () =>
      role === "SUPER_ADMIN" ||
      (["ADMIN", "OPERATIONS"].includes(role || "") &&
        (tenantId == null || tenantId === "") &&
        (companyId == null || companyId === "" || companyId === "nextcon")),
    [role, companyId, tenantId]
  );

  const [providerQueryVersion, setProviderQueryVersion] = React.useState(0);

  const providersQuery = useMemoFirebase(() => {
    if (!db || isUserLoading || !isGlobalAdmin) return null;
    return query(collection(db, "providers"), orderBy("name", "asc"));
  }, [db, isUserLoading, isGlobalAdmin, user?.uid, providerQueryVersion]);

  const { data: providers, isLoading, error: providersError } = useCollection(providersQuery);

  const activeProvidersList = React.useMemo(() => {
    return (providers || []).filter((provider: ProviderItem) => provider && !provider.isDeleted);
  }, [providers]);

  const handleDeleteProvider = async (provider: ProviderItem) => {
    if (!db || !isGlobalAdmin || !provider?.id) return;
    const confirmDelete = window.confirm(
      `Deseja arquivar o cadastro do prestador "${provider.name || "Selecionado"}"?`
    );
    if (!confirmDelete) return;

    try {
      const providerRef = doc(db, "providers", provider.id);
      await updateProviderIfCurrent({
        store: createFirestoreProviderConditionalWriteStore(db),
        reference: providerRef,
        expected: provider,
        update: {
          active: false,
          isDeleted: true,
          archivedAt: serverTimestamp(),
          archivedBy: user?.uid || null,
          updatedAt: serverTimestamp(),
          revision: Number(provider.revision || 0) + 1,
        },
        verify: { isDeleted: true, active: false },
      });
      toast({
        title: "Cadastro Arquivado",
        description: `${provider.name || "Prestador"} foi arquivado após confirmação da gravação.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Falha ao arquivar cadastro",
        description: err.message || "A gravação não foi confirmada. Tente novamente.",
      });
    }
  };

  const companiesQuery = useMemoFirebase(() => {
    if (!db || isUserLoading || !isGlobalAdmin) return null;
    return query(collection(db, "companies"), orderBy("name", "asc"));
  }, [db, isUserLoading, isGlobalAdmin, user?.uid, providerQueryVersion]);
  const {
    data: companies,
    isLoading: companiesLoading,
    error: companiesError,
  } = useCollection(companiesQuery);

  const filteredProviders = React.useMemo(() => {
    const term = searchTerm.toLowerCase();
    const companyScope =
      isGlobalAdmin && activeClientId === "unauthorized" ? "all" : activeClientId;
    return activeProvidersList
      .filter((p: ProviderItem) => {
        if (!isProviderAssociatedWithCompany(p, companyScope)) return false;
        return (
          (p.name || p.displayName || "").toLowerCase().includes(term) ||
          (p.cnpj || "").includes(term) ||
          (p.profession || "").toLowerCase().includes(term) ||
          (p.specialty || p.category || "").toLowerCase().includes(term)
        );
      })
      .sort((a: ProviderItem, b: ProviderItem) => {
        const aHasPhoto = !!a.photoUrl;
        const bHasPhoto = !!b.photoUrl;
        if (aHasPhoto && !bHasPhoto) return -1;
        if (!aHasPhoto && bHasPhoto) return 1;
        return (a.name || a.displayName || "").localeCompare(b.name || b.displayName || "");
      });
  }, [activeProvidersList, searchTerm, activeClientId, isGlobalAdmin]);

  React.useLayoutEffect(() => {
    setEditingProvider(null);
    setIsCreateOpen(false);
    setSelectedAdelmoPgr(null);
    setSelectedNfse(null);
    setSelectedBoleto(null);
    setCsvPreview(null);
    setSearchTerm("");
    importedCsvIdentities.current.clear();
    manualProviderAttempts.current.clear();
  }, [user?.uid, companyId, role, activeClientId]);

  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      name: "",
      cnpj: "",
      profession: "",
      operationalFunction: "",
      councilNumber: "",
      rqe: "",
      specialty: "",
      cep: "",
      city: "",
      state: "",
      address: "",
      email: "",
      phone: "",
      active: false,
      contractUrl: "",
      photoUrl: "",
      councilCardUrl: "",
      servedCompanies: [],
    },
  });

  React.useEffect(() => {
    if (!isCreateOpen) {
      setTempContract(null);
      setTempPhoto(null);
      setTempCouncilCard(null);
      return;
    }

    if (editingProvider) {
      form.reset({
        name: editingProvider.name || "",
        cnpj: editingProvider.cnpj || "",
        profession: editingProvider.profession || "",
        operationalFunction: editingProvider.operationalFunction || "",
        councilNumber: editingProvider.councilNumber || "",
        rqe: editingProvider.rqe || "",
        type: editingProvider.type || undefined,
        specialty: editingProvider.specialty || "",
        cep: editingProvider.cep || "",
        city: editingProvider.city || "",
        state: editingProvider.state || "",
        address: editingProvider.address || "",
        email: editingProvider.email || "",
        phone: editingProvider.phone || "",
        active: editingProvider.active ?? false,
        rating: editingProvider.rating ?? undefined,
        contractUrl: editingProvider.contractUrl || "",
        photoUrl: editingProvider.photoUrl || "",
        councilCardUrl: editingProvider.councilCardUrl || "",
        servedCompanies: editingProvider.servedCompanies || [],
      });
    } else {
      form.reset({
        name: "",
        cnpj: "",
        profession: "",
        operationalFunction: "",
        councilNumber: "",
        rqe: "",
        type: undefined,
        specialty: "",
        cep: "",
        city: "",
        state: "",
        address: "",
        email: "",
        phone: "",
        active: false,
        contractUrl: "",
        photoUrl: "",
        councilCardUrl: "",
        servedCompanies: [],
      });
    }
    setTempContract(null);
    setTempPhoto(null);
    setTempCouncilCard(null);
  }, [editingProvider, isCreateOpen]);

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Falha na leitura do arquivo."));
      reader.readAsDataURL(file);
    });
  };

  const handleAiContractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.includes("pdf")) {
      toast({
        variant: "destructive",
        title: "Apenas PDF",
        description: "O contrato deve estar em formato PDF para análise IA.",
      });
      return;
    }

    setIsAiAnalyzing(true);
    setIsCreateOpen(true);

    try {
      const base64 = await readFileAsDataURL(file);
      const result = await analyzeProviderContract(
        { pdfDataUri: base64 },
        await getActionIdToken()
      );

      if (result) {
        form.setValue("name", result.name.toUpperCase());
        form.setValue("cnpj", result.cnpj);
        form.setValue("city", result.city);
        form.setValue("state", result.state);
        form.setValue("address", result.address);
        form.setValue("email", result.email || "");
        form.setValue("phone", result.phone || "");

        setTempContract(file);
        toast({
          title: "Análise IA Concluída",
          description: "Os dados do contrato foram extraídos com sucesso.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Falha na Análise",
        description: "Não foi possível concluir a análise. Tente novamente ou contate o suporte.",
      });
    } finally {
      setIsAiAnalyzing(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = e.target.files?.[0];
    if (!file) return;
    if (!db || !isGlobalAdmin || !providers || providersError) {
      toast({
        variant: "destructive",
        title: "Dados indisponíveis",
        description: "Aguarde uma leitura autorizada dos prestadores antes de importar.",
      });
      input.value = "";
      return;
    }
    if (!isProviderCsvSizeAllowed(file.size)) {
      toast({
        variant: "destructive",
        title: "Arquivo excede o limite",
        description: `O CSV deve ter no máximo ${MAX_PROVIDER_CSV_BYTES / 1_000_000} MB.`,
      });
      input.value = "";
      return;
    }

    setIsImportingCsv(true);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const preview = previewProviderCsvRows(result.data, [
          ...providers,
          ...importedCsvIdentities.current.values(),
        ]);
        const parseErrors = result.errors.map(
          ({ row, message }) => `Linha ${(row ?? 0) + 2}: ${message}`
        );
        if (result.data.length === 0) parseErrors.push("O CSV não contém linhas para importar.");
        setCsvPreview({
          rows: preview.rows.map((row) =>
            row.record ? { ...row, attemptId: crypto.randomUUID() } : row
          ),
          errors: [...preview.errors, ...parseErrors],
        });
        setIsImportingCsv(false);
        input.value = "";
      },
      error: (error) => {
        setCsvPreview({ rows: [], errors: [error.message] });
        setIsImportingCsv(false);
        input.value = "";
      },
    });
  };

  const confirmCsvImport = async () => {
    if (!db || !isGlobalAdmin || !providers || !csvPreview || csvPreview.errors.length > 0) return;
    setIsImportingCsv(true);
    const previousResults = new Map<number, ProviderCsvImportResult>(
      (csvPreview.results || []).map((result) => [result.rowNumber, result])
    );
    const results: ProviderCsvImportResult[] = [];
    const store = createFirestoreProviderReservationStore(db);

    for (const row of csvPreview.rows) {
      const previous = previousResults.get(row.rowNumber);
      if (
        previous &&
        (previous.status === "confirmed" ||
          previous.status === "duplicate" ||
          (previous.status !== "not_committed" &&
            previous.status !== "committed_unconfirmed" &&
            previous.status !== "outcome_unknown"))
      ) {
        results.push(previous);
        continue;
      }
      if (!row.record) {
        if (previous) results.push(previous);
        else
          results.push({
            rowNumber: row.rowNumber,
            status: "not_committed",
            message: row.errors.join(" "),
          });
        continue;
      }
      if (!row.attemptId) {
        results.push({
          rowNumber: row.rowNumber,
          status: "not_committed",
          message: "Intento sem identificador. Reabra a prévia para gerar uma nova chave.",
        });
        continue;
      }

      const identityHash = await hashProviderIdentifier(row.record.cnpj);
      const providerId = providerIdForIdentityHash(identityHash);
      const providerRef = doc(db, "providers", providerId);
      const reservationRef = doc(db, "provider_tax_id_reservations", identityHash);
      const legacyProviderRefs = providers
        .filter(
          (provider: ProviderItem) =>
            (provider.cnpj || "").replace(/[^a-z\d]/gi, "").toUpperCase() === row.record?.cnpj ||
            (provider.taxIdStatus === "verified" &&
              normalizeProviderName(provider.name || "") ===
                normalizeProviderName(row.record?.name || ""))
        )
        .map((provider: ProviderItem) => doc(db, "providers", provider.id));
      const providerData = {
        ...row.record,
        id: providerId,
        taxIdStatus: "pending_verification",
        active: false,
        isDeleted: false,
        importAttemptId: row.attemptId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        version: "3.3",
        revision: 1,
      };
      const outcome = await reserveAndWriteProvider({
        store,
        reservationRef,
        providerRef,
        legacyProviderRefs,
        attemptId: row.attemptId,
        identifier: row.record.cnpj,
        identityHash,
        providerData,
      });
      if (outcome.status === "confirmed") {
        importedCsvIdentities.current.set(row.record.cnpj, {
          name: row.record.name,
          cnpj: row.record.cnpj,
          taxIdStatus: "pending_verification",
        });
      }
      results.push({
        rowNumber: row.rowNumber,
        status: outcome.status,
        message:
          outcome.status === "duplicate"
            ? "Documento reservado por outro cadastro ou já existente; nenhum cadastro foi sobrescrito."
            : outcome.status === "not_committed"
              ? "A transação não foi gravada. O mesmo intento pode ser tentado novamente."
              : outcome.status === "committed_unconfirmed"
                ? "A gravação foi confirmada pela transação, mas a releitura do servidor falhou. Repita o mesmo intento para confirmar."
                : outcome.status === "outcome_unknown"
                  ? "O resultado do commit é desconhecido. Repita o mesmo intento; não será criado outro documento."
                  : undefined,
      });
    }

    setCsvPreview({ ...csvPreview, results });
    const saved = results.filter((result) => result.status === "confirmed").length;
    const unresolved = results.filter(
      (result) => result.status === "committed_unconfirmed" || result.status === "outcome_unknown"
    ).length;
    const failed = results.length - saved - unresolved;
    toast({
      variant: failed > 0 || unresolved > 0 ? "destructive" : "default",
      title: unresolved
        ? "Confirmação pendente"
        : failed > 0
          ? "Importação parcial"
          : "Importação confirmada",
      description: `${saved} linhas confirmadas por releitura do servidor; ${unresolved} commits sem confirmação; ${failed} não gravadas. Nenhuma conta de acesso foi criada.`,
    });
    setIsImportingCsv(false);
  };

  async function handleSave(values: ProviderFormValues) {
    if (!db || !storage || !isGlobalAdmin) return;
    if (!providers || providersError) {
      toast({
        variant: "destructive",
        title: "Dados indisponíveis",
        description: "Aguarde uma leitura autorizada dos prestadores antes de salvar.",
      });
      return;
    }
    setIsSubmitting(true);

    try {
      const submittedIdentifier = (values.cnpj || "").replace(/[^a-z\d]/gi, "").toUpperCase();
      const previousIdentifier = (editingProvider?.cnpj || "")
        .replace(/[^a-z\d]/gi, "")
        .toUpperCase();
      const identityChanged =
        submittedIdentifier !== previousIdentifier ||
        normalizeProviderName(values.name) !== normalizeProviderName(editingProvider?.name || "");
      if (submittedIdentifier && submittedIdentifier !== previousIdentifier) {
        if (!isValidProviderIdentifier(submittedIdentifier)) {
          throw new Error("Informe um CPF/CNPJ válido ou deixe o documento pendente.");
        }
        const conflictingProvider = providers.find(
          (provider: ProviderItem) =>
            provider.id !== editingProvider?.id &&
            (provider.cnpj || "").replace(/[^a-z\d]/gi, "").toUpperCase() === submittedIdentifier
        );
        if (conflictingProvider) {
          throw new Error("Este CPF/CNPJ já está vinculado a outro cadastro.");
        }
      }
      if (editingProvider && submittedIdentifier !== previousIdentifier) {
        throw new Error(
          "O CPF/CNPJ não pode ser alterado em um cadastro existente. Cadastre outro prestador para reservar a nova identidade."
        );
      }
      const verifiedNameConflict = providers.find(
        (provider: ProviderItem) =>
          provider.id !== editingProvider?.id &&
          provider.taxIdStatus === "verified" &&
          normalizeProviderName(provider.name || "") === normalizeProviderName(values.name) &&
          (provider.cnpj || "").replace(/[^a-z\d]/gi, "").toUpperCase() !== submittedIdentifier
      );
      if (verifiedNameConflict) {
        throw new Error("O nome conflita com um cadastro fiscal verificado.");
      }

      const createAttemptKey = submittedIdentifier || `draft:${normalizeProviderName(values.name)}`;
      let createAttemptId = manualProviderAttempts.current.get(createAttemptKey);
      if (!editingProvider && !createAttemptId) {
        createAttemptId = crypto.randomUUID();
        manualProviderAttempts.current.set(createAttemptKey, createAttemptId);
      }
      const identityHash = submittedIdentifier
        ? await hashProviderIdentifier(submittedIdentifier)
        : await hashProviderIdentifier(`draft-${createAttemptId}`);
      const providerId = editingProvider?.id || providerIdForIdentityHash(identityHash);
      let finalContractUrl = values.contractUrl;
      let finalPhotoUrl = values.photoUrl;
      let finalCouncilCardUrl = values.councilCardUrl;

      if (tempContract) {
        const snap = await uploadBytes(
          ref(storage, `providers/contracts/${providerId}_${Date.now()}.pdf`),
          tempContract
        );
        finalContractUrl = await getDownloadURL(snap.ref);
      }
      if (tempPhoto) {
        const snap = await uploadBytes(
          ref(storage, `providers/photos/${providerId}_${Date.now()}`),
          tempPhoto
        );
        finalPhotoUrl = await getDownloadURL(snap.ref);
      }
      if (tempCouncilCard) {
        const snap = await uploadBytes(
          ref(storage, `providers/council/${providerId}_${Date.now()}`),
          tempCouncilCard
        );
        finalCouncilCardUrl = await getDownloadURL(snap.ref);
      }

      const data: Record<string, unknown> = {
        ...values,
        cnpj: values.cnpj || "",
        taxIdType: submittedIdentifier
          ? !identityChanged && editingProvider?.taxIdType
            ? editingProvider.taxIdType
            : submittedIdentifier.length === 11
              ? "CPF"
              : "CNPJ"
          : undefined,
        contractUrl: finalContractUrl,
        photoUrl: finalPhotoUrl,
        councilCardUrl: finalCouncilCardUrl,
      };
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) delete data[key];
      }

      const providerRef = doc(db, "providers", providerId);
      let taxIdStatus: string | undefined;
      let active = false;
      if (editingProvider) {
        taxIdStatus = identityChanged
          ? "pending_verification"
          : (editingProvider.taxIdStatus as string | undefined);
        active =
          taxIdStatus === "pending_verification"
            ? false
            : canKeepProviderActive(taxIdStatus, editingProvider.active === true, !identityChanged)
              ? (values.active ?? editingProvider.active === true)
              : false;
        await updateProviderIfCurrent({
          store: createFirestoreProviderConditionalWriteStore(db),
          reference: providerRef,
          expected: editingProvider,
          update: {
            ...data,
            active,
            ...(taxIdStatus ? { taxIdStatus } : {}),
            updatedAt: serverTimestamp(),
            revision: Number(editingProvider.revision || 0) + 1,
          },
          verify: {
            name: values.name,
            cnpj: values.cnpj || "",
            active,
            taxIdStatus,
          },
        });
      } else {
        const providerData = {
          ...data,
          id: providerId,
          active: false,
          taxIdStatus: "pending_verification",
          ...(submittedIdentifier
            ? { taxIdType: submittedIdentifier.length === 11 ? "CPF" : "CNPJ" }
            : {}),
          importAttemptId: createAttemptId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isDeleted: false,
          version: "3.3",
          revision: 1,
        };
        const store = createFirestoreProviderReservationStore(db);
        const reservationRef = doc(db, "provider_tax_id_reservations", identityHash);
        const legacyProviderRefs = providers
          .filter(
            (provider: ProviderItem) =>
              (!!submittedIdentifier &&
                (provider.cnpj || "").replace(/[^a-z\d]/gi, "").toUpperCase() ===
                  submittedIdentifier) ||
              (provider.taxIdStatus === "verified" &&
                normalizeProviderName(provider.name || "") === normalizeProviderName(values.name))
          )
          .map((provider: ProviderItem) => doc(db, "providers", provider.id));
        const outcome = await reserveAndWriteProvider({
          store,
          reservationRef,
          providerRef,
          legacyProviderRefs,
          attemptId: createAttemptId!,
          identifier: submittedIdentifier,
          identityHash,
          providerData,
        });
        if (outcome.status !== "confirmed") {
          const detail =
            outcome.status === "duplicate"
              ? "Este documento já existe ou está reservado por outra sessão."
              : outcome.status === "not_committed"
                ? "A transação não foi gravada; repita o mesmo intento."
                : outcome.status === "committed_unconfirmed"
                  ? "A gravação ocorreu, mas a releitura do servidor falhou. Repita o mesmo intento para confirmar."
                  : "O resultado do commit é desconhecido. Repita o mesmo intento; não criaremos outro documento.";
          throw new Error(detail);
        }
        taxIdStatus = "pending_verification";
        active = false;
      }

      toast({
        title: "Registro Protocolado",
        description: `Cadastro profissional gravado e relido. ${
          taxIdStatus === "verified"
            ? "A identificação fiscal verificada foi preservada."
            : taxIdStatus === "pending_verification"
              ? "A identificação fiscal permanece pendente até confirmação independente."
              : "Os dados fiscais legados foram preservados sem alteração de status."
        } Acesso e permissões são provisionados separadamente.`,
      });
      setIsCreateOpen(false);
      setEditingProvider(null);
      manualProviderAttempts.current.delete(createAttemptKey);
      form.reset();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na Gravação", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleFetchCnpj = async () => {
    const cnpj = form.getValues("cnpj")?.replace(/\D/g, "");
    if (!cnpj || cnpj.length < 14) return;
    setIsFetchingCnpj(true);
    try {
      const res = await enriquecerDadosEmpresa(cnpj, 0);
      if (res.sucesso && res.dados) {
        if (res.dados.razaoSocial) form.setValue("name", res.dados.razaoSocial.toUpperCase());
        if (res.dados.municipio) form.setValue("city", res.dados.municipio);
        if (res.dados.uf) form.setValue("state", res.dados.uf);
        if (res.dados.logradouro)
          form.setValue(
            "address",
            `${res.dados.logradouro}, ${res.dados.numero || ""} - ${res.dados.bairro || ""}`
          );
        toast({ title: "CNPJ Localizado" });
      }
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  const handleFetchCep = async () => {
    const cep = form.getValues("cep")?.replace(/\D/g, "");
    if (!cep || cep.length < 8) return;
    setIsFetchingCep(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
      if (res.ok) {
        const data = await res.json();
        form.setValue("city", data.city);
        form.setValue("state", data.state);
        form.setValue("address", `${data.street || ""} - ${data.neighborhood || ""}`);
        toast({ title: "Endereço Localizado" });
      }
    } finally {
      setIsFetchingCep(false);
    }
  };

  if (isUserLoading || userError || !isGlobalAdmin || activeClientId === "unauthorized") {
    return (
      <ProviderAccessState
        loading={isUserLoading}
        error={userError}
        authorized={isGlobalAdmin && activeClientId !== "unauthorized"}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 text-left">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-white font-black text-[9px] uppercase tracking-widest">
              TÉCNICOS, MÉDICOS & ENGENHEIROS
            </Badge>
            <Link href="/accredited-network">
              <Badge
                variant="outline"
                className="border-accent/40 text-accent hover:bg-accent/10 cursor-pointer transition-all text-[9px] font-black uppercase flex items-center gap-1"
              >
                <MapPin size={10} /> Ir para Rede Credenciada (Clínicas Ocupacionais)
              </Badge>
            </Link>
          </div>
          <h1 className="text-3xl font-headline font-black text-primary uppercase leading-tight">
            Prestadores de Serviços SST
          </h1>
          <p className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest flex items-center gap-2">
            <Users className="size-3 text-accent" /> Gestão de Engenheiros, Médicos Ocupacionais,
            Enfermeiros e Peritos Credenciados.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            disabled={isImportingCsv}
            onClick={() => document.getElementById("provider-csv-import")?.click()}
            className="h-11 px-5 border-accent text-accent hover:bg-accent/10 font-black uppercase text-[10px] gap-2 rounded-xl"
          >
            {isImportingCsv ? <Loader2 className="size-4 animate-spin" /> : <FileUp size={16} />}
            Importar CSV
          </Button>
          <input
            id="provider-csv-import"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCsvImport}
          />
          <Button
            variant="outline"
            disabled={isAiAnalyzing}
            className="h-11 px-6 border-accent text-accent font-black uppercase text-[10px] gap-2 rounded-xl bg-accent/5 hover:bg-accent/10"
            onClick={() => document.getElementById("ai-onboarding")?.click()}
          >
            {isAiAnalyzing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}{" "}
            Análise de Contrato (IA)
          </Button>
          <input
            id="ai-onboarding"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleAiContractUpload}
          />

          <Button
            onClick={() => {
              setEditingProvider(null);
              setIsCreateOpen(true);
            }}
            className="gradient-nextcon text-white h-11 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg"
          >
            <Plus className="size-4 text-accent mr-2" /> Novo Credenciamento
          </Button>
        </div>
      </header>

      <div className="relative group">
        <Search className="absolute left-4 top-3.5 size-5 text-slate-300 group-focus-within:text-primary transition-colors" />
        <Input
          placeholder="Pesquisar por nome, profissão ou especialidade..."
          className="pl-12 h-12 bg-white border-none shadow-sm rounded-xl font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {csvPreview && (
        <Card className="border border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Prévia da importação</CardTitle>
            <CardDescription>
              {csvPreview.rows.filter((row) => row.record).length} linhas aptas para tentativa de
              gravação; {csvPreview.rows.filter((row) => !row.record).length} recusadas. Documentos
              fiscais permanecem pendentes e nenhuma conta ou permissão será criada.
            </CardDescription>
            {csvPreview.errors.map((error) => (
              <p key={error} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ))}
          </CardHeader>
          <CardContent className="space-y-3">
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {csvPreview.rows.map((row) => {
                  const result = csvPreview.results?.find(
                    (item) => item.rowNumber === row.rowNumber
                  );
                  return (
                    <div
                      key={row.rowNumber}
                      className="grid grid-cols-[auto_1fr_1fr_2fr] gap-3 border-b py-2 text-xs"
                    >
                      <span>Linha {row.rowNumber}</span>
                      <span>{row.record?.name || "—"}</span>
                      <span>{row.record?.cnpj || "—"}</span>
                      <span
                        className={
                          result?.status === "confirmed"
                            ? "text-emerald-700"
                            : "text-muted-foreground"
                        }
                      >
                        {result
                          ? result.status === "confirmed"
                            ? "Gravado e confirmado por leitura"
                            : result.message || "Falha na gravação"
                          : row.errors.length
                            ? row.errors.join(" ")
                            : "Aguardando confirmação"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCsvPreview(null)}
                disabled={isImportingCsv}
              >
                Fechar prévia
              </Button>
              {!csvPreview.results && (
                <Button
                  type="button"
                  onClick={confirmCsvImport}
                  disabled={
                    isImportingCsv ||
                    csvPreview.errors.length > 0 ||
                    !csvPreview.rows.some((row) => row.record)
                  }
                >
                  {isImportingCsv && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Confirmar gravação dos válidos
                </Button>
              )}
              {csvPreview.results?.some(
                (result) =>
                  result.status === "not_committed" ||
                  result.status === "committed_unconfirmed" ||
                  result.status === "outcome_unknown"
              ) && (
                <Button type="button" onClick={confirmCsvImport} disabled={isImportingCsv}>
                  {isImportingCsv && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Repetir tentativas incertas
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="card-shadow border-none bg-white rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30 text-[10px] font-black uppercase">
              <TableRow>
                <TableHead className="pl-10 py-5">Profissional / Clínica</TableHead>
                <TableHead>Profissão / Escopo</TableHead>
                <TableHead>Unidades (Vínculos)</TableHead>
                <TableHead className="text-center">Rating</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="pr-10 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-20 text-center">
                    <Loader2 className="size-10 animate-spin mx-auto text-primary opacity-20" />
                  </TableCell>
                </TableRow>
              ) : providersError ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <p role="alert" className="mb-3 text-destructive">
                      Não foi possível carregar os cadastros autorizados.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setProviderQueryVersion((version) => version + 1)}
                    >
                      <RefreshCw className="mr-2 size-4" /> Tentar novamente
                    </Button>
                  </TableCell>
                </TableRow>
              ) : filteredProviders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-20 text-center text-muted-foreground">
                    {providers?.length
                      ? "Nenhum cadastro corresponde à pesquisa ou ao vínculo explícito selecionado."
                      : "Nenhum prestador foi confirmado na base de dados."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProviders.map((provider) => (
                  <TableRow
                    key={provider.id}
                    className="hover:bg-slate-50/50 transition-colors group border-b last:border-none"
                  >
                    <TableCell className="pl-10 py-6">
                      <div className="flex items-center gap-5">
                        <div className="size-12 rounded-[1.25rem] bg-primary/5 flex items-center justify-center text-primary font-black text-xs shadow-inner shrink-0 overflow-hidden relative">
                          {provider.photoUrl ? (
                            <img
                              src={provider.photoUrl}
                              className="object-cover w-full h-full"
                              alt=""
                            />
                          ) : (
                            <User size={20} className="text-slate-300" />
                          )}
                        </div>
                        <div className="text-left">
                          <button
                            type="button"
                            className="font-black text-sm text-primary uppercase leading-tight truncate max-w-[300px] text-left hover:underline"
                            onClick={() => {
                              setEditingProvider(provider);
                              setIsCreateOpen(true);
                            }}
                          >
                            {provider.name}
                          </button>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
                            Vínculo: {provider.id}
                          </p>
                          <p className="text-[8px] text-amber-700 font-bold uppercase mt-1">
                            {provider.taxIdStatus === "verified"
                              ? "Identificação fiscal confirmada"
                              : "Identificação fiscal não confirmada"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-[8px] font-black uppercase border-slate-200 text-slate-500 mb-1"
                      >
                        {provider.profession || "Profissão não informada"}
                      </Badge>
                      {provider.operationalFunction && (
                        <p className="text-[10px] font-bold text-slate-500 truncate max-w-[180px]">
                          Função: {provider.operationalFunction}
                        </p>
                      )}
                      <p className="text-[10px] font-bold text-slate-400 truncate max-w-[180px]">
                        Especialidade registrada: {provider.specialty || "Não informada"}
                      </p>
                      {provider.rqe && (
                        <p className="text-[9px] text-slate-400">RQE: {provider.rqe}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {(() => {
                          const explicitCompanies = Array.isArray(provider.servedCompanies)
                            ? provider.servedCompanies
                            : provider.companyId
                              ? [provider.companyId]
                              : [];

                          if (explicitCompanies.length === 0) {
                            return (
                              <span className="text-[8px] text-slate-400 uppercase italic">
                                Sem vínculo confirmado
                              </span>
                            );
                          }

                          return explicitCompanies.map((cid: string) => {
                            const compObj = companies?.find((c) => c.id === cid || c.name === cid);
                            const compName = compObj?.name || cid;

                            return (
                              <TooltipProvider key={cid} delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="secondary"
                                      className="text-[7px] font-black uppercase bg-primary/5 text-primary border-none cursor-pointer hover:bg-primary/10 hover:scale-105 transition-all py-1 px-2"
                                    >
                                      {compName.length > 12
                                        ? `${compName.substring(0, 12)}...`
                                        : compName}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="bg-[#001F3F] text-white border border-accent/30 rounded-xl px-3.5 py-2.5 shadow-2xl space-y-1 max-w-xs z-50 animate-in fade-in-0 zoom-in-95"
                                  >
                                    <p className="text-[9px] font-black uppercase text-accent tracking-widest flex items-center gap-1">
                                      <Sparkles size={10} /> {compName}
                                    </p>
                                    <p className="text-[11px] font-extrabold text-white leading-tight">
                                      Vínculo de atendimento cadastrado explicitamente
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          });
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <RatingStars rating={provider.rating ?? 0} readonly />
                        <span className="text-[8px] font-black text-slate-300 uppercase">
                          {provider.rating ? "Qualidade registrada" : "Sem avaliação"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        className={cn(
                          "text-[9px] font-black uppercase px-3 h-6 border-none",
                          provider.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {provider.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-10 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {provider.boletoData && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBoleto(provider.boletoData);
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-black text-[9px] uppercase tracking-widest h-8 px-3 rounded-xl gap-1.5 shadow-sm shrink-0"
                          >
                            <Barcode size={12} className="text-accent" /> Boleto Sicredi (R${" "}
                            {Number(provider.boletoData.valorDocumento || 690).toFixed(0)})
                          </Button>
                        )}
                        {provider.nfseData && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedNfse(provider.nfseData);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-widest h-8 px-3 rounded-xl gap-1.5 shadow-sm shrink-0"
                          >
                            <ReceiptText size={12} className="text-accent" /> NFS-e nº{" "}
                            {provider.nfseData.numeroNfse}
                          </Button>
                        )}
                        {provider.pgrReportData && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAdelmoPgr(provider.pgrReportData);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[9px] uppercase tracking-widest h-8 px-3 rounded-xl gap-1 shadow-sm shrink-0"
                          >
                            <FileText size={12} className="text-accent" /> PGR DW Montec
                          </Button>
                        )}
                        {(provider.phone || provider.whatsapp) && (
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={`https://wa.me/55${(provider.whatsapp || provider.phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(generateProviderInviteMessage(provider.name, provider.email || "seu@email.com.br"))}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center justify-center size-8 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition-all hover:scale-110 shrink-0"
                                >
                                  <MessageCircle size={16} />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-[#001F3F] text-white border border-emerald-500/30 text-[10px] font-extrabold uppercase px-3 py-1.5 shadow-xl"
                              >
                                Convite Portal NAI via WhatsApp
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 text-slate-300 hover:text-primary"
                            >
                              <MoreVertical size={18} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-60 rounded-2xl border-none shadow-2xl p-2"
                          >
                            {provider.boletoData && (
                              <DropdownMenuItem
                                className="gap-3 py-3 text-xs font-bold uppercase cursor-pointer text-amber-800 bg-amber-50/70 mb-1 rounded-xl"
                                onClick={() => setSelectedBoleto(provider.boletoData)}
                              >
                                <Barcode size={14} /> Ver Boleto Sicredi (R${" "}
                                {Number(provider.boletoData.valorDocumento || 690).toFixed(2)})
                              </DropdownMenuItem>
                            )}
                            {provider.nfseData && (
                              <DropdownMenuItem
                                className="gap-3 py-3 text-xs font-bold uppercase cursor-pointer text-emerald-700 bg-emerald-50/50 mb-1 rounded-xl"
                                onClick={() => setSelectedNfse(provider.nfseData)}
                              >
                                <ReceiptText size={14} /> Ver NFS-e nº{" "}
                                {provider.nfseData.numeroNfse} (DANFSe)
                              </DropdownMenuItem>
                            )}
                            {provider.pgrReportData && (
                              <DropdownMenuItem
                                className="gap-3 py-3 text-xs font-bold uppercase cursor-pointer text-blue-700 bg-blue-50/50 mb-1 rounded-xl"
                                onClick={() => setSelectedAdelmoPgr(provider.pgrReportData)}
                              >
                                <FileText size={14} /> Ver Laudo PGR DW Montec
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="gap-3 py-3 text-xs font-bold uppercase cursor-pointer"
                              onClick={() => {
                                setEditingProvider(provider);
                                setIsCreateOpen(true);
                              }}
                            >
                              <Pencil size={14} /> Editar Dados
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-3 py-3 text-xs font-bold uppercase cursor-pointer text-red-600"
                              onClick={() => handleDeleteProvider(provider)}
                            >
                              <Trash2 size={14} /> Arquivar cadastro
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[850px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          <DialogHeader className="p-10 bg-primary text-white space-y-3 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <BadgeCheck size={120} className="text-accent" />
            </div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-white/10 rounded-2xl border border-white/20 text-accent">
                <Stethoscope size={24} />
              </div>
              <DialogTitle className="text-2xl font-headline font-black uppercase tracking-tight">
                {editingProvider ? "Editar Prestador" : "Novo Credenciamento"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-white/60 font-medium italic text-sm">
              Estruturação de dados profissionais e travas de segurança multi-tenant.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh]">
            <div className="p-10">
              {(!editingProvider || editingProvider.taxIdStatus !== "verified") && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Cadastro em rascunho: o documento informado não está confirmado. O registro não
                  será ativado nem poderá ser tratado como identidade fiscal verificada.
                </div>
              )}
              {isAiAnalyzing && (
                <div className="mb-8 p-6 bg-accent/10 border-2 border-dashed border-accent rounded-[2rem] flex flex-col items-center gap-3 animate-pulse">
                  <Loader2 className="size-8 animate-spin text-accent" />
                  <p className="text-xs font-black text-primary uppercase tracking-widest">
                    NAI está analisando o contrato...
                  </p>
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSave)} className="space-y-10">
                  {/* DADOS CADASTRAIS */}
                  <div className="space-y-6">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 ml-1">
                      <Briefcase size={12} /> Identidade Profissional
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="cnpj"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 ml-1">
                              CNPJ / CPF candidato
                            </FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input
                                  {...field}
                                  className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-2"
                                onClick={handleFetchCnpj}
                                disabled={isFetchingCnpj}
                              >
                                {isFetchingCnpj ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Search size={16} />
                                )}
                              </Button>
                            </div>
                            <p className="text-[9px] text-muted-foreground">
                              A informação permanece pendente; não confirma identidade fiscal nem
                              habilita contratação ou faturamento.
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 ml-1">
                              Razão Social / Nome Completo
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="h-12 bg-slate-50 border-none rounded-xl font-bold uppercase shadow-inner"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="profession"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 ml-1">
                              Profissão (Ex: Médico do Trabalho)
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="operationalFunction"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 ml-1">
                              Função operacional
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Ex.: assistência técnica médica em perícias"
                                className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="councilNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 ml-1">
                              Registro (CRM / CREA / COREN)
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Ex: 27268-PR"
                                className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                              />
                              <FormField
                                control={form.control}
                                name="rqe"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                      RQE (quando registrado)
                                    </FormLabel>
                                    <FormControl>
                                      <Input
                                        {...field}
                                        className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 ml-1">
                              Tipo de Prestador
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner">
                                  <SelectValue placeholder="Selecione o tipo..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="CLINIC">Clínica</SelectItem>
                                <SelectItem value="LAB">Laboratório</SelectItem>
                                <SelectItem value="DOCTOR">Médico (PF)</SelectItem>
                                <SelectItem value="HOSPITAL">Hospital</SelectItem>
                                <SelectItem value="NURSE">Enfermeiro(a)</SelectItem>
                                <SelectItem value="ENGINEER">Engenheiro(a)</SelectItem>
                                <SelectItem value="TECH_NURSE">Técnico Enfermagem</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="specialty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase text-slate-400 ml-1">
                              Especialidade registrada
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 ml-1">
                        <Mail size={12} /> Canais de Contato
                      </p>
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="E-mail Corporativo"
                                  className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="WhatsApp / Telefone"
                                  className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 ml-1">
                        <MapPin size={12} /> Localização
                      </p>
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Cidade"
                                  className="h-12 bg-slate-50 border-none rounded-xl font-bold shadow-inner"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex gap-2">
                          <FormField
                            control={form.control}
                            name="cep"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <div className="relative">
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="CEP"
                                      className="h-12 bg-slate-50 border-none rounded-xl font-bold"
                                    />
                                  </FormControl>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-2 top-2"
                                    onClick={handleFetchCep}
                                    disabled={isFetchingCep}
                                  >
                                    <Search size={16} />
                                  </Button>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="state"
                            render={({ field }) => (
                              <FormItem className="w-20">
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="UF"
                                    className="h-12 bg-slate-50 border-none rounded-xl font-bold text-center"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DOCUMENTAÇÃO E ANEXOS */}
                  <div className="space-y-6">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2 ml-1">
                      <Paperclip size={12} /> Documentação & Anexos
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Upload de Contrato */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">
                          Contrato de Prestação
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-12 rounded-xl border-2 border-dashed gap-2 text-[10px] font-black uppercase",
                            tempContract
                              ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                              : "border-slate-200 text-slate-400"
                          )}
                          onClick={() => document.getElementById("prov-contract")?.click()}
                        >
                          {tempContract ? <Check size={14} /> : <FileUp size={14} />}
                          {tempContract ? "Contrato Pronto" : "Anexar Contrato"}
                        </Button>
                        <input
                          id="prov-contract"
                          type="file"
                          className="hidden"
                          accept=".pdf"
                          onChange={(e) => setTempContract(e.target.files?.[0] || null)}
                        />
                      </div>

                      {/* Upload de Foto */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">
                          Foto de Perfil
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-12 rounded-xl border-2 border-dashed gap-2 text-[10px] font-black uppercase",
                            tempPhoto
                              ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                              : "border-slate-200 text-slate-400"
                          )}
                          onClick={() => document.getElementById("prov-photo")?.click()}
                        >
                          {tempPhoto ? <Check size={14} /> : <ImageIcon size={14} />}
                          {tempPhoto ? "Foto Pronta" : "Anexar Foto"}
                        </Button>
                        <input
                          id="prov-photo"
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => setTempPhoto(e.target.files?.[0] || null)}
                        />
                      </div>

                      {/* Upload de Carteira do Conselho */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">
                          Carteira do Conselho
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-12 rounded-xl border-2 border-dashed gap-2 text-[10px] font-black uppercase",
                            tempCouncilCard
                              ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                              : "border-slate-200 text-slate-400"
                          )}
                          onClick={() => document.getElementById("prov-council")?.click()}
                        >
                          {tempCouncilCard ? <Check size={14} /> : <BadgeCheck size={14} />}
                          {tempCouncilCard ? "Documento Pronto" : "Anexar Carteira"}
                        </Button>
                        <input
                          id="prov-council"
                          type="file"
                          className="hidden"
                          accept=".pdf,image/*"
                          onChange={(e) => setTempCouncilCard(e.target.files?.[0] || null)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                        <Globe size={12} className="text-accent" /> Vínculos de Atendimento
                        (Unidades selecionadas)
                      </p>
                      <Badge className="bg-primary text-white border-none text-[8px] font-black">
                        SEGURANÇA ATIVA
                      </Badge>
                    </div>

                    <Card className="border-none bg-slate-50 p-6 rounded-[2.5rem] shadow-inner">
                      {companiesError && (
                        <div role="alert" className="mb-3 text-sm text-destructive">
                          Não foi possível carregar as unidades. Os vínculos atuais foram mantidos.
                          <Button
                            type="button"
                            variant="outline"
                            className="ml-2"
                            onClick={() => setProviderQueryVersion((version) => version + 1)}
                          >
                            Tentar carregar unidades
                          </Button>
                        </div>
                      )}
                      {companiesLoading && (
                        <p role="status" className="mb-3 text-sm text-muted-foreground">
                          Carregando unidades autorizadas…
                        </p>
                      )}
                      {!companiesLoading && !companiesError && !companies?.length && (
                        <p className="mb-3 text-sm text-muted-foreground">
                          Nenhuma unidade disponível para vínculo.
                        </p>
                      )}
                      <ScrollArea className="h-64 pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {companies?.map((company) => {
                            const currentVinc = form.watch("servedCompanies") || [];
                            const isSelected = currentVinc.includes(company.id);
                            return (
                              <div
                                key={company.id}
                                className={cn(
                                  "p-4 rounded-2xl flex items-center gap-4 transition-all cursor-pointer border-2",
                                  isSelected
                                    ? "bg-white border-primary shadow-md"
                                    : "bg-white/50 border-transparent hover:border-primary/10"
                                )}
                                onClick={() => {
                                  const next = isSelected
                                    ? currentVinc.filter((id) => id !== company.id)
                                    : [...currentVinc, company.id];
                                  form.setValue("servedCompanies", next);
                                }}
                              >
                                <div
                                  className={cn(
                                    "size-6 rounded-lg flex items-center justify-center transition-colors border-2 shrink-0",
                                    isSelected ? "bg-primary border-primary" : "border-slate-200"
                                  )}
                                >
                                  {isSelected && <Check size={14} className="text-white" />}
                                </div>
                                <div className="text-left">
                                  <p
                                    className={cn(
                                      "text-[10px] font-black uppercase leading-tight truncate max-w-[200px]",
                                      isSelected ? "text-primary" : "text-slate-400"
                                    )}
                                  >
                                    {company.name}
                                  </p>
                                  <p className="text-[8px] font-bold text-slate-300 uppercase mt-0.5">
                                    ID: {company.id}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                      <div className="mt-4 px-2 flex items-center gap-3">
                        <Info size={14} className="text-primary/40" />
                        <p className="text-[9px] text-primary/40 font-bold uppercase italic">
                          "Este vínculo registra escopo de atendimento e não concede acesso ao
                          sistema."
                        </p>
                      </div>
                    </Card>
                  </div>

                  {editingProvider && (
                    <ProviderAssessment
                      key={editingProvider.id}
                      initialValues={{
                        active: editingProvider.active ?? false,
                        rating: editingProvider.rating ?? 0,
                        ratingNote: editingProvider.ratingNote ?? "",
                      }}
                      onSave={async (assessment: ProviderAssessmentValues) => {
                        if (!db || !user || !isGlobalAdmin) throw new Error("Sessão indisponível");
                        const currentIdentifier = (form.getValues("cnpj") || "")
                          .replace(/[^a-z\d]/gi, "")
                          .toUpperCase();
                        const verifiedIdentifier = (editingProvider.cnpj || "")
                          .replace(/[^a-z\d]/gi, "")
                          .toUpperCase();
                        if (
                          assessment.active &&
                          !canKeepProviderActive(
                            editingProvider.taxIdStatus,
                            editingProvider.active === true,
                            currentIdentifier === verifiedIdentifier
                          )
                        ) {
                          throw new Error(
                            "Não é possível ativar o prestador sem identificação fiscal confirmada."
                          );
                        }
                        const providerRef = doc(db, "providers", editingProvider.id);
                        const submittedIdentifier = (form.getValues("cnpj") || "")
                          .replace(/[^a-z\d]/gi, "")
                          .toUpperCase();
                        if (
                          assessment.active &&
                          (!canKeepProviderActive(
                            editingProvider.taxIdStatus,
                            editingProvider.active === true,
                            currentIdentifier === submittedIdentifier
                          ) ||
                            currentIdentifier !== submittedIdentifier)
                        ) {
                          throw new Error(
                            "Não é possível ativar o prestador sem identificação fiscal confirmada."
                          );
                        }
                        await updateProviderIfCurrent({
                          store: createFirestoreProviderConditionalWriteStore(db),
                          reference: providerRef,
                          expected: editingProvider,
                          update: {
                            ...assessment,
                            updatedAt: serverTimestamp(),
                            ratingUpdatedAt: serverTimestamp(),
                            ratingUpdatedBy: user.uid,
                            revision: Number(editingProvider.revision || 0) + 1,
                          },
                          verify: {
                            active: assessment.active,
                            rating: assessment.rating,
                          },
                        });
                        form.setValue("active", assessment.active);
                        form.setValue("rating", assessment.rating);
                      }}
                    />
                  )}

                  <div className="pt-8 border-t border-dashed flex flex-col items-center gap-6">
                    <Button
                      type="submit"
                      disabled={isSubmitting || isPending}
                      className="w-full h-18 bg-primary text-white font-black uppercase text-xs tracking-[0.3em] rounded-2xl shadow-xl gap-4 hover:scale-[1.01] active:scale-95 transition-all"
                    >
                      {isSubmitting ? (
                        <Loader2 className="size-6 animate-spin" />
                      ) : (
                        <ShieldCheck className="size-6 text-accent" />
                      )}
                      {editingProvider ? "Protocolar Alterações" : "Salvar cadastro profissional"}
                    </Button>
                    <p className="text-[9px] text-slate-300 font-black uppercase tracking-[0.4em]">
                      Nextcon NAI Cloud Identity v2.8
                    </p>
                  </div>
                </form>
              </Form>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      {/* MODAL DE LAUDO PGR - DW MONTEC (ELABORADO POR ADELMO MARANGONI ANTONIAZZI) */}
      <Dialog
        open={!!selectedAdelmoPgr}
        onOpenChange={(open) => !open && setSelectedAdelmoPgr(null)}
      >
        <DialogContent className="sm:max-w-[850px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          {selectedAdelmoPgr && (
            <>
              <DialogHeader className="p-8 bg-slate-900 text-white relative overflow-hidden space-y-2">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <ShieldCheck size={140} className="text-accent" />
                </div>
                <div className="flex items-center gap-3 relative z-10">
                  <Badge className="bg-accent text-primary font-black text-[8px] uppercase tracking-widest px-3 h-5">
                    LAUDO TÉCNICO VIGENTE
                  </Badge>
                  <Badge className="bg-white/10 text-white font-black text-[8px] uppercase tracking-widest px-3 h-5">
                    VIGÊNCIA ATÉ 15/08/2027
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-headline font-black uppercase text-white relative z-10">
                  {selectedAdelmoPgr.companyName} — Programa de Gerenciamento de Riscos (PGR)
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-xs font-medium italic relative z-10">
                  Elaborado pelo Técnico em Segurança do Trabalho:{" "}
                  <strong>{selectedAdelmoPgr.technicalResponsible}</strong>
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[70vh] p-8 space-y-6">
                {/* IDENTIFICAÇÃO MESTRE DA EMPRESA */}
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">
                      CNPJ & Localização
                    </span>
                    <strong className="text-primary">{selectedAdelmoPgr.cnpj}</strong>
                    <p className="text-slate-500 text-[11px]">{selectedAdelmoPgr.city}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">
                      Atividade / CNAE
                    </span>
                    <strong className="text-primary">{selectedAdelmoPgr.cnae}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">
                      Grau de Risco & Vidas
                    </span>
                    <strong className="text-red-600 font-black">
                      GRAU {selectedAdelmoPgr.riskDegree} (NR-04)
                    </strong>
                    <p className="text-slate-500 text-[11px]">
                      {selectedAdelmoPgr.totalEmployees} Colaboradores Ativos
                    </p>
                  </div>
                </div>

                {/* GRUPOS DE EXPOSIÇÃO SIMILAR (GHES) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <Building2 size={16} className="text-accent" /> Mapeamento por Grupos de
                    Exposição Similar (GHEs)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedAdelmoPgr.ghes?.map(
                      (
                        gheItem: {
                          ghe?: string;
                          count?: number;
                          description?: string;
                          nome?: string;
                          funcoes?: string;
                          colaboradores?: number;
                          agentes?: Array<{
                            nome?: string;
                            tipo?: string;
                            intensidade?: string;
                            risco?: string;
                          }>;
                        },
                        idx: number
                      ) => (
                        <div
                          key={idx}
                          className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1 hover:border-primary transition-all"
                        >
                          <div className="flex justify-between items-center">
                            <strong className="text-xs font-black text-primary uppercase">
                              {gheItem.ghe}
                            </strong>
                            <Badge variant="outline" className="text-[8px] font-black">
                              {gheItem.count} Colab(s)
                            </Badge>
                          </div>
                          <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                            {gheItem.description}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* AVALIAÇÕES QUANTITATIVAS */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <Activity size={16} className="text-accent" /> Avaliações Quantitativas e
                    Medições
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl">
                      <strong className="text-[10px] font-black uppercase text-amber-900 block mb-1">
                        🔊 Ruído Dosimétrico
                      </strong>
                      <p className="text-[11px] text-amber-900/80 font-medium">
                        {selectedAdelmoPgr.evaluations?.noise}
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl">
                      <strong className="text-[10px] font-black uppercase text-blue-900 block mb-1">
                        🧪 Agentes Químicos
                      </strong>
                      <p className="text-[11px] text-blue-900/80 font-medium">
                        {selectedAdelmoPgr.evaluations?.chemicals}
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-2xl">
                      <strong className="text-[10px] font-black uppercase text-purple-900 block mb-1">
                        📳 Vibração de Corpo Inteiro (VCI)
                      </strong>
                      <p className="text-[11px] text-purple-900/80 font-medium">
                        {selectedAdelmoPgr.evaluations?.vibration}
                      </p>
                    </div>
                    <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
                      <strong className="text-[10px] font-black uppercase text-emerald-900 block mb-1">
                        🛡️ EPIs Compulsórios
                      </strong>
                      <p className="text-[11px] text-emerald-900/80 font-medium">
                        {selectedAdelmoPgr.evaluations?.epis}
                      </p>
                    </div>
                  </div>
                </div>

                {/* PLANO DE AÇÃO E ADEQUAÇÕES */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" /> Plano de Ação 5W2H &
                    Adequações Previstas
                  </h4>
                  <div className="p-5 bg-slate-900 text-white rounded-3xl space-y-2">
                    {selectedAdelmoPgr.actionPlan?.map((item: string, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-[11px] font-medium text-slate-200"
                      >
                        <span className="size-2 rounded-full bg-accent mt-1.5 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>

              <div className="p-6 bg-slate-50 border-t flex justify-between items-center">
                <a
                  href="https://drive.google.com/drive/project/1y3FsJNIJd4D8yOSPePZchANKcdmH5DII"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-black uppercase text-blue-600 hover:underline flex items-center gap-1.5"
                >
                  <ExternalLink size={14} /> Ver no Google Drive (/NAI_BACKUP_SST)
                </a>

                <Button
                  onClick={() => setSelectedAdelmoPgr(null)}
                  className="bg-primary text-white font-black text-xs uppercase rounded-xl px-6 h-10"
                >
                  Fechar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DANFSe v2.0 - NOTA FISCAL DE SERVIÇOS ELETRÔNICA (PABLO RICARDO / PRESTADOR) */}
      <Dialog open={!!selectedNfse} onOpenChange={(open) => !open && setSelectedNfse(null)}>
        <DialogContent className="sm:max-w-[850px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          {selectedNfse && (
            <>
              <DialogHeader className="p-8 bg-slate-900 text-white relative overflow-hidden space-y-2">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <ReceiptText size={140} className="text-accent" />
                </div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-widest px-3 h-6">
                      DANFSe v2.0 • DOCUMENTO OFICIAL
                    </Badge>
                    <Badge className="bg-white/10 text-white font-black text-[9px] uppercase tracking-widest px-3 h-6">
                      NFS-e Nº {selectedNfse.numeroNfse}
                    </Badge>
                  </div>
                  <Badge className="bg-accent text-primary font-black text-[9px] uppercase tracking-widest px-3 h-6">
                    {selectedNfse.municipio || "Curitiba - PR"}
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-headline font-black uppercase text-white relative z-10 pt-2">
                  Documento Auxiliar da NFS-e Nacional
                </DialogTitle>
                <DialogDescription className="text-slate-300 text-xs font-medium italic relative z-10">
                  Competência: <strong>{selectedNfse.competencia}</strong> • Emitida em:{" "}
                  <strong>{selectedNfse.dataEmissao}</strong>
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[70vh] p-8 space-y-6">
                {/* CHAVE DE ACESSO & AUTENTICIDADE */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
                      Chave de Acesso da NFS-e
                    </span>
                    <span className="text-xs font-mono font-black text-primary select-all break-all">
                      {selectedNfse.chaveAcesso}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 border-emerald-200 text-emerald-800 text-[9px] font-black uppercase shrink-0 py-1.5 px-3"
                  >
                    Autenticidade Verificada
                  </Badge>
                </div>

                {/* PRESTADOR / TOMADOR GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* PRESTADOR */}
                  <div className="p-5 bg-white border-2 border-slate-100 rounded-3xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                        Prestador / Fornecedor
                      </span>
                      <Badge className="bg-blue-50 text-blue-700 border-none text-[8px] font-black uppercase">
                        MEI - Simples
                      </Badge>
                    </div>
                    <p className="text-xs font-black text-primary uppercase leading-tight">
                      {selectedNfse.prestador?.razaoSocial || "-"}
                    </p>
                    <p className="text-[11px] font-mono font-bold text-slate-600">
                      CNPJ: {selectedNfse.prestador?.cnpj || "-"}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {selectedNfse.prestador?.endereco || "-"}
                    </p>
                    <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-medium space-y-0.5">
                      <p>
                        E-mail:{" "}
                        <strong className="text-slate-700">
                          {selectedNfse.prestador?.email || "-"}
                        </strong>
                      </p>
                      <p>
                        Telefone:{" "}
                        <strong className="text-slate-700">
                          {selectedNfse.prestador?.telefone || "-"}
                        </strong>
                      </p>
                    </div>
                  </div>

                  {/* TOMADOR */}
                  <div className="p-5 bg-white border-2 border-slate-100 rounded-3xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                        Tomador / Adquirente
                      </span>
                      <Badge className="bg-purple-50 text-purple-700 border-none text-[8px] font-black uppercase">
                        Nextcon NAI
                      </Badge>
                    </div>
                    <p className="text-xs font-black text-primary uppercase leading-tight">
                      {selectedNfse.tomador?.razaoSocial || "-"}
                    </p>
                    <p className="text-[11px] font-mono font-bold text-slate-600">
                      CNPJ: {selectedNfse.tomador?.cnpj || "-"}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {selectedNfse.tomador?.endereco || "-"}
                    </p>
                    <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-medium space-y-0.5">
                      <p>
                        Local de Prestação:{" "}
                        <strong className="text-slate-700">Curitiba / PR</strong>
                      </p>
                      <p>
                        Regime: <strong className="text-slate-700">SST Empresarial</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* DISCRIMINAÇÃO DO SERVIÇO */}
                <div className="p-5 bg-slate-50 border border-slate-100 rounded-3xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                      Serviço Prestado & Enquadramento
                    </span>
                    <span className="text-[9px] font-mono font-black text-primary">
                      Cód. {selectedNfse.servico.codigoTributacao} • NBS{" "}
                      {selectedNfse.servico.codigoNbs}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 leading-relaxed">
                    {selectedNfse.servico.discriminacao}
                  </p>
                </div>

                {/* VALORES E TOTALIZADORES */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-left">
                    <span className="text-[9px] font-black uppercase text-emerald-800 tracking-wider block mb-1">
                      Valor do Serviço
                    </span>
                    <span className="text-2xl font-black font-headline text-emerald-700 tabular-nums">
                      {Number(selectedNfse.servico.valorServicos).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Retenções Tributárias
                    </span>
                    <span className="text-2xl font-black font-headline text-slate-600 tabular-nums">
                      R$ 0,00
                    </span>
                    <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">
                      Optante MEI (Sem Retenção)
                    </p>
                  </div>

                  <div className="p-4 bg-primary text-white rounded-2xl text-left shadow-lg">
                    <span className="text-[9px] font-black uppercase text-accent tracking-wider block mb-1">
                      Valor Líquido a Pagar
                    </span>
                    <span className="text-2xl font-black font-headline text-white tabular-nums">
                      {Number(selectedNfse.servico.valorLiquido).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                    <p className="text-[8px] text-slate-300 font-bold uppercase mt-1">
                      Vencimento: {selectedNfse.pagamento.vencimento}
                    </p>
                  </div>
                </div>

                {/* INFORMAÇÕES BANCÁRIAS E PIX PARA PAGAMENTO */}
                <div className="p-5 bg-amber-50/80 border-2 border-amber-200/80 rounded-3xl space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-amber-900 tracking-widest flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-600" /> Instruções de Pagamento /
                      Chave Pix
                    </span>
                    <Badge className="bg-amber-200 text-amber-900 border-none text-[8px] font-black uppercase">
                      Vencimento até {selectedNfse.pagamento.vencimento}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 bg-white rounded-2xl border border-amber-100 space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">
                        Instituição Financeira
                      </span>
                      <p className="font-black text-slate-800 uppercase">
                        {selectedNfse.pagamento.banco}
                      </p>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-amber-100 flex items-center justify-between gap-2">
                      <div className="space-y-1 overflow-hidden">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                          Chave Pix (CNPJ)
                        </span>
                        <p className="font-mono font-black text-slate-900 truncate">
                          {selectedNfse.pagamento.chavePix}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 px-3 rounded-xl border-amber-300 hover:bg-amber-100 text-amber-900 font-black text-[9px] uppercase gap-1 shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedNfse.pagamento.chavePix);
                          setCopiedPix(true);
                          toast({
                            title: "Chave Pix Copiada!",
                            description: selectedNfse.pagamento.chavePix,
                          });
                          setTimeout(() => setCopiedPix(false), 2500);
                        }}
                      >
                        {copiedPix ? (
                          <Check size={12} className="text-emerald-600" />
                        ) : (
                          <Copy size={12} />
                        )}
                        {copiedPix ? "Copiado!" : "Copiar Pix"}
                      </Button>
                    </div>
                  </div>

                  <p className="text-[10px] text-amber-900/80 italic font-medium leading-relaxed">
                    {selectedNfse.pagamento.informacoesComplementares}
                  </p>
                </div>
              </ScrollArea>

              <div className="p-6 bg-slate-50 border-t flex flex-wrap justify-between items-center gap-3">
                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  className="bg-white border-slate-200 text-slate-700 font-black text-xs uppercase rounded-xl px-5 h-10 gap-1.5"
                >
                  <Printer size={14} /> Imprimir DANFSe
                </Button>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setSelectedNfse(null)}
                    className="bg-primary text-white font-black text-xs uppercase rounded-xl px-6 h-10"
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL BOLETO BANCÁRIO SICREDI - FALAVINHA NEXT CONTABILIDADE */}
      <Dialog open={!!selectedBoleto} onOpenChange={(open) => !open && setSelectedBoleto(null)}>
        <DialogContent className="sm:max-w-[850px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white text-left">
          {selectedBoleto && (
            <>
              <DialogHeader className="p-8 bg-[#002f24] text-white relative overflow-hidden space-y-2">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <Barcode size={160} className="text-emerald-400" />
                </div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-widest px-3 h-6">
                      SICREDI • 748-X
                    </Badge>
                    <Badge className="bg-white/10 text-white font-black text-[9px] uppercase tracking-widest px-3 h-6">
                      RECIBO DO SACADO / FICHA DE COMPENSAÇÃO
                    </Badge>
                  </div>
                  <Badge className="bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-widest px-3 h-6">
                    Vencimento: {selectedBoleto.vencimento}
                  </Badge>
                </div>
                <DialogTitle className="text-2xl font-headline font-black uppercase text-white relative z-10 pt-2 flex items-center gap-3">
                  Boleto de Cobrança Bancária — Falavinha Next
                </DialogTitle>
                <DialogDescription className="text-emerald-200 text-xs font-medium italic relative z-10">
                  Beneficiário: <strong>{selectedBoleto.beneficiario}</strong> (CNPJ:{" "}
                  {selectedBoleto.cnpjBeneficiario})
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[70vh] p-8 space-y-6">
                {/* LINHA DIGITÁVEL */}
                <div className="p-5 bg-emerald-50/80 border-2 border-emerald-200 rounded-3xl space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase text-emerald-900 tracking-wider flex items-center gap-1.5">
                      <Barcode size={14} className="text-emerald-700" /> Linha Digitável (Código de
                      Barras)
                    </span>
                    <Badge className="bg-emerald-200 text-emerald-950 text-[8px] font-black uppercase">
                      Pagável em qualquer banco ou aplicativo
                    </Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                    <span className="text-xs sm:text-sm font-mono font-black text-slate-900 select-all tracking-wider break-all bg-white px-3 py-2 rounded-xl border border-emerald-200 w-full sm:w-auto">
                      {selectedBoleto.linhaDigitavel}
                    </span>
                    <Button
                      size="sm"
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-[10px] uppercase tracking-widest h-10 px-4 rounded-xl gap-1.5 shrink-0 shadow-md"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedBoleto.linhaDigitavel);
                        setCopiedBoleto(true);
                        toast({
                          title: "Linha Digitável Copiada!",
                          description: selectedBoleto.linhaDigitavel,
                        });
                        setTimeout(() => setCopiedBoleto(false), 2500);
                      }}
                    >
                      {copiedBoleto ? (
                        <Check size={14} className="text-accent" />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copiedBoleto ? "Copiado!" : "Copiar Código"}
                    </Button>
                  </div>
                </div>

                {/* DETALHES DO TÍTULO */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                      Valor do Boleto
                    </span>
                    <strong className="text-xl font-black font-headline text-emerald-700">
                      {Number(selectedBoleto.valorDocumento).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </strong>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                      Data Vencimento
                    </span>
                    <strong className="text-sm font-black text-red-600 block">
                      {selectedBoleto.vencimento}
                    </strong>
                    <span className="text-[8px] text-slate-400 font-bold uppercase">
                      Competência 08/2026
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                      Agência / Código
                    </span>
                    <strong className="text-xs font-black font-mono text-slate-800">
                      {selectedBoleto.agenciaCodigoCedente}
                    </strong>
                    <span className="text-[8px] text-slate-400 font-bold uppercase block mt-0.5">
                      Cooperativa Sicredi
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">
                      Nosso Número
                    </span>
                    <strong className="text-xs font-black font-mono text-slate-800">
                      {selectedBoleto.nossoNumero}
                    </strong>
                    <span className="text-[8px] text-slate-400 font-bold uppercase block mt-0.5">
                      Doc: {selectedBoleto.numeroDocumento}
                    </span>
                  </div>
                </div>

                {/* BENEFICIÁRIO & PAGADOR */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* BENEFICIÁRIO */}
                  <div className="p-5 bg-white border-2 border-slate-100 rounded-3xl space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">
                      Beneficiário (Cedente)
                    </span>
                    <p className="text-xs font-black text-primary uppercase leading-tight">
                      {selectedBoleto.beneficiario}
                    </p>
                    <p className="text-[11px] font-mono font-bold text-slate-600">
                      CNPJ: {selectedBoleto.cnpjBeneficiario}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {selectedBoleto.enderecoBeneficiario}
                    </p>
                    <p className="text-[10px] text-emerald-700 font-bold pt-1">
                      Espécie: DP (Duplicata de Prestação de Serviços Contábeis)
                    </p>
                  </div>

                  {/* PAGADOR */}
                  <div className="p-5 bg-white border-2 border-slate-100 rounded-3xl space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">
                      Pagador (Sacado)
                    </span>
                    <p className="text-xs font-black text-primary uppercase leading-tight">
                      {selectedBoleto.pagador?.razaoSocial || "-"}
                    </p>
                    <p className="text-[11px] font-mono font-bold text-slate-600">
                      CNPJ: {selectedBoleto.pagador?.cnpj || "-"}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {selectedBoleto.pagador?.endereco || "-"} - CEP{" "}
                      {selectedBoleto.pagador?.cep || "-"}
                    </p>
                    <p className="text-[10px] text-slate-600 font-bold pt-1">
                      Local: Curitiba / PR
                    </p>
                  </div>
                </div>

                {/* INSTRUÇÕES E ENCARGOS */}
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-3xl space-y-2 text-left">
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest block">
                    Instruções de Cobrança & Encargos
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-medium text-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                      <span>
                        Juros por dia de atraso: <strong>R$ 0,46 / dia</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-red-500 shrink-0" />
                      <span>
                        Multa por atraso: <strong>R$ 6,90 (1,00%)</strong>
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 italic pt-1">
                    * Sujeito a protesto cartorário após o vencimento conforme instrução bancária.
                    Pagável preferencialmente nas agências Sicredi ou canais digitais.
                  </p>
                </div>
              </ScrollArea>

              <div className="p-6 bg-slate-50 border-t flex flex-wrap justify-between items-center gap-3">
                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  className="bg-white border-slate-200 text-slate-700 font-black text-xs uppercase rounded-xl px-5 h-10 gap-1.5"
                >
                  <Printer size={14} /> Imprimir Boleto
                </Button>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setSelectedBoleto(null)}
                    className="bg-primary text-white font-black text-xs uppercase rounded-xl px-6 h-10"
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
