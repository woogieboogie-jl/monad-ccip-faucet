
import { useMemo, useCallback, useEffect } from "react"
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
import { useRequireMonad } from '@/hooks/use-require-monad'
import { useAutoCooldownManager } from "@/hooks/use-cooldown-manager"
import { getFaucetSnapshot } from "@/lib/faucetClient"
import { formatEther } from "viem"
import { Copy, ExternalLink, Fuel, TrendingUp, TrendingDown, Info, CheckCircle, AlertTriangle, Coins, Droplets, Check, Zap, RefreshCw, Shield } from "lucide-react"
import { formatBalance } from "@/lib/utils"
import { getCCIPPhaseText, getCCIPPhaseTooltip } from "@/lib/ccip-utils"


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

/**
 * FaucetSection - Main faucet interface component
 * 
 * PHASE 4D: Optimized with memoization and performance improvements
 * 
 * Features:
 * - Dual-token faucet (MON/LINK) with dynamic drip amounts
 * - Network validation and user guidance
 * - CCIP-based cross-chain volatility updates
 * - Gas-free transactions for new users
 * - Real-time balance updates and cooldown management
 * 
 * Performance optimizations:
 * - Memoized button state calculations
 * - Optimized event handlers with useCallback
 * - Selective Zustand subscriptions
 * - Reduced console.log noise in production
 * 
 * @param props - Component props including wallet state and handlers
 * @returns JSX element for the faucet interface
 */
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
  
  // PHASE 4A: CCIP refill hooks - moved out of useMemo to fix Rules of Hooks violation
  const monCCIPRefill = useCCIPRefill(
    "mon",
    monTokenState.tankBalance,
    monTokenState.maxTankBalance,
    useCallback((volatilityMultiplier: number, refillAmount: number) => {
      updateGlobalVolatility(volatilityMultiplier)
      refillTankFromVault("mon", refillAmount)
    }, [updateGlobalVolatility, refillTankFromVault])
  )
  
  const linkCCIPRefill = useCCIPRefill(
    "link", 
    linkTokenState.tankBalance,
    linkTokenState.maxTankBalance,
    useCallback((volatilityMultiplier: number, refillAmount: number) => {
      updateGlobalVolatility(volatilityMultiplier)
      refillTankFromVault("link", refillAmount)
    }, [updateGlobalVolatility, refillTankFromVault])
  )
  
  // PHASE 4A: Memoize clipboard and explorer functions to prevent re-creation
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedAddress(text, true)
    setTimeout(() => {
      setCopiedAddress(text, false)
    }, 2000) // Reset after 2 seconds
  }, [setCopiedAddress])

  const openExplorer = useCallback((address: string) => {
    window.open(`https://testnet.monadexplorer.com/address/${address}`, "_blank")
  }, [])

  // PHASE 4A: Memoize network check to prevent constant re-evaluation
  const requireMonad = useRequireMonad()
  const isCorrectNetwork = useMemo(() => requireMonad(), [requireMonad])

  // PHASE 4A: Memoize expensive button state calculations
  const getDripButtonState = useCallback((tokenType: "mon" | "link") => {
    const tokenState = tokenType === 'mon' ? monTokenState : linkTokenState

    if (!wallet.isConnected) {
      return { text: "Connect Wallet", disabled: true, isGasFree: false }
    }

    // Check network compatibility first - disable button if on wrong network
    if (!isCorrectNetwork) {
      return { text: "Wrong Network", disabled: true, isGasFree: false, wrongNetwork: true }
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
  }, [wallet.isConnected, wallet.monBalance, isCorrectNetwork, monTokenState, linkTokenState, formatCooldown])

  const getFuelButtonState = useCallback((tokenType: "mon" | "link") => {
    const tokenState = tokenType === 'mon' ? monTokenState : linkTokenState
    const ccipRefill = tokenType === "mon" ? monCCIPRefill : linkCCIPRefill
    // Use memoized network check instead of calling requireMonad() again
    // Use vault balances from Zustand store (updated by fetchAllFaucetData)
    const vaultEmpty = tokenType === "mon" ? vaultBalances.mon === 0 : vaultBalances.link === 0

    if (!wallet.isConnected) {
      return { text: "Connect Wallet", disabled: true, canRequest: false }
    }

    // Check network compatibility first - disable button if on wrong network
    if (!isCorrectNetwork) {
      return { text: "Wrong Network", disabled: true, canRequest: false, wrongNetwork: true }
    }

    // CRITICAL FIX: Check for any active CCIP state first
    if (ccipRefill.refillState.status === "wallet_pending") {
      return { text: "Confirm in Wallet", disabled: true, canRequest: false }
    }

    if (ccipRefill.refillState.status === "tx_pending") {
      return { text: "Transaction Pending", disabled: true, canRequest: false }
    }

    if (ccipRefill.refillState.status === "ccip_processing") {
      return { text: "CCIP Processing", disabled: true, canRequest: false }
    }

    if (ccipRefill.refillState.status === "success") {
      return { text: "Request Complete", disabled: true, canRequest: false }
    }

    if (ccipRefill.refillState.status === "failed") {
      return { text: "Request Failed - Try Again", disabled: false, canRequest: true }
    }

    if (ccipRefill.refillState.status === "stuck") {
      return { text: "Request Stuck - Try Again", disabled: false, canRequest: true }
    }

    if (vaultEmpty) {
      return { text: "Vault is Empty", disabled: true, canRequest: false }
    }

    if (tokenState.requestCooldownTime > 0) {
      return { text: formatCooldown(tokenState.requestCooldownTime), disabled: true, canRequest: false }
    }

    const isBelowThreshold = tokenState.tankBalance <= tokenState.lowTankThreshold
    return {
      text: isBelowThreshold ? "Request Volatility & Refill" : "Tank Above Threshold",
      disabled: !isBelowThreshold,
      canRequest: isBelowThreshold,
    }
  }, [wallet.isConnected, isCorrectNetwork, monTokenState, linkTokenState, monCCIPRefill, linkCCIPRefill, vaultBalances, formatCooldown])

  // Memoized values to prevent flickering - use boolean states instead of exact countdown values
  const anyRequestActive = useMemo(() => 
    monCCIPRefill.refillState.status === "tx_pending" || 
    monCCIPRefill.refillState.status === "ccip_processing" ||
    linkCCIPRefill.refillState.status === "tx_pending" || 
    linkCCIPRefill.refillState.status === "ccip_processing"
  , [monCCIPRefill.refillState.status, linkCCIPRefill.refillState.status])

  // PHASE 4A: Memoize button states to prevent expensive recalculations
  const monDripButtonState = useMemo(() => getDripButtonState("mon"), [getDripButtonState])
  const linkDripButtonState = useMemo(() => getDripButtonState("link"), [getDripButtonState])
  const monFuelButtonState = useMemo(() => getFuelButtonState("mon"), [getFuelButtonState])
  const linkFuelButtonState = useMemo(() => getFuelButtonState("link"), [getFuelButtonState])

  // PHASE 4A: Memoize event handlers to prevent re-creation
  const handleMonDrip = useCallback(() => {
    console.log('[handleMonDrip] called')
    if (monDripButtonState.isGasFree) {
      setGasFreeModalOpen(true)
    } else {
      dripTokens("mon")
    }
  }, [monDripButtonState.isGasFree, setGasFreeModalOpen, dripTokens])

  const handleLinkDrip = useCallback(() => {
    dripTokens("link")
  }, [dripTokens])

  const handleFuelButtonClick = useCallback((tokenType: "mon" | "link") => {
    setVolatilityUpdating(true)
    
    // Use the new CCIP refill hooks
    if (tokenType === "mon") {
      monCCIPRefill.triggerUniversalVolatilityAndRefill()
    } else {
      linkCCIPRefill.triggerUniversalVolatilityAndRefill()
    }
  }, [setVolatilityUpdating, monCCIPRefill, linkCCIPRefill])

  const { setDripCooldown } = useAutoCooldownManager()

  // PHASE 4A: Memoize gas-free success handler
  const handleGasFreeSuccess = useCallback(async () => {
    // 1) Optimistically bump wallet balance in parent component
    updateMonBalance(faucet.mon.currentDripAmount)

    // 2) REMOVED: Optimistic tank balance update - instead show refreshing state
    const { updateTokenState } = useFaucetStore.getState()
    
    updateTokenState('mon', { 
      isRefreshing: true  // Show spinner while refreshing tank balance
    })

    try {
      // 3) Read on-chain cooldown so we avoid hard-coding any value
      const snap = await getFaucetSnapshot(wallet.address as `0x${string}` | undefined)
      const contractCooldown = snap.constants.cooldown // seconds

      // 4) Start local countdown timer via centralized cooldown manager
      setDripCooldown('mon', contractCooldown)
      
      // 5) FIXED: Immediately refresh tank balance from contract (no optimistic update)
      try {
        const freshSnap = await getFaucetSnapshot(wallet.address as `0x${string}` | undefined)
        const freshTankBalance = Number(formatEther(freshSnap.mon.pool))
        
        updateTokenState('mon', { 
          tankBalance: freshTankBalance,
          isRefreshing: false  // Remove refreshing state
        })
      } catch (refreshError) {
        console.error('Failed to refresh tank balance:', refreshError)
        updateTokenState('mon', { isRefreshing: false })
      }
    } catch (e) {
      console.warn('Gas-free handler: failed to fetch snapshot for cooldown, will rely on periodic refresh', e)
      updateTokenState('mon', { isRefreshing: false })
    }
  }, [updateMonBalance, faucet.mon.currentDripAmount, wallet.address, setDripCooldown])

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

  // Enhanced drip action with better animation
  const handleDripWithAnimation = (tokenType: "mon" | "link") => {
    // Trigger the enhanced animation
    setDripState(tokenType, true)
    
    // Call the actual drip function
    if (tokenType === "mon") {
      handleMonDrip()
    } else {
      handleLinkDrip()
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
                            : "bg-blue-500/20 to-cyan-500/20 text-blue-300 hover:from-blue-500/30 hover:to-cyan-500/30 hover:text-blue-200 border-blue-500/40 hover:border-blue-400/60"
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
                        {(dripButtonState as any).wrongNetwork 
                          ? "Please switch to Monad Testnet to use the faucet" 
                          : (dripButtonState as any).isEmpty 
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
                <div className="flex items-center space-x-2">
                  <span className="font-body text-white text-xs font-semibold">
                    {formatBalance(faucet[tokenType].tankBalance)} {symbol}
                  </span>
                  {tokenState.isRefreshing && (
                    <div className="animate-spin h-3 w-3 border border-white/40 border-t-white rounded-full" />
                  )}
                </div>
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
                    <p className="font-body text-green-400 text-xs font-medium">✅ CCIP Volatility Request Complete</p>
                    <div className="flex items-center space-x-2">
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => ccipRefill.resetToIdle()}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                          >
                            <span className="text-green-300 hover:text-green-200 text-xs">✕</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                          <p className="font-body text-xs">Dismiss success message</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <p className="font-body text-green-300 text-xs">
                    Market Volatility: {ccipRefill.refillState.volatilityData?.score || 0}/100 ({ccipRefill.refillState.volatilityData?.trend || "stable"})
                  </p>
                  <p className="font-body text-green-200 text-xs">
                    Drip adjusted: {tokenState.baseDripAmount} → {ccipRefill.refillState.newDripAmount || tokenState.currentDripAmount} {symbol}
                    ({ccipRefill.refillState.newDripAmount ? 
                      (ccipRefill.refillState.newDripAmount > tokenState.baseDripAmount ? '+' : '') +
                      Math.round(((ccipRefill.refillState.newDripAmount / tokenState.baseDripAmount) - 1) * 100) + '%'
                      : '0%'
                    })
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
