import { prisma } from '@/lib/prisma'
import { subMonths, startOfMonth, format } from 'date-fns'

// NOTE: rewritten against the actual schema — Expense.category and
// Budget.category are plain strings (no Category relation/model exists),
// and Expense.date is stored as a "YYYY-MM-DD" string, not a DateTime.
// ISO-format date strings still compare correctly with gte/lte lexically,
// so string range queries below are safe.

interface SpendingByCategory {
  category: string
  amount: number
  percentage: number
}

interface MonthlySpending {
  month: string // YYYY-MM
  amount: number
  changeFromPrevious: number // percentage
}

interface SpendingInsight {
  totalSpent: number
  averageMonthlySpending: number
  topCategories: SpendingByCategory[]
  monthlyTrends: MonthlySpending[]
  unusualSpending: {
    category: string
    amount: number
    average: number
    percentageIncrease: number
  }[]
  savingOpportunities: {
    category: string
    currentSpend: number
    suggestedBudget: number
    potentialSavings: number
  }[]
}

type ExpenseRow = { amount: number; category: string; date: string }

function dateRangeStrings(period: number) {
  const end = new Date()
  const start = subMonths(end, period - 1)
  return {
    startStr: format(startOfMonth(start), 'yyyy-MM-dd'),
    endStr: format(end, 'yyyy-MM-dd'),
    start,
    end,
  }
}

export async function generateFinancialInsights(
  userId: string,
  period: number = 6
): Promise<SpendingInsight> {
  const { startStr, endStr, start, end } = dateRangeStrings(period)

  const expenses = await prisma.expense.findMany({
    where: { userId, date: { gte: startStr, lte: endStr } },
  })

  if (expenses.length === 0) {
    return {
      totalSpent: 0,
      averageMonthlySpending: 0,
      topCategories: [],
      monthlyTrends: [],
      unusualSpending: [],
      savingOpportunities: [],
    }
  }

  const totalSpent = expenses.reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)
  const topCategories = calculateSpendingByCategory(expenses, totalSpent)
  const monthlyTrends = calculateMonthlyTrends(expenses, start, end)
  const unusualSpending = await detectUnusualSpending(userId, expenses, startStr)
  const savingOpportunities = await findSavingOpportunities(userId, expenses)

  return {
    totalSpent,
    averageMonthlySpending: totalSpent / period,
    topCategories: topCategories.slice(0, 5),
    monthlyTrends,
    unusualSpending,
    savingOpportunities,
  }
}

function calculateSpendingByCategory(
  expenses: ExpenseRow[],
  totalSpent: number
): SpendingByCategory[] {
  const categoryMap = new Map<string, number>()

  for (const expense of expenses) {
    const category = expense.category || 'Uncategorized'
    categoryMap.set(category, (categoryMap.get(category) || 0) + expense.amount)
  }

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

function calculateMonthlyTrends(
  expenses: ExpenseRow[],
  startDate: Date,
  endDate: Date
): MonthlySpending[] {
  const monthlySpending = new Map<string, number>()

  let cursor = startOfMonth(startDate)
  while (cursor <= endDate) {
    monthlySpending.set(format(cursor, 'yyyy-MM'), 0)
    cursor = startOfMonth(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
  }

  for (const expense of expenses) {
    const monthKey = expense.date.slice(0, 7) // "YYYY-MM" prefix of "YYYY-MM-DD"
    monthlySpending.set(monthKey, (monthlySpending.get(monthKey) || 0) + expense.amount)
  }

  const sortedMonths = Array.from(monthlySpending.entries()).sort(([a], [b]) => a.localeCompare(b))

  return sortedMonths.map(([month, amount], i) => {
    let changeFromPrevious = 0
    if (i > 0) {
      const prevAmount = sortedMonths[i - 1][1]
      changeFromPrevious = prevAmount === 0 ? 100 : ((amount - prevAmount) / prevAmount) * 100
    }
    return { month, amount, changeFromPrevious }
  })
}

async function detectUnusualSpending(
  userId: string,
  currentExpenses: ExpenseRow[],
  currentPeriodStartStr: string
): Promise<SpendingInsight['unusualSpending']> {
  const previousEnd = currentPeriodStartStr
  const previousStart = format(subMonths(new Date(currentPeriodStartStr), 3), 'yyyy-MM-dd')

  const previousExpenses = await prisma.expense.findMany({
    where: { userId, date: { gte: previousStart, lt: previousEnd } },
  })

  const previousSpending = new Map<string, { sum: number; count: number }>()
  for (const expense of previousExpenses) {
    const category = expense.category || 'Uncategorized'
    const cur = previousSpending.get(category) || { sum: 0, count: 0 }
    previousSpending.set(category, { sum: cur.sum + expense.amount, count: cur.count + 1 })
  }

  const currentSpending = new Map<string, number>()
  for (const expense of currentExpenses) {
    const category = expense.category || 'Uncategorized'
    currentSpending.set(category, (currentSpending.get(category) || 0) + expense.amount)
  }

  const unusualSpending: SpendingInsight['unusualSpending'] = []
  for (const [category, amount] of currentSpending.entries()) {
    const previous = previousSpending.get(category)
    if (!previous || previous.count === 0) continue

    const previousAvg = previous.sum / previous.count
    const percentageIncrease = ((amount - previousAvg) / previousAvg) * 100

    if (percentageIncrease >= 50) {
      unusualSpending.push({ category, amount, average: previousAvg, percentageIncrease })
    }
  }

  return unusualSpending.sort((a, b) => b.percentageIncrease - a.percentageIncrease)
}

async function findSavingOpportunities(
  userId: string,
  expenses: ExpenseRow[]
): Promise<SpendingInsight['savingOpportunities']> {
  if (expenses.length === 0) return []

  const budgets = await prisma.budget.findMany({ where: { userId } })

  const spendingByCategory = new Map<string, number>()
  for (const expense of expenses) {
    const category = expense.category || 'Uncategorized'
    spendingByCategory.set(category, (spendingByCategory.get(category) || 0) + expense.amount)
  }

  const opportunities: SpendingInsight['savingOpportunities'] = []

  // 1. High spending with no budget at all
  for (const [category, amount] of spendingByCategory.entries()) {
    const hasBudget = budgets.some((b: { category: string | null }) => b.category === category)
    if (!hasBudget && amount > 1000) {
      opportunities.push({
        category,
        currentSpend: amount,
        suggestedBudget: amount * 0.8,
        potentialSavings: amount * 0.2,
      })
    }
  }

  // 2. Spending that exceeds an existing budget
  for (const budget of budgets) {
    if (!budget.category) continue
    const spend = spendingByCategory.get(budget.category)
    if (!spend || spend <= budget.amount) continue

    opportunities.push({
      category: budget.category,
      currentSpend: spend,
      suggestedBudget: budget.amount,
      potentialSavings: spend - budget.amount,
    })
  }

  return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings)
}

export default { generateFinancialInsights }
