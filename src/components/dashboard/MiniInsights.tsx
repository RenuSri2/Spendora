'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, PiggyBank, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useEffect, useState } from 'react';

type InsightData = {
  totalSpent: number;
  topCategory: string;
  potentialSavings: number;
};

export default function MiniInsights() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightData | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const response = await fetch('/api/insights/summary?period=1');
        const data = await response.json();
        setInsights({
          totalSpent: data.totalSpent || 0,
          topCategory: data.topCategories?.[0]?.categoryName || 'N/A',
          potentialSavings: data.savingOpportunities?.reduce(
            (sum: number, opp: any) => sum + (opp.potentialSavings || 0),
            0
          ) || 0,
        });
      } catch (error) {
        console.error('Error fetching insights:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, []);

  if (loading) {
    return (
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>Financial Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Financial Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <span className="text-sm font-medium">Total Spent</span>
          </div>
          <span className="font-medium">
            {formatCurrency(insights?.totalSpent || 0)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PieChart className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium">Top Category</span>
          </div>
          <span className="text-sm">{insights?.topCategory}</span>
        </div>

        {insights?.potentialSavings > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <PiggyBank className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-medium">Potential Savings</span>
            </div>
            <span className="text-sm text-green-500">
              +{formatCurrency(insights?.potentialSavings)}
            </span>
          </div>
        )}

        <div className="pt-2 text-xs text-muted-foreground">
          <AlertCircle className="mr-1 inline h-3 w-3" />
          Tip: {getRandomTip(insights?.topCategory)}
        </div>
      </CardContent>
    </Card>
  );
}

function getRandomTip(category: string = 'spending') {
  const tips = [
    `Your top category is ${category}. Consider setting a budget for better control.`,
    'Review your subscriptions to find potential savings.',
    'Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings.',
    'Use the expense tracker to monitor daily spending habits.',
    'Set up alerts for when you approach your budget limits.',
  ];
  return tips[Math.floor(Math.random() * tips.length)];
}
