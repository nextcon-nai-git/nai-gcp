'use client';

import { useEffect, useState } from 'react';
import { signInWithCustomToken, type Auth } from 'firebase/auth';
import { Loader2, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createTvSession, redeemTvSession } from '@/actions/tv-auth';

type Pairing = { code: string; verifier: string; expiresAt: number };

export function TvLogin({ auth, onAuthenticated }: { auth: Auth; onAuthenticated: () => void }) {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [origin, setOrigin] = useState('');
  const [remaining, setRemaining] = useState(300);

  useEffect(() => {
    let active = true;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    async function start() {
      try {
        const result = await createTvSession();
        if (!active) return;
        if (!result.success) { setError(result.error); return; }
        setOrigin(window.location.origin);
        setPairing(result);
        setRemaining(Math.max(0, Math.ceil((result.expiresAt - Date.now()) / 1000)));
        async function poll() {
          try {
            const response = await redeemTvSession(result.code, result.verifier);
            if (!active) return;
            if (response.status === 'authenticated') {
              await signInWithCustomToken(auth, response.customToken);
              if (active) onAuthenticated();
            } else if (response.status === 'expired') {
              setPairing(null); setError(response.error);
            } else {
              pollTimer = setTimeout(poll, 2000);
            }
          } catch {
            if (active) { setPairing(null); setError('A conexão foi interrompida. Gere um novo código para tentar novamente.'); }
          }
        }
        pollTimer = setTimeout(poll, 2000);
      } catch {
        if (active) setError('Não foi possível preparar o acesso da TV. Tente novamente.');
      }
    }
    void start();
    return () => { active = false; clearTimeout(pollTimer); };
  }, [auth, onAuthenticated, revision]);

  useEffect(() => {
    if (!pairing) return;
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((pairing.expiresAt - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [pairing]);

  return <div className="space-y-5 text-center">
    {pairing && remaining > 0 && origin ? <>
      <div className="mx-auto w-fit rounded-2xl border bg-white p-4">
        <QRCodeSVG value={`${origin}/tv-login/${pairing.code}`} size={200} level="M" title="Autorizar esta TV no NAI" />
      </div>
      <p className="text-sm text-slate-600">Escaneie com seu celular, entre na sua conta e confirme o acesso desta TV.</p>
      <p className="text-xs font-semibold text-slate-500">Expira em {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p>
      <p role="status" className="text-sm font-semibold text-primary">Aguardando sua confirmação no celular…</p>
    </> : error || remaining === 0 ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error || 'O código expirou. Gere um novo para continuar.'}</p>
      : <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-slate-600"><Loader2 className="size-5 animate-spin" /> Preparando acesso seguro…</p>}
    {(error || pairing || remaining === 0) && <button type="button" onClick={() => { setPairing(null); setError(''); setRemaining(300); setRevision(value => value + 1); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold text-primary"><RefreshCw className="size-4" /> Gerar novo código</button>}
  </div>;
}
