import { PrismaClient, Prisma } from '@prisma/client';
import { subMonths, startOfMonth, endOfMonth, format, isWithinInterval } from 'date-fns';

const prisma = new PrismaClient();

type TimePeriod = 'week' | 'month' | 'year';
type TimeRange = { start: Date; end: Date };

interface SpendingByCategory {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
}

interface MonthlySpending {
  month: string; // YYYY-MM
  amount: number;
  changeFromPrevious: number; // percentage
}

interface SpendingInsight {
  totalSpent: number;
  averageMonthlySpending: number;
  topCategories: SpendingByCategory[];
  monthlyTrends: MonthlySpending[];
  unusualSpending: {
    category: string;
    amount: number;
    average: number;
    percentageIncrease: number;
  }[];
  savingOpportunities: {
    category: string;
    currentSpend: number;
    suggestedBudget: number;
    potentialSavings: number;
  }[];
}

/**
 * Generates financial insights for a user
 * @param userId - The ID of the user
 * @param period - The time period to analyze (default: 6 months)
 */
export async function generateFinancialInsights(
  userId: string,
  period: number = 6
): Promise<SpendingInsight> {
  const endDate = new Date();
  const startDate = subMonths(endDate, period - 1);
  
  // Get all expenses for the user within the date range
  const expenses = await prisma.expense.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      category: true,
    },
  });

  if (expenses.length === 0) {
    return {
      totalSpent: 0,
      averageMonthlySpending: 0,
      topCategories: [],
      monthlyTrends: [],
      unusualSpending: [],
      savingOpportunities: [],
    };
  }

  // Calculate total spent
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  // Calculate spending by category
  const spendingByCategory = calculateSpendingByCategory(expenses, totalSpent);
  
  // Calculate monthly trends
  const monthlyTrends = calculateMonthlyTrends(expenses, startDate, endDate);
  
  // Identify unusual spending patterns
  const unusualSpending = await detectUnusualSpending(userId, expenses);
  
  // Find saving opportunities
  const savingOpportunities = await findSavingOpportunities(userId, expenses);

  return {
    totalSpent,
    averageMonthlySpending: totalSpent / period,
    topCategories: spendingByCategory.slice(0, 5), // Top 5 categories
    monthlyTrends,
    unusualSpending,
    savingOpportunities,
  };
}

/**
 * Calculates spending by category
 */
function calculateSpendingByCategory(
  expenses: any[],
  totalSpent: number
): SpendingByCategory[] {
  const categoryMap = new Map<string, number>();
  const categoryNames = new Map<string, string>();
  
  // Sum amounts by category
  for (const expense of expenses) {
    const categoryId = expense.categoryId;
    const current = categoryMap.get(categoryId) || 0;
    categoryMap.set(categoryId, current + expense.amount);
    categoryNames.set(categoryId, expense.category.name);
  }
  
  // Convert to array and calculate percentages
  return Array.from(categoryMap.entries()).map(([categoryId, amount]) => ({
    categoryId,
    categoryName: categoryNames.get(categoryId) || 'Uncategorized',
    amount,
    percentage: (amount / totalSpent) * 100,
  })).sort((a, b) => b.amount - a.amount);
}

/**
 * Calculates monthly spending trends
 */
function calculateMonthlyTrends(
  expenses: any[],
  startDate: Date,
  endDate: Date
): MonthlySpending[] {
  const monthlySpending = new Map<string, number>();
  
  // Initialize all months in range with 0
  let current = startOfMonth(startDate);
  while (current <= endDate) {
    const monthKey = format(current, 'yyyy-MM');
    monthlySpending.set(monthKey, 0);
    current = startOfMonth(new Date(current.setMonth(current.getMonth() + 1)));
  }
  
  // Sum expenses by month
  for (const expense of expenses) {
    const monthKey = format(expense.date, 'yyyy-MM');
    const current = monthlySpending.get(monthKey) || 0;
    monthlySpending.set(monthKey, current + expense.amount);
  }
  
  // Convert to array and calculate month-over-month changes
  const result: MonthlySpending[] = [];
  const sortedMonths = Array.from(monthlySpending.entries())
    .sort(([a], [b]) => a.localeCompare(b));
    
  for (let i = 0; i < sortedMonths.length; i++) {
    const [month, amount] = sortedMonths[i];
    let changeFromPrevious = 0;
    
    if (i > 0) {
      const prevAmount = sortedMonths[i - 1][1];
      changeFromPrevious = prevAmount === 0 
        ? 100 
        : ((amount - prevAmount) / prevAmount) * 100;
    }
    
    result.push({
      month,
      amount,
      changeFromPrevious,
    });
  }
  
  return result;
}

/**
 * Detects unusual spending patterns
 */
async function detectUnusualSpending(
  userId: string,
  currentExpenses: any[]
): Promise<SpendingInsight['unusualSpending']> {
  // Get previous period expenses for comparison
  const endDate = new Date();
  const startDate = subMonths(endDate, 3); // Compare with previous 3 months
  
  const previousExpenses = await prisma.expense.findMany({
    where: {
      userId,
      date: {
        gte: subMonths(startDate, 3), // 3 months before our comparison period
        lt: startDate,
      },
    },
    include: {
      category: true,
    },
  });
  
  // Calculate average spending by category for previous period
  const previousSpending = new Map<string, { sum: number; count: number }>();
  
  for (const expense of previousExpenses) {
    const categoryId = expense.categoryId;
    const current = previousSpending.get(categoryId) || { sum: 0, count: 0 };
    previousSpending.set(categoryId, {
      sum: current.sum + expense.amount,
      count: current.count + 1,
    });
  }
  
  // Calculate current spending by category
  const currentSpending = new Map<string, { amount: number; categoryName: string }>();
  
  for (const expense of currentExpenses) {
    const current = currentSpending.get(expense.categoryId) || { amount: 0, categoryName: expense.category.name };
    currentSpending.set(expense.categoryId, {
      amount: current.amount + expense.amount,
      categoryName: expense.category.name,
    });
  }
  
  // Find categories with unusual spending (50%+ increase)
  const unusualSpending: SpendingInsight['unusualSpending'] = [];
  
  for (const [categoryId, current] of currentSpending.entries()) {
    const previous = previousSpending.get(categoryId);
    if (!previous || previous.count === 0) continue;
    
    const previousAvg = previous.sum / previous.count;
    const increase = current.amount - previousAvg;
    const percentageIncrease = (increase / previousAvg) * 100;
    
    if (percentageIncrease >= 50) { // 50% or more increase
      unusualSpending.push({
        category: current.categoryName,
        amount: current.amount,
        average: previousAvg,
        percentageIncrease,
      });
    }
  }
  
  return unusualSpending.sort((a, b) => b.percentageIncrease - a.percentageIncrease);
}

/**
 * Identifies potential saving opportunities
 */
async function findSavingOpportunities(
  userId: string,
  expenses: any[]
): Promise<SpendingInsight['savingOpportunities']> {
  if (expenses.length === 0) return [];
  
  // Get user's budgets for reference
  const budgets = await prisma.budget.findMany({
    where: { userId },
    include: { category: true },
  });
  
  // Calculate spending by category
  const spendingByCategory = new Map<string, { amount: number; name: string }>();
  
  for (const expense of expenses) {
    const current = spendingByCategory.get(expense.categoryId) || { amount: 0, name: expense.category.name };
    spendingByCategory.set(expense.categoryId, {
      amount: current.amount + expense.amount,
      name: expense.category.name,
    });
  }
  
  // Find saving opportunities
  const opportunities: SpendingInsight['savingOpportunities'] = [];
  
  // 1. Check for categories without budgets that have high spending
  for (const [categoryId, spending] of spendingByCategory.entries()) {
    const hasBudget = budgets.some(b => b.categoryId === categoryId);
    
    if (!hasBudget && spending.amount > 1000) { // Arbitrary threshold
      opportunities.push({
        category: spending.name,
        currentSpend: spending.amount,
        suggestedBudget: spending.amount * 0.8, // Suggest 20% reduction
        potentialSavings: spending.amount * 0.2,
      });
    }
  }
  
  // 2. Check for categories where spending exceeds budget
  for (const budget of budgets) {
    if (!budget.categoryId) continue; // Skip uncategorized budgets
    
    const spending = spendingByCategory.get(budget.categoryId);
    if (!spending) continue;
    
    if (spending.amount > budget.amount) {
      const overspend = spending.amount - budget.amount;
      opportunities.push({
        category: budget.category?.name || 'Uncategorized',
        currentSpend: spending.amount,
        suggestedBudget: budget.amount,
        potentialSavings: overspend,
      });
    }
  }
  
  // 3. Identify categories with high month-to-month variance
  if (expenses.length > 10) { // Only if we have enough data
    const monthlySpending = new Map<string, number[]>();
    
    for (const expense of expenses) {
      const monthKey = `${expense.categoryId}-${format(expense.date, 'yyyy-MM')}`;
      const amounts = monthlySpending.get(monthKey) || [];
      amounts.push(expense.amount);
      monthlySpending.set(monthKey, amounts);
    }
    
    // Calculate coefficient of variation for each category
    for (const [categoryId, spending] of spendingByCategory.entries()) {
      const monthlyAmounts = Array.from(monthlySpending.entries())
        .filter(([key]) => key.startsWith(`${categoryId}-`))
        .map(([_, amounts]) => amounts.reduce((a, b) => a + b, 0));
      
      if (monthlyAmounts.length < 3) continue; // Need at least 3 months of data
      
      const mean = monthlyAmounts.reduce((a, b) => a + b, 0) / monthlyAmounts.length;
      const stdDev = Math.sqrt(
        monthlyAmounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / monthlyAmounts.length
      );
      const cv = (stdDev / mean) * 100; // Coefficient of variation
      
      // If spending is highly variable, suggest setting a budget
      if (cv > 50 && spending.amount > 500) {
        const hasOpportunity = opportunities.some(o => 
          o.category.toLowerCase() === spending.name.toLowerCase()
        );
        
        if (!hasOpportunity) {
          opportunities.push({
            category: spending.name,
            currentSpend: spending.amount,
            suggestedBudget: mean * 1.1, // 10% above mean
            potentialSavings: Math.max(0, spending.amount - (mean * 1.1)),
          });
        }
      }
    }
  }
  
  return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
}

export default {
  generateFinancialInsights,
};
