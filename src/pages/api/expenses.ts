import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../lib/auth'
import { prisma } from '../../lib/prisma'

const DEMO_EXPENSES = [
  { id: 'demo-1', amount: 2500, description: 'Groceries', category: 'Food', date: '2025-05-01', createdAt: new Date().toISOString() },
  { id: 'demo-2', amount: 800, description: 'Electricity bill', category: 'Utilities', date: '2025-05-03', createdAt: new Date().toISOString() },
  { id: 'demo-3', amount: 1200, description: 'Dinner out', category: 'Food', date: '2025-05-05', createdAt: new Date().toISOString() },
  { id: 'demo-4', amount: 500, description: 'Bus pass', category: 'Transport', date: '2025-05-07', createdAt: new Date().toISOString() },
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.email) {
    if (req.method === 'GET') return res.status(200).json(DEMO_EXPENSES)
    return res.status(401).json({ error: 'Please sign in to save your data' })
  }

  const user = await prisma.user.upsert({
    where: { email: session.user.email },
    update: {},
    create: { email: session.user.email, name: session.user.name ?? '' },
  })

  if (req.method === 'GET') {
    const expenses = await prisma.expense.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(expenses)
  }

  if (req.method === 'POST') {
    const { amount, description, category, date, budgetId, budgetName } = req.body
    if (!amount || !category) return res.status(400).json({ error: 'Amount and category are required' })

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

    return res.status(201).json(expense)
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'ID required' })

    const expense = await prisma.expense.findFirst({ where: { id, userId: user.id } })
    if (!expense) return res.status(404).json({ error: 'Expense not found' })

    await prisma.expense.delete({ where: { id } })

    if (expense.budgetId) {
      await prisma.budget.updateMany({
        where: { id: expense.budgetId, userId: user.id },
        data: { spent: { decrement: expense.amount } },
      })
    }

    return res.status(200).json(expense)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
