'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PiggyBank, AlertCircle, PlusCircle, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function SavingOpportunities({ timeRange = '6' }: { timeRange?: string }) {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOpportunities();
  }, [timeRange]);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/insights/opportunities?period=${timeRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch saving opportunities');
      }
      const data = await response.json();
      setOpportunities(data.opportunities || []);
    } catch (err) {
      console.error('Error fetching saving opportunities:', err);
      setError('Failed to load saving opportunities. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBudget = async (categoryId: string, suggestedAmount: number) => {
    // Implement budget creation logic here
    console.log('Creating budget for category:', categoryId, 'Amount:', suggestedAmount);
    // You can open a modal or redirect to budget creation page
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PiggyBank className="mr-2 h-5 w-5" />
            Saving Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 w-full animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (opportunities.length === 0) {
    return (
      <Alert>
        <TrendingDown className="h-4 w-4" />
        <AlertTitle>No saving opportunities found</AlertTitle>
        <AlertDescription>
          Your spending looks good! We'll notify you when we find ways to save.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <PiggyBank className="mr-2 h-5 w-5" />
          Saving Opportunities
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {opportunities.map((opp) => (
            <div key={opp.category} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium">{opp.category}</h4>
                  <p className="text-sm text-muted-foreground">
                    You've spent {formatCurrency(opp.currentSpend)} in the last {timeRange} months
                  </p>
                  {opp.potentialSavings > 0 && (
                    <p className="mt-1 text-sm">
                      <span className="font-medium text-green-600">
                        Save up to {formatCurrency(opp.potentialSavings)}
                      </span>{' '}
                      by setting a budget of {formatCurrency(opp.suggestedBudget)}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCreateBudget(opp.categoryId, opp.suggestedBudget)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Set Budget
                </Button>
              </div>
              {opp.percentageIncrease > 0 && (
                <div className="mt-2 text-xs text-amber-600">
                  <AlertCircle className="mr-1 inline h-3 w-3" />
                  {opp.percentageIncrease.toFixed(0)}% increase from your average spending
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg bg-muted/50 p-4">
          <h4 className="mb-2 font-medium">Total Potential Savings</h4>
          <div className="flex items-baseline">
            <span className="text-2xl font-bold">
              {formatCurrency(
                opportunities.reduce((sum, opp) => sum + (opp.potentialSavings || 0), 0)
              )}
            </span>
            <span className="ml-2 text-sm text-muted-foreground">
              per {timeRange} months
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            These are estimated savings based on your spending patterns and our recommendations.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
