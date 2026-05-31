export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { generateFinancialInsights } from '@/lib/services/insightService';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const period = parseInt(url.searchParams.get('period') || '6');
    
    // Generate insights and extract summary data
    const insights = await generateFinancialInsights(session.user.id, period);
    
    const summary = {
      totalSpent: insights.totalSpent,
      averageMonthlySpending: insights.averageMonthlySpending,
      topCategories: insights.topCategories,
      monthlyTrends: insights.monthlyTrends,
    };
    
    return NextResponse.json(summary);
    
  } catch (error) {
    console.error('Error generating summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
