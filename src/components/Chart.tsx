import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { MarketPoint } from '../types';

interface Props {
  data: MarketPoint[];
}

const Chart: React.FC<Props> = ({ data }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#151619' },
        textColor: '#8E9299',
      },
      grid: {
        vertLines: { color: '#ffffff05' },
        horzLines: { color: '#ffffff05' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = (chart as any).addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series as any;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      const formattedData = data.map(d => ({
        time: (d.time / 1000) as any, // Convert ms to seconds
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));
      
      // Sort data by time to ensure it's in order
      formattedData.sort((a, b) => a.time - b.time);
      
      // Remove duplicates
      const uniqueData = formattedData.filter((val, index, self) => 
        index === self.findIndex((t) => t.time === val.time)
      );

      (seriesRef.current as any).setData(uniqueData);
    }
  }, [data]);

  return (
    <div className="relative w-full">
      <div 
        ref={chartContainerRef} 
        className="h-[400px] w-full bg-[#151619] rounded-xl overflow-hidden border border-white/5 shadow-2xl"
      />
      {(!data || data.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#151619]/80 rounded-xl">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-[#8E9299] text-xs font-mono">Carregando mercado...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chart;
