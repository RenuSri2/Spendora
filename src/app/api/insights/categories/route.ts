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
    
    // Generate insights and extract category data
    const insights = await generateFinancialInsights(session.user.id, period);
    
    // Get all categories with their spending
    const categories = await prisma.category.findMany({
      where: { userId: session.user.id },
      include: {
        expenses: {
          where: {
            date: {
              gte: subMonths(new Date(), period),
              lte: new Date(),
            },
          },
        },
      },
    });
    
    // Calculate total spending for each category
    const categorySpending = categories.map(category => ({
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      amount: category.expenses.reduce((sum, exp) => sum + exp.amount, 0),
      count: category.expenses.length,
    }));
    
    // Sort by amount (descending)
    categorySpending.sort((a, b) => b.amount - a.amount);
    
    // Calculate total for percentages
    const totalSpent = categorySpending.reduce((sum, cat) => sum + cat.amount, 0);
    
    // Add percentages
    const categoriesWithPercentages = categorySpending.map(cat => ({
      ...cat,
      percentage: totalSpent > 0 ? (cat.amount / totalSpent) * 100 : 0,
    }));
    
    return NextResponse.json({
      categories: categoriesWithPercentages,
      period,
    });
    
  } catch (error) {
    console.error('Error fetching category insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category insights' },
      { status: 500 }
    );
  }
}
