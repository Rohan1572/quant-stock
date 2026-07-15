import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetStockHistory } from '@workspace/api-client-react';

interface ChartProps {
  ticker: string;
  range: '1m' | '6m' | '1y' | '5y';
}

export function PriceChart({ ticker, range }: ChartProps) {
  const { data, isLoading, isError } = useGetStockHistory(ticker, range);

  if (isLoading) {
    return <Skeleton className="w-full h-full min-h-[300px]" data-testid="chart-skeleton" />;
  }

  if (isError || !data || data.points.length === 0) {
    return (
      <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-muted/20 border border-dashed rounded-xl">
        <span className="text-muted-foreground text-sm">Price history unavailable</span>
      </div>
    );
  }

  // Determine if overall trend is positive or negative for coloring
  const firstPrice = data.points[0].close;
  const lastPrice = data.points[data.points.length - 1].close;
  const isPositive = lastPrice >= firstPrice;
  const strokeColor = isPositive ? 'hsl(var(--buy))' : 'hsl(var(--sell))';
  const fillColor = isPositive ? 'url(#colorBuy)' : 'url(#colorSell)';

  const formatXAxis = (tickItem: string) => {
    try {
      const date = parseISO(tickItem);
      if (range === '1m') return format(date, 'MMM d');
      if (range === '6m' || range === '1y') return format(date, 'MMM yyyy');
      return format(date, 'yyyy');
    } catch {
      return tickItem;
    }
  };

  const formatYAxis = (tickItem: number) => {
    return `₹${tickItem.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const minPrice = Math.min(...data.points.map(p => p.close));
  const maxPrice = Math.max(...data.points.map(p => p.close));
  const padding = (maxPrice - minPrice) * 0.1;

  return (
    <div className="w-full h-[300px]" data-testid={`price-chart-${range}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.points} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorBuy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--buy))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--buy))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorSell" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--sell))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--sell))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatXAxis}
            minTickGap={50}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis 
            domain={[Math.max(0, minPrice - padding), maxPrice + padding]}
            tickFormatter={formatYAxis}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={60}
            dx={-10}
            orientation="right"
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--card))', 
              borderColor: 'hsl(var(--border))',
              borderRadius: '0.5rem',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
            }}
            itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '0.25rem' }}
            formatter={(value: number) => [`₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
            labelFormatter={(label) => format(parseISO(label as string), 'MMM d, yyyy')}
          />
          <Area 
            type="monotone" 
            dataKey="close" 
            stroke={strokeColor} 
            strokeWidth={2}
            fill={fillColor} 
            activeDot={{ r: 6, strokeWidth: 0, fill: strokeColor }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
