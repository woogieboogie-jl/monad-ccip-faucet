import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { ArrowUpRight, ArrowDownLeft, ChevronDown, Info } from "lucide-react"
import { formatBalance } from "@/lib/utils"
import { useFaucet } from "@/hooks/use-faucet"
import { useEffect, useRef } from "react"

interface VolatilityProps {
  volatility: {
    score: number
    trend: "increasing" | "decreasing" | "stable"
    lastUpdate: Date
    source: string
  }
  getVolatilityLevel: () => string
  getDripMultiplier: () => number
}

const BASE_DRIPS: Record<"mon" | "link", number> = {
  mon: 10,
  link: 100,
}

const getTrendIcon = (trend: "increasing" | "decreasing" | "stable") => {
  if (trend === "increasing") return <ArrowUpRight className="h-3 w-3" />
  if (trend === "decreasing") return <ArrowDownLeft className="h-3 w-3" />
  return null // stable -> no icon
}

const getVolatilityColor = (score: number) => {
  if (score <= 20) return "text-green-400"
  if (score <= 40) return "text-green-300"
  if (score <= 60) return "text-yellow-400"
  if (score <= 80) return "text-orange-400"
  return "text-red-400"
}

export function VolatilityCard({ volatility, getVolatilityLevel, getDripMultiplier }: VolatilityProps) {
  const multiplier = getDripMultiplier()
  // Grab live drip amounts from central faucet hook (same source as TokenCard)
  const { faucet } = useFaucet()
  const monCurrent = faucet.mon.currentDripAmount
  const linkCurrent = faucet.link.currentDripAmount

  const liveRows = [
    { token: "mon" as const, symbol: "MON", current: monCurrent },
    { token: "link" as const, symbol: "LINK", current: linkCurrent },
  ]

  // Track previous multiplier for delta display
  const prevMultiplierRef = useRef<number | null>(null)
  const delta = prevMultiplierRef.current !== null ? multiplier - prevMultiplierRef.current : 0

  useEffect(() => {
    prevMultiplierRef.current = multiplier
  }, [multiplier])

  const rows: { token: "mon" | "link"; symbol: string }[] = [
    { token: "mon", symbol: "MON" },
    { token: "link", symbol: "LINK" },
  ]

  return (
    <TooltipProvider>
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardContent className="p-4 space-y-4">
          {/* Header - centred */}
          <div className="flex flex-col items-center bg-white/5 rounded-md py-4 space-y-1">
            <div className="flex items-center space-x-2">
              <span className={`font-body font-bold text-2xl lg:text-3xl ${getVolatilityColor(volatility.score)}`}>{volatility.score}</span>
              {getTrendIcon(volatility.trend)}
            </div>
            <span className={`font-body text-xs lg:text-sm font-medium ${getVolatilityColor(volatility.score)}`}>{getVolatilityLevel()}</span>
          </div>

          {/* Effect on drips */}
          <div className="space-y-0">
            {/* Column headers with bottom border */}
            <div className="grid grid-cols-3 text-center text-[11px] font-bold text-white/60 pb-2 border-b-2 border-white/20">
              <div>Base Drip</div>
              <div>Multiplier</div>
              <div>Current Drip</div>
            </div>
            {liveRows.map((row, idx) => {
              const current = row.current || 0
              const mult = multiplier
              const base = mult !== 0 ? current / mult : 0
              const up = mult > 1
              const multDisplay = isFinite(mult) && mult !== 0 ? mult.toFixed(2) : "-"
              return (
                <div key={row.token} className={`grid grid-cols-3 text-center text-xs py-2 ${idx === liveRows.length - 1 ? '' : 'border-b border-white/10'}`}>
                  <div className="font-body text-white/70">{formatBalance(base)} {row.symbol}</div>
                  <div className={`font-body font-medium ${up ? "text-green-300" : mult < 1 ? "text-red-300" : "text-white/70"}`}>× {multDisplay}</div>
                  <div className="font-body font-semibold text-white">{formatBalance(current)} {row.symbol}</div>
                </div>
              )
            })}
          {/* removed bottom legend */}
          </div>

          {/* Delta from previous index */}
          {prevMultiplierRef.current !== null && delta !== 0 && (
            <p className={`font-body text-xs text-center ${delta > 0 ? "text-green-300" : "text-red-300"}`}>
              Drip multiplier {delta > 0 ? "increased" : "decreased"} by {Math.abs(delta).toFixed(2)} since last update
            </p>
          )}

          {/* Collapsible thresholds */}
          <details className="group bg-white/5 rounded-md p-3">
            <summary className="cursor-pointer font-body text-xs text-white/70 flex items-center justify-between">
              <div className="flex items-center space-x-1 font-bold">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>Target Tank Threshold</span>
                  </TooltipTrigger>
                  <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                    <p className="font-body text-xs max-w-[200px]">Token tanks are considered low when their balance drops below these thresholds.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <ChevronDown className="h-3 w-3 text-white/50 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 space-y-1 text-xs font-body text-white/80">
              <p>MON low-tank threshold: 150.00 MON</p>
              <p>LINK low-tank threshold: 2 000.00 LINK</p>
              <p>Re-evaluated each time a Refuel transaction completes.</p>
            </div>
          </details>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
} 
