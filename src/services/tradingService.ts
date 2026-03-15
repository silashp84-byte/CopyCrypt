import { GoogleGenAI } from "@google/genai";
import { marketService } from "./marketService";
import { Trade, TradeType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export class TradingService {
  private isAnalyzing = false;

  public async analyzeAndTrade(): Promise<TradeType | null> {
    if (this.isAnalyzing) return null;
    this.isAnalyzing = true;

    try {
      const history = marketService.getHistory().slice(-60);
      const dataStr = history.map(p => `O: ${p.open.toFixed(2)}, H: ${p.high.toFixed(2)}, L: ${p.low.toFixed(2)}, C: ${p.close.toFixed(2)}`).join('\n');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the following 1-minute Bitcoin (BTC/USD) market data (OHLC) and decide if the next 1-minute trend will be UP (BUY) or DOWN (SELL). 
        Base your decision on price action (candlestick patterns) and volume.
        Respond ONLY with the word "BUY" or "SELL".
        
        Data:
        ${dataStr}`,
      });

      const decision = response.text?.trim().toUpperCase();
      if (decision === 'BUY' || decision === 'SELL') {
        return decision as TradeType;
      }
      return Math.random() > 0.5 ? 'BUY' : 'SELL'; // Fallback
    } catch (error) {
      console.error("Analysis error:", error);
      return null;
    } finally {
      this.isAnalyzing = false;
    }
  }
}

export const tradingService = new TradingService();
