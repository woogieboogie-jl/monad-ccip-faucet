import { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ActionButton } from "@/components/ui/action-button"
import { ContractAddress } from "@/components/ui/contract-address"
import { TrendingUp, TrendingDown, Info } from "lucide-react"
import { formatTimeAgo, formatBalance } from "@/lib/utils"

interface AssetCardProps {
  symbol: string
  tokenType: "mon" | "link"
  tankBalance: number
  currentDripAmount: number
  baseDripAmount: number
  contractAddress: string
  dripButtonProps: {
    text: string
    disabled: boolean
    isGasFree?: boolean
    isEmpty?: boolean
    loading?: boolean
    onClick: () => void
  }
  fuelButtonProps: {
    text: string
    disabled: boolean
    canRequest: boolean
    onClick: () => void
  }
  tankStatus: {
    status: string
    color: string
    isBelowThreshold: boolean
    threshold: number
    lastUpdated: Date
  }
  specialHighlight?: boolean
  children?: ReactNode
}

export function AssetCard({
  symbol,
  tokenType,
  tankBalance,
  currentDripAmount,
  baseDripAmount,
  contractAddress,
  dripButtonProps,
  fuelButtonProps,
  tankStatus,
  specialHighlight = false,
  children
}: AssetCardProps) {
  const isAmountReduced = currentDripAmount < baseDripAmount
  const isAmountIncreased = currentDripAmount > baseDripAmount
  const hasVolatilityAdjustment = currentDripAmount !== baseDripAmount

  return (
    <Card className={`bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-200 ${
      specialHighlight ? "relative z-10 overflow-visible" : ""
    }`}>
      <CardContent className={`p-4 lg:p-6 ${
        specialHighlight ? "overflow-visible" : ""
      }`}>
        <div className="space-y-4">
          {/* Asset Header */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center">
              <h3 className="font-body text-2xl lg:text-3xl font-black text-white tracking-wide">{symbol}</h3>
            </div>

            {/* Tank Balance & Drip Amount Display */}
            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <span className="font-body text-white/80 text-sm font-medium">
                  Available: {formatBalance(tankBalance)} {symbol}
                </span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <span className="font-body text-white text-sm font-medium">
                  Drip: {formatBalance(currentDripAmount)} {symbol}
                </span>
                {isAmountReduced && <TrendingDown className="h-3 w-3 text-red-400" />}
                {isAmountIncreased && <TrendingUp className="h-3 w-3 text-green-400" />}
              </div>

              {hasVolatilityAdjustment && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <p className="font-body text-xs font-medium text-green-300">
                        {isAmountReduced && `Reduced from ${formatBalance(baseDripAmount)} (volatility-adjusted)`}
                        {isAmountIncreased && `Increased from ${formatBalance(baseDripAmount)} (volatility-adjusted)`}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                    <div className="space-y-1 max-w-xs">
                      <p className="font-body text-xs font-medium">Volatility-Adjusted Drip Amount</p>
                      <p className="font-body text-xs text-white/80">
                        Drip amounts are updated based on BTC-based crypto market volatility
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Contract Address */}
          <ContractAddress 
            address={contractAddress}
            label="Contract:"
            variant="default"
          />

          {/* Drip Button */}
          <div className="space-y-2">
            <div className="flex items-center justify-center">
              <ActionButton
                variant="blue"
                state={dripButtonProps.disabled ? "disabled" : dripButtonProps.loading ? "loading" : "enabled"}
                icon={<div className="h-4 w-4" />} // This will be filled by the parent
                rightIcon={<Info className="h-3 w-3" />}
                fullWidth
                animated={!dripButtonProps.disabled}
                onClick={dripButtonProps.onClick}
                tooltip={
                  dripButtonProps.isEmpty 
                    ? "Tank is empty or insufficient - use Refuel button below to fill from vault" 
                    : dripButtonProps.isGasFree
                      ? "Your first transaction is sponsored by a Paymaster!"
                      : "Get tokens from the tank sent to your wallet"
                }
              >
                {dripButtonProps.text}
              </ActionButton>
            </div>
          </div>

          {/* Tank Status Section */}
          <div className="bg-white/5 rounded-lg p-3 space-y-3 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="font-body text-white/70 text-xs font-medium">Tank Status:</span>
              <span className="font-body text-white/70 text-xs">
                {formatTimeAgo(tankStatus.lastUpdated)}
              </span>
            </div>

            {/* Simple threshold-based status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-body text-white/70 text-xs">Status:</span>
                <span className={`font-body text-xs font-medium ${tankStatus.color}`}>{tankStatus.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body text-white/70 text-xs">Threshold:</span>
                <span className="font-body text-white/70 text-xs">{formatBalance(tankStatus.threshold)}</span>
              </div>
            </div>

            {/* Fuel Button */}
            <div className="text-xs">
              <ActionButton
                variant="orange"
                state={fuelButtonProps.disabled ? "disabled" : "enabled"}
                icon={<div className="h-4 w-4" />} // This will be filled by the parent
                rightIcon={<Info className="h-3 w-3" />}
                fullWidth
                animated={fuelButtonProps.canRequest}
                onClick={fuelButtonProps.onClick}
                tooltip="Cross-chain request to update volatility and refill tank from vault"
              >
                {fuelButtonProps.text}
              </ActionButton>
            </div>
          </div>

          {/* Custom content */}
          {children}
        </div>
      </CardContent>
    </Card>
  )
} 