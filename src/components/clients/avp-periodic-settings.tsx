"use client";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AvpPeriodicSettings({ onSaved }: { onSaved: () => void }) {
  const { user, role, tenantId } = useUser();
  const identity = useRef(user?.uid);
  useLayoutEffect(() => {
    identity.current = user?.uid;
  }, [user?.uid]);
  const allowed = role === "SUPER_ADMIN" || (role === "ADMIN" && !tenantId);
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState("");
  const [campaignUrl, setCampaign] = useState("");
  const [accreditationUrl, setAccreditation] = useState("");
  const [revision, setRevision] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [readerEmail, setReaderEmail] = useState<string | null>(null);
  const [scheduler, setScheduler] = useState<string | null>(null);
  useEffect(() => {
    setOpen(false);
    setOwner("");
    setCampaign("");
    setAccreditation("");
    setRevision("");
    setMessage("");
    setBusy(false);
    setScheduler(null);
    setReaderEmail(null);
  }, [user?.uid]);
  useEffect(() => {
    if (!open || !allowed || !user) return;
    let active = true;
    const controller = new AbortController();
    setBusy(true);
    setMessage("");
    void (async () => {
      try {
        const token = await user.getIdToken();
        if (!active) return;
        const response = await fetch("/api/clients/grupo-avp/periodic-settings", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(data.error || "Não foi possível consultar as fontes.");
        setCampaign(data.campaignUrl);
        setAccreditation(data.accreditationUrl);
        setRevision(data.revision);
        setScheduler(data.schedulerSeenAt);
        setReaderEmail(data.readerEmail);
        setOwner(user.uid);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Falha na consulta.");
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [open, allowed, user]);
  if (!allowed || !user) return null;
  const save = async () => {
    if (busy || owner !== user.uid) return;
    setBusy(true);
    setMessage("");
    try {
      const token = await user.getIdToken();
      if (identity.current !== user.uid) return;
      const response = await fetch("/api/clients/grupo-avp/periodic-settings", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ campaignUrl, accreditationUrl, revision }),
      });
      const data = await response.json();
      if (identity.current !== user.uid) return;
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar as fontes.");
      setRevision(data.revision);
      setMessage(
        `Fontes validadas: ${data.sourceRows} linhas de campanha, ${data.municipalities} municípios e ${data.clinics} clínicas informadas no credenciamento.`
      );
      onSaved();
    } catch (error) {
      if (identity.current === user.uid)
        setMessage(error instanceof Error ? error.message : "Falha na configuração.");
    } finally {
      if (identity.current === user.uid) setBusy(false);
    }
  };
  return (
    <div className="rounded-lg border p-3">
      <Button variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
        Fontes e atualização
      </Button>
      {open && (
        <div className="mt-3 space-y-3">
          <label className="block text-sm">
            Planilha da campanha
            <Input
              aria-label="Planilha da campanha"
              value={owner === user.uid ? campaignUrl : ""}
              onChange={(e) => setCampaign(e.target.value)}
              disabled={busy}
              type="url"
            />
          </label>
          <label className="block text-sm">
            Planilha de credenciamento
            <Input
              aria-label="Planilha de credenciamento"
              value={owner === user.uid ? accreditationUrl : ""}
              onChange={(e) => setAccreditation(e.target.value)}
              disabled={busy}
              type="url"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Leitura das abas Controle e NAI Credenciamento. Atualização a cada hora; as planilhas
            não são alteradas.
          </p>
          {readerEmail && (
            <p className="text-xs">
              Leitor do NAI: {readerEmail}. As duas fontes precisam conceder apenas leitura a esta
              conta.
            </p>
          )}
          <p className="text-xs">
            {scheduler
              ? `Última chamada do agendador: ${new Date(scheduler).toLocaleString("pt-BR")}`
              : "Ainda sem chamada do agendador registrada para esta integração."}
          </p>
          <Button onClick={() => void save()} disabled={busy || owner !== user.uid}>
            {busy ? "Validando fontes..." : "Validar e conectar fontes"}
          </Button>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
