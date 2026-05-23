'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, PiggyBank, PieChart, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import MonthlyTrends from './charts/MonthlyTrends';
import CategorySpending from './charts/CategorySpending';
import SpendingTrends from './charts/SpendingTrends';
import SavingOpportunities from './SavingOpportunities';

const InsightsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('6');
  const [insights, setInsights] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchInsights();
  }, [timeRange]);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/insights/summary?period=${timeRange}`);
      const data = await response.json();
      setInsights(data);
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !insights) {
    return <InsightsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Financial Insights</h2>
        <div className="flex items-center space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="3">Last 3 Months</option>
            <option value="6">Last 6 Months</option>
            <option value="12">Last 12 Months</option>
          </select>
        </div>
      </div>

      <Tabs 
        defaultValue="overview" 
        className="space-y-4"
        onValueChange={setActiveTab}
      >
        <TabsList>
          <TabsTrigger value="overview">
            <TrendingUp className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="categories">
            <PieChart className="mr-2 h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="savings">
            <PiggyBank className="mr-2 h-4 w-4" />
            Savings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Spent"
              value={insights?.totalSpent}
              icon={TrendingUp}
              loading={loading}
            />
            <StatCard
              title="Avg. Monthly Spend"
              value={insights?.averageMonthlySpending}
              icon={TrendingUp}
              loading={loading}
            />
            <StatCard
              title="Top Category"
              value={insights?.topCategories[0]?.categoryName || 'N/A'}
              subtitle={`${insights?.topCategories[0]?.percentage?.toFixed(1)}% of total`}
              icon={PieChart}
              loading={loading}
            />
            <StatCard
              title="Potential Savings"
              value={insights?.savingOpportunities?.reduce((sum: number, opp: any) => sum + opp.potentialSavings, 0) || 0}
              icon={PiggyBank}
              loading={loading}
              isCurrency
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Monthly Spending</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <MonthlyTrends timeRange={timeRange} />
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Spending by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <CategorySpending timeRange={timeRange} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <SpendingTrends timeRange={timeRange} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="savings" className="space-y-4">
          <SavingOpportunities timeRange={timeRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const StatCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  loading = false,
  isCurrency = true,
}: {
  title: string;
  value: any;
  subtitle?: string;
  icon: any;
  loading?: boolean;
  isCurrency?: boolean;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <>
          <div className="text-2xl font-bold">
            {isCurrency ? formatCurrency(value || 0) : value || 'N/A'}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </>
      )}
    </CardContent>
  </Card>
);

const InsightsSkeleton = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32" />
    </div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
      ))}
    </div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      <Skeleton className="col-span-4 h-[400px] w-full rounded-xl" />
      <Skeleton className="col-span-3 h-[400px] w-full rounded-xl" />
    </div>
  </div>
);

export default InsightsDashboard;
