import { useState, useEffect } from "react"
import { FAUCET_ADDRESS, LINK_TOKEN_ADDRESS, MON_TOKEN_ADDRESS } from '@/lib/addresses'
import { parseAbi, encodeFunctionData, formatEther } from "viem"
import { getFaucetSnapshot } from '@/lib/faucetClient'
import { publicClient } from '@/lib/viem'
import { useWalletClient } from 'wagmi'
import { useAutoCooldownManager } from '@/hooks/use-cooldown-manager'
import { useFaucetStore, useTokenState, useVaultState, useVolatilityState } from '@/store/faucet-store'
import { useBatchOperations } from '@/hooks/use-batch-operations'
import { useRequireMonad } from '@/hooks/use-require-monad'
import { TokenState, FaucetState, GlobalVolatilityState } from '@/lib/types'

// CONSOLIDATION: Use unified interfaces from types.ts
// Removed duplicate interfaces: TokenState, FaucetState, GlobalVolatilityState

export function useFaucet() {
  // CONSOLIDATION: Read from Zustand store instead of maintaining local state
  const monTokenState = useTokenState('mon')
  const linkTokenState = useTokenState('link')
  const vaultBalances = useVaultState()
  const volatilityState = useVolatilityState()
  
  // Create the faucet object from Zustand store data to maintain API compatibility
  const faucet: FaucetState & { globalVolatility: GlobalVolatilityState } = {
    mon: {
      tankBalance: monTokenState.tankBalance,
      maxTankBalance: monTokenState.maxTankBalance,
      baseDripAmount: monTokenState.baseDripAmount,
      currentDripAmount: monTokenState.currentDripAmount,
      dripCooldownTime: monTokenState.dripCooldownTime,
      requestCooldownTime: monTokenState.requestCooldownTime,
      isDripLoading: monTokenState.isDripLoading,
      isRequestLoading: monTokenState.isRequestLoading,
      isRefreshing: monTokenState.isRefreshing,
      contractAddress: monTokenState.contractAddress,
      lowTankThreshold: monTokenState.lowTankThreshold,
    },
    link: {
      tankBalance: linkTokenState.tankBalance,
      maxTankBalance: linkTokenState.maxTankBalance,
      baseDripAmount: linkTokenState.baseDripAmount,
      currentDripAmount: linkTokenState.currentDripAmount,
      dripCooldownTime: linkTokenState.dripCooldownTime,
      requestCooldownTime: linkTokenState.requestCooldownTime,
      isDripLoading: linkTokenState.isDripLoading,
      isRequestLoading: linkTokenState.isRequestLoading,
      isRefreshing: linkTokenState.isRefreshing,
      contractAddress: linkTokenState.contractAddress,
      lowTankThreshold: linkTokenState.lowTankThreshold,
    },
    vaultMon: vaultBalances.mon,
    vaultLink: vaultBalances.link,
    globalVolatility: {
      multiplier: volatilityState.multiplier,
      lastUpdated: volatilityState.lastUpdated,
      isUpdating: volatilityState.isUpdating,
    },
  }

  const { data: walletClient } = useWalletClient()
  const { setDripCooldown } = useAutoCooldownManager()
  const { fetchAllFaucetData } = useBatchOperations()
  const { updateTokenState, updateVolatility } = useFaucetStore()

  // REMOVED: Local state and sync effects - now reading directly from Zustand

  // Unified snapshot fetch - now updates Zustand store directly
  const refreshSnapshot = async (account?: `0x${string}`) => {
    try {
      const snap = await getFaucetSnapshot(account)

      const monPoolNum  = Number(formatEther(snap.mon.pool))
      const monDripNum  = Number(formatEther(snap.mon.drip))
      const linkPoolNum = Number(formatEther(snap.link.pool))
      const linkDripNum = Number(formatEther(snap.link.drip))

      // New: derive on-chain reservoir capacities for accurate UI max values
      const monCapNum  = Number(formatEther(snap.mon.capacity))
      const linkCapNum = Number(formatEther(snap.link.capacity))

      const threshFactorNum = snap.constants.thresholdFactor

      let remainingMon = 0
      let remainingLink = 0

      if (snap.lastClaim && account) {
        const nowSec = Math.floor(Date.now() / 1000)
        remainingMon = snap.lastClaim.mon === 0n ? 0 : Math.max(0, snap.constants.cooldown - (nowSec - Number(snap.lastClaim.mon)))
        remainingLink = snap.lastClaim.link === 0n ? 0 : Math.max(0, snap.constants.cooldown - (nowSec - Number(snap.lastClaim.link)))
      }

      // FIXED: Use actual base drip rates from contract instead of hardcoded values
      const monBaseDripNum = Number(formatEther(snap.mon.baseDrip))
      const linkBaseDripNum = Number(formatEther(snap.link.baseDrip))
      
      // Calculate actual volatility multipliers from contract data
      const monMultiplier = monBaseDripNum > 0 ? monDripNum / monBaseDripNum : 1
      const linkMultiplier = linkBaseDripNum > 0 ? linkDripNum / linkBaseDripNum : 1
      
      // Use average multiplier for global volatility (or could use MON as primary)
      const globalMultiplier = (monMultiplier + linkMultiplier) / 2
      
      // Update global volatility state to match contract reality
      updateVolatility({
        multiplier: globalMultiplier,
      })

      // CONSOLIDATION: Update Zustand store with correct base vs current separation
      updateTokenState('mon', {
        tankBalance: monPoolNum,
        baseDripAmount: monBaseDripNum,                     // ✅ True base from contract
        currentDripAmount: monDripNum,                      // ✅ Current from contract
        lowTankThreshold: monDripNum * threshFactorNum,
        dripCooldownTime: remainingMon,
        contractAddress: MON_TOKEN_ADDRESS ?? '',
        maxTankBalance: monCapNum,
      })

      updateTokenState('link', {
        tankBalance: linkPoolNum,
        baseDripAmount: linkBaseDripNum,                    // ✅ True base from contract
        currentDripAmount: linkDripNum,                     // ✅ Current from contract
        lowTankThreshold: linkDripNum * threshFactorNum,
        dripCooldownTime: remainingLink,
        contractAddress: LINK_TOKEN_ADDRESS ?? FAUCET_ADDRESS,
        maxTankBalance: linkCapNum,
      })

      // Snapshot refreshed with contract-based base drip rates
    } catch (error) {
      console.error('Failed to refresh snapshot:', error)
    }
  }

  // Snapshot refresh on wallet change & mount
  useEffect(() => {
    refreshSnapshot(walletClient?.account.address as `0x${string}` | undefined)
  }, [walletClient])

  // Initial fetch on mount
  useEffect(() => {
    refreshSnapshot()
  }, [])

  // (we no longer return early because faucet is always defined)

  // ------------------------------------------------------------
  // Drip tokens (on-chain call)
  // ------------------------------------------------------------
  const requireMonad = useRequireMonad()

  const dripTokens = async (tokenType: "mon" | "link") => {
    if (!requireMonad()) return
    if (!walletClient) return
    
    // FIXED: Check cooldown from Zustand store instead of local state
    const { tokens } = useFaucetStore.getState()
    if (tokens[tokenType].dripCooldownTime > 0) return

    const { updateTokenState } = useFaucetStore.getState()

    try {
      // FIXED: Only update Zustand store for loading state to prevent sync conflicts
      updateTokenState(tokenType, { isDripLoading: true })

      const faucetAbi = parseAbi([
        'function requestMonTokens()',
        'function requestLinkTokens()',
      ])

      const functionName = tokenType === "mon" ? "requestMonTokens" : "requestLinkTokens"
      const { request } = await publicClient.simulateContract({
        address: FAUCET_ADDRESS as `0x${string}`,
        abi: faucetAbi,
        functionName,
        account: walletClient.account,
      })

      const txHash = await walletClient.writeContract(request)
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
      
      if (receipt.status === 'success') {
        // REMOVED: Optimistic tank balance update - instead show refreshing state
        updateTokenState(tokenType, { 
          isDripLoading: false,
          isRefreshing: true  // Add refreshing state to show spinner
        })
        
        // FIXED: Get the actual contract cooldown duration instead of hardcoded value
        const snap = await getFaucetSnapshot(walletClient.account.address)
        const contractCooldown = snap.constants.cooldown // This is the actual COOLDOWN from contract
        
        // Drip successful! Refreshing tank balance from contract
        
        // OPTIMIZED: Use centralized cooldown system with correct contract duration
        setDripCooldown(tokenType, contractCooldown)
        
        // FIXED: Immediately refresh tank balance from contract (no optimistic update)
        try {
          const freshSnap = await getFaucetSnapshot(walletClient.account.address)
          const freshTankBalance = tokenType === 'mon' 
            ? Number(formatEther(freshSnap.mon.pool))
            : Number(formatEther(freshSnap.link.pool))
          
          updateTokenState(tokenType, { 
            tankBalance: freshTankBalance,
            isRefreshing: false  // Remove refreshing state
          })
          
          // Tank balance refreshed from contract
        } catch (refreshError) {
          console.error('Failed to refresh tank balance:', refreshError)
          updateTokenState(tokenType, { isRefreshing: false })
        }
      }
    } catch (err) {
      console.error('Drip failed', err)
      updateTokenState(tokenType, { isDripLoading: false })
    }
  }

  // Fuel button action: Cross-chain volatility check + vault→tank refill
  const requestVolatilityAndRefill = async (tokenType: "mon" | "link") => {
    if (faucet[tokenType].requestCooldownTime > 0) return

    // CONSOLIDATION: Update Zustand store directly instead of local state
    updateTokenState(tokenType, { isRequestLoading: true })

    // This will be handled by the CCIP refill hook
    // Just set the cooldown here
    setTimeout(() => {
      updateTokenState(tokenType, { 
        isRequestLoading: false,
        requestCooldownTime: 24 * 60 * 60, // 24 hours cooldown for fuel button
      })
    }, 2000)
  }

  // Update global volatility (called from either MON or LINK fuel button)
  const updateGlobalVolatility = (volatilityMultiplier: number) => {
    // CONSOLIDATION: Update Zustand store directly instead of local state
    updateVolatility({
      multiplier: volatilityMultiplier,
      isUpdating: false,
    })

    // Update current drip amounts based on volatility
    const monBaseDrip = monTokenState.baseDripAmount
    const linkBaseDrip = linkTokenState.baseDripAmount
    
    updateTokenState('mon', {
      currentDripAmount: Math.floor(monBaseDrip * volatilityMultiplier),
    })
    
    updateTokenState('link', {
      currentDripAmount: Math.floor(linkBaseDrip * volatilityMultiplier),
    })
  }

  const setVolatilityUpdating = (isUpdating: boolean) => {
    // CONSOLIDATION: Update Zustand store directly instead of local state
    updateVolatility({ isUpdating })
  }

  // Refill tank from vault (called after successful CCIP request)
  const refillTankFromVault = async (tokenType: "mon" | "link", refillAmount: number) => {
    // CONSOLIDATION: Update Zustand store directly instead of local state
    const currentBalance = tokenType === 'mon' ? monTokenState.tankBalance : linkTokenState.tankBalance
    updateTokenState(tokenType, {
      tankBalance: currentBalance + refillAmount,
    })

    // After updating pool locally, refresh on-chain drip & threshold
    await refreshSnapshot()
  }

  // Check if tank is low (show fuel button)
  const isTankLow = (tokenType: "mon" | "link") => {
    const token = faucet[tokenType]
    // Dynamic threshold based on current drip and on-chain factor
    const threshold = token.currentDripAmount * (token.lowTankThreshold / token.currentDripAmount)
    return token.tankBalance < threshold
  }

  // Refresh vault balances (can be called manually)
  const refreshVaultBalances = async () => {
    try {
      await fetchAllFaucetData()
    } catch (error) {
      console.error('Failed to refresh vault balances:', error)
    }
  }

  // Force refresh tank balances from contract (bypasses optimistic update protection)
  const forceRefreshTankBalances = async () => {
    try {
      await refreshSnapshot(walletClient?.account.address as `0x${string}` | undefined)
      // Tank balances force refreshed from contract
    } catch (error) {
      console.error('Failed to force refresh tank balances:', error)
    }
  }

  // 🚀 Initial vault balance fetch
  useEffect(() => {
    fetchAllFaucetData()
  }, [fetchAllFaucetData])

  // REMOVED: Old individual cooldown timer - now handled by centralized timer in Zustand store
  // This eliminates one of the major sources of RPC calls (3,600 calls/hour)

  const formatCooldown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return {
    faucet,
    dripTokens,
    requestTokens: dripTokens,
    requestVolatilityAndRefill, // Fuel button action
    updateGlobalVolatility,
    setVolatilityUpdating,
    refillTankFromVault,
    formatCooldown,
    isTankLow,
    refreshVaultBalances, // ✅ New function for manual refresh
    forceRefreshTankBalances, // ✅ Force refresh tank balances from contract
  }
}
