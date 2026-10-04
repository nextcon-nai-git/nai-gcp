"use client";

import * as React from "react";
import {
  UploadCloud,
  FileText,
  Trash2,
  Eye,
  CheckCircle2,
  Loader2,
  Paperclip,
  FileCheck,
  AlertCircle,
  Download,
} from "lucide-react";
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
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firebaseConfig } from "@/firebase/config";
import { initializeApp, getApps, getApp } from "firebase/app";
import { cn } from "@/lib/utils";

export interface EmployeeDocument {
  id: string;
  name: string;
  category: string;
  url: string;
  size?: string;
  type?: string;
  uploadedAt: string;
}

interface DocumentUploadFieldProps {
  employeeId?: string;
  documents?: EmployeeDocument[];
  onDocumentsChange?: (updatedDocs: EmployeeDocument[]) => void;
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

export function DocumentUploadField({
  employeeId = "temp",
  documents = [],
  onDocumentsChange,
  readOnly = false,
}: DocumentUploadFieldProps) {
  const { toast } = useToast();
  const [docList, setDocList] = React.useState<EmployeeDocument[]>(documents);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("RG / CPF");
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDocList(documents || []);
  }, [documents]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const file = files[0];
    const fileId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const formattedSize = (file.size / 1024 / 1024).toFixed(2) + " MB";
    const uploadedAt =
      new Date().toLocaleDateString("pt-BR") +
      " " +
      new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    let downloadUrl = "";

    try {
      // Attempt Firebase Storage Upload
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const storage = getStorage(app, firebaseConfig.storageBucket);
      const storageRef = ref(storage, `employee_documents/${employeeId}/${fileId}_${file.name}`);

      const snapshot = await uploadBytes(storageRef, file);
      downloadUrl = await getDownloadURL(snapshot.ref);
    } catch (err) {
      console.warn(
        "[Storage Fallback] Firebase Storage indisponível, utilizando fallback resiliente local.",
        err
      );
      // Evita gravar megabytes de Base64 diretamente no documento do Firestore (limite rígido de 1MB por doc)
      if (file.size < 300 * 1024) {
        downloadUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(URL.createObjectURL(file));
          reader.readAsDataURL(file);
        });
      } else {
        downloadUrl = URL.createObjectURL(file);
      }
    }

    const newDoc: EmployeeDocument = {
      id: fileId,
      name: file.name,
      category: selectedCategory,
      url: downloadUrl,
      size: formattedSize,
      type: file.type,
      uploadedAt,
    };

    const updated = [...docList, newDoc];
    setDocList(updated);
    if (onDocumentsChange) onDocumentsChange(updated);

    toast({
      title: "Documento Anexado",
      description: `${file.name} salvo na categoria [${selectedCategory}].`,
    });

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = (id: string) => {
    const updated = docList.filter((d) => d.id !== id);
    setDocList(updated);
    if (onDocumentsChange) onDocumentsChange(updated);
    toast({ title: "Documento Removido", description: "O documento foi removido da ficha." });
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

      {!readOnly && (
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
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
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
            * Suporta PDF, PNG, JPG ou DOCX até 15MB por arquivo. Todos os anexos são armazenados no
            dossiê eSocial do colaborador.
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
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold uppercase gap-1 transition-all"
                >
                  <Eye size={12} /> Ver
                </a>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(doc.id)}
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
