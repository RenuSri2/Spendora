import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../lib/auth'
import { prisma } from '../../lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)

  if (!session?.user?.email) {
    if (req.method === 'GET') return res.status(200).json([])
    return res.status(401).json({ error: 'Please sign in to save your data' })
  }

  const user = await prisma.user.upsert({
    where: { email: session.user.email },
    update: {},
    create: { email: session.user.email, name: session.user.name ?? '' },
  })

  if (req.method === 'GET') {
    const receipts = await prisma.receipt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(receipts)
  }

  if (req.method === 'POST') {
    const { fileName, filePath, fileType, extractedText, vendor, totalAmount, date } = req.body
    const receipt = await prisma.receipt.create({
      data: {
        fileName: fileName || 'receipt',
        filePath: filePath || null,
        fileType: fileType || null,
        extractedText: extractedText || null,
        vendor: vendor || null,
        totalAmount: totalAmount ? parseFloat(totalAmount) : null,
        date: date || null,
        userId: user.id,
      },
    })
    return res.status(201).json(receipt)
  }

  if (req.method === 'PATCH') {
    const { id } = req.query
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'ID required' })

    const receipt = await prisma.receipt.updateMany({
      where: { id, userId: user.id },
      data: req.body,
    })
    return res.status(200).json(receipt)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
