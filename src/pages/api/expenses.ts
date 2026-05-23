import type { NextApiRequest, NextApiResponse } from 'next'
import { getExpenses, addExpense, deleteExpense } from '../../lib/database'
// Temporary: Using a default user ID for development without authentication
const DEFAULT_USER_ID = 'default-user'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // For development, we'll use a default user ID
  const userId = DEFAULT_USER_ID

  if (req.method === 'GET') {
    try {
      const expenses = getExpenses(userId)
      res.status(200).json(expenses)
    } catch (error) {
      console.error('Error fetching expenses:', error)
      res.status(500).json({ error: 'Failed to fetch expenses' })
    }
  } else if (req.method === 'POST') {
    try {
      const expense = req.body
      if (!expense.amount || !expense.category) {
        return res.status(400).json({ error: 'Amount and category are required' })
      }

      const newExpense = {
        ...expense,
        id: Date.now().toString(),
        date: expense.date || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        userId,
      }

      const savedExpense = addExpense(userId, newExpense)
      res.status(201).json(savedExpense)
    } catch (error) {
      console.error('Error creating expense:', error)
      res.status(500).json({ error: 'Failed to create expense' })
    }
  } else if (req.method === 'DELETE') {
    try {
      const { id } = req.query
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Expense ID is required' })
      }

      const deletedExpense = deleteExpense(userId, id)
      res.status(200).json(deletedExpense)
    } catch (error) {
      console.error('Error deleting expense:', error)
      res.status(500).json({ error: 'Failed to delete expense' })
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}
