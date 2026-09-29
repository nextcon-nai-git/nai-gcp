'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Globe, Zap, Tv, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/firebase';
import { TvLogin } from '@/components/auth/tv-login';
import { loginDestination } from '@/lib/login-destination';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

export default function LoginPage() {
  const [loginMode, setLoginMode] = React.useState<'email' | 'tv'>('email');
  
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const onTvAuthenticated = React.useCallback(() => router.replace('/'), [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const targetEmail = email.toLowerCase().trim();
    
    try {
      await signInWithEmailAndPassword(auth, targetEmail, password);

      toast({ title: "Acesso Autorizado", description: "Bem-vindo à plataforma NAI." });
      router.replace(loginDestination(window.location.search));
      
    } catch (error: unknown) {
      setLoading(false);
      const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
      const message = code === 'auth/network-request-failed' ? 'Verifique sua conexão e tente novamente.'
        : code === 'auth/too-many-requests' ? 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.'
        : 'Confira seu e-mail e senha e tente novamente.';
      toast({
        variant: 'destructive',
        title: 'Falha no Acesso',
        description: message,
      });
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-[#001F3F] p-6">
      <div className="w-full max-w-md space-y-8 bg-white p-6 sm:p-10 rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500">
        
        <div className="text-center space-y-2">
          <div className="size-16 rounded-[1.5rem] bg-primary mx-auto flex items-center justify-center text-white font-black text-3xl shadow-xl border-2 border-white/10 mb-4">N</div>
          <h1 className="text-4xl font-black text-primary uppercase tracking-tighter">NAI</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Inteligência em SST 2026</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            type="button"
            onClick={() => setLoginMode('email')} disabled={loading} aria-pressed={loginMode === 'email'}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${loginMode === 'email' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Smartphone className="size-4" /> Senha
          </button>
          <button 
            type="button"
            onClick={() => setLoginMode('tv')} disabled={loading} aria-pressed={loginMode === 'tv'}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${loginMode === 'tv' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Tv className="size-4" /> TV (QR Code)
          </button>
        </div>

        {loginMode === 'email' ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="login-email" className="text-[10px] font-black uppercase text-slate-400 ml-1">E-mail Corporativo</label>
                <Input 
                  id="login-email" autoComplete="username" disabled={loading} type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="h-14 bg-slate-50 border-none rounded-2xl font-bold px-6 shadow-inner" 
                  placeholder="ex: seu@email.com.br" required
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="login-password" className="text-[10px] font-black uppercase text-slate-400 ml-1">Senha</label>
                <Input 
                  id="login-password" autoComplete="current-password" disabled={loading} type="password" value={password} onChange={e => setPassword(e.target.value)}
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
          <TvLogin auth={auth} onAuthenticated={onTvAuthenticated} />
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
