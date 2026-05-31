'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

export default function MonthlyTrends({ timeRange = '6' }: { timeRange?: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/insights/trends?months=${timeRange}`);
        const json = await response.json();
        
        // Transform data for the chart
        const chartData = json.data.map((month: any) => ({
          name: month.date,
          total: month.amount || 0,
          // Add previous period for comparison if available
          previousPeriod: json.data.find((m: any) => 
            m.date === formatPreviousPeriod(month.date)
          )?.amount || null,
        }));
        
        setData(chartData);
      } catch (error) {
        console.error('Error fetching trends data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  const formatPreviousPeriod = (dateString: string) => {
    const [year, month] = dateString.split('-').map(Number);
    const prevYear = month <= 6 ? year - 1 : year;
    const prevMonth = month <= 6 ? month + 6 : month - 6;
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No spending data available for the selected period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip 
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              return (
                <div className="rounded-lg border bg-background p-4 shadow-sm">
                  <p className="font-medium">{label}</p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Spent: </span>
                    {formatCurrency(payload[0].value as number)}
                  </p>
                  {payload[1]?.value && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Previous Year: </span>
                      {formatCurrency(payload[1].value as number)}
                    </p>
                  )}
                </div>
              );
            }
            return null;
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="total"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6 }}
          name="Current Period"
        />
        <Line
          type="monotone"
          dataKey="previousPeriod"
          stroke="#94a3b8"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          name="Previous Year"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
