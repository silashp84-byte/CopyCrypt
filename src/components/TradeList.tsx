import React from 'react';
import { Trade } from '../types';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  trades: Trade[];
}

const TradeList: React.FC<Props> = ({ trades }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[#8E9299] uppercase tracking-wider">Histórico de Operações</h3>
      <div className="space-y-2">
        {trades.length === 0 && (
          <div className="text-center py-8 text-[#8E9299] text-sm italic">
            Nenhuma operação realizada ainda.
          </div>
        )}
        {trades.map((trade) => (
          <div 
            key={trade.id} 
            className="bg-[#151619] border border-white/5 rounded-lg p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-full ${trade.type === 'BUY' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {trade.type === 'BUY' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-white font-medium">{trade.type}</span>
                  <span className="text-xs text-[#8E9299]">{format(trade.timestamp, 'HH:mm:ss')}</span>
                </div>
                <div className="text-xs text-[#8E9299]">
                  Entrada: <span className="text-white">${trade.entryPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="font-mono text-white font-medium">
                ${trade.amount.toFixed(2)}
              </div>
              <div className="flex items-center gap-1 justify-end">
                {trade.status === 'open' ? (
                  <>
                    <Clock size={12} className="text-amber-500" />
                    <span className="text-[10px] text-amber-500 uppercase font-bold">Em Aberto</span>
                  </>
                ) : trade.status === 'won' ? (
                  <>
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    <span className="text-[10px] text-emerald-500 uppercase font-bold">Vitória</span>
                  </>
                ) : (
                  <>
                    <XCircle size={12} className="text-rose-500" />
                    <span className="text-[10px] text-rose-500 uppercase font-bold">Derrota</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TradeList;
