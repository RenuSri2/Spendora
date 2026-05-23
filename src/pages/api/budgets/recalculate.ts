import type { NextApiRequest, NextApiResponse } from 'next'
import { recalculateBudgetSpending } from '../../../lib/database'
// Temporary: Using a default user ID for development without authentication
const DEFAULT_USER_ID = 'default-user'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // For development, we'll use a default user ID
  const userId = DEFAULT_USER_ID

  if (req.method === 'POST') {
    try {
      const updatedBudgets = recalculateBudgetSpending(userId)
      res.status(200).json({ 
        message: 'Budget spending recalculated successfully',
        budgets: updatedBudgets 
      })
    } catch (error) {
      console.error('Error recalculating budget spending:', error)
      res.status(500).json({ error: 'Failed to recalculate budget spending' })
    }
  } else {
    res.setHeader('Allow', ['POST'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}
