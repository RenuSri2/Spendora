'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

const COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  index,
  name,
}: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-medium"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function CategorySpending({ timeRange = '6' }: { timeRange?: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/insights/categories?period=${timeRange}`);
        const json = await response.json();
        
        // Transform and limit to top 6 categories
        const chartData = json.categories
          .sort((a: any, b: any) => b.amount - a.amount)
          .slice(0, 6)
          .map((cat: any) => ({
            name: cat.name,
            value: cat.amount,
            color: cat.color,
          }));
        
        // Add 'Other' category if there are more than 6 categories
        if (json.categories.length > 6) {
          const otherAmount = json.categories
            .slice(6)
            .reduce((sum: number, cat: any) => sum + cat.amount, 0);
          
          if (otherAmount > 0) {
            chartData.push({
              name: 'Other',
              value: otherAmount,
              color: '#94a3b8', // slate-400
            });
          }
        }
        
        setData(chartData);
      } catch (error) {
        console.error('Error fetching category data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

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
        No category data available.
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            className="text-xs"
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color || COLORS[index % COLORS.length]} 
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              borderColor: 'hsl(var(--border))',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}
          />
          <Legend 
            layout="vertical"
            verticalAlign="middle"
            align="right"
            formatter={(value, entry: any, index) => {
              const dataEntry = data.find((d) => d.name === value);
              const percentage = ((dataEntry?.value || 0) / 
                data.reduce((sum, d) => sum + d.value, 0)) * 100;
              
              return (
                <span className="text-xs text-muted-foreground">
                  {value}: {formatCurrency(dataEntry?.value || 0)} ({percentage.toFixed(1)}%)
                </span>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
