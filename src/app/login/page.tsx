"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Globe, Mail, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/firebase";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [recoveringPassword, setRecoveringPassword] = React.useState(false);
  const [resetSent, setResetSent] = React.useState(false);
  const [resetError, setResetError] = React.useState("");
  const resetPending = React.useRef(false);

  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const targetEmail = email.toLowerCase().trim();

    try {
      await signInWithEmailAndPassword(auth, targetEmail, password);

      toast({ title: "Acesso Autorizado", description: "Bem-vindo à plataforma NAI." });
      router.replace("/");
    } catch (error: unknown) {
      setLoading(false);
      const code = error && typeof error === "object" && "code" in error ? error.code : "";
      const message =
        code === "auth/network-request-failed"
          ? "Verifique sua conexão e tente novamente."
          : code === "auth/too-many-requests"
            ? "Muitas tentativas. Aguarde um pouco antes de tentar novamente."
            : "Confira seu e-mail e senha e tente novamente.";
      toast({
        variant: "destructive",
        title: "Falha no Acesso",
        description: message,
      });
    }
  };

  const handlePasswordReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (resetPending.current || loading || resetSent) return;

    const targetEmail = email.toLowerCase().trim();
    if (!targetEmail || !e.currentTarget.checkValidity()) {
      setResetError("Informe um e-mail válido para recuperar sua senha.");
      return;
    }

    resetPending.current = true;
    setLoading(true);
    setResetError("");
    try {
      auth.languageCode = "pt-BR";
      await sendPasswordResetEmail(auth, targetEmail);
      setResetSent(true);
    } catch (error: unknown) {
      const code = error && typeof error === "object" && "code" in error ? error.code : "";
      if (code === "auth/user-not-found") {
        setResetSent(true);
      } else {
        setResetError(
          code === "auth/network-request-failed"
            ? "Verifique sua conexão e tente novamente."
            : code === "auth/too-many-requests"
              ? "Muitas solicitações. Aguarde um pouco antes de tentar novamente."
              : code === "auth/invalid-email"
                ? "Informe um e-mail válido para recuperar sua senha."
                : "Não foi possível solicitar a recuperação. Tente novamente em instantes."
        );
      }
    } finally {
      resetPending.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#001F3F] p-6">
      <div className="w-full max-w-md space-y-8 bg-white p-6 sm:p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <div className="size-16 rounded-[1.5rem] bg-primary mx-auto flex items-center justify-center text-white font-black text-3xl shadow-xl border-2 border-white/10 mb-4">
            N
          </div>
          <h1 className="text-4xl font-black text-primary uppercase tracking-tighter">NAI</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
            Inteligência em SST 2026
          </p>
        </div>

        <form
          onSubmit={recoveringPassword ? handlePasswordReset : handleLogin}
          className="space-y-6"
          aria-busy={loading}
        >
          {recoveringPassword && (
            <div className="space-y-2 text-center">
              <h2 className="text-xl font-bold text-primary">Recuperar senha</h2>
              <p id="password-reset-help" className="text-sm text-slate-600">
                Informe o e-mail cadastrado no NAI para receber um link e criar uma nova senha.
              </p>
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="login-email"
                className="text-[10px] font-black uppercase text-slate-400 ml-1"
              >
                E-mail Corporativo
              </label>
              <Input
                id="login-email"
                autoComplete={recoveringPassword ? "email" : "username"}
                aria-describedby={recoveringPassword ? "password-reset-help" : undefined}
                disabled={loading || resetSent}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 bg-slate-50 border-none rounded-2xl font-bold px-6 shadow-inner"
                placeholder="ex: seu@email.com.br"
                required
              />
            </div>
            {!recoveringPassword && (
              <div className="space-y-1">
                <label
                  htmlFor="login-password"
                  className="text-[10px] font-black uppercase text-slate-400 ml-1"
                >
                  Senha
                </label>
                <Input
                  id="login-password"
                  autoComplete="current-password"
                  disabled={loading}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 bg-slate-50 border-none rounded-2xl font-bold px-6 shadow-inner"
                  placeholder="••••••••"
                  required
                />
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    variant="link"
                    disabled={loading}
                    className="h-auto p-0 text-xs font-semibold"
                    onClick={() => {
                      setRecoveringPassword(true);
                      setPassword("");
                      setResetSent(false);
                      setResetError("");
                    }}
                  >
                    Esqueci minha senha
                  </Button>
                </div>
              </div>
            )}
          </div>

          {recoveringPassword && resetSent && (
            <p role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
              Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.
              Confira também a pasta de spam. Depois de criar a nova senha, volte ao login.
            </p>
          )}
          {recoveringPassword && resetError && (
            <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">
              {resetError}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || resetSent}
            className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3"
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : recoveringPassword ? (
              <Mail className="size-5" />
            ) : (
              <Zap className="size-5 text-accent" />
            )}
            {recoveringPassword
              ? loading
                ? "Enviando..."
                : resetSent
                  ? "Solicitação concluída"
                  : "Enviar link de redefinição"
              : "Entrar no Portal"}
          </Button>
          {recoveringPassword && (
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              className="w-full rounded-2xl"
              onClick={() => {
                setRecoveringPassword(false);
                setResetSent(false);
                setResetError("");
              }}
            >
              Voltar ao login
            </Button>
          )}
        </form>
        <div className="pt-6 border-t flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
            <Globe className="size-3" /> NAI Cloud Infrastructure
          </div>
        </div>
      </div>
    </div>
  );
}
