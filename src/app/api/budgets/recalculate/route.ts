import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const budgets = await prisma.budget.findMany({ where: { userId: user.id } })
  const expenses = await prisma.expense.findMany({ where: { userId: user.id } })

  for (const budget of budgets) {
    const spent = expenses
      .filter((e: { budgetId: string | null }) => e.budgetId === budget.id)
      .reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)

    await prisma.budget.update({ where: { id: budget.id }, data: { spent } })
  }

  const updated = await prisma.budget.findMany({ where: { userId: user.id } })
  return NextResponse.json(updated)
}
