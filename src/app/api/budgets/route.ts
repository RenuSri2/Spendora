import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DEMO_BUDGETS = [
  { id: 'demo-b1', name: 'Food & Dining', amount: 5000, spent: 3700, period: 'monthly', category: 'Food', createdAt: new Date().toISOString() },
  { id: 'demo-b2', name: 'Transport', amount: 2000, spent: 500, period: 'monthly', category: 'Transport', createdAt: new Date().toISOString() },
  { id: 'demo-b3', name: 'Utilities', amount: 3000, spent: 800, period: 'monthly', category: 'Utilities', createdAt: new Date().toISOString() },
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
  if (!user) return NextResponse.json(DEMO_BUDGETS)

  const budgets = await prisma.budget.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(budgets)
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to save your data' }, { status: 401 })

  const { name, amount, period, category } = await request.json()
  if (!name || !amount) {
    return NextResponse.json({ error: 'Name and amount are required' }, { status: 400 })
  }

  const budget = await prisma.budget.create({
    data: {
      name,
      amount: parseFloat(amount),
      period: period || 'monthly',
      category: category || null,
      spent: 0,
      userId: user.id,
    },
  })
  return NextResponse.json(budget, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to save your data' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const budget = await prisma.budget.findFirst({ where: { id, userId: user.id } })
  if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })

  await prisma.budget.delete({ where: { id } })
  return NextResponse.json(budget)
}
