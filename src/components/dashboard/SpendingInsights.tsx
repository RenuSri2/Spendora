'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, PiggyBank, PieChart, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  category?: string;
}

interface SpendingInsightsProps {
  totalSpent: number;
  monthlyBudget: number;
  budgetUsed: number;
  topCategory?: string | null;
  recentTransactions?: Transaction[];
}

export default function SpendingInsights({ 
  totalSpent = 0, 
  monthlyBudget = 0, 
  budgetUsed = 0,
  topCategory = null,
  recentTransactions = []
}: SpendingInsightsProps) {
  const potentialSavings = monthlyBudget > 0 
    ? Math.max(0, monthlyBudget * 0.2 - (monthlyBudget - totalSpent)) 
    : 0;

  const getBudgetStatus = () => {
    if (budgetUsed >= 90) return 'Over Budget';
    if (budgetUsed >= 75) return 'Approaching Limit';
    return 'On Track';
  };

  const getStatusColor = () => {
    if (budgetUsed >= 90) return 'text-red-400';
    if (budgetUsed >= 75) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getBarColor = () => {
    if (budgetUsed >= 90) return 'bg-red-500';
    if (budgetUsed >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Get top 2 highest transactions
  const highestTransactions = [...recentTransactions]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 2);

  return (
    <Card className="bg-gray-800/50 border border-gray-700 rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base font-semibold">Spending Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Budget Usage - Compact Version */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-300">Budget Usage</span>
            <span className={`font-medium ${getStatusColor()}`}>
              {budgetUsed.toFixed(1)}% • {getBudgetStatus()}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1">
            <div 
              className={`h-1 rounded-full ${getBarColor()}`} 
              style={{ width: `${Math.min(100, budgetUsed)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>Spent: {formatCurrency(totalSpent)}</span>
            <span>Remaining: {formatCurrency(Math.max(0, monthlyBudget - totalSpent))}</span>
          </div>
        </div>

        {/* Rest of the content remains the same */}
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            {topCategory && (
              <div className="bg-gray-700/30 p-2 rounded-lg">
                <div className="flex items-center space-x-1.5 text-xs text-gray-400 mb-1">
                  <PieChart className="h-3.5 w-3.5 text-purple-400" />
                  <span>Top Category</span>
                </div>
                <div className="text-sm font-medium text-white">{topCategory}</div>
              </div>
            )}

            {potentialSavings > 0 && (
              <div className="bg-gray-700/30 p-2 rounded-lg">
                <div className="flex items-center space-x-1.5 text-xs text-gray-400 mb-1">
                  <PiggyBank className="h-3.5 w-3.5 text-green-400" />
                  <span>Potential Savings</span>
                </div>
                <div className="text-sm font-medium text-green-400">
                  +{formatCurrency(potentialSavings)}/mo
                </div>
              </div>
            )}
          </div>

          {highestTransactions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-400">Highest Transactions</h4>
              <div className="space-y-1.5">
                {highestTransactions.map((txn) => (
                  <div key={txn.id} className="flex justify-between items-center text-sm bg-gray-700/30 px-2.5 py-1.5 rounded-lg">
                    <span className="text-gray-300 truncate pr-2 text-xs">{txn.description}</span>
                    <span className="font-medium text-white text-xs">-{formatCurrency(txn.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-1 text-xs text-gray-400 flex items-start">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 mr-1.5 text-cyan-400" />
            <span>
              {getBudgetTip(budgetUsed, topCategory || 'your spending')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getBudgetTip(budgetUsed: number, category: string): string {
  if (budgetUsed >= 90) {
    return `You're over budget! Consider reducing ${category} expenses.`;
  }
  if (budgetUsed >= 75) {
    return `You've used ${Math.round(budgetUsed)}% of your budget. Watch your ${category} this month.`;
  }
  
  const tips = [
    `Your top category is ${category}. Keep an eye on it!`,
    'Consider transferring unused budget to savings.',
    "You're doing great with your budget!",
    'Review your subscriptions to find potential savings.',
    'Try to save at least 20% of your income each month.',
  ];
  
  return tips[Math.floor(Math.random() * tips.length)];
}
