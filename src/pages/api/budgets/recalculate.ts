import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/auth'
import { prisma } from '../../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.email) return res.status(401).json({ error: 'Not authenticated' })

  const user = await prisma.user.findUnique({ where: { email: session.user.email } })
  if (!user) return res.status(404).json({ error: 'User not found' })

  const budgets = await prisma.budget.findMany({ where: { userId: user.id } })
  const expenses = await prisma.expense.findMany({ where: { userId: user.id } })

  for (const budget of budgets) {
    const spent = expenses
      .filter(e => e.budgetId === budget.id)
      .reduce((sum, e) => sum + e.amount, 0)

    await prisma.budget.update({ where: { id: budget.id }, data: { spent } })
  }

  const updated = await prisma.budget.findMany({ where: { userId: user.id } })
  return res.status(200).json(updated)
}
