export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

// This API route is now simplified since we use client-side Tesseract.js OCR
// The main processing happens in the browser using the visionReceiptReader

export async function POST(request: NextRequest) {
  try {
    // This endpoint is now mainly for logging and potential server-side fallbacks
    const { fileName, ocrText } = await request.json()
    
    console.log('📊 Free OCR processing request:', {
      fileName: fileName || 'unknown',
      textLength: ocrText?.length || 0
    })
    
    // Since we're using client-side OCR, this endpoint primarily serves as a logging point
    // and could be used for future server-side optimizations or fallbacks
    
    return NextResponse.json({
      success: true,
      message: 'OCR processing completed on client-side',
      processingMode: 'client-side-tesseract',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('OCR logging error:', error)
    return NextResponse.json({ 
      error: 'Logging failed',
      message: 'OCR processing continues on client-side'
    }, { status: 200 }) // Still return 200 since client-side processing should continue
  }
}
