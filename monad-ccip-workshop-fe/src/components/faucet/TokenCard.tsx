import { memo, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTokenState, useCCIPState, useUIState, useFaucetStore, useVaultState } from '@/store/faucet-store'
import { useFaucet } from "@/hooks/use-faucet"
import { Copy, ExternalLink, Fuel, TrendingUp, TrendingDown, Info, CheckCircle, AlertTriangle, Coins, Droplets, Check, Zap, RefreshCw, Shield } from "lucide-react"
import { formatBalance } from "@/lib/utils"

interface TokenCardProps {
  tokenType: "mon" | "link"
  walletAddress: string | null
  isConnected: boolean
  isOwner: boolean
  userBalance: number
  onDrip: (tokenType: "mon" | "link") => void
  onRefill: (tokenType: "mon" | "link") => void
  onGasFreeModalOpen?: () => void
  formatCooldown: (seconds: number) => string
}

const TOKEN_CONFIG = {
  mon: {
    symbol: "MON",
    name: "MON Token",
    color: "from-purple-500 to-blue-500",
    iconUrl: "/tokens/mon.png",
    explorer: "https://monad-explorer.com/token/"
  },
  link: {
    symbol: "LINK",
    name: "LINK Token", 
    color: "from-blue-500 to-cyan-500",
    iconUrl: "/tokens/link.png",
    explorer: "https://testnet.snowtrace.io/token/"
  }
} as const

export const TokenCard = memo(({ 
  tokenType, 
  walletAddress, 
  isConnected, 
  isOwner,
  userBalance,
  onDrip, 
  onRefill, 
  onGasFreeModalOpen,
  formatCooldown 
}: TokenCardProps) => {
  const tokenState = useTokenState(tokenType)
  const ccipState = useCCIPState(tokenType)
  const { copiedAddresses, dripStates } = useUIState()
  const { setCopiedAddress, setDripState, resetCCIPState } = useFaucetStore()
  const vaultState = useVaultState()
  const vaultBalance = tokenType === 'mon' ? vaultState.mon : vaultState.link
  
  const config = TOKEN_CONFIG[tokenType]
  const Icon = config.iconUrl // Changed to use image URL

  // Computed states
  const tankPercentage = useMemo(() => 
    Math.round((tokenState.tankBalance / tokenState.maxTankBalance) * 100), 
    [tokenState.tankBalance, tokenState.maxTankBalance]
  )

  const isBelowThreshold = useMemo(() => 
    tankPercentage < 30, 
    [tankPercentage]
  )

  const dripCooldownText = useMemo(() => 
    formatCooldown(tokenState.dripCooldownTime), 
    [tokenState.dripCooldownTime, formatCooldown]
  )

  const requestCooldownText = useMemo(() => 
    formatCooldown(tokenState.requestCooldownTime), 
    [tokenState.requestCooldownTime, formatCooldown]
  )

  // Button states
  const dripButtonState = useMemo(() => {
    if (!isConnected) {
      return { text: "Connect Wallet", disabled: true, isGasFree: false }
    }

    if (tokenState.tankBalance <= 0) {
      return { text: "Tank Empty - Use Refuel", disabled: true, isGasFree: false, isEmpty: true }
    }
    
    if (tokenState.tankBalance < tokenState.currentDripAmount) {
      return { 
        text: `Insufficient Tank (${formatBalance(tokenState.tankBalance)} < ${formatBalance(tokenState.currentDripAmount)})`, 
        disabled: true, 
        isGasFree: false, 
        isEmpty: true 
      }
    }

    if (tokenType === "mon" && userBalance === 0) {
      return { text: "Get First MON (Gas-Free)", disabled: false, isGasFree: true }
    }

    if (tokenState.isDripLoading) {
      return { text: "Dripping...", disabled: true, loading: true, isGasFree: false }
    }

    if (tokenState.dripCooldownTime > 0) {
      return { text: dripCooldownText, disabled: true, isGasFree: false }
    }

    return { text: "Drip", disabled: false, isGasFree: false }
  }, [
    isConnected, 
    tokenState.tankBalance, 
    tokenState.maxTankBalance, 
    tokenState.currentDripAmount, 
    tokenState.isDripLoading, 
    tokenState.dripCooldownTime,
    tokenType,
    userBalance,
    dripCooldownText
  ])

  const refillButtonState = useMemo(() => {
    if (!isConnected) {
      return { text: "Connect Wallet", disabled: true, canRequest: false }
    }

    if (ccipState.status !== "idle") {
      return { text: "Refill in progress", disabled: true, canRequest: false }
    }

    // Vault empty guard
    if (vaultBalance === 0) {
      return { text: "Vault empty, contact admin", disabled: true, canRequest: false }
    }

    if (tokenState.requestCooldownTime > 0) {
      return { text: requestCooldownText, disabled: true, canRequest: false }
    }

    return {
      text: isBelowThreshold ? "Request Volatility & Refill" : "Tank Above Threshold",
      disabled: !isBelowThreshold,
      canRequest: isBelowThreshold,
    }
  }, [
    isConnected, 
    ccipState.status, 
    tokenState.requestCooldownTime, 
    requestCooldownText, 
    isBelowThreshold,
    vaultBalance
  ])

  // Event handlers
  const handleDrip = useCallback(() => {
    if (dripButtonState.isGasFree && onGasFreeModalOpen) {
      onGasFreeModalOpen()
    } else {
      setDripState(tokenType, true)
      onDrip(tokenType)
      
      // Reset animation after 800ms
      setTimeout(() => {
        setDripState(tokenType, false)
      }, 800)
    }
  }, [dripButtonState.isGasFree, onGasFreeModalOpen, onDrip, tokenType, setDripState])

  const handleRefill = useCallback(() => {
    onRefill(tokenType)
  }, [onRefill, tokenType])

  const handleCopyAddress = useCallback((address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedAddress(address, true)
  }, [setCopiedAddress])

  const handleOpenExplorer = useCallback((address: string) => {
    window.open(`${config.explorer}${address}`, "_blank")
  }, [config.explorer])

  const handleDismissError = useCallback(() => {
    resetCCIPState(tokenType)
  }, [resetCCIPState, tokenType])

  // Render progress bar for CCIP operations
  const renderCCIPProgress = () => {
    if (ccipState.status === "idle") return null

    const shouldShowProgress = ccipState.status === "tx_pending" || 
                              ccipState.status === "ccip_processing" || 
                              ccipState.status === "wallet_pending"

    if (!shouldShowProgress) return null

    return (
      <div className="bg-blue-500/10 border border-blue-400/30 rounded p-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <p className="font-body text-blue-400 text-xs font-medium">
              🌊 Cross-Chain Volatility Request
            </p>
            {/* Outbound (Monad → Avalanche) message */}
            {ccipState.messageId && ccipState.messageId.length === 66 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => window.open(`https://ccip.chain.link/msg/${ccipState.messageId}`, "_blank")}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 text-blue-300 hover:text-blue-200" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                  <p className="font-body text-xs">View outbound CCIP request</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Inbound (Avalanche → Monad) response message */}
            {ccipState.ccipResponseMessageId && ccipState.ccipResponseMessageId.length === 66 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => window.open(`https://ccip.chain.link/msg/${ccipState.ccipResponseMessageId}`, "_blank")}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 text-purple-300 hover:text-purple-200" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                  <p className="font-body text-xs">View inbound CCIP response</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          {/* Removed loading dots */}
        </div>
        <Progress 
          value={ccipState.progress} 
          className="h-2 bg-white/10"
          style={{
            background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 50%, rgba(6, 182, 212, 0.2) 100%)'
          }}
        />
        <p className="font-body text-blue-200 text-xs animate-pulse">
          {ccipState.currentPhase ? `Phase: ${ccipState.currentPhase}` : "Processing..."}
        </p>
      </div>
    )
  }

  // Render success state
  const renderSuccessState = () => {
    if (ccipState.status !== "success") return null

    return (
      <div className="bg-green-500/10 border border-green-400/30 rounded p-2 space-y-1">
        <p className="font-body text-green-400 text-xs font-medium">✅ CCIP Volatility Complete</p>
        <p className="font-body text-green-300 text-xs">
          Drip adjusted: {formatBalance(tokenState.baseDripAmount)} → {formatBalance(tokenState.currentDripAmount)} {config.symbol}
        </p>
        <p className="font-body text-green-200 text-xs">
          Tank refilled successfully!
        </p>
      </div>
    )
  }

  // Render error state
  const renderErrorState = () => {
    if (ccipState.status !== "failed") return null

    return (
      <div className="bg-red-500/10 border border-red-400/30 rounded p-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="font-body text-red-400 text-xs font-medium">❌ Request Failed</p>
            <p className="font-body text-red-300 text-xs">{ccipState.errorMessage}</p>
          </div>
          <Button
            onClick={handleDismissError}
            size="sm"
            variant="ghost"
            className="h-5 w-5 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20 ml-2"
          >
            ✕
          </Button>
        </div>
      </div>
    )
  }

  // Render stuck state
  const renderStuckState = () => {
    if (ccipState.status !== "stuck") return null

    return (
      <div className="bg-amber-500/10 border border-amber-400/30 rounded p-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-3 w-3 text-amber-400" />
            <div>
              <p className="font-body text-amber-400 text-xs font-medium whitespace-nowrap">
                CCIP Transaction Stuck in {ccipState.currentPhase || 'unknown'}
              </p>
              <p className="font-body text-amber-300 text-xs">
                Stuck in: {ccipState.currentPhase || 'monad_confirm'}
              </p>
            </div>
          </div>
          {/* removed pulsing dots */}
        </div>
        
        {/* Compact Action Buttons - matching drip/refuel button style */}
        <div className="flex gap-2">
          <Button
            onClick={handleRefill}
            size="sm"
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 font-body font-medium transition-all duration-200"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            <span className="text-xs">Retry</span>
          </Button>
          
          {isOwner && (
            <Button
              onClick={handleDismissError}
              size="sm"
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 font-body font-medium transition-all duration-200"
            >
              <Shield className="h-3 w-3 mr-1" />
              <span className="text-xs">Reset</span>
            </Button>
          )}
        </div>
        
        {ccipState.errorMessage && (
          <p className="font-body text-amber-200 text-xs opacity-80">
            {ccipState.errorMessage}
          </p>
        )}
      </div>
    )
  }

  return (
    <Card className="relative overflow-hidden border-white/20 bg-black/20 backdrop-blur-sm">
      <div className={`absolute inset-0 bg-gradient-to-br ${config.color} opacity-5`} />
      <CardContent className="relative p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${config.color} bg-opacity-20`}>
              <img 
                src={config.iconUrl} 
                alt={config.name} 
                className="h-5 w-5 rounded-full border border-white/40"
                onError={(e) => {
                  // Fallback to text if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = document.createElement('span');
                  fallback.className = 'text-white text-xs font-bold flex items-center justify-center h-5 w-5 rounded-full border border-white/40';
                  fallback.textContent = config.symbol.charAt(0);
                  target.parentNode?.appendChild(fallback);
                }}
              />
            </div>
            <div>
              <h3 className="font-body text-white font-semibold text-lg">{config.symbol}</h3>
              <p className="font-body text-white/60 text-sm">{config.name}</p>
            </div>
          </div>
          
          {/* Balance Display */}
          <div className="text-right">
            <p className="font-body text-white/70 text-xs">Your Balance</p>
            <p className="font-body text-white font-semibold">
              {formatBalance(userBalance)} {config.symbol}
            </p>
          </div>
        </div>

        {/* Tank Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-body text-white/70 text-sm">Tank Status</span>
            <span className={`font-body text-sm font-medium ${isBelowThreshold ? 'text-red-400' : 'text-green-400'}`}>
              {tankPercentage}% ({formatBalance(tokenState.tankBalance)}/{formatBalance(tokenState.maxTankBalance)})
            </span>
          </div>
          
          <Progress 
            value={tankPercentage} 
            className="h-3"
            style={{
              background: tankPercentage < 10 ? 'rgba(239, 68, 68, 0.2)' : 
                         tankPercentage < 30 ? 'rgba(245, 158, 11, 0.2)' : 
                         'rgba(34, 197, 94, 0.2)'
            }}
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {/* Drip Button */}
          <Button
            onClick={handleDrip}
            disabled={dripButtonState.disabled}
            className={`font-body font-medium transition-all duration-200 ${
              dripButtonState.isGasFree 
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 text-white border-0'
                : dripButtonState.isEmpty
                ? 'bg-gray-600 hover:bg-gray-700 text-white border-0'
                : `bg-gradient-to-r ${config.color} hover:opacity-90 text-white border-0`
            }`}
            size="sm"
          >
            {dripButtonState.loading && <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-2" />}
            {dripButtonState.isGasFree && <Zap className="h-3 w-3 mr-1" />}
            <span className="text-xs">{dripButtonState.text}</span>
          </Button>

          {/* Refill Button */}
          <Button
            onClick={handleRefill}
            disabled={refillButtonState.disabled}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 font-body font-medium transition-all duration-200"
            size="sm"
          >
            <Fuel className="h-3 w-3 mr-1" />
            <span className="text-xs">{refillButtonState.text}</span>
          </Button>
        </div>

        {/* Status Messages */}
        <div className="space-y-2">
          {renderCCIPProgress()}
          {renderStuckState()}
          {renderSuccessState()}
          {renderErrorState()}
        </div>

        {/* Contract Info */}
        <div className="bg-white/5 rounded-lg p-3 space-y-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="font-body text-white/70 text-xs">Contract:</span>
            <div className="flex items-center space-x-1">
              <code className="font-mono text-white text-xs">
                {tokenState.contractAddress.slice(0, 6)}...{tokenState.contractAddress.slice(-4)}
              </code>
              <Button
                onClick={() => handleCopyAddress(tokenState.contractAddress)}
                size="sm"
                variant="ghost"
                className="h-4 w-4 p-0 text-white/60 hover:text-white"
              >
                {copiedAddresses[tokenState.contractAddress] ? 
                  <Check className="h-3 w-3" /> : 
                  <Copy className="h-3 w-3" />
                }
              </Button>
              <Button
                onClick={() => handleOpenExplorer(tokenState.contractAddress)}
                size="sm"
                variant="ghost"
                className="h-4 w-4 p-0 text-white/60 hover:text-white"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-center space-x-4">
            {/* Drip amount */}
            <div className="flex items-center space-x-1">
              <span className="font-body text-white text-sm font-medium">
                Drips: {formatBalance(tokenState.currentDripAmount)} {config.symbol}
              </span>
              {/* isAmountReduced and isAmountIncreased are not defined in the original file,
                  so these lines are commented out to avoid errors. */}
              {/* {isAmountReduced && <TrendingDown className="h-3 w-3 text-red-400" />} */}
              {/* {isAmountIncreased && <TrendingUp className="h-3 w-3 text-green-400" />} */}
            </div>

            {/* Divider */}
            <span className="font-body text-white/40">|</span>

            {/* Available balance */}
            <span className="font-body text-white/80 text-sm font-medium">
              Available: {formatBalance(tokenState.tankBalance)} {config.symbol}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

TokenCard.displayName = "TokenCard" 