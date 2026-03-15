import { MarketPoint } from '../types';

class MarketService {
  private currentPrice: number = 0;
  private history: MarketPoint[] = [];
  private listeners: ((point: MarketPoint) => void)[] = [];
  private ws: WebSocket | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      // Fetch initial history from Binance
      const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=100');
      const data = await response.json();
      
      this.history = data.map((d: any) => ({
        time: d[0],
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5])
      }));

      if (this.history.length > 0) {
        this.currentPrice = this.history[this.history.length - 1].close;
      }

      this.connectWebSocket();
    } catch (error) {
      console.error("Failed to fetch real market data:", error);
      // Fallback to simulation if API fails
      this.startSimulation();
    }
  }

  private connectWebSocket() {
    this.ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const k = data.k;
      
      const point: MarketPoint = {
        time: k.t,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v)
      };

      this.currentPrice = point.close;

      // Update history: replace last if same minute, or push new
      const lastIndex = this.history.length - 1;
      if (lastIndex >= 0 && this.history[lastIndex].time === point.time) {
        this.history[lastIndex] = point;
      } else {
        this.history.push(point);
        if (this.history.length > 200) this.history.shift();
      }

      this.listeners.forEach(l => l(point));
    };

    this.ws.onclose = () => {
      setTimeout(() => this.connectWebSocket(), 5000);
    };
  }

  private startSimulation() {
    this.currentPrice = 65000;
    setInterval(() => {
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
        volume: Math.random() * 500
      };

      this.history.push(point);
      if (this.history.length > 200) this.history.shift();
      this.listeners.forEach(l => l(point));
    }, 1000);
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
