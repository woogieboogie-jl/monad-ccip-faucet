

import { useState, useEffect } from "react"
import { VolatilityData } from '@/lib/types'

// CONSOLIDATION: Use unified VolatilityData interface from types.ts
// Local interface for additional fields specific to this hook
interface VolatilityHookData extends VolatilityData {
  lastUpdate: Date
  source: string
}

export function useVolatility() {
  const [volatility, setVolatility] = useState<VolatilityHookData>({
    score: 45, // Start with moderate volatility
    trend: "stable",
    multiplier: 1.0, // Added from unified interface
    refillDecision: 0, // Added from unified interface
    lastUpdate: new Date(),
    source: "BTC-based Crypto",
  })

  const [isLoading, setIsLoading] = useState(false)

  // Simulate fetching volatility data from Avalanche Fuji
  const fetchVolatilityData = async () => {
    setIsLoading(true)

    // Simulate API call delay
    setTimeout(() => {
      // Generate realistic volatility data
      const newScore = Math.floor(Math.random() * 100) + 1
      const currentScore = volatility.score

      let trend: "increasing" | "decreasing" | "stable" = "stable"
      if (newScore > currentScore + 5) trend = "increasing"
      else if (newScore < currentScore - 5) trend = "decreasing"

      setVolatility({
        score: newScore,
        trend,
        multiplier: 1.0 + (newScore - 50) / 100, // Calculate multiplier based on score
        refillDecision: newScore > 70 ? 1 : 0, // Simple refill decision logic
        lastUpdate: new Date(),
        source: "BTC-based Crypto",
      })
      setIsLoading(false)
    }, 1500)
  }

  // NOTE: Removed automatic 30-second polling that produced random
  // volatility scores. Volatility will now update only when
  // `updateVolatilityScore` (or a manual call to `fetchVolatilityData`)
  // is invoked – e.g. after a successful CCIP refill.

  // Calculate drip multiplier based on volatility score
  const getDripMultiplier = () => {
    if (volatility.score <= 20) return 2.0 // Low volatility = higher drip
    if (volatility.score <= 40) return 1.5
    if (volatility.score <= 60) return 1.0 // Normal drip
    if (volatility.score <= 80) return 0.7
    return 0.5 // High volatility = lower drip
  }

  const getVolatilityLevel = () => {
    if (volatility.score <= 20) return "Very Low"
    if (volatility.score <= 40) return "Low"
    if (volatility.score <= 60) return "Moderate"
    if (volatility.score <= 80) return "High"
    return "Very High"
  }

  const getVolatilityColor = () => {
    if (volatility.score <= 20) return "text-green-400"
    if (volatility.score <= 40) return "text-green-300"
    if (volatility.score <= 60) return "text-yellow-400"
    if (volatility.score <= 80) return "text-orange-400"
    return "text-red-400"
  }

  const getDripReasoning = () => {
    const level = getVolatilityLevel()
    const multiplier = getDripMultiplier()

    if (volatility.score <= 20) {
      return `${level} volatility detected - increased drip amounts (${multiplier}x) to encourage testing`
    }
    if (volatility.score <= 40) {
      return `${level} volatility - slightly increased drip amounts (${multiplier}x) for stable testing`
    }
    if (volatility.score <= 60) {
      return `${level} volatility - standard drip amounts (${multiplier}x) maintained`
    }
    if (volatility.score <= 80) {
      return `${level} volatility - reduced drip amounts (${multiplier}x) to preserve reserves`
    }
    return `${level} volatility - minimal drip amounts (${multiplier}x) to protect faucet reserves`
  }

  // Update volatility score programmatically (for CCIP updates)
  const updateVolatilityScore = (newScore: number) => {
    const currentScore = volatility.score
    let trend: "increasing" | "decreasing" | "stable" = "stable"
    if (newScore > currentScore + 5) trend = "increasing"
    else if (newScore < currentScore - 5) trend = "decreasing"

    setVolatility({
      score: Math.max(1, Math.min(100, newScore)), // Clamp between 1-100
      trend,
      multiplier: 1.0 + (newScore - 50) / 100, // Calculate multiplier based on score
      refillDecision: newScore > 70 ? 1 : 0, // Simple refill decision logic
      lastUpdate: new Date(),
      source: "BTC-based Crypto",
    })
  }

  return {
    volatility,
    isLoading,
    fetchVolatilityData,
    getDripMultiplier,
    getVolatilityLevel,
    getVolatilityColor,
    getDripReasoning,
    updateVolatilityScore,
  }
}
