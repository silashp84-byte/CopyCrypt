export type TradeStatus = 'open' | 'won' | 'lost';
export type TradeType = 'BUY' | 'SELL';

export interface Trade {
  id: string;
  type: TradeType;
  entryPrice: number;
  exitPrice?: number;
  amount: number;
  timestamp: number;
  expiry: number;
  status: TradeStatus;
  asset: string;
  uid: string;
}

export interface MarketPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface UserProfile {
  uid: string;
  balance: number;
  displayName: string;
  photoURL?: string;
  goalsReached: number;
}
