import { useMemo } from "react"

export type StatusLevel = "good" | "warning" | "critical"

interface StatusConfig {
  level: StatusLevel
  text: string
  color: string
  progress?: number
}

interface StatusThresholds {
  critical: number
  warning: number
}

export function useStatus(value: number, max: number, thresholds: StatusThresholds): StatusConfig {
  return useMemo(() => {
    const percentage = (value / max) * 100
    
    if (value < thresholds.critical) {
      return {
        level: "critical",
        text: "Critical",
        color: "text-red-400",
        progress: percentage
      }
    }
    
    if (value < thresholds.warning) {
      return {
        level: "warning", 
        text: "Low",
        color: "text-yellow-400",
        progress: percentage
      }
    }
    
    return {
      level: "good",
      text: "Good", 
      color: "text-green-400",
      progress: percentage
    }
  }, [value, max, thresholds.critical, thresholds.warning])
}

// Re-export utilities from lib/utils for convenience
export { formatCooldown, formatTimeAgo, formatNumber } from "@/lib/utils" 