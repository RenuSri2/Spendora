import { NextRequest, NextResponse } from 'next/server'
import { flashAIIntegration } from '../../../lib/flashAIIntegration'

// Real Flash.co-style AI-powered product analysis engine
async function analyzeProductWithAI(productUrl: string) {
  console.log(`🔥 Flash AI Analysis starting for: ${productUrl}`)
  
  try {
    // Use real Flash.co-style integration with actual scraping
    const analysis = await flashAIIntegration.analyzeProduct(productUrl)
    
    console.log(`✅ Flash AI Analysis completed:`, {
      product: analysis.productName,
      score: analysis.score,
      platforms: analysis.priceComparison.length,
      confidence: analysis.confidence,
      lowestPrice: analysis.marketIntelligence.lowestPrice?.price,
      highestPrice: analysis.marketIntelligence.highestPrice?.price
    })
    
    return analysis
    
  } catch (error) {
    console.error('❌ Flash AI Analysis error:', error)
    throw error // Re-throw to handle in main function
  }
}


// Main API endpoint - Flash.co-style product analysis
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { productUrl } = await request.json()
    
    if (!productUrl) {
      return NextResponse.json({ error: 'Product URL is required' }, { status: 400 })
    }
    
    // Validate URL format
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
    
    console.log(`🔍 Flash AI Analysis requested for: ${productUrl}`)
    
    try {
      // Perform real Flash.co-style analysis with scraping
      const analysis = await analyzeProductWithAI(productUrl)
      
      const processingTime = Date.now() - startTime
      console.log(`✅ Analysis completed successfully in ${processingTime}ms`)
      
      return NextResponse.json({
        success: true,
        analysis,
        analysisTime: new Date().toISOString(),
        processingTime,
        message: `Product analyzed across ${analysis.priceComparison.length} platforms with ${analysis.confidence}% confidence`
      })
      
    } catch (analysisError) {
      console.error('❌ Analysis failed:', analysisError)
      
      // Return more specific error messages
      const errorMessage = analysisError instanceof Error ? analysisError.message : 'Analysis failed'
      
      if (errorMessage.includes('fetch')) {
        return NextResponse.json({
          error: 'Unable to access the product page. Please check if the URL is accessible and try again.',
          details: 'Network or access error'
        }, { status: 502 })
      }
      
      if (errorMessage.includes('timeout')) {
        return NextResponse.json({
          error: 'Analysis timed out. The website might be slow to respond. Please try again.',
          details: 'Request timeout'
        }, { status: 408 })
      }
      
      return NextResponse.json({
        error: 'Failed to analyze the product. This could be due to website restrictions or unsupported format.',
        details: errorMessage,
        suggestion: 'Try with a different product URL from Amazon, Flipkart, or other major e-commerce sites.'
      }, { status: 422 })
    }
    
  } catch (error) {
    console.error('❌ API Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint for URL prefix method (spendora.ai/[encoded-url])
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const encodedUrl = searchParams.get('url')
    
    if (!encodedUrl) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }
    
    const productUrl = decodeURIComponent(encodedUrl)
    
    // Validate decoded URL
    try {
      new URL(productUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid decoded URL format' }, { status: 400 })
    }
    
    console.log(`🔍 Flash AI Analysis (URL prefix) for: ${productUrl}`)
    
    try {
      // Perform real Flash.co-style analysis
      const analysis = await analyzeProductWithAI(productUrl)
      
      const processingTime = Date.now() - startTime
      
      return NextResponse.json({
        success: true,
        analysis,
        analysisTime: new Date().toISOString(),
        processingTime,
        method: 'URL prefix',
        message: `Product analyzed across ${analysis.priceComparison.length} platforms`
      })
      
    } catch (analysisError) {
      console.error('❌ Analysis failed (URL prefix):', analysisError)
      
      return NextResponse.json({
        error: 'Failed to analyze product via URL prefix method',
        details: analysisError instanceof Error ? analysisError.message : 'Unknown error'
      }, { status: 422 })
    }
    
  } catch (error) {
    console.error('❌ URL prefix API error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
