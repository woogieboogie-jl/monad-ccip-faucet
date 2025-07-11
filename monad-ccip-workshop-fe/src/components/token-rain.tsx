import { useMemo, useEffect, useRef } from "react"

const BASE_DROPLET_COUNT = 50 // Base number of droplets for visible rain effect

/**
 * Animated rain shower component with crisp coins falling in unified direction.
 * Features dynamic intensity and gradual direction changes over time like real rain.
 *
 * Purple (Monad) and Blue (Chainlink) coins fall in a shower pattern.
 */
export function TokenRain() {
  const containerRef = useRef<HTMLDivElement>(null)

  const droplets = useMemo(() => {
    return Array.from({ length: BASE_DROPLET_COUNT }, (_, idx) => {
      /**
       * Create rain-like falling pattern with crossing directions
       * Purple: left-to-right, Blue: right-to-left
       */
      const duration = 3 + Math.random() * 2 // 3-5s consistent rain speed
      const delay = Math.random() * 8 // 0-8s staggered start for seamless loop
      const size = 12 + Math.random() * 6 // 12-18px for consistent coin sizes
      
      // Ensure perfect 50/50 split between purple and blue tokens
      const tokenType = idx % 2 === 0 ? 'purple' : 'blue'
      
      // Position coins based on their direction to ensure full screen coverage
      const left = tokenType === 'purple' 
        ? -40 + Math.random() * 100  // Purple: start from -40% to 60% (left-to-right)
        : 40 + Math.random() * 100   // Blue: start from 40% to 140% (right-to-left)
      
      return { idx, left, duration, delay, size, tokenType }
    })
  }, [])

  // Dynamic angle changes over time
  useEffect(() => {
    const updateAngles = () => {
      if (containerRef.current) {
        // Generate random angles for purple (left-to-right) and blue (right-to-left)
        const purpleAngle = 40 + Math.random() * 80 // 40vw to 120vw (positive, left-to-right)
        const blueAngle = -(40 + Math.random() * 80) // -40vw to -120vw (negative, right-to-left)
        
        // Update CSS custom properties
        containerRef.current.style.setProperty('--purple-angle', `${purpleAngle}vw`)
        containerRef.current.style.setProperty('--blue-angle', `${blueAngle}vw`)
      }
    }

    // Set initial angles
    updateAngles()
    
    // Change angles every 8-15 seconds for natural variation
    const interval = setInterval(() => {
      updateAngles()
    }, 8000 + Math.random() * 7000) // 8-15 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div ref={containerRef} className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {droplets.map(({ idx, left, duration, delay, size, tokenType }) => (
        <div
          key={idx}
          className={`absolute top-[-30px] rounded-full opacity-80 border-2 ${
            tokenType === 'purple'
              ? "bg-gradient-to-br from-monad-purple via-purple-400 to-purple-600 border-purple-200/80 shadow-lg shadow-purple-400/60" 
              : "bg-gradient-to-br from-monad-blue via-blue-400 to-blue-600 border-blue-200/80 shadow-lg shadow-blue-400/60"
          } rain-coin`}
          style={{
            left: `${left}%`,
            width: size,
            height: size,
            animation: `rain-shower-${tokenType} ${duration}s linear infinite`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  )
} 