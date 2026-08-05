import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEMO_EXPENSES = [
  { id: 'demo-1', amount: 2500, description: 'Groceries', category: 'Food', date: '2025-05-01', createdAt: new Date().toISOString() },
  { id: 'demo-2', amount: 800, description: 'Electricity bill', category: 'Utilities', date: '2025-05-03', createdAt: new Date().toISOString() },
  { id: 'demo-3', amount: 1200, description: 'Dinner out', category: 'Food', date: '2025-05-05', createdAt: new Date().toISOString() },
  { id: 'demo-4', amount: 500, description: 'Bus pass', category: 'Transport', date: '2025-05-07', createdAt: new Date().toISOString() },
]

async function getSessionUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.upsert({
    where: { email: session.user.email },
    update: {},
    create: { email: session.user.email, name: session.user.name ?? '' },
  })
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json(DEMO_EXPENSES)

  const expenses = await prisma.expense.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(expenses)
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to save your data' }, { status: 401 })

  const { amount, description, category, date, budgetId, budgetName } = await request.json()
  if (!amount || !category) {
    return NextResponse.json({ error: 'Amount and category are required' }, { status: 400 })
  }

  const expense = await prisma.expense.create({
    data: {
      amount: parseFloat(amount),
      description: description || '',
      category,
      date: date || new Date().toISOString().split('T')[0],
      budgetId: budgetId || null,
      budgetName: budgetName || null,
      userId: user.id,
    },
  })

  if (budgetId) {
    await prisma.budget.updateMany({
      where: { id: budgetId, userId: user.id },
      data: { spent: { increment: parseFloat(amount) } },
    })
  }

  return NextResponse.json(expense, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to save your data' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const expense = await prisma.expense.findFirst({ where: { id, userId: user.id } })
  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 })

  await prisma.expense.delete({ where: { id } })

  if (expense.budgetId) {
    await prisma.budget.updateMany({
      where: { id: expense.budgetId, userId: user.id },
      data: { spent: { decrement: expense.amount } },
    })
  }

  return NextResponse.json(expense)
}
