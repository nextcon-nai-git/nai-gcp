"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { ShieldAlert, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Global Error Boundary NAI Shield
 * Previne telas vermelhas do React Dev Overlay em demonstrações executivas.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("[NAI Error Boundary Shield]", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="p-6 bg-amber-500/10 border-2 border-amber-500/30 rounded-[2.5rem] max-w-lg w-full space-y-6 shadow-2xl backdrop-blur-xl">
            <div className="p-4 bg-amber-500/20 rounded-2xl w-fit mx-auto text-amber-400">
              <ShieldAlert className="size-12" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tight font-headline">
                Módulo em Restauração
              </h2>
              <p className="text-xs font-medium text-slate-400 leading-relaxed">
                A plataforma NAI isolou uma oscilação temporária para garantir a segurança dos seus
                dados.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Button
                onClick={this.handleReset}
                className="flex-1 h-12 bg-accent hover:bg-accent/90 text-primary font-black uppercase text-[11px] tracking-widest rounded-2xl gap-2 shadow-lg"
              >
                <RefreshCw className="size-4" /> Atualizar Módulo
              </Button>
              <Button
                onClick={() => (window.location.href = "/")}
                variant="outline"
                className="flex-1 h-12 border-white/10 hover:bg-white/5 text-white font-black uppercase text-[11px] tracking-widest rounded-2xl gap-2"
              >
                <Home className="size-4" /> Ir para Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
