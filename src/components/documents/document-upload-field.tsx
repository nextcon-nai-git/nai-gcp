"use client";

import * as React from "react";
import { UploadCloud, FileText, Trash2, Eye, Loader2, Paperclip, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useStorage, useUser } from "@/firebase";

function safeDocumentUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export interface EmployeeDocument {
  id: string;
  name: string;
  category: string;
  url: string;
  size?: string;
  type?: string;
  uploadedAt: string;
}

export type EmployeeDocumentChange = { type: "add" | "remove"; document: EmployeeDocument };

interface DocumentUploadFieldProps {
  employeeId?: string;
  companyId?: string;
  internal?: boolean;
  draft?: boolean;
  onBusyChange?: (busy: boolean) => void;
  documents?: EmployeeDocument[];
  onDocumentsChange?: (
    updatedDocs: EmployeeDocument[],
    change: EmployeeDocumentChange
  ) => void | Promise<void>;
  readOnly?: boolean;
}

const DOCUMENT_CATEGORIES = [
  "RG / CPF",
  "Carteira de Trabalho (CTPS)",
  "Comprovante de Residência",
  "ASO Ocupacional",
  "Contrato de Trabalho",
  "Ficha de Registro",
  "Certidão de Nascimento/Casamento",
  "Outros Documentos CLT",
];

export function DocumentUploadField(props: DocumentUploadFieldProps) {
  const { user } = useUser();
  return (
    <DocumentUploadSession
      key={`${user?.uid || "anonymous"}:${props.internal ? "internal" : props.companyId}:${props.employeeId || "draft"}`}
      {...props}
    />
  );
}

function DocumentUploadSession({
  employeeId,
  companyId,
  internal = false,
  draft = false,
  onBusyChange,
  documents = [],
  onDocumentsChange,
  readOnly = false,
}: DocumentUploadFieldProps) {
  const { toast } = useToast();
  const storage = useStorage();
  const { user } = useUser();
  const [draftId] = React.useState(() => `draft_${crypto.randomUUID()}`);
  const [docList, setDocList] = React.useState<EmployeeDocument[]>(documents);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("RG / CPF");
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const busy = React.useRef(false);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      onBusyChange?.(false);
    };
  }, [onBusyChange]);
  React.useEffect(() => {
    setDocList(documents);
  }, [documents]);
  const canEdit = !!user && !readOnly && !!onDocumentsChange;
  const finish = () => {
    busy.current = false;
    if (mounted.current) {
      onBusyChange?.(false);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || busy.current || !canEdit) return;
    busy.current = true;
    onBusyChange?.(true);
    setIsUploading(true);
    try {
      if (
        file.size <= 0 ||
        file.size >= 10 * 1024 * 1024 ||
        !["application/pdf", "image/png", "image/jpeg"].includes(file.type)
      ) {
        throw new Error("Selecione um PDF, PNG ou JPG com tamanho inferior a 10 MB.");
      }
      const owner = employeeId || (draft && internal ? draftId : "");
      const validSegment = (value: string | undefined) =>
        !!value && !/[\/]/.test(value) && ![".", "..", "all", "unauthorized"].includes(value);
      if (!validSegment(owner) || (!internal && !validSegment(companyId))) {
        throw new Error("Não foi possível identificar a empresa e o colaborador do anexo.");
      }
      const fileId = crypto.randomUUID();
      const prefix = internal
        ? `internos_nextcon/colaboradores/${owner}`
        : `clientes/${companyId}/colaboradores/${owner}`;
      const snapshot = await uploadBytes(ref(storage, `${prefix}/${fileId}`), file);
      if (!mounted.current) return;
      const url = await getDownloadURL(snapshot.ref);
      if (!mounted.current) return;
      if (!safeDocumentUrl(url))
        throw new Error("O armazenamento não retornou um endereço válido.");
      const updated = [
        ...docList,
        {
          id: fileId,
          name: file.name,
          category: selectedCategory,
          url,
          size: (file.size / 1024 / 1024).toFixed(2) + " MB",
          type: file.type,
          uploadedAt: new Date().toISOString(),
        },
      ];
      await onDocumentsChange!(updated, { type: "add", document: updated[updated.length - 1] });
      if (!mounted.current) return;
      setDocList(updated);
      toast({
        title: draft ? "Anexo preparado" : "Documento anexado",
        description: draft
          ? "Salve o colaborador para vincular este anexo à ficha."
          : "O anexo foi vinculado à ficha do colaborador.",
      });
    } catch (error) {
      if (mounted.current)
        toast({
          variant: "destructive",
          title: "Anexo não vinculado",
          description:
            error instanceof Error && !("code" in error)
              ? error.message
              : "Não foi possível salvar o anexo. Verifique sua conexão e permissão e tente novamente.",
        });
    } finally {
      finish();
    }
  };

  const handleDelete = async (id: string) => {
    if (busy.current || !canEdit) return;
    busy.current = true;
    onBusyChange?.(true);
    setIsUploading(true);
    try {
      const updated = docList.filter((item) => item.id !== id);
      const document = docList.find((item) => item.id === id);
      if (!document) return;
      await onDocumentsChange!(updated, { type: "remove", document });
      if (!mounted.current) return;
      setDocList(updated);
      toast({
        title: "Vínculo removido",
        description: draft
          ? "Salve o colaborador para confirmar a alteração."
          : "O anexo foi desvinculado da ficha. O arquivo permanece no armazenamento.",
      });
    } catch {
      if (mounted.current)
        toast({
          variant: "destructive",
          title: "Não foi possível remover o vínculo",
          description: "O anexo foi mantido na ficha. Tente novamente.",
        });
    } finally {
      finish();
    }
  };

  return (
    <div className="space-y-4 text-left font-sans">
      <div className="flex items-center justify-between">
        <label className="text-xs font-black uppercase text-slate-300 flex items-center gap-2">
          <Paperclip size={14} className="text-accent" />
          Documentos & Anexos CLT
        </label>
        <span className="text-[10px] font-bold text-slate-400 uppercase">
          {docList.length} documento(s) anexado(s)
        </span>
      </div>

      {canEdit && (
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3 shadow-inner">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:w-1/2">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Tipo de Documento
              </span>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="bg-slate-950 border-slate-800 text-white text-xs rounded-xl h-10 font-medium">
                  <SelectValue placeholder="Selecione a categoria..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="text-xs font-medium">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-1/2 flex items-end">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full h-10 bg-accent text-primary hover:bg-accent/90 font-black text-xs uppercase tracking-wider rounded-xl gap-2 shadow-md mt-auto"
              >
                {isUploading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UploadCloud size={14} />
                )}
                {isUploading ? "Enviando..." : "Selecionar Arquivo PDF / Imagem"}
              </Button>
            </div>
          </div>

          <p className="text-[9px] text-slate-400 italic">
            * PDF, PNG ou JPG com tamanho inferior a 10 MB. Anexar um arquivo não realiza envio ao
            eSocial.
          </p>
        </div>
      )}

      {/* LISTA DE DOCUMENTOS ANEXADOS */}
      {docList.length === 0 ? (
        <div className="p-6 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl text-center space-y-1">
          <FileText size={24} className="mx-auto text-slate-600" />
          <p className="text-xs font-bold text-slate-400 uppercase">
            Nenhum documento anexado ainda
          </p>
          <p className="text-[10px] text-slate-500">
            Faça o upload do RG, CPF, CTPS, ASO ou Contrato do colaborador.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60 border border-slate-800 rounded-2xl bg-slate-950/60 overflow-hidden shadow-lg">
          {docList.map((doc) => (
            <div
              key={doc.id}
              className="p-3.5 flex items-center justify-between hover:bg-slate-900/50 transition-colors"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="size-9 rounded-xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center shrink-0">
                  <FileCheck size={18} />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-white truncate max-w-[200px] sm:max-w-[300px]">
                      {doc.name}
                    </span>
                    <Badge className="bg-slate-800 text-slate-300 text-[8px] font-black uppercase shrink-0">
                      {doc.category}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {doc.uploadedAt} {doc.size ? `• ${doc.size}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={safeDocumentUrl(doc.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold uppercase gap-1 transition-all"
                >
                  <Eye size={12} /> Ver
                </a>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(doc.id)}
                    disabled={isUploading}
                    aria-label={`Remover vínculo de ${doc.name}`}
                    className="size-8 text-slate-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
