export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { generateFinancialInsights } from '@/lib/services/insightService'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const period = parseInt(request.nextUrl.searchParams.get('period') || '3')
    const insights = await generateFinancialInsights(session.user.id, period)

    return NextResponse.json({
      opportunities: insights.savingOpportunities,
      period,
    })
  } catch (error) {
    console.error('Error finding saving opportunities:', error)
    return NextResponse.json({ error: 'Failed to find saving opportunities' }, { status: 500 })
  }
}
