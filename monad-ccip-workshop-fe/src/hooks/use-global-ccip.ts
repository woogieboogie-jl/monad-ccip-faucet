

import { useState, useEffect } from "react"
import { useWalletClient } from 'wagmi'
import { parseAbi, encodeFunctionData, keccak256, toBytes } from 'viem'
import { publicClient } from '@/lib/viem'
import { FAUCET_ADDRESS } from '@/lib/addresses'
import { avalancheFuji } from 'viem/chains'
import { createPublicClient, http } from 'viem'

const fujiClient = createPublicClient({ chain: avalancheFuji, transport: http('https://api.avax-test.network/ext/bc/C/rpc') })

// Track the current refill messageId across polls / UI states
let currentMessageId: `0x${string}` | null = localStorage.getItem('lastRefillMsgId') as `0x${string}` | null

interface TokenRefillState {
  status: "idle" | "wallet_pending" | "tx_pending" | "ccip_processing" | "success" | "failed" | "stuck"
  progress: number
  currentPhase?: "wallet_confirm" | "monad_confirm" | "ccip_pending" | "ccip_confirmed" | "avalanche_confirm" | "ccip_response" | "monad_refill"
  messageId?: string
  ccipResponseMessageId?: string
  monadTxHash?: string
  transactionHash?: string
  newDripAmount?: number
  refillAmount?: number
  errorMessage?: string
  lastUpdated: Date
}

interface GlobalCCIPState {
  mon: TokenRefillState
  link: TokenRefillState
  universalVolatility?: {
    score: number
    trend: "increasing" | "decreasing" | "stable"
    multiplier: number
    lastUpdated: Date
  }
}

const initialTokenState: TokenRefillState = {
  status: "idle",
  progress: 0,
  lastUpdated: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
}

const initialState: GlobalCCIPState = {
  mon: { ...initialTokenState },
  link: { ...initialTokenState },
}

export function useGlobalCCIP() {
  const [globalCCIP, setGlobalCCIP] = useState<GlobalCCIPState>(initialState)

  // Restore state from localStorage on mount
  useEffect(() => {
    const monState = localStorage.getItem('ccip-refill-mon')
    const linkState = localStorage.getItem('ccip-refill-link')
    
    if (monState || linkState) {
      setGlobalCCIP(prev => ({
        ...prev,
        mon: monState ? JSON.parse(monState) : prev.mon,
        link: linkState ? JSON.parse(linkState) : prev.link,
      }))
    }
  }, [])

  // Listen for localStorage changes (from useCCIPRefill hooks)
  useEffect(() => {
    const handleStorageChange = () => {
      const monState = localStorage.getItem('ccip-refill-mon')
      const linkState = localStorage.getItem('ccip-refill-link')
      
      setGlobalCCIP(prev => ({
        ...prev,
        mon: monState ? JSON.parse(monState) : prev.mon,
        link: linkState ? JSON.parse(linkState) : prev.link,
        }))
      }

    // Listen for storage events
    window.addEventListener('storage', handleStorageChange)
    
    // OPTIMIZED: Reduced polling from 5s to 30s since we now have smart monitoring
    // This reduces RPC calls from 720/hour to 120/hour (83% reduction)
    // Smart monitoring handles active CCIP operations with event-driven updates
    const interval = setInterval(handleStorageChange, 30000)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  const isAnyRequestActive = () => {
    return globalCCIP.mon.status === "tx_pending" || 
           globalCCIP.mon.status === "ccip_processing" ||
           globalCCIP.mon.status === "wallet_pending" ||
           globalCCIP.link.status === "tx_pending" || 
           globalCCIP.link.status === "ccip_processing" ||
           globalCCIP.link.status === "wallet_pending"
  }

  const getTokenState = (tokenType: "mon" | "link") => {
    const state = globalCCIP[tokenType]
    
    // Map new states to old states for backward compatibility
    const mappedState = {
      ...state,
      status: state.status === "tx_pending" || state.status === "ccip_processing" ? "pending" : 
              state.status === "wallet_pending" ? "pending" :
              state.status,
    }
    
    return mappedState
  }

  const getActiveRequest = () => {
    if (globalCCIP.mon.status === "tx_pending" || globalCCIP.mon.status === "ccip_processing" || globalCCIP.mon.status === "wallet_pending") {
      return { 
        token: "mon", 
        state: {
          ...globalCCIP.mon,
          status: "pending" as any, // Map to legacy status for navigation bar
          messageId: globalCCIP.mon.messageId,
          ccipResponseMessageId: globalCCIP.mon.ccipResponseMessageId,
          monadTxHash: globalCCIP.mon.monadTxHash
        }
      }
    }
    if (globalCCIP.link.status === "tx_pending" || globalCCIP.link.status === "ccip_processing" || globalCCIP.link.status === "wallet_pending") {
      return { 
        token: "link", 
        state: {
          ...globalCCIP.link,
          status: "pending" as any, // Map to legacy status for navigation bar
          messageId: globalCCIP.link.messageId,
          ccipResponseMessageId: globalCCIP.link.ccipResponseMessageId,
          monadTxHash: globalCCIP.link.monadTxHash
        }
      }
    }
    return null
  }

  // Legacy function for backward compatibility
  const triggerGlobalRefill = async (tokenType: "mon" | "link") => {
    // This is now handled by the individual useCCIPRefill hooks
    console.log(`Legacy triggerGlobalRefill called for ${tokenType} - use useCCIPRefill instead`)
  }

  const resetGlobalState = () => {
    setGlobalCCIP(initialState)
    localStorage.removeItem('ccip-refill-mon')
    localStorage.removeItem('ccip-refill-link')
  }

  return {
    globalCCIP,
    triggerGlobalRefill,
    resetGlobalState,
    isAnyRequestActive,
    getTokenState,
    getActiveRequest,
  }
} 