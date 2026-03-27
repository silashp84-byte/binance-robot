import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, TrendingUp, Target, Wallet, History, AlertCircle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';

interface BotStatus {
  botRunning: boolean;
  simulationMode: boolean;
  currentCapital: number;
  initialCapital: number;
  targetGoal: number;
  logs: string[];
  profit: number;
  realPrice: number;
  realBalance: number;
  hasApiKeys: boolean;
}

export default function App() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const lastLogRef = useRef<string | null>(null);

  const playAlertSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log('Audio play failed', e));
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      
      // Check for new alerts in logs
      if (data.logs.length > 0) {
        const latestLog = data.logs[0];
        if (latestLog !== lastLogRef.current) {
          if (latestLog.includes('ALERT')) {
            toast.success(latestLog, {
              icon: '🎯',
              duration: 5000,
            });
            playAlertSound();
          }
          lastLogRef.current = latestLog;
        }
      }
      
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    await fetch('/api/start', { method: 'POST' });
    fetchStatus();
  };

  const handleStop = async () => {
    await fetch('/api/stop', { method: 'POST' });
    fetchStatus();
  };

  const handleCheckup = () => {
    toast.info('Check-up do Sistema: Robô Operacional', {
      description: `Capital: $${status?.currentCapital.toFixed(2)} | Status: ${status?.botRunning ? 'Rodando' : 'Parado'}`,
      icon: <ShieldCheck className="w-5 h-5 text-blue-400" />
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f3ba2f]"></div>
      </div>
    );
  }

  const progress = status ? (Math.max(0, status.profit) / status.targetGoal) * 100 : 0;
  const profitColor = status && status.profit >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-[#0b0e11] text-[#eaecef] font-sans selection:bg-[#f3ba2f] selection:text-black">
      <Toaster position="top-right" theme="dark" richColors />
      {/* Header */}
      <header className="border-b border-[#2b2f36] bg-[#181a20] p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-[#f3ba2f] p-2 rounded-lg">
              <TrendingUp className="text-black w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Binance Alavancagem Bot</h1>
          </div>
          <div className="flex items-center gap-4">
            {status?.realPrice && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#2b2f36] rounded-full text-sm">
                <span className="text-[#848e9c]">BTC:</span>
                <span className="text-green-400 font-mono font-bold">${status.realPrice.toLocaleString()}</span>
              </div>
            )}
            <button 
              onClick={handleCheckup}
              className="p-2 hover:bg-[#2b2f36] rounded-full transition-colors text-[#848e9c]"
              title="Check-up do Sistema"
            >
              <ShieldCheck className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1 bg-[#2b2f36] rounded-full text-sm">
              <div className={`w-2 h-2 rounded-full ${status?.botRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              {status?.botRunning ? 'Executando' : 'Parado'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Stats */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCard 
              icon={<TrendingUp className={profitColor} />} 
              label="Lucro (Alavancagem)" 
              value={`$${status?.profit.toFixed(2)}`} 
              subValue="Performance Real"
              valueClass={profitColor}
            />
            
            <StatCard 
              icon={<Target className="text-blue-400" />} 
              label="Meta Final" 
              value={`$${status?.targetGoal}`} 
              subValue="Objetivo da Conta"
            />
          </div>

          {/* Progress Bar */}
          {status?.hasApiKeys && (
            <div className="bg-[#181a20] p-6 rounded-2xl border border-[#2b2f36]">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <h3 className="text-sm text-[#848e9c] uppercase tracking-wider font-semibold">Progresso da Alavancagem</h3>
                  <p className="text-2xl font-bold mt-1">{progress.toFixed(1)}% concluído</p>
                </div>
                <p className="text-[#848e9c] text-sm">Faltam ${status ? Math.max(0, status.targetGoal - status.currentCapital).toFixed(2) : 0} para a meta</p>
              </div>
              <div className="h-4 bg-[#2b2f36] rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  className="h-full bg-gradient-to-r from-[#f3ba2f] to-[#f0b90b]"
                />
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-4">
            {!status?.botRunning ? (
              <button 
                onClick={handleStart}
                className="flex-1 bg-[#f3ba2f] hover:bg-[#f0b90b] text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-[#f3ba2f]/10"
              >
                <Play fill="currentColor" /> INICIAR ALAVANCAGEM
              </button>
            ) : (
              <button 
                onClick={handleStop}
                className="flex-1 bg-[#2b2f36] hover:bg-[#3b3f46] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Square fill="currentColor" /> PARAR E REINICIAR
              </button>
            )}
          </div>

          {/* Strategy Info */}
          <div className="bg-[#181a20] p-6 rounded-2xl border border-[#2b2f36] flex items-start gap-4">
            <div className="bg-blue-500/10 p-3 rounded-xl">
              <AlertCircle className="text-blue-400 w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold mb-1">Configuração de Risco</h4>
              <p className="text-sm text-[#848e9c] leading-relaxed">
                O robô monitora a conta real Binance, arriscando 1% do capital por operação. 
                Alertas automáticos são disparados a cada $20 de lucro acumulado na meta de $1000.
              </p>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-[#181a20] rounded-2xl border border-[#2b2f36] flex flex-col h-[600px]">
          <div className="p-4 border-b border-[#2b2f36] flex items-center gap-2">
            <History className="w-5 h-5 text-[#848e9c]" />
            <h3 className="font-bold">Histórico de Operações</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
            <AnimatePresence initial={false}>
              {status?.logs.map((log, i) => (
                <motion.div 
                  key={log + i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-2 rounded border-l-2 ${
                    log.includes('GANHO') || log.includes('WON') ? 'bg-green-500/5 border-green-500 text-green-400' : 
                    log.includes('PERDIDO') || log.includes('LOST') ? 'bg-red-500/5 border-red-500 text-red-400' :
                    log.includes('ALERT') ? 'bg-yellow-500/5 border-yellow-500 text-yellow-400' :
                    log.includes('Analisando') ? 'bg-blue-500/5 border-blue-500 text-blue-400' :
                    log.includes('Tentativa') ? 'bg-purple-500/5 border-purple-500 text-purple-400' :
                    'bg-[#2b2f36]/30 border-[#848e9c] text-[#848e9c]'
                  }`}
                >
                  {log}
                </motion.div>
              ))}
            </AnimatePresence>
            {status?.logs.length === 0 && (
              <div className="text-center text-[#848e9c] py-10 italic">
                Aguardando início das operações...
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, subValue, valueClass = "" }: { icon: React.ReactNode, label: string, value: string, subValue: string, valueClass?: string }) {
  return (
    <div className="bg-[#181a20] p-6 rounded-2xl border border-[#2b2f36] transition-all hover:border-[#f3ba2f]/30">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <span className="text-xs text-[#848e9c] uppercase tracking-wider font-bold">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      <div className="text-xs text-[#848e9c] mt-1">{subValue}</div>
    </div>
  );
}
