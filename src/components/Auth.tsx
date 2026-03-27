import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Mail, Lock, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setSuccess('Usuário criado com sucesso!');
        setEmail('');
        setPassword('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Ocorreu um erro durante a autenticação.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans flex items-center justify-center p-6 selection:bg-emerald-500/30">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-transparent flex items-center justify-center mx-auto mb-6 overflow-hidden">
            <img src="https://i.ibb.co/fdPyNmNQ/logo-sg.png" alt="Logo" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling!.classList.remove('hidden'); }} />
            <span className="hidden text-white font-bold text-3xl tracking-tighter">SG</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            {isSignUp ? 'Criar nova conta' : 'Acesse sua conta'}
          </h1>
          <p className="text-zinc-400 text-sm">
            Hub criativo e estratégico. Experiências digitais de alto impacto.
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleAuth} className="space-y-5">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm text-center">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl text-sm text-center">
                {success}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-400 pl-1">E-mail</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-zinc-500" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-400 pl-1">Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-zinc-500" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-xl px-4 py-3.5 hover:bg-white transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isSignUp ? 'Criar conta' : 'Entrar na plataforma'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccess(null);
              }}
              className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              {isSignUp 
                ? 'Já tem uma conta? Faça login' 
                : 'Não tem uma conta? Cadastre-se'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
