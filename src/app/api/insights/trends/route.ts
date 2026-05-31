export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { subMonths, format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';

const prisma = new PrismaClient();

type TrendData = {
  date: string; // YYYY-MM
  [category: string]: number | string;
};

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
    const months = parseInt(url.searchParams.get('months') || '6');
    const categoryId = url.searchParams.get('categoryId');
    
    // Calculate date range
    const endDate = new Date();
    const startDate = subMonths(endDate, months - 1);
    
    // Get all categories for the user
    const categories = await prisma.category.findMany({
      where: { userId: session.user.id },
    });
    
    // Get all expenses in the date range
    const expenses = await prisma.expense.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
        ...(categoryId && { categoryId }),
      },
      include: {
        category: true,
      },
      orderBy: {
        date: 'asc',
      },
    });
    
    // Initialize result array with all months in range
    const monthsInRange = eachMonthOfInterval({
      start: startOfMonth(startDate),
      end: endOfMonth(endDate),
    });
    
    // Initialize trend data structure
    const trendData: TrendData[] = monthsInRange.map(month => {
      const monthKey = format(month, 'yyyy-MM');
      const monthData: TrendData = { date: monthKey };
      
      // Initialize all categories with 0
      categories.forEach(category => {
        monthData[category.name] = 0;
      });
      
      // Add uncategorized
      monthData['Uncategorized'] = 0;
      
      return monthData;
    });
    
    // Process expenses
    expenses.forEach(expense => {
      const monthKey = format(expense.date, 'yyyy-MM');
      const monthData = trendData.find(d => d.date === monthKey);
      
      if (monthData) {
        const categoryName = expense.category?.name || 'Uncategorized';
        monthData[categoryName] = (monthData[categoryName] as number) + expense.amount;
      }
    });
    
    // Calculate totals for each category
    const categoryTotals = categories.map(category => ({
      id: category.id,
      name: category.name,
      color: category.color,
      total: trendData.reduce((sum, month) => sum + (month[category.name] as number), 0),
    }));
    
    // Sort categories by total (descending)
    categoryTotals.sort((a, b) => b.total - a.total);
    
    // Prepare response
    const response = {
      period: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd'),
        months,
      },
      categories: categoryTotals,
      data: trendData,
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error fetching spending trends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spending trends' },
      { status: 500 }
    );
  }
}
