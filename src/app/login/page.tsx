'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ShieldAlert, Globe, Zap, Tv, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';

export default function LoginPage() {
  const [loginMode, setLoginMode] = React.useState<'email' | 'tv'>('email');
  const [tvCode, setTvCode] = React.useState('');
  
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  React.useEffect(() => {
    if (loginMode === 'tv') {
      let unsubscribe: (() => void) | null = null;

      const setupTvSession = async () => {
        if (auth.currentUser && !auth.currentUser.isAnonymous) {
          toast({
            variant: 'destructive',
            title: "Sessão ativa detectada",
            description: "Para login em TV, abra em um navegador/dispositivo sem sessão já autenticada."
          });
          return;
        }

        let sessionUid = auth.currentUser?.uid || null;
        if (!auth.currentUser) {
          const credential = await signInAnonymously(auth);
          sessionUid = credential.user.uid;
        }

        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        setTvCode(code);
        const sessionRef = doc(db, 'tv_auth_sessions', code);

        await setDoc(sessionRef, {
          status: 'pending',
          createdAt: serverTimestamp(),
          createdByUid: sessionUid
        });

        unsubscribe = onSnapshot(sessionRef, async (snap) => {
          const data = snap.data();
          if (data && data.status === 'authenticated' && data.customToken) {
            setLoading(true);
            try {
              await signInWithCustomToken(auth, data.customToken);
              toast({ title: "TV Autorizada!", description: "Acesso via QR Code realizado com sucesso." });
              router.push('/');
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : "Erro desconhecido";
              console.error("Erro no signInWithCustomToken", message);
              toast({ variant: 'destructive', title: "Falha na autorização da TV" });
              setLoading(false);
            }
          }
        });
      };

      setupTvSession().catch((err) => {
        console.error("Erro ao iniciar sessão de TV", err);
        toast({ variant: 'destructive', title: "Falha ao iniciar login da TV" });
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [loginMode, db, auth, router, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const targetEmail = email.toLowerCase().trim();
    const isMasterEmail = targetEmail === 'nextcon@nextconsaude.com.br';

    try {
      await signInWithEmailAndPassword(auth, targetEmail, password);

      toast({ title: "Acesso Autorizado", description: "Bem-vindo à plataforma NAI." });
      router.push('/');
      
    } catch (error: unknown) {
      setLoading(false);
      const message = error instanceof Error ? error.message : "Erro desconhecido no login";
      console.error("Login Error:", message);
      toast({
        variant: 'destructive',
        title: 'Falha no Acesso',
        description: isMasterEmail && message.includes('password')
          ? 'Senha incorreta para o perfil mestre.'
          : 'Verifique suas credenciais Nextcon.',
      });
    }
  };

  const tvAuthUrl = tvCode ? `https://nai.nextconsaude.com.br/tv-login/${tvCode}` : '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#001F3F] p-6">
      <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500">
        
        <div className="text-center space-y-2">
          <div className="size-16 rounded-[1.5rem] bg-primary mx-auto flex items-center justify-center text-white font-black text-3xl shadow-xl border-2 border-white/10 mb-4">N</div>
          <h1 className="text-4xl font-black text-primary uppercase tracking-tighter">NAI</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Inteligência em SST 2026</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            type="button"
            onClick={() => setLoginMode('email')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${loginMode === 'email' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Smartphone className="size-4" /> Senha
          </button>
          <button 
            type="button"
            onClick={() => setLoginMode('tv')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${loginMode === 'tv' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Tv className="size-4" /> TV (QR Code)
          </button>
        </div>

        {loginMode === 'email' ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">E-mail Corporativo</label>
                <Input 
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="h-14 bg-slate-50 border-none rounded-2xl font-bold px-6 shadow-inner" 
                  placeholder="ex: seu@email.com.br" required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Senha</label>
                <Input 
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="h-14 bg-slate-50 border-none rounded-2xl font-bold px-6 shadow-inner" 
                  placeholder="••••••••" required
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-16 bg-primary text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl gap-3">
              {loading ? <Loader2 className="animate-spin" /> : <Zap className="size-5 text-accent" />}
              Entrar no Portal
            </Button>
          </form>
        ) : (
          <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-50 p-6 rounded-3xl border flex flex-col items-center">
              {tvCode ? (
                <>
                  <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
                    <QRCodeSVG value={tvAuthUrl} size={180} level="H" />
                  </div>
                  <p className="text-xl font-black tracking-[0.2em] text-primary">{tvCode}</p>
                  <p className="text-xs text-slate-500 mt-2 font-medium">Aponte a câmera do celular para o código acima para fazer login rápido na TV.</p>
                </>
              ) : (
                <Loader2 className="animate-spin text-primary size-8 my-10" />
              )}
            </div>
            {loading && <p className="text-sm font-bold text-primary animate-pulse">Aprovando acesso...</p>}
          </div>
        )}

        <div className="pt-6 border-t flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
            <Globe className="size-3" /> NAI Cloud Infrastructure
          </div>
        </div>
      </div>
    </div>
  );
}
