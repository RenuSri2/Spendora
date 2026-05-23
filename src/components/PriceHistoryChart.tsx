"use client"

import { useEffect, useRef, useState } from 'react'

interface PriceHistoryChartProps {
  priceHistory: Array<{
    date: string
    price: number
  }>
  currentPrice: number
  productName: string
}

export default function PriceHistoryChart({ priceHistory, currentPrice, productName }: PriceHistoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; date: string; price: number } | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Mouse event handlers
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    
    setMousePos({ x: event.clientX, y: event.clientY })

    // Chart dimensions
    const padding = 40
    const chartWidth = rect.width - 2 * padding
    const chartHeight = rect.height - 2 * padding

    // Helper functions
    const getX = (index: number) => padding + (index / (priceHistory.length - 1)) * chartWidth
    const prices = priceHistory.map(p => p.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice || 1
    const getY = (price: number) => padding + chartHeight - ((price - minPrice) / priceRange) * chartHeight

    // Find closest point
    let closestPoint = null
    let minDistance = Infinity

    priceHistory.forEach((point, index) => {
      const x = getX(index)
      const y = getY(point.price)
      const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2))
      
      if (distance < minDistance && distance < 20) { // 20px hover radius
        minDistance = distance
        closestPoint = {
          x,
          y,
          date: point.date,
          price: point.price
        }
      }
    })

    setHoveredPoint(closestPoint)
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height)

    if (priceHistory.length === 0) return

    // Chart dimensions
    const padding = 40
    const chartWidth = rect.width - 2 * padding
    const chartHeight = rect.height - 2 * padding

    // Get min and max prices for scaling
    const prices = priceHistory.map(p => p.price)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice || 1

    // Helper functions
    const getX = (index: number) => padding + (index / (priceHistory.length - 1)) * chartWidth
    const getY = (price: number) => padding + chartHeight - ((price - minPrice) / priceRange) * chartHeight

    // Draw grid lines
    ctx.strokeStyle = '#374151'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padding + (i / 4) * chartHeight
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(padding + chartWidth, y)
      ctx.stroke()
    }

    // Vertical grid lines
    for (let i = 0; i <= 6; i++) {
      const x = padding + (i / 6) * chartWidth
      ctx.beginPath()
      ctx.moveTo(x, padding)
      ctx.lineTo(x, padding + chartHeight)
      ctx.stroke()
    }

    ctx.setLineDash([])

    // Draw price line
    ctx.strokeStyle = '#06b6d4'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    priceHistory.forEach((point, index) => {
      const x = getX(index)
      const y = getY(point.price)
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight)
    gradient.addColorStop(0, 'rgba(6, 182, 212, 0.3)')
    gradient.addColorStop(1, 'rgba(6, 182, 212, 0.05)')
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    priceHistory.forEach((point, index) => {
      const x = getX(index)
      const y = getY(point.price)
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.lineTo(getX(priceHistory.length - 1), padding + chartHeight)
    ctx.lineTo(getX(0), padding + chartHeight)
    ctx.closePath()
    ctx.fill()

    // Draw data points
    priceHistory.forEach((point, index) => {
      const x = getX(index)
      const y = getY(point.price)
      
      // Check if this point is being hovered
      const isHovered = hoveredPoint && 
        Math.abs(hoveredPoint.x - x) < 1 && 
        Math.abs(hoveredPoint.y - y) < 1
      
      // Point color and size
      const pointSize = isHovered ? 6 : 4
      ctx.fillStyle = isHovered ? '#fbbf24' : '#06b6d4'
      
      ctx.beginPath()
      ctx.arc(x, y, pointSize, 0, Math.PI * 2)
      ctx.fill()
      
      // Highlight current price or hovered point
      if (index === priceHistory.length - 1 || isHovered) {
        ctx.strokeStyle = isHovered ? '#fbbf24' : '#ffffff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x, y, pointSize + 2, 0, Math.PI * 2)
        ctx.stroke()
      }
    })

    // Draw price labels
    ctx.fillStyle = '#9ca3af'
    ctx.font = '12px system-ui'
    ctx.textAlign = 'right'
    
    for (let i = 0; i <= 4; i++) {
      const price = minPrice + (i / 4) * priceRange
      const y = padding + chartHeight - (i / 4) * chartHeight
      ctx.fillText(`₹${Math.round(price).toLocaleString()}`, padding - 10, y + 4)
    }

    // Draw date labels
    ctx.textAlign = 'center'
    const dateLabels = [0, Math.floor(priceHistory.length / 3), Math.floor(2 * priceHistory.length / 3), priceHistory.length - 1]
    
    dateLabels.forEach(index => {
      const x = getX(index)
      const date = new Date(priceHistory[index].date)
      const label = date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      ctx.fillText(label, x, padding + chartHeight + 20)
    })

    // Draw current price indicator
    const currentY = getY(currentPrice)
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(padding, currentY)
    ctx.lineTo(padding + chartWidth, currentY)
    ctx.stroke()
    ctx.setLineDash([])

    // Current price label
    ctx.fillStyle = '#10b981'
    ctx.font = 'bold 12px system-ui'
    ctx.textAlign = 'left'
    ctx.fillText(`Current: ₹${currentPrice.toLocaleString()}`, padding + 10, currentY - 10)

  }, [priceHistory, currentPrice, hoveredPoint])

  // Calculate price change
  const priceChange = priceHistory.length > 1 
    ? ((priceHistory[priceHistory.length - 1].price - priceHistory[0].price) / priceHistory[0].price) * 100
    : 0

  const changeColor = priceChange >= 0 ? 'text-green-400' : 'text-red-400'
  const changeIcon = priceChange >= 0 ? '↗️' : '↘️'

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-white">Price History</h3>
          <p className="text-gray-400 text-sm">Last 30 days trend for {productName}</p>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${changeColor}`}>
            {changeIcon} {Math.abs(priceChange).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">30-day change</div>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-64 rounded-lg bg-gray-900/20 cursor-crosshair"
          style={{ width: '100%', height: '256px' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        
        {priceHistory.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500">Loading price history...</p>
          </div>
        )}
        
        {/* Interactive Tooltip */}
        {hoveredPoint && (
          <div 
            className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl pointer-events-none"
            style={{
              left: mousePos.x + 15,
              top: mousePos.y - 60,
              transform: mousePos.x > window.innerWidth - 200 ? 'translateX(-100%)' : 'none'
            }}
          >
            <div className="text-white text-sm font-medium">
              ₹{hoveredPoint.price.toLocaleString()}
            </div>
            <div className="text-gray-400 text-xs">
              {new Date(hoveredPoint.date).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
            <div className="w-2 h-2 bg-yellow-400 rounded-full mx-auto mt-1"></div>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-green-400 text-lg font-semibold">
            ₹{Math.min(...priceHistory.map(p => p.price)).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">Lowest</div>
        </div>
        <div>
          <div className="text-cyan-400 text-lg font-semibold">
            ₹{Math.round(priceHistory.reduce((sum, p) => sum + p.price, 0) / priceHistory.length).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">Average</div>
        </div>
        <div>
          <div className="text-red-400 text-lg font-semibold">
            ₹{Math.max(...priceHistory.map(p => p.price)).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">Highest</div>
        </div>
      </div>
    </div>
  )
}
