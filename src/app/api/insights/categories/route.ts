export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subMonths, format } from 'date-fns'

// NOTE: there's no separate Category model in the schema — categories are
// plain strings on Expense/Budget — so this groups directly by that string
// instead of querying a model that doesn't exist.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const period = parseInt(request.nextUrl.searchParams.get('period') || '6')
    const startStr = format(subMonths(new Date(), period), 'yyyy-MM-dd')

    const expenses = await prisma.expense.findMany({
      where: { userId: session.user.id, date: { gte: startStr } },
    })

    const totals = new Map<string, { amount: number; count: number }>()
    for (const e of expenses) {
      const category = e.category || 'Uncategorized'
      const cur = totals.get(category) || { amount: 0, count: 0 }
      totals.set(category, { amount: cur.amount + e.amount, count: cur.count + 1 })
    }

    const totalSpent = Array.from(totals.values()).reduce((sum, t) => sum + t.amount, 0)

    const categories = Array.from(totals.entries())
      .map(([name, t]) => ({
        name,
        amount: t.amount,
        count: t.count,
        percentage: totalSpent > 0 ? (t.amount / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    return NextResponse.json({ categories, period })
  } catch (error) {
    console.error('Error fetching category insights:', error)
    return NextResponse.json({ error: 'Failed to fetch category insights' }, { status: 500 })
  }
}
