

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Info, ExternalLink, Copy, Fuel, TrendingDown, TrendingUp } from "lucide-react"

interface AssetCardProps {
  symbol: string
  baseAmount: number
  actualAmount: number
  contractAddress: string
  onDrip: () => void
  onRequest: () => void
  dripState: {
    text: string
    disabled: boolean
    loading?: boolean
    isGasFree?: boolean
  }
  requestState: {
    text: string
    disabled: boolean
    loading?: boolean
    showIcon: boolean
  }
  showGasFreeTooltip?: boolean
  volatilityMultiplier: number
  volatilityReasoning: string
}

export function AssetCard({
  symbol,
  baseAmount,
  actualAmount,
  contractAddress,
  onDrip,
  onRequest,
  dripState,
  requestState,
  showGasFreeTooltip = false,
  volatilityMultiplier,
  volatilityReasoning,
}: AssetCardProps) {
  const openExplorer = () => {
    window.open(`https://etherscan.io/address/${contractAddress}`, "_blank")
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(contractAddress)
  }

  const isAmountReduced = volatilityMultiplier < 1.0
  const isAmountIncreased = volatilityMultiplier > 1.0

  return (
    <TooltipProvider>
      <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-200">
        <CardContent className="p-6">
          <div className="space-y-5">
            {/* Asset Header with Request Icon */}
            <div className="text-center space-y-2 relative">
              <div className="flex items-center justify-center space-x-2">
                <h3 className="font-poster text-2xl font-black text-white tracking-wide">{symbol}</h3>
                {requestState.showIcon && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={onRequest}
                        disabled={requestState.disabled}
                        className={`p-2 rounded-full transition-all duration-200 border-2 ${
                          requestState.disabled
                            ? "bg-white/5 border-white/20 text-white/40 cursor-not-allowed"
                            : "bg-orange-500/20 border-orange-400/50 text-orange-400 hover:bg-orange-500/30 hover:border-orange-400/70 hover:text-orange-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-orange-400/20"
                        } ${requestState.loading ? "animate-pulse" : ""}`}
                      >
                        <Fuel className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-body text-sm">
                        {requestState.disabled
                          ? `Cross-chain refill cooldown: ${requestState.text}`
                          : "Request cross-chain faucet refill (you manage the refill process)"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Dynamic Amount Display */}
              <div className="space-y-1">
                <div className="flex items-center justify-center space-x-2">
                  <span className="font-body text-white/80 text-sm font-medium">
                    Available: {actualAmount} {symbol}
                  </span>
                  {isAmountReduced && <TrendingDown className="h-3 w-3 text-red-400" />}
                  {isAmountIncreased && <TrendingUp className="h-3 w-3 text-green-400" />}
                </div>

                {volatilityMultiplier !== 1.0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <p
                          className={`font-body text-xs font-medium ${
                            isAmountReduced ? "text-red-300" : isAmountIncreased ? "text-green-300" : "text-white/60"
                          }`}
                        >
                          {isAmountReduced && `Reduced from ${baseAmount} (${volatilityMultiplier}x)`}
                          {isAmountIncreased && `Increased from ${baseAmount} (${volatilityMultiplier}x)`}
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1 max-w-xs">
                        <p className="font-body text-sm font-medium">Volatility-Adjusted Amount</p>
                        <p className="font-body text-xs text-white/80">{volatilityReasoning}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Contract Address (hide for native tokens) */}
            {contractAddress && (
            <div className="bg-white/5 rounded-lg p-4 space-y-3">
              <p className="font-body text-white/70 text-xs font-medium text-center tracking-wide uppercase">
                Contract Address
              </p>
              <div className="flex items-center justify-between space-x-2">
                <code className="font-mono text-white text-xs flex-1 text-center font-medium">
                  {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                </code>
                <div className="flex space-x-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={copyAddress} className="p-1.5 hover:bg-white/10 rounded transition-colors">
                        <Copy className="h-3.5 w-3.5 text-white/70 hover:text-white" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-body text-sm">Copy address</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={openExplorer} className="p-1.5 hover:bg-white/10 rounded transition-colors">
                        <ExternalLink className="h-3.5 w-3.5 text-white/70 hover:text-white" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-body text-sm">View on explorer</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
            )}

            {/* Drip Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-1">
                <Button
                  variant="outline"
                  size="sm"
                  className={`w-full border-2 border-white/60 text-white hover:bg-white hover:text-monad-purple bg-transparent font-body font-medium text-sm transition-all duration-200 ${
                    dripState.loading ? "animate-pulse" : ""
                  } ${dripState.isGasFree ? "border-green-400 text-green-400 hover:bg-green-400 hover:text-monad-purple" : ""}`}
                  onClick={onDrip}
                  disabled={dripState.disabled}
                >
                  {dripState.text}
                </Button>
                {showGasFreeTooltip && dripState.isGasFree && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-green-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-body text-sm">Your first transaction is sponsored by a Paymaster!</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="font-body text-xs text-white/60 text-center font-medium">
                Request cross-chain refill when reserves are low
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
