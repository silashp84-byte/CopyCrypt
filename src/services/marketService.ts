import { MarketPoint } from '../types';

class MarketService {
  private currentPrice: number = 65432.10;
  private history: MarketPoint[] = [];
  private listeners: ((point: MarketPoint) => void)[] = [];

  constructor() {
    // Initialize with some history
    const now = Date.now();
    for (let i = 100; i >= 0; i--) {
      const open = this.currentPrice;
      const change = (Math.random() - 0.5) * 25.0;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * 10.0;
      const low = Math.min(open, close) - Math.random() * 10.0;
      
      this.currentPrice = close;
      
      this.history.push({
        time: now - i * 1000,
        open,
        high,
        low,
        close,
        volume: Math.random() * 500
      });
    }

    // Start price movement
    setInterval(() => {
      this.tick();
    }, 1000);
  }

  private tick() {
    const open = this.currentPrice;
    const change = (Math.random() - 0.5) * 20.0;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 5.0;
    const low = Math.min(open, close) - Math.random() * 5.0;
    
    this.currentPrice = close;
    
    const point: MarketPoint = {
      time: Date.now(),
      open,
      high,
      low,
      close,
      volume: Math.random() * 100
    };

    this.history.push(point);
    if (this.history.length > 200) this.history.shift();
    
    this.listeners.forEach(l => l(point));
  }

  public getHistory() {
    return [...this.history];
  }

  public getCurrentPrice() {
    return this.currentPrice;
  }

  public subscribe(callback: (point: MarketPoint) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }
}

export const marketService = new MarketService();
