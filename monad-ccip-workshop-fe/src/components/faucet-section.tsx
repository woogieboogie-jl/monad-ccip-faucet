
import { useState, useMemo, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { GasFreeModal } from "@/components/gas-free-modal"
import { useFaucet } from "@/hooks/use-faucet"
// CONSOLIDATION: Use Zustand UI state instead of local useState
import { useTokenState, useVaultState, useUIState, useFaucetStore } from "@/store/faucet-store"
import { useGlobalCCIP } from "@/hooks/use-global-ccip"
import { useCCIPRefill } from "@/hooks/use-ccip-refill"
import { useBatchOperations } from "@/hooks/use-batch-operations"
import { Copy, ExternalLink, Fuel, TrendingUp, TrendingDown, Info, CheckCircle, AlertTriangle, Coins, Droplets, Check, Zap, RefreshCw, Shield } from "lucide-react"
import { formatBalance } from "@/lib/utils"


interface WalletState {
  address: string | null
  isConnected: boolean
  isOwner: boolean
  monBalance: number
  linkBalance: number
}

interface FaucetSectionProps {
  wallet: WalletState
  updateMonBalance: (balance: number) => void
  volatilityMultiplier: number
  volatilityReasoning: string
  updateGlobalVolatility: (volatility: number) => void
  setVolatilityUpdating: (updating: boolean) => void
}

export function FaucetSection({
  wallet,
  updateMonBalance,
  volatilityMultiplier,
  volatilityReasoning,
  updateGlobalVolatility,
  setVolatilityUpdating,
}: FaucetSectionProps) {
  const {
    faucet,
    dripTokens,
    refillTankFromVault,
    formatCooldown,
    isTankLow,
  } = useFaucet()
  
  // Read tank balances from Zustand store instead of local state
  const monTokenState = useTokenState('mon')
  const linkTokenState = useTokenState('link')
  const vaultBalances = useVaultState()
  
  // CONSOLIDATION: Use Zustand UI state instead of local useState
  const { isGasFreeModalOpen, copiedAddresses, dripStates } = useUIState()
  const { setGasFreeModalOpen, setCopiedAddress, setDripState } = useFaucetStore()

  // Global CCIP state for backward compatibility (only used for legacy components)
  const { globalCCIP } = useGlobalCCIP()
  
  // New CCIP refill hooks for each token
  const monCCIPRefill = useCCIPRefill(
    "mon",
    monTokenState.tankBalance,
    monTokenState.maxTankBalance,
    (volatilityMultiplier, refillAmount) => {
      updateGlobalVolatility(volatilityMultiplier)
      refillTankFromVault("mon", refillAmount)
    }
  )
  
  const linkCCIPRefill = useCCIPRefill(
    "link", 
    linkTokenState.tankBalance,
    linkTokenState.maxTankBalance,
    (volatilityMultiplier, refillAmount) => {
      updateGlobalVolatility(volatilityMultiplier)
      refillTankFromVault("link", refillAmount)
    }
  )
  
  // const [dripStates, setDripStates] = useState<{ mon: boolean; link: boolean }>({ mon: false, link: false })
  // const [copiedAddresses, setCopiedAddresses] = useState<{ [key: string]: boolean }>({})

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAddress(text, true)
    setTimeout(() => {
      setCopiedAddress(text, false)
    }, 2000) // Reset after 2 seconds
  }

  const openExplorer = (address: string) => {
    window.open(`https://testnet.monadexplorer.com/address/${address}`, "_blank")
  }

  const getDripButtonState = (tokenType: "mon" | "link") => {
    const tokenState = tokenType === 'mon' ? monTokenState : linkTokenState

    if (!wallet.isConnected) {
      return { text: "Connect Wallet", disabled: true, isGasFree: false }
    }

    // Check if tank is empty or insufficient for drip (use Zustand store data)
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

    // New user with zero balance - show gas-free option for MON drip only
    if (wallet.monBalance === 0 && tokenType === "mon") {
      return { text: "Get First MON (Gas-Free)", disabled: false, isGasFree: true }
    }

    // FIXED: Use Zustand store for loading and cooldown checks instead of local state
    if (tokenState.isDripLoading) {
      return { text: "Dripping...", disabled: true, loading: true, isGasFree: false }
    }

    if (tokenState.dripCooldownTime > 0) {
      return { text: formatCooldown(tokenState.dripCooldownTime), disabled: true, isGasFree: false }
    }

    return { text: "Drip", disabled: false, isGasFree: false }
  }

  const getFuelButtonState = (tokenType: "mon" | "link") => {
    const tokenState = tokenType === 'mon' ? monTokenState : linkTokenState
    const ccipRefill = tokenType === "mon" ? monCCIPRefill : linkCCIPRefill
    // Use vault balances from Zustand store (updated by fetchAllFaucetData)
    const vaultEmpty = tokenType === "mon" ? vaultBalances.mon === 0 : vaultBalances.link === 0

    if (!wallet.isConnected) {
      return { text: "Connect Wallet", disabled: true, canRequest: false }
    }

    // Check if any CCIP refill is active
    if (ccipRefill.refillState.status === "tx_pending" || 
        ccipRefill.refillState.status === "ccip_processing" ||
        ccipRefill.refillState.status === "wallet_pending") {
      return { text: "Refill in progress", disabled: true, canRequest: false }
    }

    // if vault is empty disable fuel request button
    if (vaultEmpty) {
      return { text: "Vault is Empty", disabled: true, canRequest: false }
    }

    // FIXED: Use Zustand store for cooldown check instead of local state
    if (tokenState.requestCooldownTime > 0) {
      return { text: formatCooldown(tokenState.requestCooldownTime), disabled: true, canRequest: false }
    }

    const isBelowThreshold = isTankLow(tokenType)
    return {
      text: isBelowThreshold ? "Request Volatility & Refill" : "Tank Above Threshold",
      disabled: !isBelowThreshold,
      canRequest: isBelowThreshold,
    }
  }

  // Memoized values to prevent flickering - use boolean states instead of exact countdown values
  const anyRequestActive = useMemo(() => 
    monCCIPRefill.refillState.status === "tx_pending" || 
    monCCIPRefill.refillState.status === "ccip_processing" ||
    linkCCIPRefill.refillState.status === "tx_pending" || 
    linkCCIPRefill.refillState.status === "ccip_processing"
  , [monCCIPRefill.refillState.status, linkCCIPRefill.refillState.status])
  
  // Stable boolean states for cooldowns (only change when cooldown starts/ends, not every second)
  const monDripOnCooldown = useMemo(() => monTokenState.dripCooldownTime > 0, [monTokenState.dripCooldownTime > 0])
  const linkDripOnCooldown = useMemo(() => linkTokenState.dripCooldownTime > 0, [linkTokenState.dripCooldownTime > 0])
  const monRequestOnCooldown = useMemo(() => monTokenState.requestCooldownTime > 0, [monTokenState.requestCooldownTime > 0])
  const linkRequestOnCooldown = useMemo(() => linkTokenState.requestCooldownTime > 0, [linkTokenState.requestCooldownTime > 0])
  
  // Memoized formatCooldown results to prevent constant string generation - FIXED: Use Zustand store
  const monDripCooldownText = useMemo(() => formatCooldown(monTokenState.dripCooldownTime), [Math.floor(monTokenState.dripCooldownTime / 5)]) // Update every 5 seconds
  const linkDripCooldownText = useMemo(() => formatCooldown(linkTokenState.dripCooldownTime), [Math.floor(linkTokenState.dripCooldownTime / 5)])
  const monRequestCooldownText = useMemo(() => formatCooldown(monTokenState.requestCooldownTime), [Math.floor(monTokenState.requestCooldownTime / 5)])
  const linkRequestCooldownText = useMemo(() => formatCooldown(linkTokenState.requestCooldownTime), [Math.floor(linkTokenState.requestCooldownTime / 5)])
  
  // Memoized button states with precise dependencies
  const monDripButtonState = useMemo(() => {
    if (!wallet.isConnected) {
      return { text: "Connect Wallet", disabled: true, isGasFree: false }
    }

    if (monTokenState.tankBalance <= 0) {
      return { text: "Tank Empty - Use Refuel", disabled: true, isGasFree: false, isEmpty: true }
    }
    
    if (monTokenState.tankBalance < monTokenState.currentDripAmount) {
      return { 
        text: `Insufficient Tank (${formatBalance(monTokenState.tankBalance)} < ${formatBalance(monTokenState.currentDripAmount)})`, 
        disabled: true, 
        isGasFree: false, 
        isEmpty: true 
      }
    }

    if (wallet.monBalance === 0) {
      return { text: "Get First MON (Gas-Free)", disabled: false, isGasFree: true }
    }

    if (monTokenState.isDripLoading) {
      return { text: "Dripping...", disabled: true, loading: true, isGasFree: false }
    }

    if (monDripOnCooldown) {
      return { text: monDripCooldownText, disabled: true, isGasFree: false }
    }

    return { text: "Drip", disabled: false, isGasFree: false }
  }, [wallet.isConnected, wallet.monBalance, monTokenState.tankBalance, monTokenState.currentDripAmount, monTokenState.isDripLoading, monDripOnCooldown, monDripCooldownText])

  const linkDripButtonState = useMemo(() => {
    if (!wallet.isConnected) {
      return { text: "Connect Wallet", disabled: true, isGasFree: false }
    }

    if (linkTokenState.tankBalance <= 0) {
      return { text: "Tank Empty - Use Refuel", disabled: true, isGasFree: false, isEmpty: true }
    }
    
    if (linkTokenState.tankBalance < linkTokenState.currentDripAmount) {
      return { 
        text: `Insufficient Tank (${formatBalance(linkTokenState.tankBalance)} < ${formatBalance(linkTokenState.currentDripAmount)})`, 
        disabled: true, 
        isGasFree: false, 
        isEmpty: true 
      }
    }

    if (linkTokenState.isDripLoading) {
      return { text: "Dripping...", disabled: true, loading: true, isGasFree: false }
    }

    if (linkDripOnCooldown) {
      return { text: linkDripCooldownText, disabled: true, isGasFree: false }
    }

    return { text: "Drip", disabled: false, isGasFree: false }
  }, [wallet.isConnected, linkTokenState.tankBalance, linkTokenState.currentDripAmount, linkTokenState.isDripLoading, linkDripOnCooldown, linkDripCooldownText])

  const monFuelButtonState = useMemo(() => {
    if (!wallet.isConnected) {
      return { text: "Connect Wallet", disabled: true, canRequest: false }
    }

    if (anyRequestActive) {
      return { text: "Refill in progress", disabled: true, canRequest: false }
    }

    if (vaultBalances.mon === 0){
      return { text: "Vault is Empty", disabled: true, canRequest: false }
    }

    if (monRequestOnCooldown) {
      return { text: monRequestCooldownText, disabled: true, canRequest: false }
    }

    const isBelowThreshold = monTokenState.tankBalance <= monTokenState.lowTankThreshold
    return {
      text: isBelowThreshold ? "Request Volatility & Refill" : "Tank Above Threshold",
      disabled: !isBelowThreshold,
      canRequest: isBelowThreshold,
    }
  }, [wallet.isConnected, anyRequestActive, vaultBalances.mon, monRequestOnCooldown, monRequestCooldownText, monTokenState.tankBalance, monTokenState.lowTankThreshold])

  const linkFuelButtonState = useMemo(() => {
    if (!wallet.isConnected) {
      return { text: "Connect Wallet", disabled: true, canRequest: false }
    }

    if (anyRequestActive) {
      return { text: "Refill in progress", disabled: true, canRequest: false }
    }

    if (vaultBalances.link === 0){
      return { text: "Vault is Empty", disabled: true, canRequest: false }
    }

    if (linkRequestOnCooldown) {
      return { text: linkRequestCooldownText, disabled: true, canRequest: false }
    }

    const isBelowThreshold = linkTokenState.tankBalance <= linkTokenState.lowTankThreshold
    return {
      text: isBelowThreshold ? "Request Volatility & Refill" : "Tank Above Threshold",
      disabled: !isBelowThreshold,
      canRequest: isBelowThreshold,
    }
  }, [wallet.isConnected, anyRequestActive, vaultBalances.link, linkRequestOnCooldown, linkRequestCooldownText, linkTokenState.tankBalance, linkTokenState.lowTankThreshold])

  // Enhanced drip action with useCallback to prevent re-renders
  const handleMonDrip = useCallback(() => {
    if (monDripButtonState.isGasFree) {
      setGasFreeModalOpen(true)
    } else {
      dripTokens("mon")
    }
  }, [monDripButtonState.isGasFree, dripTokens, setGasFreeModalOpen])

  const handleFuelButtonClick = (tokenType: "mon" | "link") => {
    setVolatilityUpdating(true)
    
    // Use the new CCIP refill hooks
    if (tokenType === "mon") {
      monCCIPRefill.triggerUniversalVolatilityAndRefill()
    } else {
      linkCCIPRefill.triggerUniversalVolatilityAndRefill()
    }
  }

  const handleGasFreeSuccess = () => {
    // Update the UI balance - the AA transaction already sent the tokens
    updateMonBalance(faucet.mon.currentDripAmount)
    
    // Just refresh the faucet state to get updated cooldowns and tank balance
    // Don't call dripTokens() again since the AA UserOperation already did the drip
    // The refreshMonBalance in HomePage will fetch the real balance from blockchain
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    if (diffInMinutes < 1) return "Just now"
    if (diffInMinutes === 1) return "1 minute ago"
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours === 1) return "1 hour ago"
    return `${diffInHours} hours ago`
  }

  const getCCIPPhaseText = (phase?: string) => {
    switch (phase) {
      case "wallet_confirm":
        return "⚡ Wallet confirmation..."
      case "monad_confirm":
        return "🔗 CCIP Transaction sent..."
      case "ccip_pending":
        return "🌐 CCIP transaction pending..."
      case "ccip_confirmed":
        return "📡 CCIP transaction confirmed on Monad..."
      case "avalanche_confirm":
        return "⌛ Waiting for finality from Monad..."
      case "ccip_response":
        return "📡 Waiting for finality from Avalanche..."
      case "monad_refill":
        return "🔄 Refilling tank..."
      default:
        return "Processing..."
    }
  }

  const getCCIPPhaseTooltip = (phase?: string) => {
    switch (phase) {
      case "wallet_confirm":
        return "Waiting for wallet confirmation"
      case "monad_confirm":
        return "Transaction submitted to Monad - waiting for confirmation"
      case "ccip_pending":
        return "CCIP message pending - cross-chain request initiated"
      case "ccip_confirmed":
        return "CCIP message confirmed - waiting for finality from Monad"
      case "avalanche_confirm":
        return "Volatility data request received from Monad"
      case "ccip_response":
        return "Waiting for Avalanche → Monad CCIP response (finality)"
      case "monad_refill":
        return "Refilling tank from vault based on volatility data"
      default:
        return "Processing cross-chain volatility request"
    }
  }

  // Enhanced drip action with better animation
  const handleDripWithAnimation = (tokenType: "mon" | "link") => {
    // Trigger the enhanced animation
    setDripState(tokenType, true)
    
    // Call the actual drip function
    if (tokenType === "mon") {
      handleMonDrip()
    } else {
      dripTokens(tokenType)
    }
    
    // Reset animation state after completion
    setTimeout(() => {
      setDripState(tokenType, false)
    }, 800)
  }

  const renderAssetCard = (tokenType: "mon" | "link") => {
    const tokenState = tokenType === 'mon' ? monTokenState : linkTokenState
    const token = faucet[tokenType]
    const symbol = tokenType.toUpperCase()
    const dripButtonState = tokenType === "mon" ? monDripButtonState : linkDripButtonState
    const fuelButtonState = tokenType === "mon" ? monFuelButtonState : linkFuelButtonState
    const ccipRefill = tokenType === "mon" ? monCCIPRefill : linkCCIPRefill

    // Show fuel button if tank is below 30% threshold
    const isBelowThreshold = tokenState.tankBalance <= tokenState.maxTankBalance * 0.3

    // Calculate tank percentage for progress bar
    const tankPercentage = Math.round((tokenState.tankBalance / tokenState.maxTankBalance) * 100)

    // Tank status color and text
    const getTankStatusColor = () => {
      if (tankPercentage < 30) return "text-red-400"
      if (tankPercentage < 60) return "text-yellow-400"
      return "text-green-400"
    }

    const getTankStatusText = () => {
      if (tankPercentage < 30) return "Critical"
      if (tankPercentage < 60) return "Low"
      return "Healthy"
    }

    const tankStatusColor = getTankStatusColor()
    const tankStatus = getTankStatusText()

    // Check if drip amount has changed due to volatility
    const isAmountReduced = tokenState.currentDripAmount < tokenState.baseDripAmount
    const isAmountIncreased = tokenState.currentDripAmount > tokenState.baseDripAmount

    // DEBUG: Log the current state to understand why progress bar might not show
    console.log(`🎯 ${symbol} renderAssetCard:`, {
      status: ccipRefill.refillState.status,
      progress: ccipRefill.refillState.progress,
      shouldShowProgress: ccipRefill.refillState.status === "tx_pending" || ccipRefill.refillState.status === "ccip_processing" || ccipRefill.refillState.status === "wallet_pending",
      currentPhase: ccipRefill.refillState.currentPhase,
      lastUpdated: ccipRefill.refillState.lastUpdated
    })

    return (
      <Card className={`bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-200 ${
        tokenType === "mon" ? "relative z-0 overflow-visible" : ""
      }`}>
        <CardContent className={`p-4 lg:p-6 ${
          tokenType === "mon" ? "overflow-visible" : ""
        }`}>
          <div className="space-y-4">
            {/* Asset Header - Clean without fuel button */}
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center">
                <h3 className="font-body text-2xl lg:text-3xl font-black text-white tracking-wide">{symbol}</h3>
              </div>

              {/* Tank Balance & Drip Amount Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-center space-x-4">
                  {/* Drip amount */}
                  <div className="flex items-center space-x-1">
                  <span className="font-body text-white text-sm font-medium">
                      Drips: {formatBalance(tokenState.currentDripAmount)} {symbol}
                  </span>
                  {isAmountReduced && <TrendingDown className="h-3 w-3 text-red-400" />}
                  {isAmountIncreased && <TrendingUp className="h-3 w-3 text-green-400" />}
                  </div>

                  {/* Divider */}
                  <span className="font-body text-white/40">|</span>

                  {/* Available - Fixed to use Zustand store */}
                  <span className="font-body text-white/80 text-sm font-medium">
                    Available: {formatBalance(tokenState.tankBalance)} {symbol}
                  </span>
                </div>

                {token.currentDripAmount !== token.baseDripAmount && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="cursor-help">
                        <p className="font-body text-xs font-medium text-green-300">
                          {isAmountReduced && `Reduced from ${formatBalance(token.baseDripAmount)} (volatility-adjusted)`}
                          {isAmountIncreased && `Increased from ${formatBalance(token.baseDripAmount)} (volatility-adjusted)`}
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

            {/* Minimized Contract Address - Single Line */}
            <div className="bg-white/5 rounded-lg p-2 flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                <span className="font-body text-white/70 text-xs font-medium whitespace-nowrap">Contract:</span>
                <code className="font-mono text-white text-xs truncate flex-1">
                  {token.contractAddress}
                </code>
              </div>
              <div className="flex space-x-1 ml-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => copyToClipboard(token.contractAddress)}
                      className={`p-1 hover:bg-white/10 rounded transition-all duration-200 ${
                        copiedAddresses[token.contractAddress] ? "bg-green-500/20" : ""
                      }`}
                    >
                      {copiedAddresses[token.contractAddress] ? (
                        <Check className="h-3 w-3 text-green-400" />
                      ) : (
                        <Copy className="h-3 w-3 text-white/70 hover:text-white" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                    <p className="font-body text-xs">{copiedAddresses[token.contractAddress] ? "Copied!" : "Copy address"}</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => openExplorer(token.contractAddress)}
                      className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                      <ExternalLink className="h-3 w-3 text-white/70 hover:text-white" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                    <p className="font-body text-xs">View on explorer</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Enhanced Drip Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-center">
                {wallet.monBalance === 0 && dripButtonState.isGasFree ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setGasFreeModalOpen(true)}
                        disabled={dripButtonState.disabled}
                        className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg gap-3 font-body cta-enhanced transition-all duration-200 border-2 ${
                          dripButtonState.disabled
                            ? "bg-white/5 border-white/20 text-white/40 cursor-not-allowed opacity-50"
                            : "bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 hover:from-green-500/30 hover:to-emerald-500/30 hover:text-green-200 border-white/40 hover:border-white/60"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <div className="relative">
                            <div className={`absolute inset-0 rounded-full ${
                              dripButtonState.disabled 
                                ? "bg-white/10" 
                                : "bg-green-400/20 animate-pulse"
                            }`}></div>
                            <Droplets className="h-4 w-4 relative z-0" />
                          </div>
                          <span className="font-body text-sm font-medium">{dripButtonState.text}</span>
                        </div>
                        <Info className={`h-3 w-3 transition-colors ${
                          dripButtonState.disabled
                            ? "text-white/40"
                            : "text-green-300 group-hover:text-green-200"
                        }`} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                      <p className="font-body text-xs">Your first transaction is sponsored by a Paymaster!</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleDripWithAnimation(tokenType)}
                        disabled={dripButtonState.disabled}
                        className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg gap-3 font-body cta-enhanced transition-all duration-200 border-2 ${
                          dripButtonState.disabled
                            ? "bg-white/5 border-white/20 text-white/40 cursor-not-allowed opacity-50"
                            : "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 hover:from-blue-500/30 hover:to-cyan-500/30 hover:text-blue-200 border-blue-500/40 hover:border-blue-400/60"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <div className="relative">
                            <div className={`absolute inset-0 rounded-full ${
                              dripButtonState.disabled 
                                ? "bg-white/10" 
                                : "bg-blue-400/20 animate-pulse"
                            }`}></div>
                            <Droplets className="h-4 w-4 relative z-0" />
                          </div>
                          <span className="font-body text-sm font-medium">{dripButtonState.text}</span>
                        </div>
                        <Info className={`h-3 w-3 transition-colors ${
                          dripButtonState.disabled
                            ? "text-white/40"
                            : "text-blue-300 group-hover:text-blue-200"
                        }`} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                      <p className="font-body text-xs">
                        {dripButtonState.isEmpty 
                          ? "Tank is empty or insufficient - use Refuel button below to fill from vault" 
                          : "Get tokens from the tank sent to your wallet"
                        }
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Tank Status Section with Enhanced Fuel Button */}
            <div className="bg-white/5 rounded-lg p-3 space-y-3 border-t border-white/10">
              {/* Tank Balance */}
              <div className="flex items-center justify-between">
                <span className="font-body text-white/70 text-xs font-medium">Tank Balance:</span>
                <span className="font-body text-white text-xs font-semibold">
                  {formatBalance(faucet[tokenType].tankBalance)} {symbol}
                </span>
              </div>

              {/* Status with Threshold in Tooltip */}
                <div className="flex items-center justify-between">
                <span className="font-body text-white/70 text-xs font-medium">Status:</span>
                <div className="flex items-center space-x-1">
                  <span className={`font-body text-xs font-medium ${tankStatusColor}`}>{tankStatus}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-white/50 hover:text-white/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                      <p className="font-body text-xs">
                        Threshold: {formatBalance(faucet[tokenType].maxTankBalance * 0.3)} {symbol}
                        <br />
                        Current: {formatBalance(faucet[tokenType].tankBalance)} {symbol}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Status Message with Enhanced Fuel Button */}
              <div className="text-xs">
                {isBelowThreshold ? (
                  <div className="flex items-center justify-between p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-3 w-3 text-yellow-400" />
                      <span className="font-body text-yellow-300 text-xs font-medium">
                        {fuelButtonState.text === "Vault is Empty" ? "Empty vault, contact admin" : "Tank needs refilling"}
                      </span>
                    </div>
                    {/* Enhanced Fuel Button with Info Icon Inside */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleFuelButtonClick(tokenType)}
                          disabled={!fuelButtonState.canRequest}
                          className={`group flex items-center justify-between px-3 py-2 rounded-lg gap-3 font-body cta-enhanced cta-fuel ${
                            !fuelButtonState.canRequest
                              ? "bg-white/5 border-white/20 text-white/40 cursor-not-allowed opacity-50"
                              : "bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 hover:from-orange-500/30 hover:to-red-500/30 hover:text-orange-200"
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <div className="relative">
                              <div className="absolute inset-0 bg-orange-400/20 rounded-full animate-pulse"></div>
                              <Fuel className="h-4 w-4 relative z-0" />
                            </div>
                            <span className="font-body text-xs font-medium">Refuel</span>
                          </div>
                          <Info className={`h-3 w-3 transition-opacity ${
                            !fuelButtonState.canRequest 
                              ? "text-white/40" 
                              : "text-orange-300 group-hover:text-orange-200"
                          }`} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                        <p className="font-body text-xs max-w-[200px]">Cross-chain tank refill via CCIP volatility request</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 p-2 bg-green-500/20 border border-green-400/30 rounded-lg">
                    <CheckCircle className="h-3 w-3 text-green-400" />
                    <span className="font-body text-green-300 text-xs font-medium">
                      Tank healthy - above threshold
                    </span>
                  </div>
                )}
              </div>

              {/* Progress for pending state - token specific */}
              {(ccipRefill.refillState.status === "tx_pending" || ccipRefill.refillState.status === "ccip_processing" || ccipRefill.refillState.status === "wallet_pending") && (
                <div className="space-y-2">
                  {/* Vibrant CCIP Progress Bar with Lightning Bolt and Animated Dots */}
                  <div className="bg-gradient-to-r from-blue-500/25 via-purple-500/25 to-cyan-500/25 rounded-lg p-3 border border-blue-400/40 shadow-lg shadow-blue-800/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative cursor-help">
                              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-bounce opacity-60"></div>
                              <Zap className="h-4 w-4 text-yellow-300 relative z-0 animate-bounce" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                            <p className="font-body text-xs max-w-[200px]">
                              {getCCIPPhaseTooltip(ccipRefill.refillState.currentPhase)}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        <span className="font-body text-transparent bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-xs font-semibold">
                          Cross-Chain Requests (CCIP)
                        </span>
                        {/* CCIP Explorer Link */}
                        {ccipRefill.refillState.ccipMessageId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => ccipRefill.openCCIPExplorer(ccipRefill.refillState.ccipMessageId!)}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                              >
                                <ExternalLink className="h-3 w-3 text-blue-300 hover:text-blue-200" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                              <p className="font-body text-xs">View on CCIP Explorer</p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* ENHANCED: Response Message Link (when available) */}
                        {ccipRefill.refillState.ccipResponseMessageId && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => ccipRefill.openCCIPExplorer(ccipRefill.refillState.ccipResponseMessageId!)}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                              >
                                <ExternalLink className="h-3 w-3 text-purple-300 hover:text-purple-200" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                              <p className="font-body text-xs">View response message on CCIP Explorer</p>
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {/* ENHANCED: Dynamic message display based on phase */}
                        {!ccipRefill.refillState.ccipMessageId && !ccipRefill.refillState.ccipResponseMessageId && (
                          <span className="font-body text-white/40 text-xs">
                            {ccipRefill.refillState.currentPhase === "wallet_confirm" ? "Preparing..." : 
                             ccipRefill.refillState.currentPhase === "monad_confirm" ? "Confirming..." : 
                             "Processing..."}
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-blue-400 rounded-full animate-ping"></div>
                        <div className="w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-1 h-1 bg-cyan-400 rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                    <Progress 
                      value={ccipRefill.refillState.progress} 
                      className="h-2 bg-white/10"
                      style={{
                        background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.2) 0%, rgba(147, 51, 234, 0.2) 50%, rgba(6, 182, 212, 0.2) 100%)'
                      }}
                    />
                    {/* Percentage label */}
                    <div className="flex justify-end">
                      <span className="font-body text-blue-200 text-xs font-semibold">
                        {ccipRefill.refillState.progress}%
                      </span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="font-body text-blue-200 text-xs mt-2 cursor-help animate-pulse">
                          {getCCIPPhaseText(ccipRefill.refillState.currentPhase)}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                        <p className="font-body text-xs max-w-[200px]">
                          {getCCIPPhaseTooltip(ccipRefill.refillState.currentPhase)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}

              {/* Success state - token specific */}
              {ccipRefill.refillState.status === "success" && (
                <div className="bg-green-500/10 border border-green-400/30 rounded p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-body text-green-400 text-xs font-medium">✅ CCIP Volatility Complete</p>
                    {ccipRefill.refillState.ccipMessageId && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => ccipRefill.openCCIPExplorer(ccipRefill.refillState.ccipMessageId!)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                          >
                            <ExternalLink className="h-3 w-3 text-green-300 hover:text-green-200" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                          <p className="font-body text-xs">View completed CCIP transaction</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <p className="font-body text-green-300 text-xs">
                    Market Volatility: {ccipRefill.refillState.volatilityData?.score || 0}/100 ({ccipRefill.refillState.volatilityData?.trend || "stable"})
                  </p>
                  <p className="font-body text-green-200 text-xs">
                    Drip adjusted: {tokenState.baseDripAmount} → {ccipRefill.refillState.newDripAmount} {symbol} 
                    ({ccipRefill.refillState.newDripAmount && ccipRefill.refillState.newDripAmount > tokenState.baseDripAmount ? '+' : ''}{((ccipRefill.refillState.newDripAmount || tokenState.baseDripAmount) / tokenState.baseDripAmount * 100 - 100).toFixed(0)}%)
                  </p>
                  <p className="font-body text-green-200 text-xs">
                    Tank refilled: +{ccipRefill.refillState.refillAmount?.toLocaleString() || 0} {symbol}
                  </p>
                </div>
              )}

              {/* Error state - token specific */}
              {ccipRefill.refillState.status === "failed" && (
                <div className="bg-red-500/10 border border-red-400/30 rounded p-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                  <p className="font-body text-red-400 text-xs font-medium">❌ Request Failed</p>
                  <p className="font-body text-red-300 text-xs">{ccipRefill.refillState.errorMessage}</p>
                    </div>
                    <Button
                      onClick={() => ccipRefill.resetToIdle()}
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 border-0 text-red-400 hover:text-red-300 hover:bg-red-500/20 ml-2"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              )}

              {/* Stuck state - token specific */}
              {ccipRefill.refillState.status === "stuck" && (
                <div className="bg-amber-500/10 border border-amber-400/30 rounded p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      <p className="font-body text-amber-400 text-xs font-medium whitespace-nowrap">
                        ⚠️ CCIP Transaction Stuck in {ccipRefill.refillState.stuckPhase || 'unknown'}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-amber-400 rounded-full animate-pulse"></div>
                        <div className="w-1 h-1 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                      </div>
                      
                      {wallet.isOwner && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => ccipRefill.renounceStuckTransaction()}
                              className="group flex items-center justify-center px-2 py-1 rounded-lg gap-1 font-body cta-enhanced cta-fuel bg-gradient-to-r from-red-500/20 to-red-500/20 text-red-300 hover:from-red-500/30 hover:to-red-500/30 hover:text-red-200 border border-red-500/40 hover:border-red-400/60 transition-all duration-200"
                            >
                              <Shield className="h-3 w-3" />
                              <span className="font-body text-xs font-medium">Reset</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="z-[9999]" side="bottom" sideOffset={5}>
                            <p className="font-body text-xs">Admin: Reset stuck transaction</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                  
                  {/* No detailed error description needed */}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        {/* Title Section - Centered in available space */}
        <div className="flex-1 flex items-center justify-center px-4 pt-24 pb-20 relative z-10">
          <div className="text-center space-y-3">
            {/* First Line */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black starwars-title whitespace-nowrap">
              KEEP CALM AND BUILD WITH
            </h1>
            
            {/* Second Line */}
            <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black starwars-title whitespace-nowrap">
              MON & LINK
            </h2>
          </div>
        </div>

        {/* Main Content Section */}
        <div className="container mx-auto px-4 space-y-6 lg:space-y-8 pb-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
            {/* MON Card */}
                {renderAssetCard("mon")}

            {/* LINK Card */}
                {renderAssetCard("link")}
              </div>
            </div>

        {/* Gas-Free Modal */}
          <GasFreeModal
            isOpen={isGasFreeModalOpen}
            onClose={() => setGasFreeModalOpen(false)}
            onSuccess={handleGasFreeSuccess}
          walletAddress={wallet.address || ""}
          dripAmount={faucet.mon.currentDripAmount}
          />
      </div>
    </TooltipProvider>
  )
}
