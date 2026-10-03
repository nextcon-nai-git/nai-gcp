"use client";

import * as React from "react";
import { Star, MessageSquare, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { cn } from "@/lib/utils";

export function PlatformFeedback() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const [isOpen, setIsOpen] = React.useState(false);
  const [rating, setRating] = React.useState(0);
  const [hoveredRating, setHoveredRating] = React.useState(0);
  const [suggestion, setSuggestion] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const profileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, "users", user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(profileRef);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        variant: "destructive",
        title: "Avaliação Obrigatória",
        description: "Por favor, selecione uma nota de 1 a 5 estrelas.",
      });
      return;
    }

    if (!db || !user) return;

    setIsSubmitting(true);
    try {
      const feedbackRef = collection(db, "feedback");
      await addDocumentNonBlocking(feedbackRef, {
        userId: user.uid,
        userName: profile?.name || user.email,
        companyId: profile?.companyId || "N/A",
        rating,
        suggestion,
        createdAt: new Date().toISOString(),
        platformVersion: "2.6",
      });

      toast({
        title: "Obrigado pelo seu Feedback!",
        description: "Sua opinião é fundamental para a evolução da NAI.",
      });
      setIsOpen(false);
      setRating(0);
      setSuggestion("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao enviar",
        description: "Não foi possível processar sua avaliação agora.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-slate-400 hover:bg-slate-50 group"
        >
          <MessageSquare className="size-5 group-hover:text-primary transition-colors" />
          <span className="absolute -top-1 -right-1 size-2 bg-accent rounded-full border-2 border-white animate-pulse"></span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
        <DialogHeader className="p-8 bg-primary text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/10 rounded-lg">
              <Sparkles className="size-5 text-accent" />
            </div>
            <DialogTitle className="text-xl font-headline font-black uppercase">
              Experiência NAI
            </DialogTitle>
          </div>
          <DialogDescription className="text-white/70 font-medium">
            Como você avalia sua produtividade na plataforma hoje? Sua sugestão ajuda a construir a
            SST do futuro.
          </DialogDescription>
        </DialogHeader>

        <div className="p-8 space-y-8 bg-white">
          <div className="flex flex-col items-center gap-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Sua nota para a plataforma
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                  className="transition-all hover:scale-125 active:scale-95"
                >
                  <Star
                    className={cn(
                      "size-8 transition-colors",
                      (hoveredRating || rating) >= star
                        ? "fill-accent text-accent"
                        : "text-slate-200 fill-none"
                    )}
                  />
                </button>
              ))}
            </div>
            <p className="text-xs font-bold text-primary italic">
              {rating === 1 && "Poderia ser muito melhor"}
              {rating === 2 && "Ainda tem o que melhorar"}
              {rating === 3 && "Satisfeito"}
              {rating === 4 && "Muito bom"}
              {rating === 5 && "Excelente, amei!"}
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
              Sugestões de Melhoria
            </label>
            <Textarea
              placeholder="Ex: Gostaria de ver um gráfico de absenteísmo na home..."
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              className="min-h-[120px] bg-slate-50 border-none rounded-2xl p-4 text-sm font-medium focus-visible:ring-primary/10 shadow-inner"
            />
          </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 flex gap-2">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="font-bold uppercase text-[10px]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
            className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest px-8 h-12 rounded-xl shadow-lg shadow-primary/20 gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Enviar Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
