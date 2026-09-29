"use client";

import * as React from "react";
import { executarComandoStorage } from "@/actions/ia-storage";
import { Bot, FolderPlus, Loader2, Sparkles, CheckCircle2, AlertCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStorage } from "@/firebase";
import { ref, uploadString } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface StorageResult {
  sucesso: boolean;
  mensagem?: string;
  dados?: {
    caminhoStorage: string;
    placeholderContent: string;
    docType: string;
    nomeEmpresa: string;
  };
}

/**
 * @fileOverview Assistente de Pastas NAI - Versão Hierarquia de Elite
 */

export default function AiStorageAssistant() {
  const { toast } = useToast();
  const storage = useStorage();
  const [comando, setComando] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [resultado, setResultado] = React.useState<{ sucesso: boolean; mensagem: string } | null>(null);

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!comando.trim() || !storage) return;

    setLoading(true);
    setResultado(null);

    const res: StorageResult = await executarComandoStorage(comando);

    if (res.sucesso && res.dados) {
      try {
        // Executa o provisionamento do arquivo de marcação na nova hierarquia
        const fileRef = ref(storage, res.dados.caminhoStorage);
        await uploadString(fileRef, res.dados.placeholderContent, 'raw');

        setResultado({ 
          sucesso: true, 
          mensagem: `🚀 Estrutura Provisionada! A pasta de ${res.dados.docType.toUpperCase()} para "${res.dados.nomeEmpresa}" foi criada no Storage.` 
        });
        setComando("");
        
        toast({
          title: "Diretório Criado",
          description: "A hierarquia oficial foi respeitada.",
        });
      } catch (error: any) {
        setResultado({ 
          sucesso: false, 
          mensagem: "Bloqueio de Segurança: Você não tem permissão para gerenciar pastas deste cliente ou área interna." 
        });
      }
    } else {
      setResultado({ 
        sucesso: false, 
        mensagem: res.mensagem || "Erro na interpretação da arquivista NAI." 
      });
    }

    setLoading(false);
  }

  return (
    <Card className="card-shadow border-none bg-white rounded-[2rem] overflow-hidden max-w-2xl w-full">
      <CardHeader className="bg-primary/5 pb-6 border-b">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary text-white rounded-2xl shadow-lg">
            <Database className="size-6 text-accent" />
          </div>
          <div>
            <CardTitle className="text-xl font-headline font-black text-primary uppercase leading-tight">Arquivista Digital NAI</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Provisionamento inteligente de diretórios SST 2026.</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-8">
        <form onSubmit={handleEnviar} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Comando de Organização</label>
            <div className="flex gap-3">
              <Input
                value={comando}
                onChange={(e) => setComando(e.target.value)}
                placeholder="Ex: Criar pasta do PGR para Britânia, CNPJ 76.492.701/0011-29"
                className="h-14 bg-slate-50 border-none rounded-2xl shadow-inner font-medium"
                disabled={loading}
              />
              <Button 
                type="submit" 
                disabled={loading || !comando}
                className="h-14 px-8 bg-primary text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl gap-2"
              >
                {loading ? <Loader2 className="size-5 animate-spin" /> : <FolderPlus className="size-5 text-accent" />}
                Executar
              </Button>
            </div>
          </div>

          {resultado && (
            <div className={cn(
              "p-5 rounded-2xl border flex gap-4 animate-in slide-in-from-top-2",
              resultado.sucesso ? "bg-accent/10 border-accent/20 text-primary" : "bg-red-50 border-red-100 text-red-700"
            )}>
              {resultado.sucesso ? <CheckCircle2 className="size-5 text-accent shrink-0" /> : <AlertCircle className="size-5 text-red-500 shrink-0" />}
              <p className="text-xs font-bold leading-relaxed italic">"{resultado.mensagem}"</p>
            </div>
          )}
        </form>

        <div className="mt-8 pt-6 border-t border-dashed">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-3">Subpastas Automáticas:</p>
          <div className="flex flex-wrap gap-2">
            {['nr01_pgr', 'nr06_epis', 'nr07_pcmso', 'afastados', 'pericias'].map(tag => (
              <Badge key={tag} variant="outline" className="text-[8px] border-primary/10 text-primary/40 uppercase">{tag}</Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
