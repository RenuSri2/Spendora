"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SparklesIcon, MagnifyingGlassIcon, ArrowRightIcon } from '@heroicons/react/24/outline'

export default function AIAssistantPage() {
  const [productUrl, setProductUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [currentText, setCurrentText] = useState(0)
  const router = useRouter()

  // Flash.co-style rotating text
  const rotatingTexts = [
    'for reviews that spill the truth',
    'if it\'s worth buying or skipping',
    'where to buy it for less',
    'what experts really think',
    'if the price will drop soon'
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentText((prev) => (prev + 1) % rotatingTexts.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleAnalyze = async () => {
    if (!productUrl.trim()) {
      setErrorMessage('Please enter a product URL')
      return
    }

    // Validate URL format
    try {
      const url = new URL(productUrl.startsWith('http') ? productUrl : `https://${productUrl}`)
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch {
      setErrorMessage('Oops. That doesn\'t look like a valid link. Try entering the full URL – like https://example.com.')
      return
    }

    setIsAnalyzing(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productUrl })
      })

      const data = await response.json()
      
      if (data.success) {
        // Store analysis data and navigate to results
        localStorage.setItem('aiAnalysisResult', JSON.stringify(data.analysis))
        router.push('/ai-assistant/analysis')
      } else {
        setErrorMessage(data.error || 'Failed to analyze product')
      }
    } catch (error) {
      setErrorMessage('Something went wrong. Please try again.')
      console.error('Analysis error:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAnalyze()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-blue-500/10 to-transparent rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold">Spendora AI</span>
          </div>
          
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-gray-300 hover:text-white transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Title */}
          <div className="mb-8">
            <h1 className="text-6xl md:text-7xl font-bold mb-6">
              Ask <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Spendora AI</span>
            </h1>
            
            {/* Rotating subtitle */}
            <div className="h-16 flex items-center justify-center">
              <p className="text-xl md:text-2xl text-gray-300 transition-all duration-500 ease-in-out">
                {rotatingTexts[currentText]}
              </p>
            </div>
          </div>

          {/* URL Input Form */}
          <div className="mb-8">
            <div className="max-w-3xl mx-auto">
              <div className="relative">
                {/* AI Badge */}
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2 z-10">
                  <div className="w-8 h-8 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                    <SparklesIcon className="w-5 h-5 text-white" />
                  </div>
                </div>
                
                {/* Input Field */}
                <input
                  type="text"
                  value={productUrl}
                  onChange={(e) => {
                    setProductUrl(e.target.value)
                    setErrorMessage('')
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="Paste a product link here to see the AI magic"
                  className="w-full pl-16 pr-20 py-6 text-lg bg-gray-800/80 backdrop-blur-sm border border-gray-600 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                  disabled={isAnalyzing}
                />
                
                {/* Submit Button */}
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !productUrl.trim()}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:from-cyan-400 hover:to-blue-500 transition-all duration-200 group"
                >
                  {isAnalyzing ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <ArrowRightIcon className="w-6 h-6 text-white group-hover:translate-x-0.5 transition-transform" />
                  )}
                </button>
              </div>
              
              {/* Error Message */}
              {errorMessage && (
                <div className="mt-4 p-4 bg-red-900/20 border border-red-600 rounded-xl text-red-400 text-sm">
                  {errorMessage}
                </div>
              )}
              
              {/* Loading State */}
              {isAnalyzing && (
                <div className="mt-6 text-center">
                  <div className="inline-flex items-center space-x-2 text-cyan-400">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-400 border-t-transparent"></div>
                    <span className="text-lg">Analyzing with AI...</span>
                  </div>
                  <p className="text-gray-400 mt-2">Scanning across platforms for the best insights</p>
                </div>
              )}
            </div>
            
              {/* Helper Text */}
            <div className="mt-6 text-gray-400 text-center">
              <span>or </span>
              <span className="text-cyan-400 font-medium">Add localhost:3000/ </span>
              <span>in front of any product URL to get instant AI breakdown</span>
              <div className="mt-2 text-sm">
                <span className="text-gray-500">Works with: </span>
                <span className="text-cyan-300 font-mono text-xs">Amazon, Flipkart, Nykaa, Myntra & more</span>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-5xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
              <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl flex items-center justify-center mb-4">
                <MagnifyingGlassIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Deep Research</h3>
              <p className="text-gray-400">AI analyzes reviews, specs, and market data to give you the full picture</p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-xl flex items-center justify-center mb-4">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Scoring</h3>
              <p className="text-gray-400">Get an AI-powered score based on quality, price, and user satisfaction</p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-500 rounded-xl flex items-center justify-center mb-4">
                <ArrowRightIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Best Prices</h3>
              <p className="text-gray-400">Compare prices across platforms and find the best deals instantly</p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center items-center space-x-8 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>10M+ Products Analyzed</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span>Real-time Data</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span>Privacy First</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center py-8 px-6 border-t border-gray-800">
        <p className="text-gray-400">
          Your shopping assistant powered by AI. 
          <span className="text-cyan-400 ml-2">Make smarter decisions.</span>
        </p>
      </footer>
    </div>
  )
}
