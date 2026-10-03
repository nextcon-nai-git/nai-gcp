"use client";

import * as React from "react";
import { logger } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error("React render error", {
      error: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <section
            role="alert"
            aria-label="Falha ao carregar a tela"
            className="rounded-2xl border bg-card p-6 shadow-sm"
          >
            <h1 className="text-xl font-semibold">Não foi possível carregar esta tela</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tente novamente ou escolha outra opção no menu para continuar.
            </p>
            <button
              type="button"
              autoFocus
              onClick={this.retry}
              className="mt-5 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Tentar novamente
            </button>
          </section>
        )
      );
    }
    return this.props.children;
  }
}
