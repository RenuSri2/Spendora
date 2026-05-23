interface SpendoraIconProps {
  className?: string
  size?: number
}

export default function SpendoraIcon({ className = "", size = 32 }: SpendoraIconProps) {
  return (
    <div 
      className={`relative flex items-center justify-center bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 rounded-2xl ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-300/20 to-purple-500/20 rounded-2xl" />
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        className="relative z-10"
      >
        {/* Modern geometric S design */}
        <path
          d="M12 2L19 6V10L15 12L19 14V18L12 22L5 18V14L9 12L5 10V6L12 2Z"
          fill="white"
          stroke="white"
          strokeWidth="0.5"
          opacity="0.9"
        />
        <path
          d="M12 6L16 8V10L12 12L8 10V8L12 6Z"
          fill="rgba(255,255,255,0.3)"
        />
        <path
          d="M12 12L16 14V16L12 18L8 16V14L12 12Z"
          fill="rgba(255,255,255,0.5)"
        />
      </svg>
      
      {/* Sparkle effects */}
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-white/60 rounded-full animate-pulse" />
      <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse delay-300" />
    </div>
  )
}
