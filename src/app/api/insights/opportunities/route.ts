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
    const period = parseInt(url.searchParams.get('period') || '3'); // Default to 3 months for opportunities
    
    // Generate insights and extract opportunities
    const insights = await generateFinancialInsights(session.user.id, period);
    
    // Get user's budgets for additional context
    const budgets = await prisma.budget.findMany({
      where: { userId: session.user.id },
      include: { category: true },
    });
    
    // Get all categories for reference
    const categories = await prisma.category.findMany({
      where: { userId: session.user.id },
    });
    
    // Enhance opportunities with additional data
    const enhancedOpportunities = insights.savingOpportunities.map(opp => {
      // Find if there's a budget for this category
      const budget = budgets.find(b => 
        b.category?.name.toLowerCase() === opp.category.toLowerCase()
      );
      
      // Find category details
      const category = categories.find(c => 
        c.name.toLowerCase() === opp.category.toLowerCase()
      );
      
      return {
        ...opp,
        categoryId: category?.id,
        color: category?.color || '#3B82F6',
        icon: category?.icon || 'DollarSign',
        hasBudget: !!budget,
        currentBudget: budget?.amount,
        budgetId: budget?.id,
      };
    });
    
    // Sort by potential savings (descending)
    enhancedOpportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
    
    return NextResponse.json({
      opportunities: enhancedOpportunities,
      period,
    });
    
  } catch (error) {
    console.error('Error finding saving opportunities:', error);
    return NextResponse.json(
      { error: 'Failed to find saving opportunities' },
      { status: 500 }
    );
  }
}
