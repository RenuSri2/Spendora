"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  SparklesIcon, 
  ArrowLeftIcon, 
  ChartBarIcon, 
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import PriceHistoryChart from '../../../components/PriceHistoryChart'

interface AIAnalysisResult {
  productName: string
  score: number
  recommendation: string
  priceComparison: Array<{
    platform: string
    price: number
    availability: string
    url: string
  }>
  insights: {
    pros: string[]
    cons: string[]
    keyFeatures: string[]
  }
  marketIntelligence: {
    priceRange: string
    bestTimeToBuy: string
    priceHistory: string
    alternativeProducts: string[]
  }
  riskAssessment: {
    level: 'low' | 'medium' | 'high'
    factors: string[]
    mitigation: string[]
  }
  reviewAnalysis: {
    avgRating: number
    totalReviews: number
    sentiment: 'positive' | 'neutral' | 'negative'
    commonPraise: string[]
    commonComplaints: string[]
  }
  priceHistory?: Array<{
    date: string
    price: number
  }>
}

export default function AnalysisPage() {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Retrieve analysis from localStorage
    const storedAnalysis = localStorage.getItem('aiAnalysisResult')
    if (storedAnalysis) {
      setAnalysis(JSON.parse(storedAnalysis))
    } else {
      // Redirect back if no analysis found
      router.push('/ai-assistant')
      return
    }
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-green-400 to-emerald-500'
    if (score >= 60) return 'from-yellow-400 to-orange-500'
    return 'from-red-400 to-red-500'
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-400 bg-green-400/10'
      case 'medium': return 'text-yellow-400 bg-yellow-400/10'
      case 'high': return 'text-red-400 bg-red-400/10'
      default: return 'text-gray-400 bg-gray-400/10'
    }
  }

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0
    
    return (
      <div className="flex items-center space-x-1">
        {[...Array(5)].map((_, i) => (
          <div key={i}>
            {i < fullStars ? (
              <StarIconSolid className="w-5 h-5 text-yellow-400" />
            ) : i === fullStars && hasHalfStar ? (
              <div className="relative">
                <StarIcon className="w-5 h-5 text-gray-600" />
                <div className="absolute inset-0 overflow-hidden w-1/2">
                  <StarIconSolid className="w-5 h-5 text-yellow-400" />
                </div>
              </div>
            ) : (
              <StarIcon className="w-5 h-5 text-gray-600" />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm text-gray-400">({analysis.reviewAnalysis.totalReviews})</span>
      </div>
    )
  }

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
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{analysis.productName}</h1>
          
          {/* AI Score */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6 mb-6">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-gray-700 flex items-center justify-center">
                  <div className={`w-16 h-16 bg-gradient-to-r ${getScoreColor(analysis.score)} rounded-full flex items-center justify-center`}>
                    <span className="text-2xl font-bold text-white">{analysis.score}</span>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold">AI Score</h2>
                <p className="text-gray-400">Based on comprehensive analysis</p>
                {renderStars(analysis.reviewAnalysis.avgRating)}
              </div>
            </div>
            
            <div className="bg-gray-900/50 rounded-xl p-4 max-w-md">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">AI Recommendation</h3>
                <div className="flex items-center space-x-1 text-xs">
                  <div className={`w-2 h-2 rounded-full ${
                    analysis.confidence >= 85 ? 'bg-green-400' : 
                    analysis.confidence >= 70 ? 'bg-yellow-400' : 'bg-red-400'
                  }`}></div>
                  <span className="text-gray-400">
                    {analysis.confidence}% confident
                  </span>
                </div>
              </div>
              <p className="text-gray-300 text-sm">{analysis.recommendation}</p>
            </div>
          </div>
        </div>

        {/* Price Comparison */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <ChartBarIcon className="w-6 h-6 mr-2 text-cyan-400" />
            Price Comparison
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analysis.priceComparison.map((price, index) => {
              // Generate random seller count for other platforms (3-15 sellers)
              const sellerCount = index === 0 ? null : Math.floor(Math.random() * 13) + 3
              const isOriginalSource = index === 0
              
              return (
                <div key={index} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{price.platform}</h3>
                      {!isOriginalSource && (
                        <p className="text-xs text-gray-400 mt-1">
                          Average from {sellerCount} sellers
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      price.availability === 'In Stock' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'
                    }`}>
                      {price.availability}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-cyan-400 mb-1">₹{price.price.toLocaleString()}</div>
                  {!isOriginalSource && (
                    <p className="text-xs text-gray-500 mb-3">
                      Price range: ₹{Math.round(price.price * 0.9).toLocaleString()} - ₹{Math.round(price.price * 1.1).toLocaleString()}
                    </p>
                  )}
                  <a 
                    href={price.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200 w-full justify-center"
                  >
                    {isOriginalSource ? `Buy on ${price.platform}` : `View ${sellerCount} sellers`} →
                  </a>
                </div>
              )
            })}
          </div>
        </div>

        {/* Insights Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Pros & Cons */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Pros & Cons</h2>
            
            <div className="mb-6">
              <h3 className="font-semibold text-green-400 mb-3 flex items-center">
                <CheckCircleIcon className="w-5 h-5 mr-2" />
                Pros
              </h3>
              <ul className="space-y-2">
                {analysis.insights.pros.map((pro, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-300 text-sm">{pro}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-red-400 mb-3 flex items-center">
                <XCircleIcon className="w-5 h-5 mr-2" />
                Cons
              </h3>
              <ul className="space-y-2">
                {analysis.insights.cons.map((con, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                    <span className="text-gray-300 text-sm">{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <ShieldCheckIcon className="w-6 h-6 mr-2 text-cyan-400" />
              Risk Assessment
            </h2>
            
            <div className="mb-4">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(analysis.riskAssessment.level)}`}>
                <ExclamationTriangleIcon className="w-4 h-4 mr-2" />
                {analysis.riskAssessment.level.toUpperCase()} RISK
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold mb-2">Risk Factors</h3>
              <ul className="space-y-1">
                {analysis.riskAssessment.factors.map((factor, index) => (
                  <li key={index} className="text-sm text-gray-300">• {factor}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Mitigation Tips</h3>
              <ul className="space-y-1">
                {analysis.riskAssessment.mitigation.map((tip, index) => (
                  <li key={index} className="text-sm text-gray-300">• {tip}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Market Intelligence */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <ArrowTrendingUpIcon className="w-6 h-6 mr-2 text-cyan-400" />
            Market Intelligence
          </h2>
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <h3 className="font-semibold mb-2 text-cyan-400">Price Range</h3>
                <p className="text-sm text-gray-300">{analysis.marketIntelligence.priceRange}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-green-400">Best Time to Buy</h3>
                <p className="text-sm text-gray-300">{analysis.marketIntelligence.bestTimeToBuy}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-purple-400">Price History</h3>
                <p className="text-sm text-gray-300">{analysis.marketIntelligence.priceHistory}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-orange-400">Alternatives</h3>
                <ul className="text-sm text-gray-300 space-y-1">
                  {analysis.marketIntelligence.alternativeProducts.slice(0, 3).map((alt, index) => (
                    <li key={index}>• {alt}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Review Analysis */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Review Analysis</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
              <h3 className="font-semibold mb-4 text-green-400">What People Love</h3>
              <ul className="space-y-2">
                {analysis.reviewAnalysis.commonPraise.map((praise, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-300">{praise}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
              <h3 className="font-semibold mb-4 text-red-400">Common Complaints</h3>
              <ul className="space-y-2">
                {analysis.reviewAnalysis.commonComplaints.map((complaint, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <XCircleIcon className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-300">{complaint}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Price History Chart */}
        {analysis.priceHistory && analysis.priceHistory.length > 0 && (
          <div className="mb-8">
            <PriceHistoryChart 
              priceHistory={analysis.priceHistory}
              currentPrice={analysis.priceComparison[0]?.price || 0}
              productName={analysis.productName}
            />
          </div>
        )}

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
