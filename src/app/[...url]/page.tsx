"use client"

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react' // ✅ Added useCallback
import { SparklesIcon } from '@heroicons/react/24/outline'

interface AnalysisResult {
  productName: string
  score: number
  recommendation: string
  priceComparison: any[]
  insights: {
    pros: string[]
    cons: string[]
    keyFeatures: string[]
  }
  marketIntelligence: any
  riskAssessment: any
  reviewAnalysis: any
  confidence: number
  processingTime: number
}

export default function FlashStyleAnalysisPage() {
  const params = useParams()
  const router = useRouter()
  const [isAnalyzing, setIsAnalyzing] = useState(true)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')

  // ✅ FIXED: Move function declaration BEFORE useEffect and wrap in useCallback
  const analyzeFlashStyleUrl = useCallback(async () => {
    try {
      // Reconstruct the original URL from the path
      const urlParts = Array.isArray(params?.url) ? params.url : (params?.url ? [params.url] : [])
      if (urlParts.length === 0) {
        throw new Error('No URL provided for analysis')
      }
      let originalUrl = urlParts.join('/')

      // Handle Flash.co-style URL format
      if (!originalUrl.startsWith('http')) {
        originalUrl = 'https://' + originalUrl
      }

      console.log('🔥 Flash.co-style analysis for:', originalUrl)

      // Call the AI analysis API
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productUrl: originalUrl })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setAnalysis(data.analysis)
      } else {
        setError(data.error || 'Failed to analyze product')
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setError('Something went wrong. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }, [params?.url]) // ✅ Add params?.url as dependency

  // ✅ FIXED: Now useEffect can safely reference the function
  useEffect(() => {
    if (params?.url) {
      analyzeFlashStyleUrl()
    }
  }, [params?.url, analyzeFlashStyleUrl]) // ✅ Both dependencies included

  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <SparklesIcon className="w-8 h-8 text-white" />
          </div>
          
          <h1 className="text-2xl font-bold mb-4">Flash.co-style Analysis</h1>
          
          <div className="flex items-center justify-center space-x-2 text-cyan-400 mb-4">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-cyan-400 border-t-transparent"></div>
            <span className="text-lg">Analyzing with AI...</span>
          </div>
          
          <p className="text-gray-400">
            🔍 Extracting product intelligence<br/>
            💰 Finding best prices across platforms<br/>
            🧠 Generating smart recommendations
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
            <span className="text-2xl">❌</span>
          </div>
          
          <h1 className="text-2xl font-bold mb-4">Analysis Failed</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          
          <button
            onClick={() => router.push('/ai-assistant')}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">No analysis data available</h1>
          <button
            onClick={() => router.push('/ai-assistant')}
            className="mt-4 bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Navigation */}
      <nav className="px-6 py-4 border-b border-gray-800">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">Spendora AI</span>
          </div>
          
          <button 
            onClick={() => router.push('/ai-assistant')}
            className="text-gray-300 hover:text-white transition-colors"
          >
            Analyze Another Product
          </button>
        </div>
      </nav>

      {/* Analysis Results */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            {analysis.productName}
          </h1>
          
          {/* AI Score */}
          <div className="inline-flex items-center space-x-4 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl px-8 py-4">
            <div className="text-center">
              <div className={`text-4xl font-bold ${
                analysis.score >= 80 ? 'text-green-400' :
                analysis.score >= 60 ? 'text-yellow-400' : 
                'text-red-400'
              }`}>
                {analysis.score}
              </div>
              <div className="text-sm text-gray-400">AI Score</div>
            </div>
            
            <div className="h-12 w-px bg-gray-600"></div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">{analysis.confidence}%</div>
              <div className="text-sm text-gray-400">Confidence</div>
            </div>
            
            <div className="h-12 w-px bg-gray-600"></div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{analysis.processingTime}ms</div>
              <div className="text-sm text-gray-400">Analysis Time</div>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className="mb-8 p-6 bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-sm border border-gray-600 rounded-2xl">
          <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
            <SparklesIcon className="w-5 h-5 text-cyan-400" />
            <span>AI Recommendation</span>
          </h2>
          <p className="text-gray-200 text-lg">{analysis.recommendation}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Price Comparisons */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <span className="text-2xl">💰</span>
              <span>Price Comparison ({analysis.priceComparison?.length || 0} platforms)</span>
            </h2>
            
            <div className="space-y-4">
              {analysis.priceComparison?.map((comparison: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-xl">
                  <div>
                    <div className="font-semibold">{comparison.platform}</div>
                    <div className="text-sm text-gray-400">
                      {comparison.availability} • {comparison.deliveryTime}
                    </div>
                    {comparison.rating > 0 && (
                      <div className="text-sm text-yellow-400">
                        ⭐ {comparison.rating} ({comparison.reviewCount} reviews)
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">
                      ₹{comparison.price?.toLocaleString()}
                    </div>
                    <a 
                      href={comparison.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      View on {comparison.platform} →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Insights */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <span className="text-2xl">💡</span>
              <span>AI Insights</span>
            </h2>
            
            <div className="space-y-6">
              {/* Pros */}
              {analysis.insights?.pros?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-green-400 mb-2">Pros</h3>
                  <ul className="space-y-1">
                    {analysis.insights.pros.map((pro: string, index: number) => (
                      <li key={index} className="text-sm text-gray-300 flex items-start space-x-2">
                        <span className="text-green-400 mt-1">+</span>
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Cons */}
              {analysis.insights?.cons?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-400 mb-2">Cons</h3>
                  <ul className="space-y-1">
                    {analysis.insights.cons.map((con: string, index: number) => (
                      <li key={index} className="text-sm text-gray-300 flex items-start space-x-2">
                        <span className="text-red-400 mt-1">-</span>
                        <span>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Key Features */}
              {analysis.insights?.keyFeatures?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-blue-400 mb-2">Key Features</h3>
                  <ul className="space-y-1">
                    {analysis.insights.keyFeatures.map((feature: string, index: number) => (
                      <li key={index} className="text-sm text-gray-300 flex items-start space-x-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Market Intelligence */}
        {analysis.marketIntelligence && (
          <div className="mt-8 bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
              <span className="text-2xl">📊</span>
              <span>Market Intelligence</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">
                  {analysis.marketIntelligence.priceRange}
                </div>
                <div className="text-sm text-gray-400">Price Range</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-semibold text-green-400 capitalize">
                  {analysis.marketIntelligence.competitiveness}
                </div>
                <div className="text-sm text-gray-400">Market Competitiveness</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-semibold text-yellow-400 capitalize">
                  {analysis.marketIntelligence.priceVolatility}
                </div>
                <div className="text-sm text-gray-400">Price Volatility</div>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-gray-700/50 rounded-xl">
              <p className="text-gray-200">{analysis.marketIntelligence.bestTimeToBuy}</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <footer className="text-center py-8 px-6 border-t border-gray-800">
        <p className="text-gray-400">
          Analysis powered by Spendora AI • 
          <span className="text-cyan-400 ml-2">Making shopping smarter</span>
        </p>
      </footer>
    </div>
  )
}
