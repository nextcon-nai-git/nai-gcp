"use client";

import * as React from "react";
import { Mic, MicOff, Loader2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface VoiceAssistantButtonProps {
  onTranscript: (text: string) => void;
  isProcessing: boolean;
  isSpeaking: boolean;
  className?: string;
}

/**
 * Componente de Pesquisa por Voz NAI.
 * Utiliza o Web Speech API para captura e o motor NAI para processamento.
 */
export function VoiceAssistantButton({
  onTranscript,
  isProcessing,
  isSpeaking,
  className,
}: VoiceAssistantButtonProps) {
  const { toast } = useToast();
  const [isListening, setIsListening] = React.useState(false);
  const recognitionRef = React.useRef<any>(null);

  React.useEffect(() => {
    // Inicializa o reconhecimento de fala se suportado
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "pt-BR";

      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onTranscript(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech Error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed") {
          toast({
            variant: "destructive",
            title: "Microfone Bloqueado",
            description: "Permita o acesso ao microfone nas configurações do seu navegador.",
          });
        }
      };
    } else {
      console.warn("Speech Recognition não suportado neste navegador.");
    }
  }, [onTranscript, toast]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({
        variant: "destructive",
        title: "Recurso Indisponível",
        description: "Seu navegador não suporta pesquisa por voz.",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Ondas Sonoras Animadas */}
      {(isListening || isSpeaking) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={cn(
              "absolute size-12 rounded-full animate-ping opacity-20",
              isListening ? "bg-accent" : "bg-emerald-500"
            )}
          />
          <div
            className={cn(
              "absolute size-16 rounded-full animate-ping opacity-10 delay-150",
              isListening ? "bg-accent" : "bg-emerald-500"
            )}
          />
        </div>
      )}

      <Button
        onClick={toggleListening}
        disabled={isProcessing}
        className={cn(
          "size-14 rounded-full shadow-2xl transition-all duration-500 relative z-10 p-0",
          isListening
            ? "bg-accent text-primary scale-110"
            : isSpeaking
              ? "bg-emerald-600 text-white"
              : "bg-primary text-white hover:scale-105"
        )}
      >
        {isProcessing ? (
          <Loader2 className="size-6 animate-spin" />
        ) : isListening ? (
          <MicOff className="size-6" />
        ) : isSpeaking ? (
          <Volume2 className="size-6 animate-pulse" />
        ) : (
          <Mic className="size-6" />
        )}
      </Button>

      {isListening && (
        <div className="absolute -top-10 bg-accent text-primary text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap animate-in fade-in slide-in-from-bottom-2">
          NAI está ouvindo...
        </div>
      )}
    </div>
  );
}
