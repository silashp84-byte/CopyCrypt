import React, { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, CartesianGrid, Bar, Cell } from 'recharts';
import { MarketPoint } from '../types';

interface Props {
  data: MarketPoint[];
}

const Candle = (props: any) => {
  const { x, y, width, height, open, close, high, low } = props;
  const isUp = close >= open;
  const color = isUp ? '#10b981' : '#ef4444';
  
  // If open and close are the same, height is 0. We need a minimum height for the body
  const bodyHeight = Math.max(height, 1);
  const bodyY = height < 1 ? y - 0.5 : y;

  // We need to calculate the wick positions. 
  // Since we don't have the scale, we can estimate the ratio from the body if height > 0
  // A better way is to pass the scale or use a different approach.
  // But for this simulation, we can use the body ratio or a fallback.
  const priceDiff = Math.abs(open - close);
  const ratio = priceDiff > 0 ? height / priceDiff : 0;
  
  // If ratio is 0 (open == close), we can't draw wicks accurately this way.
  // However, in our simulation, priceDiff is almost never 0.
  const wickHigh = ratio > 0 ? bodyY - (high - Math.max(open, close)) * ratio : bodyY;
  const wickLow = ratio > 0 ? bodyY + bodyHeight + (Math.min(open, close) - low) * ratio : bodyY + bodyHeight;

  return (
    <g>
      <line 
        x1={x + width / 2} 
        y1={wickHigh} 
        x2={x + width / 2} 
        y2={wickLow} 
        stroke={color} 
        strokeWidth={1} 
      />
      <rect 
        x={x} 
        y={bodyY} 
        width={width} 
        height={bodyHeight} 
        fill={color} 
      />
    </g>
  );
};

const Chart: React.FC<Props> = ({ data }) => {
  const domain = useMemo(() => {
    if (data.length === 0) return [0, 0];
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  }, [data]);

  // Prepare data for Recharts Bar
  // We want the bar to represent the body (open to close)
  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      // Bar expects [start, end] for range or just a value
      // We'll use a range [min(open, close), max(open, close)]
      body: [Math.min(d.open, d.close), Math.max(d.open, d.close)],
    }));
  }, [data]);

  return (
    <div className="h-[400px] w-full bg-[#151619] rounded-xl p-4 border border-white/5 shadow-2xl">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
          <XAxis 
            dataKey="time" 
            hide 
          />
          <YAxis 
            domain={domain} 
            orientation="right" 
            tick={{ fill: '#8E9299', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => val.toFixed(2)}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#151619', border: '1px solid #ffffff10', borderRadius: '8px' }}
            itemStyle={{ color: '#00FF00' }}
            labelStyle={{ display: 'none' }}
            formatter={(value: any, name: string, props: any) => {
              if (name === 'body') {
                const { open, close, high, low } = props.payload;
                return [
                  `O: ${open.toFixed(2)} H: ${high.toFixed(2)} L: ${low.toFixed(2)} C: ${close.toFixed(2)}`,
                  'Price'
                ];
              }
              return [value, name];
            }}
          />
          <Bar 
            dataKey="body" 
            shape={<Candle />}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default Chart;
