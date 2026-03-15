/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { marketService } from './services/marketService';
import { tradingService } from './services/tradingService';
import { MarketPoint, Trade, UserProfile } from './types';
import Chart from './components/Chart';
import TradeList from './components/TradeList';
import { Wallet, TrendingUp, Activity, Timer, BrainCircuit, LogIn, LogOut, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  updateDoc,
  getDocFromServer
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export default function App() {
  const [marketData, setMarketData] = useState<MarketPoint[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [nextTradeTime, setNextTradeTime] = useState<number>(0);
  const [aiThought, setAiThought] = useState<string>('Aguardando próxima janela de análise...');
  const [error, setError] = useState<string | null>(null);
  
  const tradesRef = useRef<Trade[]>([]);
  const userProfileRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    tradesRef.current = trades;
    userProfileRef.current = userProfile;
  }, [trades, userProfile]);

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setError(`Erro de permissão no banco de dados. Contate o suporte.`);
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setIsAuthReady(true);
      if (user) {
        // Check/Create user profile
        const userRef = doc(db, 'users', user.uid);
        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            const newProfile: UserProfile = {
              uid: user.uid,
              balance: 10000,
              displayName: user.displayName || 'Trader',
              goalsReached: 0
            };
            await setDoc(userRef, newProfile);
            setUserProfile(newProfile);
          } else {
            setUserProfile(snap.data() as UserProfile);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setUserProfile(null);
      }
    });
    return unsubscribe;
  }, []);

  // Test connection
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          setError("Erro de conexão com o Firebase. Verifique sua configuração.");
        }
      }
    };
    testConnection();
  }, []);

  // Sync Trades from Firestore
  useEffect(() => {
    if (!authUser || !isAuthReady) return;

    const q = query(
      collection(db, 'trades'),
      where('uid', '==', authUser.uid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTrades = snapshot.docs.map(doc => doc.data() as Trade);
      setTrades(fetchedTrades);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'trades');
    });

    return unsubscribe;
  }, [authUser, isAuthReady]);

  // Sync User Profile
  useEffect(() => {
    if (!authUser || !isAuthReady) return;

    const unsubscribe = onSnapshot(doc(db, 'users', authUser.uid), (snap) => {
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${authUser.uid}`);
    });

    return unsubscribe;
  }, [authUser, isAuthReady]);

  // Update market data and check for trade expiries
  useEffect(() => {
    setMarketData(marketService.getHistory());
    
    const unsubscribe = marketService.subscribe(async (point) => {
      setMarketData(prev => [...prev.slice(-199), point]);
      
      // Check for expired trades
      const now = Date.now();
      const openTrades = tradesRef.current.filter(t => t.status === 'open');
      
      if (openTrades.length > 0 && authUser) {
        for (const trade of openTrades) {
          if (now >= trade.expiry) {
            const win = trade.type === 'BUY' 
              ? point.close > trade.entryPrice 
              : point.close < trade.entryPrice;
            
            const status = win ? 'won' : 'lost';
            // 2:1 logic: profit is 2x the amount (100% profit)
            const profit = win ? trade.amount * 2 : 0;
            
            try {
              // Update trade status
              await updateDoc(doc(db, 'trades', trade.id), {
                status,
                exitPrice: point.close
              });

              // Update balance if won
              if (win && userProfileRef.current) {
                let newBalance = userProfileRef.current.balance + profit;
                let newGoalsReached = userProfileRef.current.goalsReached || 0;

                // Check for 1M goal
                if (newBalance >= 1000000) {
                  newBalance = 10000; // Reset to initial
                  newGoalsReached += 1;
                }

                await updateDoc(doc(db, 'users', authUser.uid), {
                  balance: newBalance,
                  goalsReached: newGoalsReached
                });
              }
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `trades/${trade.id}`);
            }
          }
        }
      }
    });

    return unsubscribe;
  }, [authUser]);

  const playAlert = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0.5;
    audio.play().catch(e => console.log('Audio playback blocked until user interaction:', e));
  };

  // Trading Loop: Every minute
  useEffect(() => {
    const runAnalysis = async () => {
      if (!authUser || !userProfileRef.current) return;

      setIsAnalyzing(true);
      setAiThought('Analisando padrões de velas e volume dos últimos 60 segundos...');
      const decision = await tradingService.analyzeAndTrade();
      setIsAnalyzing(false);

      if (decision && userProfileRef.current.balance >= 100) {
        setAiThought(`Análise concluída: Tendência de ${decision === 'BUY' ? 'ALTA' : 'BAIXA'} detectada. Abrindo operação...`);
        const amount = 100;
        const tradeId = Math.random().toString(36).substr(2, 9);
        const newTrade: Trade = {
          id: tradeId,
          type: decision,
          entryPrice: marketService.getCurrentPrice(),
          amount,
          timestamp: Date.now(),
          expiry: Date.now() + 60000,
          status: 'open',
          asset: 'BTC/USD',
          uid: authUser.uid
        };

        try {
          // Deduct balance first
          await updateDoc(doc(db, 'users', authUser.uid), {
            balance: userProfileRef.current.balance - amount
          });
          // Create trade
          await setDoc(doc(db, 'trades', tradeId), newTrade);
          playAlert();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `trades/${tradeId}`);
        }
      } else if (!decision) {
        setAiThought('Análise inconclusiva. Aguardando próxima oportunidade.');
      }
    };

    const interval = setInterval(() => {
      const now = new Date();
      if (now.getSeconds() === 0) {
        runAnalysis();
      }
      const secondsToNext = 60 - now.getSeconds();
      setNextTradeTime(secondsToNext);
    }, 1000);

    return () => clearInterval(interval);
  }, [authUser]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  const handleLogout = () => signOut(auth);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#0A0B0D] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-white font-sans selection:bg-emerald-500/30">
      {/* Error Boundary */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-rose-500 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3"
          >
            <AlertCircle size={20} />
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 hover:opacity-70">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-bottom border-white/5 bg-[#151619]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="text-black" size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">CopyTrade <span className="text-emerald-500">AI</span></h1>
              <p className="text-[10px] text-[#8E9299] uppercase font-bold tracking-widest">Simulação em Tempo Real</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {authUser ? (
              <>
                <div className="hidden md:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-full border border-white/5">
                  <Timer size={16} className="text-emerald-500" />
                  <span className="text-xs font-mono">Próxima análise: {nextTradeTime}s</span>
                </div>
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
                  <Wallet size={18} className="text-emerald-500" />
                  <div className="flex flex-col">
                    <span className="font-mono font-bold text-emerald-500">
                      ${userProfile?.balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                    </span>
                    <span className="text-[8px] text-emerald-500/70 uppercase font-bold">Metas: {userProfile?.goalsReached || 0}</span>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-[#8E9299] hover:text-white"
                >
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                <LogIn size={18} />
                Entrar com Google
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!authUser ? (
          <div className="max-w-2xl mx-auto text-center py-20">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <BrainCircuit className="text-emerald-500" size={40} />
            </div>
            <h2 className="text-4xl font-bold mb-4 tracking-tight">Trading Inteligente Automático</h2>
            <p className="text-[#8E9299] mb-10 text-lg leading-relaxed">
              Conecte sua conta para começar a simular operações em tempo real. 
              Nossa IA analisa o mercado 24/7 para você.
            </p>
            <button 
              onClick={handleLogin}
              className="bg-emerald-500 hover:bg-emerald-600 text-black px-10 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-emerald-500/30 flex items-center gap-3 mx-auto"
            >
              <LogIn size={24} />
              Começar Agora
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Chart & Analysis */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="text-emerald-500" size={20} />
                  <h2 className="text-xl font-bold">BTC/USD</h2>
                  <span className="text-xs bg-emerald-500/10 px-2 py-1 rounded text-emerald-500 border border-emerald-500/20">Mercado Real (Binance)</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-emerald-500">
                    ${marketService.getCurrentPrice().toFixed(5)}
                  </div>
                  <div className="text-[10px] text-[#8E9299] uppercase font-bold">Preço Atual</div>
                </div>
              </div>

              <Chart data={marketData} />

              {/* Price Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Abertura', value: marketData[marketData.length - 1]?.open, color: 'text-white' },
                  { label: 'Máxima', value: marketData[marketData.length - 1]?.high, color: 'text-emerald-500' },
                  { label: 'Mínima', value: marketData[marketData.length - 1]?.low, color: 'text-rose-500' },
                  { label: 'Fechamento', value: marketData[marketData.length - 1]?.close, color: 'text-white' },
                ].map((item) => (
                  <div key={item.label} className="bg-[#151619] border border-white/5 p-4 rounded-xl">
                    <div className="text-[10px] text-[#8E9299] uppercase font-bold mb-1">{item.label}</div>
                    <div className={`font-mono text-lg font-bold ${item.color}`}>
                      ${item.value?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#151619] border border-white/5 rounded-xl p-6 relative overflow-hidden">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`p-3 rounded-xl ${isAnalyzing ? 'bg-emerald-500/20 animate-pulse' : 'bg-white/5'}`}>
                    <BrainCircuit className={isAnalyzing ? 'text-emerald-500' : 'text-[#8E9299]'} size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold">Análise da IA</h3>
                    <p className="text-xs text-[#8E9299]">
                      {aiThought}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  {['RSI', 'MACD', 'Volume'].map((indicator) => (
                    <div key={indicator} className="bg-white/5 p-3 rounded-lg border border-white/5">
                      <div className="text-[10px] text-[#8E9299] uppercase font-bold mb-1">{indicator}</div>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-emerald-500"
                          initial={{ width: '0%' }}
                          animate={{ width: isAnalyzing ? '100%' : '60%' }}
                          transition={{ duration: isAnalyzing ? 2 : 0.5 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Trades */}
            <div className="space-y-6">
              <div className="bg-[#151619] border border-white/5 rounded-xl p-6">
                <TradeList trades={trades} />
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-6">
                <h4 className="text-sm font-bold text-emerald-500 mb-2">Como funciona?</h4>
                <p className="text-xs text-[#8E9299] leading-relaxed">
                  Nossa IA analisa os últimos 60 segundos de movimentação do mercado a cada minuto. 
                  Ao identificar um padrão de alta ou baixa baseado em volume e price action, 
                  uma operação de 1 minuto é aberta automaticamente.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-8 border-t border-white/5 text-center">
        <p className="text-xs text-[#8E9299]">
          © 2026 CopyTrade AI Simulator. Esta é uma plataforma de simulação com dinheiro fictício.
        </p>
      </footer>
    </div>
  );
}
