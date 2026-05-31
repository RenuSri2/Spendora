export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { flashAIIntegration } from '../../../lib/flashAIIntegration'

async function analyzeProductWithAI(productUrl: string) {
  console.log(`🔥 Flash AI Analysis starting for: ${productUrl}`)
  
  try {
    const analysis = await flashAIIntegration.analyzeProduct(productUrl)
    console.log(`✅ Flash AI Analysis completed:`, {
      product: analysis.productName,
      score: analysis.score,
      platforms: analysis.priceComparison.length,
      confidence: analysis.confidence,
    })
    return analysis
  } catch (error) {
    console.error('❌ Flash AI Analysis error:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { productUrl } = await request.json()
    
    if (!productUrl) {
      return NextResponse.json({ error: 'Product URL is required' }, { status: 400 })
    }
    
    try {
      const url = new URL(productUrl)
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch {
      return NextResponse.json({ 
        error: 'Invalid URL format. Please provide a valid product URL (e.g., https://amazon.in/...)' 
      }, { status: 400 })
    }
    
    try {
      const analysis = await analyzeProductWithAI(productUrl)
      const processingTime = Date.now() - startTime
      
      return NextResponse.json({
        success: true,
        analysis,
        analysisTime: new Date().toISOString(),
        processingTime,
        message: `Product analyzed across ${analysis.priceComparison.length} platforms with ${analysis.confidence}% confidence`
      })
    } catch (analysisError) {
      const errorMessage = analysisError instanceof Error ? analysisError.message : 'Analysis failed'
      return NextResponse.json({
        error: 'Failed to analyze the product.',
        details: errorMessage,
      }, { status: 422 })
    }
    
  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const encodedUrl = searchParams.get('url')
    
    if (!encodedUrl) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }
    
    const productUrl = decodeURIComponent(encodedUrl)
    
    try {
      new URL(productUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid decoded URL format' }, { status: 400 })
    }
    
    try {
      const analysis = await analyzeProductWithAI(productUrl)
      const processingTime = Date.now() - startTime
      
      return NextResponse.json({
        success: true,
        analysis,
        analysisTime: new Date().toISOString(),
        processingTime,
        method: 'URL prefix',
      })
    } catch (analysisError) {
      return NextResponse.json({
        error: 'Failed to analyze product',
        details: analysisError instanceof Error ? analysisError.message : 'Unknown error'
      }, { status: 422 })
    }
    
  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
