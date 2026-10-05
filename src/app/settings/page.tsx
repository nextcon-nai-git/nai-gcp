"use client";
import { useState } from "react";
import { useUser, useAuth } from "@/firebase";
import { sendPasswordResetEmail } from "firebase/auth";
import { Button } from "@/components/ui/button";
export default function SettingsPage() {
  const { user, role, companyId } = useUser();
  const auth = useAuth();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const reset = async () => {
    if (!user?.email || !auth) return;
    setSending(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage("Solicitação encaminhada. Confira o e-mail cadastrado e a pasta de spam.");
    } catch {
      setMessage("Não foi possível solicitar a redefinição. Tente novamente.");
    } finally {
      setSending(false);
    }
  };
  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Minha conta</h1>
      <p>{user?.displayName || "Conta NAI"}</p>
      <p>{user?.email}</p>
      <p>Perfil: {role || "Aguardando liberação"}</p>
      <p>Empresa: {companyId || "Definida pelo administrador"}</p>
      <Button onClick={reset} disabled={!user?.email || sending}>
        {sending ? "Solicitando…" : "Redefinir senha por e-mail"}
      </Button>
      <p role="status" className="text-sm">
        {message}
      </p>
      {user?.providerData.some((provider) => provider.providerId === "google.com") && (
        <p className="text-sm">Seu acesso Google usa a conta selecionada na tela de login.</p>
      )}
    </section>
  );
}
