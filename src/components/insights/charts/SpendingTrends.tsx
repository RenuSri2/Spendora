'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';

type TimeRange = '3' | '6' | '12';

const timeRanges = [
  { value: '3', label: '3M' },
  { value: '6', label: '6M' },
  { value: '12', label: '1Y' },
];

export default function SpendingTrends() {
  const [timeRange, setTimeRange] = useState<TimeRange>('6');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/insights/trends?months=${timeRange}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch spending trends');
        }
        
        const json = await response.json();
        
        // Transform data for the stacked bar chart
        const categories = Array.from(
          new Set(
            json.categories
              .sort((a: any, b: any) => b.total - a.total)
              .slice(0, 5) // Top 5 categories
              .map((cat: any) => cat.name)
          )
        );
        
        // Group data by month and category
        const monthlyData = json.data.map((month: any) => {
          const monthData: any = {
            name: month.date,
          };
          
          // Initialize all categories for this month
          categories.forEach((cat: string) => {
            monthData[cat] = 0;
          });
          
          // Fill in the actual values
          Object.entries(month).forEach(([key, value]) => {
            if (categories.includes(key)) {
              monthData[key] = value;
            }
          });
          
          // Calculate total for this month
          monthData.total = Object.values(monthData).reduce(
            (sum: number, val: any) => (typeof val === 'number' ? sum + val : sum),
            0
          );
          
          return monthData;
        });
        
        setData(monthlyData);
        setError(null);
      } catch (err) {
        console.error('Error fetching spending trends:', err);
        setError('Failed to load spending trends. Please try again later.');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  const COLORS = [
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ec4899', // pink-500
  ];

  if (loading) {
    return (
      <div className="h-[400px] w-full flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[400px] items-center justify-center text-destructive">
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center text-muted-foreground">
        No spending data available for the selected period.
      </div>
    );
  }

  // Get the top 5 categories from the first month's data
  const categories = Object.keys(data[0] || {})
    .filter(key => !['name', 'total'].includes(key) && data[0][key] > 0)
    .sort((a, b) => (data[0][b] || 0) - (data[0][a] || 0))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Spending by Category</h3>
        <Tabs 
          defaultValue={timeRange}
          onValueChange={(value) => setTimeRange(value as TimeRange)}
          className="w-[200px]"
        >
          <TabsList className="grid w-full grid-cols-3">
            {timeRanges.map((range) => (
              <TabsTrigger key={range.value} value={range.value}>
                {range.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
            barGap={0}
            barCategoryGap="10%"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              tickFormatter={(value) => `$${value}`}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name,
              ]}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                borderColor: 'hsl(var(--border))',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
              }}
            />
            <Legend 
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">
                  {value}
                </span>
              )}
            />
            {categories.map((category, index) => (
              <Bar
                key={category}
                dataKey={category}
                name={category}
                stackId="a"
                fill={COLORS[index % COLORS.length]}
                radius={index === categories.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
