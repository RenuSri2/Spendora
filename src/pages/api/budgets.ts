import type { NextApiRequest, NextApiResponse } from 'next'
import { getBudgets, addBudget, deleteBudget } from '../../lib/database'
// Temporary: Using a default user ID for development without authentication
const DEFAULT_USER_ID = 'default-user'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // For development, we'll use a default user ID
  const userId = DEFAULT_USER_ID

  if (req.method === 'GET') {
    try {
      const budgets = getBudgets(userId)
      res.status(200).json(budgets)
    } catch (error) {
      console.error('Error fetching budgets:', error)
      res.status(500).json({ error: 'Failed to fetch budgets' })
    }
  } else if (req.method === 'POST') {
    try {
      const budget = req.body
      if (!budget.name || !budget.amount) {
        return res.status(400).json({ error: 'Name and amount are required' })
      }

      const newBudget = {
        ...budget,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        userId,
      }

      const savedBudget = addBudget(userId, newBudget)
      res.status(201).json(savedBudget)
    } catch (error) {
      console.error('Error creating budget:', error)
      res.status(500).json({ error: 'Failed to create budget' })
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Budget ID is required' })
      }

      const deletedBudget = deleteBudget(userId, id)
      res.status(200).json(deletedBudget)
    } catch (error) {
      console.error('Error deleting budget:', error)
      res.status(500).json({ error: 'Failed to delete budget' })
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}
