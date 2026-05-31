import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../lib/auth'
import { prisma } from '../../lib/prisma'

const DEMO_BUDGETS = [
  { id: 'demo-b1', name: 'Food & Dining', amount: 5000, spent: 3700, period: 'monthly', category: 'Food', createdAt: new Date().toISOString() },
  { id: 'demo-b2', name: 'Transport', amount: 2000, spent: 500, period: 'monthly', category: 'Transport', createdAt: new Date().toISOString() },
  { id: 'demo-b3', name: 'Utilities', amount: 3000, spent: 800, period: 'monthly', category: 'Utilities', createdAt: new Date().toISOString() },
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.email) {
    if (req.method === 'GET') return res.status(200).json(DEMO_BUDGETS)
    return res.status(401).json({ error: 'Please sign in to save your data' })
  }

  const user = await prisma.user.upsert({
    where: { email: session.user.email },
    update: {},
    create: { email: session.user.email, name: session.user.name ?? '' },
  })

  if (req.method === 'GET') {
    const budgets = await prisma.budget.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(budgets)
  }

  if (req.method === 'POST') {
    const { name, amount, period, category } = req.body
    if (!name || !amount) return res.status(400).json({ error: 'Name and amount are required' })

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
    return res.status(201).json(budget)
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'ID required' })

    const budget = await prisma.budget.findFirst({ where: { id, userId: user.id } })
    if (!budget) return res.status(404).json({ error: 'Budget not found' })

    await prisma.budget.delete({ where: { id } })
    return res.status(200).json(budget)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
