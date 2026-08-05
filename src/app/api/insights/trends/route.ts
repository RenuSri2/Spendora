export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subMonths, format, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'

type TrendData = {
  date: string // YYYY-MM
  [category: string]: number | string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const months = parseInt(request.nextUrl.searchParams.get('months') || '6')

    const endDate = new Date()
    const startDate = subMonths(endDate, months - 1)
    const startStr = format(startOfMonth(startDate), 'yyyy-MM-dd')
    const endStr = format(endDate, 'yyyy-MM-dd')

    // No separate Category model exists — categories are plain strings on Expense.
    const expenses = await prisma.expense.findMany({
      where: { userId: session.user.id, date: { gte: startStr, lte: endStr } },
      orderBy: { date: 'asc' },
    })

    const categoryNames: string[] = Array.from(
      new Set(expenses.map((e: { category: string | null }) => e.category || 'Uncategorized'))
    )

    const monthsInRange = eachMonthOfInterval({
      start: startOfMonth(startDate),
      end: endOfMonth(endDate),
    })

    const trendData: TrendData[] = monthsInRange.map((month) => {
      const monthKey = format(month, 'yyyy-MM')
      const monthData: TrendData = { date: monthKey }
      categoryNames.forEach((name: string) => { monthData[name] = 0 })
      return monthData
    })

    for (const expense of expenses) {
      const monthKey = expense.date.slice(0, 7)
      const monthData = trendData.find((d) => d.date === monthKey)
      if (monthData) {
        const category = expense.category || 'Uncategorized'
        monthData[category] = (monthData[category] as number) + expense.amount
      }
    }

    const categoryTotals = categoryNames
      .map((name: string) => ({
        name,
        total: trendData.reduce((sum, month) => sum + (month[name] as number), 0),
      }))
      .sort((a, b) => b.total - a.total)

    return NextResponse.json({
      period: { start: startStr, end: endStr, months },
      categories: categoryTotals,
      data: trendData,
    })
  } catch (error) {
    console.error('Error fetching spending trends:', error)
    return NextResponse.json({ error: 'Failed to fetch spending trends' }, { status: 500 })
  }
}
