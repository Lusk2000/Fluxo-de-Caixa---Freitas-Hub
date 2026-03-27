import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Plus, 
  Download,
  Trash2,
  X,
  Loader2,
  LogOut
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';

// Types
interface CashFlowEntry {
  id: string;
  date: string;
  project: string;
  service: string;
  description: string;
  income_amount: number;
  expense_amount: number;
}

const getTodayLocal = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzoffset).toISOString().split('T')[0];
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [entries, setEntries] = useState<CashFlowEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    date: getTodayLocal(),
    project: '',
    service: '',
    description: '',
    incomeAmount: '' as string | number,
    expenseAmount: '' as string | number
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchEntries();
    }
  }, [session]);

  const fetchEntries = async () => {
    if (!isSupabaseConfigured) {
      console.warn('Supabase is not configured. Please set VITE_SUPABASE_ANON_KEY.');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cash_flow')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      if (data) setEntries(data as CashFlowEntry[]);
    } catch (error) {
      console.error('Error fetching entries:', error);
      // Fallback to empty array if table doesn't exist yet
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculations
  const currentMonthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());
  
  const { totalIncome, totalExpense, balance } = useMemo(() => {
    return entries.reduce((acc, entry) => {
      const inc = Number(entry.income_amount) || 0;
      const exp = Number(entry.expense_amount) || 0;
      acc.totalIncome += inc;
      acc.totalExpense += exp;
      acc.balance += (inc - exp);
      return acc;
    }, { totalIncome: 0, totalExpense: 0, balance: 0 });
  }, [entries]);

  // Sort entries by date
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [entries]);

  // Calculate accumulated balance
  const entriesWithAccumulated = useMemo(() => {
    let accumulated = 0;
    return sortedEntries.map(entry => {
      const inc = Number(entry.income_amount) || 0;
      const exp = Number(entry.expense_amount) || 0;
      accumulated += (inc - exp);
      return { ...entry, accumulated };
    });
  }, [sortedEntries]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    const parseAmount = (val: string | number) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      
      // Remove anything that is not a digit, comma, or dot
      let cleanVal = String(val).replace(/[^\d.,]/g, '');
      
      // Handle Brazilian format (e.g., 1.500,00)
      if (cleanVal.includes('.') && cleanVal.includes(',')) {
        cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
      } else if (cleanVal.includes(',')) {
        // Handle just comma (e.g., 150,00)
        cleanVal = cleanVal.replace(',', '.');
      }
      
      const parsed = Number(cleanVal);
      return isNaN(parsed) ? 0 : parsed;
    };

    const incAmt = parseAmount(newEntry.incomeAmount);
    const expAmt = parseAmount(newEntry.expenseAmount);

    if (!newEntry.project || !newEntry.project.trim()) {
      toast.error("Por favor, preencha o campo 'Projeto'.");
      return;
    }

    if (!newEntry.service || !newEntry.service.trim()) {
      toast.error("Por favor, preencha o campo 'Serviço / Categoria'.");
      return;
    }

    if (incAmt === 0 && expAmt === 0) {
      toast.error("Por favor, informe um valor maior que zero para Receita ou Despesa.");
      return;
    }

    setIsSubmitting(true);

    const entryToInsert = {
      date: newEntry.date || getTodayLocal(),
      project: newEntry.project.trim(),
      service: newEntry.service.trim(),
      description: newEntry.description || '',
      income_amount: incAmt,
      expense_amount: expAmt
    };

    try {
      const { data, error } = await supabase
        .from('cash_flow')
        .insert([entryToInsert])
        .select();

      if (error) {
        console.error("Supabase Error:", error);
        toast.error(`Erro ao salvar no banco de dados: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        setEntries(prev => {
          const newEntries = [...prev, ...(data as CashFlowEntry[])];
          return newEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        });
      } else {
        fetchEntries();
      }
      
      setIsModalOpen(false);
      toast.success('Lançamento adicionado com sucesso!');
      setNewEntry({
        date: getTodayLocal(),
        project: '',
        service: '',
        description: '',
        incomeAmount: '',
        expenseAmount: ''
      });
    } catch (error: any) {
      console.error('Error adding entry:', error);
      toast.error(`Erro inesperado: ${error.message || 'Verifique a conexão com o Supabase.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cash_flow')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setEntries(entries.filter(e => e.id !== id));
      toast.success('Lançamento excluído.');
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Erro ao excluir lançamento.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30 pb-20">
      <Toaster theme="dark" position="top-center" />
      {!isSupabaseConfigured && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-400 px-6 py-3 text-center text-sm font-medium">
          Atenção: A chave pública do Supabase (VITE_SUPABASE_ANON_KEY) não foi configurada. O aplicativo não conseguirá salvar ou carregar dados.
        </div>
      )}
      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-transparent flex items-center justify-center overflow-hidden">
              <img src="https://i.ibb.co/fdPyNmNQ/logo-sg.png" alt="Logo" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling!.classList.remove('hidden'); }} />
              <span className="hidden text-white font-bold text-lg sm:text-xl tracking-tighter">SG</span>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold tracking-tight leading-tight">Fluxo de Caixa</h1>
              <p className="text-[10px] sm:text-xs text-zinc-400 uppercase tracking-widest leading-tight">Freitas Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => window.print()}
              className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar PDF
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 bg-zinc-100 text-zinc-950 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium hover:bg-white transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Novo Lançamento</span>
              <span className="sm:hidden">Novo</span>
            </button>
            <button 
              onClick={handleSignOut}
              className="flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:px-4 sm:py-2 text-sm font-medium text-zinc-400 hover:text-rose-400 transition-colors rounded-full hover:bg-zinc-900 sm:hover:bg-transparent"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-2">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 sm:mt-10">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 sm:mb-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-zinc-400">Mês Atual</p>
              <div className="w-8 h-8 rounded-full bg-zinc-800/50 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-zinc-300" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-semibold capitalize">{currentMonthName}</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-zinc-400">Total Receita</p>
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-emerald-400">{formatCurrency(totalIncome)}</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-zinc-400">Total Despesa</p>
              <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-rose-500" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-semibold text-rose-400">{formatCurrency(totalExpense)}</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-zinc-100 rounded-2xl p-5 sm:p-6 text-zinc-950 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-zinc-300/50 to-transparent rounded-bl-full -z-10" />
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-zinc-600">Saldo Geral</p>
              <div className="w-8 h-8 rounded-full bg-zinc-950/5 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-zinc-950" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight">{formatCurrency(balance)}</p>
          </motion.div>
        </div>

        {/* Desktop Data Table */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="hidden md:block bg-zinc-900/30 border border-zinc-800/50 rounded-2xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800/50 bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-400 whitespace-nowrap">
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium">Projeto</th>
                  <th className="p-4 font-medium">Serviço</th>
                  <th className="p-4 font-medium text-right">Receita</th>
                  <th className="p-4 font-medium">Descrição</th>
                  <th className="p-4 font-medium text-right">Despesa</th>
                  <th className="p-4 font-medium text-right">Saldo Acumulado</th>
                  <th className="p-4 font-medium text-center w-16">Ações</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <AnimatePresence>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-zinc-500">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Carregando dados...</span>
                        </div>
                      </td>
                    </tr>
                  ) : entriesWithAccumulated.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-zinc-500">
                        Nenhum lançamento encontrado.
                      </td>
                    </tr>
                  ) : (
                    entriesWithAccumulated.map((entry, index) => (
                      <motion.tr 
                        initial={{ opacity: 0, opacity: 0 }}
                        animate={{ opacity: 1, opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={entry.id} 
                        className={`border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors ${index % 2 === 0 ? 'bg-transparent' : 'bg-zinc-900/20'}`}
                      >
                        <td className="p-4 text-zinc-300 whitespace-nowrap">
                          {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-4 font-medium text-zinc-100">{entry.project}</td>
                        <td className="p-4 text-zinc-300">{entry.service}</td>
                        <td className="p-4 text-right font-mono text-emerald-400">
                          {entry.income_amount > 0 ? formatCurrency(entry.income_amount) : '-'}
                        </td>
                        <td className="p-4 text-zinc-400 max-w-xs truncate" title={entry.description}>
                          {entry.description || '-'}
                        </td>
                        <td className="p-4 text-right font-mono text-rose-400">
                          {entry.expense_amount > 0 ? formatCurrency(entry.expense_amount) : '-'}
                        </td>
                        <td className={`p-4 text-right font-mono font-medium ${entry.accumulated >= 0 ? 'text-zinc-200' : 'text-rose-500'}`}>
                          {formatCurrency(entry.accumulated)}
                        </td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => removeEntry(entry.id)}
                            className="text-zinc-500 hover:text-rose-400 transition-colors p-1 rounded"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Mobile Data Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="md:hidden space-y-4 pb-8"
        >
          <AnimatePresence>
            {isLoading ? (
              <div className="p-8 text-center text-zinc-500 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Carregando dados...</span>
              </div>
            ) : entriesWithAccumulated.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl">
                Nenhum lançamento encontrado.
              </div>
            ) : (
              entriesWithAccumulated.map((entry) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={entry.id} 
                  className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 flex flex-col gap-4"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-semibold text-zinc-100 text-base">{entry.project}</h3>
                      <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <button 
                      onClick={() => removeEntry(entry.id)}
                      className="text-zinc-500 hover:text-rose-400 transition-colors p-2 -mr-2 -mt-2 rounded-full hover:bg-zinc-800/50"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="text-sm text-zinc-300 space-y-2 bg-zinc-950/30 p-3.5 rounded-xl border border-zinc-800/30">
                    <div className="flex justify-between items-start gap-4">
                      <span className="text-zinc-500 text-xs uppercase tracking-wider">Serviço</span> 
                      <span className="font-medium text-right">{entry.service}</span>
                    </div>
                    {entry.description && (
                      <div className="flex justify-between items-start gap-4 pt-2 border-t border-zinc-800/30">
                        <span className="text-zinc-500 text-xs uppercase tracking-wider">Desc</span> 
                        <span className="text-right text-xs leading-relaxed">{entry.description}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-end pt-2">
                    <div className="flex flex-col gap-1.5">
                      {entry.income_amount > 0 && (
                        <span className="text-sm font-mono font-medium text-emerald-400 flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          {formatCurrency(entry.income_amount)}
                        </span>
                      )}
                      {entry.expense_amount > 0 && (
                        <span className="text-sm font-mono font-medium text-rose-400 flex items-center gap-1.5">
                          <TrendingDown className="w-3.5 h-3.5" />
                          {formatCurrency(entry.expense_amount)}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Saldo Acumulado</p>
                      <p className={`font-mono font-bold text-lg ${entry.accumulated >= 0 ? 'text-zinc-100' : 'text-rose-500'}`}>
                        {formatCurrency(entry.accumulated)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* Add Entry Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <h2 className="text-lg font-semibold">Novo Lançamento</h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleAddEntry} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-emerald-400">Valor Receita (R$)</label>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="0,00"
                      value={newEntry.incomeAmount}
                      onChange={e => setNewEntry({...newEntry, incomeAmount: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-emerald-400 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-rose-400">Valor Despesa (R$)</label>
                    <input 
                      type="text" 
                      inputMode="decimal"
                      placeholder="0,00"
                      value={newEntry.expenseAmount}
                      onChange={e => setNewEntry({...newEntry, expenseAmount: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-rose-400 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-400">Data</label>
                  <input 
                    type="date" 
                    value={newEntry.date}
                    onChange={e => setNewEntry({...newEntry, date: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-400">Projeto</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Tatu Preparações"
                    value={newEntry.project}
                    onChange={e => setNewEntry({...newEntry, project: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-400">Serviço / Categoria</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Desenvolvimento Web"
                    value={newEntry.service}
                    onChange={e => setNewEntry({...newEntry, service: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-zinc-400">Descrição (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Cliente Tatu Preparações"
                    value={newEntry.description}
                    onChange={e => setNewEntry({...newEntry, description: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-base sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-all"
                  />
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-zinc-100 text-zinc-950 font-medium rounded-xl px-4 py-3 hover:bg-white transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Adicionar Lançamento'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
