import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
  if (!user) return NextResponse.json([])

  const receipts = await prisma.receipt.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(receipts)
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to save your data' }, { status: 401 })

  const { fileName, filePath, fileType, extractedText, vendor, totalAmount, date } = await request.json()

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
  return NextResponse.json(receipt, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to save your data' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const body = await request.json()
  const receipt = await prisma.receipt.updateMany({
    where: { id, userId: user.id },
    data: body,
  })
  return NextResponse.json(receipt)
}
