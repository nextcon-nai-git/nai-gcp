'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { approveTvSession } from '@/actions/tv-auth';
import { useUser } from '@/firebase';

export default function TvApprovalPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { user } = useUser();
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const valid = /^[a-f0-9]{32}$/.test(code);

  async function approve() {
    if (!user || busy || approved || !valid) return;
    setBusy(true); setError('');
    try {
      const result = await approveTvSession(code, await user.getIdToken());
      if (result.success) setApproved(true);
      else setError(result.error || 'Não foi possível autorizar esta TV.');
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-lg rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
    <h1 className="text-2xl font-bold text-slate-900">{approved ? 'TV autorizada' : 'Autorizar acesso na TV'}</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">{approved ? 'Volte à TV para continuar. O código só pode ser utilizado uma vez.' : 'Confirme somente se este QR Code está na TV que você está utilizando. A TV terá acesso com as permissões da sua conta.'}</p>
    {!approved && <p className="mt-4 break-all rounded-xl bg-slate-50 p-3 text-sm font-semibold">{user?.email}</p>}
    {(!valid || error) && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{!valid ? 'Código inválido. Gere um novo código na TV.' : error}</p>}
    {!approved && <button type="button" disabled={!valid || !user || busy} onClick={approve} className="mt-6 min-h-12 w-full rounded-xl bg-primary px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Autorizando…' : 'Confirmar acesso desta TV'}</button>}
    <Link href="/" className="mt-4 inline-block text-sm font-semibold text-primary">{approved ? 'Voltar ao início' : 'Cancelar e voltar'}</Link>
  </section>;
}
