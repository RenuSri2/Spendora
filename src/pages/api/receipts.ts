import type { NextApiRequest, NextApiResponse } from 'next'
import { getReceipts, addReceipt } from '../../lib/database'
// Temporary: Using a default user ID for development without authentication
const DEFAULT_USER_ID = 'default-user'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // For development, we'll use a default user ID
  const userId = DEFAULT_USER_ID

  if (req.method === 'GET') {
    try {
      const receipts = getReceipts(userId)
      res.status(200).json(receipts)
    } catch (error) {
      console.error('Error fetching receipts:', error)
      res.status(500).json({ error: 'Failed to fetch receipts' })
    }
  } else if (req.method === 'POST') {
    try {
      const receipt = req.body
      if (!receipt.imageUrl) {
        return res.status(400).json({ error: 'Image URL is required' })
      }

      const newReceipt = {
        ...receipt,
        id: Date.now().toString(),
        uploadedAt: new Date().toISOString(),
        isProcessed: false,
        userId,
      }

      const savedReceipt = addReceipt(userId, newReceipt)
      res.status(201).json(savedReceipt)
    } catch (error) {
      console.error('Error saving receipt:', error)
      res.status(500).json({ error: 'Failed to save receipt' })
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}
