"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  SparklesIcon,
  ArrowLeftIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'

interface AnalysisResponse {
  success: boolean
  partial?: boolean
  notes?: string[]
  meta?: {
    insightSource: 'ai' | 'rules'
    insightModel: string | null
    insightError: string | null
    renderBackend: string | null
  }
  product: {
    name: string
    price: number | null
    currency: string
    image: string | null
    platform: string
    url: string
    dataSource: string | null
  }
  priceHistory: Array<{ date: string; price: number }>
  comparison: Array<{
    platform: string
    label?: string
    source?: 'scraped' | 'google-shopping'
    matched: boolean
    name: string | null
    price: number | null
    url: string | null
    confidence: number | null
    reason?: string
  }>
  valueScore: {
    score: number
    label: string
    basis: string[]
  }
  dataConfidence: {
    level: 'high' | 'medium' | 'low'
    reasons: string[]
  }
  insight: {
    summary: string
    pros: string[]
    cons: string[]
    whoItsFor: string
    recommendation: string
  } | null
}

export default function AnalysisPage() {
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let parsed: AnalysisResponse | null = null
    try {
      const stored = localStorage.getItem('aiAnalysisResult')
      parsed = stored ? JSON.parse(stored) : null
    } catch {
      parsed = null
    }
    // Older saved results (or corrupted storage) may be missing fields.
    if (!parsed?.product || !Array.isArray(parsed.comparison)) {
      router.push('/ai-assistant')
      return
    }
    setAnalysis(parsed)
    setLoading(false)
  }, [router])

  if (loading || !analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-cyan-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-white">Loading analysis...</p>
        </div>
      </div>
    )
  }

  const { product, comparison, valueScore, dataConfidence, insight } = analysis
  const notes = analysis.notes ?? []
  const insightIsAi = analysis.meta?.insightSource !== 'rules'
  const labelOf = (c: { platform: string; label?: string }) => c.label || c.platform

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-green-400 to-emerald-500'
    if (score >= 60) return 'from-yellow-400 to-orange-500'
    return 'from-red-400 to-red-500'
  }

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-green-400 bg-green-400/10'
      case 'medium': return 'text-yellow-400 bg-yellow-400/10'
      default: return 'text-red-400 bg-red-400/10'
    }
  }

  const confidenceDotColor =
    dataConfidence.level === 'high' ? 'bg-green-400' : dataConfidence.level === 'medium' ? 'bg-yellow-400' : 'bg-red-400'

  // Real numbers, derived from actual matched comparisons — no fabricated ranges.
  const matchedComparisons = comparison.filter((c) => c.matched && c.price !== null)
  const allPrices = [
    ...(product.price !== null ? [product.price] : []),
    ...matchedComparisons.map((c) => c.price as number),
  ]
  const priceRangeText =
    allPrices.length > 1
      ? `₹${Math.min(...allPrices).toLocaleString('en-IN')} – ₹${Math.max(...allPrices).toLocaleString('en-IN')} across ${allPrices.length} confirmed listings`
      : 'Only one confirmed listing so far'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-cyan-500/5 to-transparent rounded-full blur-3xl"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-blue-500/5 to-transparent rounded-full blur-3xl"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button
            onClick={() => router.push('/ai-assistant')}
            className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>New Analysis</span>
          </button>

          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold">AI Analysis</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* Product Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{product.name}</h1>

          {/* Score + Recommendation */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 mb-6">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center">
                  <div className={`w-16 h-16 bg-gradient-to-r ${getScoreColor(valueScore.score)} rounded-full flex items-center justify-center`}>
                    <span className="text-2xl font-bold text-white">{valueScore.score}</span>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold">{valueScore.label}</h2>
                <p className="text-gray-400 text-sm">
                  {product.price !== null ? `₹${product.price.toLocaleString('en-IN')}` : 'Price unavailable'} on {product.platform}
                  {product.dataSource === 'search-listing' && ' (Google Shopping listing)'}
                </p>
              </div>
            </div>

            <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-4 max-w-md">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{insightIsAi ? 'AI Recommendation' : 'Recommendation'}</h3>
                <div className="flex items-center space-x-1 text-xs">
                  <div className={`w-2 h-2 rounded-full ${confidenceDotColor}`}></div>
                  <span className="text-gray-400 capitalize">{dataConfidence.level} confidence</span>
                </div>
              </div>
              <p className="text-gray-300 text-sm">
                {insight?.recommendation || 'AI narrative unavailable right now — the price and comparison data above is still real.'}
              </p>
              {!insightIsAi && (
                <p className="text-xs text-gray-500 mt-2">Rule-based summary — the AI model was unavailable for this request.</p>
              )}
            </div>
          </div>
        </div>

        {/* Price Comparison — always shown, even with zero matches, for honesty about what was attempted */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <ChartBarIcon className="w-6 h-6 mr-2 text-cyan-400" />
            Price Comparison
          </h2>
          {matchedComparisons.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  ...(product.price !== null
                    ? [{ platform: product.platform, price: product.price, url: product.url, confidence: null as number | null, isOrigin: true, viaShopping: product.dataSource === 'search-listing' }]
                    : []),
                  ...matchedComparisons.map((c) => ({ platform: labelOf(c), price: c.price as number, url: c.url as string, confidence: c.confidence, isOrigin: false, viaShopping: c.source === 'google-shopping' }))]
                  .map((entry, index) => (
                    <div key={index} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold uppercase text-sm tracking-wide">{entry.platform}</h3>
                        {entry.confidence !== null && (
                          <span className="px-2 py-1 rounded-full text-xs bg-cyan-400/10 text-cyan-400">
                            {Math.round(entry.confidence * 100)}% match
                          </span>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-cyan-400 mb-1">₹{entry.price.toLocaleString('en-IN')}</div>
                      <p className="text-xs text-gray-500 mb-3">
                        {entry.isOrigin ? 'This listing' : 'Matched listing'}
                        {entry.viaShopping ? ' · via Google Shopping' : ''}
                      </p>
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 w-full justify-center"
                      >
                        {entry.isOrigin ? 'View original listing' : 'View listing'} →
                      </a>
                    </div>
                  ))}
              </div>
              {comparison.some((c) => !c.matched) && (
                <ul className="text-xs text-gray-500 mt-3 space-y-1">
                  {comparison.filter((c) => !c.matched).map((c) => (
                    <li key={c.platform}>
                      No confident match on {labelOf(c)}
                      {c.reason ? ` — ${c.reason}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 text-center text-gray-400 text-sm">
              {comparison.length > 0 ? (
                <>
                  <p>Checked {comparison.length} platform{comparison.length > 1 ? 's' : ''} — no confident matches found.</p>
                  <ul className="mt-3 space-y-1 text-xs text-gray-500">
                    {comparison.map((c) => (
                      <li key={c.platform}>{labelOf(c)}: {c.reason || 'no match'}</li>
                    ))}
                  </ul>
                </>
              ) : (
                'Comparison search unavailable — check that SERPER_API_KEY is set.'
              )}
            </div>
          )}
        </div>

        {notes.length > 0 && (
          <div className="mb-8 bg-yellow-500/5 border border-yellow-600/30 rounded-xl p-4 text-sm text-yellow-200/80">
            {notes.map((n, i) => (
              <p key={i}>• {n}</p>
            ))}
          </div>
        )}

        {/* Pros & Cons + Data Confidence */}
        {insight && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-1">Pros & Cons</h2>
              {insight.summary && <p className="text-gray-300 text-sm mb-4">{insight.summary}</p>}
              <p className="text-xs text-gray-500 mb-4">
                {insightIsAi ? `Written by ${analysis.meta?.insightModel || 'AI'} from the data above` : 'Rule-based, from the data above'}
              </p>

              {insight.pros.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-green-400 mb-3 flex items-center">
                    <CheckCircleIcon className="w-5 h-5 mr-2" />
                    Pros
                  </h3>
                  <ul className="space-y-2">
                    {insight.pros.map((pro, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-300 text-sm">{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insight.cons.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-400 mb-3 flex items-center">
                    <XCircleIcon className="w-5 h-5 mr-2" />
                    Cons
                  </h3>
                  <ul className="space-y-2">
                    {insight.cons.map((con, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-gray-300 text-sm">{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insight.whoItsFor && (
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <h3 className="font-semibold text-purple-400 mb-2">Good for</h3>
                  <p className="text-gray-300 text-sm">{insight.whoItsFor}</p>
                </div>
              )}
            </div>

            {/* Data Confidence (real — replaces the old fabricated risk assessment) */}
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <ShieldCheckIcon className="w-6 h-6 mr-2 text-cyan-400" />
                Data Confidence
              </h2>

              <div className="mb-4">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(dataConfidence.level)}`}>
                  <ShieldCheckIcon className="w-4 h-4 mr-2" />
                  {dataConfidence.level.toUpperCase()} CONFIDENCE
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Why</h3>
                <ul className="space-y-1">
                  {dataConfidence.reasons.map((reason, index) => (
                    <li key={index} className="text-sm text-gray-300">• {reason}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="font-semibold mb-2">Why this score</h3>
                <ul className="space-y-1">
                  {valueScore.basis.map((b, index) => (
                    <li key={index} className="text-sm text-gray-300">• {b}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Market Intelligence — real fields only, no fabricated "alternatives" */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <ArrowTrendingUpIcon className="w-6 h-6 mr-2 text-cyan-400" />
            Market Intelligence
          </h2>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 text-cyan-400">Price Range</h3>
                <p className="text-sm text-gray-300">{priceRangeText}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-green-400">Timing Read</h3>
                <p className="text-sm text-gray-300">{valueScore.label}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => router.push('/ai-assistant')}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-semibold hover:from-cyan-400 hover:to-blue-500 transition-all duration-200"
          >
            Analyze Another Product
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-8 py-3 bg-gray-800 border border-gray-600 rounded-xl font-semibold hover:bg-gray-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
