import { useState, useCallback } from 'react'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { encodeFunctionData, parseEther, parseAbi, decodeAbiParameters, formatEther } from 'viem'
import { FAUCET_ADDRESS, HELPER_ADDRESS } from '@/lib/addresses'
import { publicClient } from '@/lib/viem'
import { useFaucetStore, useTokenState, useCCIPState } from '@/store/faucet-store'
import { faucetAbi } from '@/lib/faucetAbi'
import { useAutoCooldownManager } from '@/hooks/use-cooldown-manager'
import { useBatchOperations } from '@/hooks/use-batch-operations'
import { invalidateUserCache } from '@/lib/request-cache'
import { startSmartCCIPMonitoring } from '@/lib/smart-ccip-monitor'

export function useTokenOperations(tokenType: 'mon' | 'link') {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { fetchUserBalances, debouncedFetchAll } = useBatchOperations()
  const { setDripCooldown } = useAutoCooldownManager()
  
  const tokenState = useTokenState(tokenType)
  const ccipState = useCCIPState(tokenType)
  const { 
    updateTokenState, 
    setDripLoading, 
    updateCCIPState, 
    resetCCIPState,
    updateVolatility 
  } = useFaucetStore()

  /**
   * Execute drip operation for the specified token
   */
  const executeDrip = useCallback(async (): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    if (!walletClient || !address) {
      return { success: false, error: 'Wallet not connected' }
    }

    if (tokenState.tankBalance < tokenState.currentDripAmount) {
      return { success: false, error: 'Insufficient tank balance' }
    }

    try {
      setDripLoading(tokenType, true)

      const functionName = tokenType === 'mon' ? 'requestMonTokens' : 'requestLinkTokens'
      
      const txHash = await walletClient.sendTransaction({
        to: FAUCET_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: faucetAbi,
          functionName,
        }),
        value: 0n,
      })

      // Wait for confirmation then fetch real cooldown values from contract
      const receipt = await publicClient?.waitForTransactionReceipt({ hash: txHash })

      if (receipt?.status === 'success') {
        try {
          // IMPORTANT: Invalidate cache after successful transaction
          invalidateUserCache(address)
          
          // OPTIMIZED: Use individual Promise.all calls instead of failing multicall
          // This ensures reliable cooldown fetching after drip transactions
          console.log('🔄 Fetching cooldown data using individual calls...')
          
          if (!publicClient) {
            console.warn('⚠️ Public client not available for cooldown fetch')
            return { success: true, txHash }
          }
          
          const [cooldownResult, lastClaimResult] = await Promise.all([
            // Get cooldown constant
            publicClient.readContract({
              address: FAUCET_ADDRESS as `0x${string}`,
              abi: parseAbi(['function COOLDOWN() view returns (uint256)']),
              functionName: 'COOLDOWN',
            }),
            // Get user's last claim timestamp
            publicClient.readContract({
              address: FAUCET_ADDRESS as `0x${string}`,
              abi: parseAbi([
                'function lastClaimMon(address) view returns (uint256)',
                'function lastClaimLink(address) view returns (uint256)'
              ]),
              functionName: tokenType === 'mon' ? 'lastClaimMon' : 'lastClaimLink',
              args: [address as `0x${string}`],
            }),
          ])
          
          if (cooldownResult && lastClaimResult) {
            const cooldown = cooldownResult as bigint
            const lastClaim = lastClaimResult as bigint

            const now = Math.floor(Date.now() / 1000)
            const remaining = Number(cooldown) - (now - Number(lastClaim))

            console.log('⏰ Cooldown data:', {
              cooldown: Number(cooldown),
              lastClaim: Number(lastClaim),
              remaining: Math.max(0, remaining),
            })

            updateTokenState(tokenType, {
              tankBalance: tokenState.tankBalance - tokenState.currentDripAmount,
            })

            // OPTIMIZED: Use centralized cooldown system
            setDripCooldown(tokenType, Math.max(0, remaining))
            
            console.log(`✅ Cooldown set: ${Math.max(0, remaining)}s remaining (${Math.floor(Math.max(0, remaining)/60)}min)`)
          } else {
            console.warn('⚠️ Cooldown fetch failed, missing results')
          }
          
        } catch (e) {
          console.error('Failed to fetch on-chain cooldown info:', e)
        }
      }

      // Fetch updated user balances
      if (address) {
        const balances = await fetchUserBalances(address)
        // This would be handled by a separate user balance hook
      }

      return { success: true, txHash }
    } catch (error) {
      console.error(`${tokenType.toUpperCase()} drip failed:`, error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    } finally {
      setDripLoading(tokenType, false)
    }
  }, [walletClient, address, tokenState, tokenType, setDripLoading, updateTokenState, fetchUserBalances, publicClient])

  /**
   * Execute CCIP refill operation
   */
  const executeRefill = useCallback(async (): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    if (!walletClient || !address) {
      return { success: false, error: 'Wallet not connected' }
    }

    try {
      // Reset any previous CCIP state
      resetCCIPState(tokenType)
      
      // Update CCIP state to wallet pending
      updateCCIPState(tokenType, {
        status: 'wallet_pending',
        progress: 5,
        currentPhase: 'wallet_confirm',
      })

      // Send transaction
      const txHash = await walletClient.sendTransaction({
        to: FAUCET_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: faucetAbi,
          functionName: 'triggerRefillCheck',
        }),
        value: parseEther('0.0001'), // Small fee for CCIP
      })

      // Update to transaction pending
      updateCCIPState(tokenType, {
        status: 'tx_pending',
        progress: 15,
        currentPhase: 'monad_confirm',
      })

      // Wait for transaction confirmation
      const receipt = await publicClient?.waitForTransactionReceipt({ hash: txHash })
      
      if (receipt?.status === 'success') {
        // Extract CCIP message ID from logs
        const ccipMessageId = extractCCIPMessageId(receipt.logs)
        
        updateCCIPState(tokenType, {
          status: 'ccip_processing',
          progress: 25,
          currentPhase: 'ccip_pending',
          messageId: ccipMessageId,
        })

        // Start monitoring CCIP progress
        startCCIPMonitoring(tokenType, ccipMessageId)

        return { success: true, messageId: ccipMessageId }
      } else {
        throw new Error('Transaction failed')
      }
    } catch (error) {
      console.error(`${tokenType.toUpperCase()} CCIP refill failed:`, error)
      
      updateCCIPState(tokenType, {
        status: 'failed',
        progress: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }, [walletClient, address, tokenType, publicClient, resetCCIPState, updateCCIPState])

  /**
   * Extract CCIP message ID from transaction logs
   */
  const extractCCIPMessageId = (logs: any[]): string | undefined => {
    // Look for CCIPSendRequested event
    const ccipSendRequestedTopic = '0x35c02761bcd3ef995c6a601a1981f4ed3934dcbe5041e24e286c89f5531d17e4'
    
    for (const log of logs) {
      if (log.topics[0] === ccipSendRequestedTopic) {
        return log.topics[1] // messageId is usually the first indexed parameter
      }
    }
    
    return undefined
  }

  /**
   * Monitor CCIP progress across chains
   * OPTIMIZED: Smart monitoring with adaptive intervals instead of aggressive 5s polling
   */
  const startCCIPMonitoring = useCallback((tokenType: 'mon' | 'link', messageId?: string) => {
    if (!messageId) return

    console.log(`🎯 Starting SMART CCIP monitoring for ${tokenType} (reduced from 5s polling)`)
    
         // Use smart monitoring with adaptive intervals
     startSmartCCIPMonitoring(tokenType, messageId, 'ccip_pending', {
       onPhaseUpdate: (phase: string, progress: number, data?: any) => {
         console.log(`📊 CCIP Phase Update: ${phase} (${progress}%)`)
         updateCCIPState(tokenType, {
           currentPhase: phase,
           progress,
           ...(data || {})
         })
       },
       onComplete: (result: any) => {
         console.log(`✅ CCIP monitoring completed for ${tokenType}`)
         updateCCIPState(tokenType, {
           status: 'success',
           progress: 100,
           currentPhase: 'monad_refill',
         })
         
         // Refresh all faucet data
         debouncedFetchAll()
         
         // Auto-clear success state after 5 seconds
         setTimeout(() => {
           resetCCIPState(tokenType)
         }, 5000)
       },
       onError: (error: string) => {
         console.error(`❌ CCIP monitoring error for ${tokenType}:`, error)
         updateCCIPState(tokenType, {
           status: 'stuck',
           errorMessage: error,
         })
       }
     })

  }, [updateCCIPState, debouncedFetchAll, resetCCIPState])

  /**
   * Monitor for CCIP response from Avalanche back to Monad
   * OPTIMIZED: Replaced 5-second polling with smart event-driven monitoring
   */
  const monitorCCIPResponse = useCallback(async (tokenType: 'mon' | 'link', originalMessageId: string) => {
    console.log(`🎯 Starting SMART response monitoring for ${tokenType} (was 5s polling)`)
    
    // Use smart monitoring for response phase
    startSmartCCIPMonitoring(tokenType, originalMessageId, 'ccip_response', {
      onPhaseUpdate: (phase: string, progress: number, data?: any) => {
        updateCCIPState(tokenType, {
          currentPhase: phase,
          progress,
          ccipResponseMessageId: data?.responseMessageId,
        })
      },
      onComplete: (result: any) => {
        updateCCIPState(tokenType, {
          status: 'success',
          progress: 100,
          currentPhase: 'monad_refill',
        })
        
        // Refresh all faucet data
        debouncedFetchAll()
        
        // Auto-clear success state after 5 seconds
        setTimeout(() => {
          resetCCIPState(tokenType)
        }, 5000)
      },
      onError: (error: string) => {
        updateCCIPState(tokenType, {
          status: 'stuck',
          errorMessage: error,
          progress: 75,
        })
      }
    })
  }, [updateCCIPState, debouncedFetchAll, resetCCIPState])

  /**
   * Check if CCIP message has been delivered
   */
  const checkCCIPDelivery = async (messageId: string): Promise<boolean> => {
    try {
      // Query CCIP Router or use API to check delivery status
      // This is a simplified version - actual implementation would query CCIP infrastructure
      const response = await fetch(`https://ccip.chain.link/api/v1/messages/${messageId}`)
      const data = await response.json()
      return data.status === 'delivered'
    } catch (error) {
      console.error('Failed to check CCIP delivery:', error)
      return false
    }
  }

  /**
   * Check for volatility response events
   */
  const checkVolatilityResponse = async (originalMessageId: string) => {
    if (!publicClient) return []
    
    try {
      const events = await publicClient.getLogs({
        address: HELPER_ADDRESS as `0x${string}`,
        event: parseAbi(['event VolatilityResponseSent(bytes32 indexed responseMessageId, bytes32 indexed originalRequestId, uint256 volatilityValue, address indexed faucetAddress)'])[0],
        args: {
          originalRequestId: originalMessageId as `0x${string}`,
        },
        fromBlock: 'latest',
        toBlock: 'latest',
      })
      
      return events
    } catch (error) {
      console.error('Failed to check volatility response:', error)
      return []
    }
  }

  /**
   * Format cooldown time in human readable format
   */
  const formatCooldown = useCallback((seconds: number): string => {
    if (seconds <= 0) return 'Ready'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }, [])

  // REMOVED: Individual cooldown timer - now handled by centralized timer in Zustand store
  // This eliminates another source of duplicate RPC calls

  return {
    // State
    tokenState,
    ccipState,
    
    // Operations
    executeDrip,
    executeRefill,
    
    // Utilities
    formatCooldown,
    
    // Computed values
    tankPercentage: Math.round((tokenState.tankBalance / tokenState.maxTankBalance) * 100),
    isTankLow: tokenState.tankBalance < tokenState.lowTankThreshold,
    canDrip: tokenState.tankBalance >= tokenState.currentDripAmount && tokenState.dripCooldownTime <= 0,
    canRefill: ccipState.status === 'idle' && tokenState.requestCooldownTime <= 0,
  }
} 