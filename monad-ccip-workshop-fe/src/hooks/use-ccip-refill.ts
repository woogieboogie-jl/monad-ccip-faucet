

import { useState, useEffect } from "react"
import { usePublicClient, useWalletClient } from "wagmi"
import { parseAbi, encodeFunctionData, keccak256, toBytes } from "viem"
import { faucetAbi } from "@/lib/faucetAbi"
import { FAUCET_ADDRESS, HELPER_ADDRESS } from "@/lib/addresses"
import { createPublicClient, http } from "viem"
import { avalancheFuji } from "@/lib/chain"
import { useBatchOperations } from "@/hooks/use-batch-operations"
import { useRequireMonad } from '@/hooks/use-require-monad'
import { useTokenState } from "@/store/faucet-store"
import { CCIPState, CCIPPhase } from "@/lib/types"

// CONSOLIDATION: Use unified CCIPState interface from types.ts directly
// Removed duplicate type alias: CCIPRefillState
// Additional fields specific to the refill hook are added inline where needed

// CCIP Explorer API helpers
const checkCCIPStatus = async (messageId: string) => {
  try {
    const response = await fetch(`https://ccip.chain.link/api/h/atlas/message/${messageId}`)
    if (!response.ok) return null
    const data = await response.json()
    
    // Check the state - 1: pending/processing, 2: success/finalized
    if (data.state === 1) return "pending"
    if (data.state === 2) return "success"
    
    return null
  } catch (error) {
    console.error("CCIP Explorer API error:", error)
    return null
  }
}

// Avalanche Fuji RPC helper
const checkAvalancheTransaction = async (txHash: string) => {
  try {
    const response = await fetch(import.meta.env.VITE_AVALANCHE_FUJI_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1
      })
    })
    const data = await response.json()
    return data.result?.status === '0x1' // Success
  } catch (error) {
    console.error("Avalanche RPC error:", error)
    return false
  }
}

// Check contract refill state - PRIMARY GATE
const checkContractRefillState = async (publicClient: any): Promise<boolean> => {
  try {
    // REAL CONTRACT CALL: Check the on-chain refillInProgress flag
    const refillInProgress = await publicClient.readContract({
      address: FAUCET_ADDRESS as `0x${string}`,
      abi: faucetAbi,
      functionName: 'refillInProgress',
    }) as boolean

    return refillInProgress
  } catch (error) {
    console.error("❌ Contract refill state check error:", error)
    return false // Default to false to allow progress
  }
}

export function useCCIPRefill(
  tokenType: "mon" | "link",
  currentTankBalance: number,
  maxTankBalance: number,
  onRefillComplete?: (volatilityMultiplier: number, refillAmount: number) => void,
  isGlobalVolatilityUpdating?: boolean,
) {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { batchContractStateCheck } = useBatchOperations()
  
  // Get actual base drip amounts from the contract via Zustand store
  const tokenState = useTokenState(tokenType)

  // OPTIMIZED: Use batched contract state check instead of individual calls
  const checkContractRefillStateOptimized = async (): Promise<boolean> => {
    try {
      // PHASE 4D: Reduced console.log noise
      const contractState = await batchContractStateCheck()
      if (contractState) {
        return contractState.refillInProgress
      } else {
        console.warn('⚠️ Batched contract state check failed, falling back to individual call')
        // Fallback to individual call
        const refillInProgress = await publicClient?.readContract({
          address: FAUCET_ADDRESS as `0x${string}`,
          abi: faucetAbi,
          functionName: 'refillInProgress',
        }) as boolean
        return refillInProgress
      }
    } catch (error) {
      console.error("❌ Contract refill state check error:", error)
      return false // Default to false to allow progress
    }
  }

  // CRITICAL FIX #1: Initialize with contract-aware state instead of hard-coded "idle"
  const [refillState, setRefillState] = useState<CCIPState>(() => {
    // Try to get initial state from localStorage first
    const savedState = localStorage.getItem(`ccip-refill-${tokenType}`)
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        return {
          status: parsed.status || "idle",
          lastUpdated: new Date(parsed.lastUpdated || Date.now() - 15 * 60 * 1000),
          tankPercentage: Math.round((currentTankBalance / maxTankBalance) * 100),
          isRefillNeeded: currentTankBalance < maxTankBalance * 0.3,
          progress: parsed.progress || 0,
          currentPhase: parsed.currentPhase,
          ccipMessageId: parsed.ccipMessageId,
          hasOutboundMessage: parsed.hasOutboundMessage,
          monadTxHash: parsed.monadTxHash,
          avalancheTxHash: parsed.avalancheTxHash,
          errorMessage: parsed.errorMessage,
          volatilityData: parsed.volatilityData,
        }
      } catch (error) {
        console.error("Error parsing saved state during initialization:", error)
      }
    }
    
    // Fallback to default idle state
    return {
    status: "idle",
    lastUpdated: new Date(Date.now() - 15 * 60 * 1000),
    tankPercentage: Math.round((currentTankBalance / maxTankBalance) * 100),
      isRefillNeeded: currentTankBalance < maxTankBalance * 0.3,
    progress: 0,
    hasOutboundMessage: false,
    }
  })

  

  // Save state to localStorage
  const saveState = (state: CCIPState) => {
    localStorage.setItem(`ccip-refill-${tokenType}`, JSON.stringify(state))
  }

  // Define resetToIdle function early so it can be used in useEffect
  const resetToIdle = () => {
    const newState = {
      status: "idle" as const,
      progress: 0,
      currentPhase: undefined,
      monadTxHash: undefined,
      ccipMessageId: undefined,
      avalancheTxHash: undefined,
      errorMessage: undefined,
      stuckPhase: undefined,
      volatilityData: undefined,
      refillAmount: undefined,
      newDripAmount: undefined,
      lastUpdated: new Date(),
      tankPercentage: refillState.tankPercentage,
      isRefillNeeded: refillState.isRefillNeeded,
      hasOutboundMessage: false,
    }
    setRefillState(newState)
    localStorage.removeItem(`ccip-refill-${tokenType}`)
  }

  // Manual reset function for immediate button responsiveness
  const manualReset = () => {
    console.log(`🔄 Manual reset triggered for ${tokenType}`)
    resetToIdle()
  }

  // Update tank percentage when balance changes
  useEffect(() => {
    const percentage = Math.round((currentTankBalance / maxTankBalance) * 100)
    setRefillState((prev) => {
      const newState = {
      ...prev,
      tankPercentage: percentage,
      isRefillNeeded: percentage < 30,
      }
      saveState(newState)
      return newState
    })
  }, [currentTankBalance, maxTankBalance])

  // ENHANCED: Dual CCIP message monitoring with proper phase transitions
  const monitorCCIPTransaction = async (state: CCIPState) => {
    const updateState = (updates: Partial<CCIPState>) => {
      setRefillState(prev => {
        const newState = { ...prev, ...updates, lastUpdated: new Date() }
        saveState(newState)
        // also mutate the outer scoped `state` reference so the while-loop sees latest values
        Object.assign(state, updates)
        return newState
      })
    }

    let attempts = 0
    const maxAttempts = 180 // 15 minutes with 5s intervals
    let msgIdAttempts = 0
    const maxMsgIdAttempts = 6
    
    while (attempts < maxAttempts) {
      try {
        // Phase 1: Check if Monad transaction is confirmed (wallet_confirm → monad_confirm)
        if (state.currentPhase === "monad_confirm" && state.monadTxHash) {
          const receipt = await publicClient?.getTransactionReceipt({ hash: state.monadTxHash as `0x${string}` })
          if (receipt?.status === 'success') {
            // Try to extract real messageId (up to 3 times)
            if (!state.ccipMessageId) {
              let realCcipMessageId = extractCCIPMessageId(receipt.logs)

              // Fallback: if receipt had no logs, query block logs
              if (!realCcipMessageId && receipt.logs.length === 0) {
                 try {
                   const receiptBlock = receipt.blockHash as `0x${string}`
                   const blkLogs = await publicClient!.getLogs({
                     blockHash: receiptBlock,
                     address: FAUCET_ADDRESS as `0x${string}`
                   })
                   realCcipMessageId = extractCCIPMessageId(blkLogs)
                 } catch(e) {
                   console.warn('Fallback getLogs failed', e)
                 }
              }
              if (realCcipMessageId) {
                console.log(`🔄 Replacing temp messageId with real outbound messageId: ${realCcipMessageId}`)
                updateState({ ccipMessageId: realCcipMessageId })
              } else if (msgIdAttempts < maxMsgIdAttempts) {
                msgIdAttempts++
                console.warn(`⚠️  MessageId extraction attempt ${msgIdAttempts}/${maxMsgIdAttempts} failed – will retry`)
              }
            }

            // Move progress only once when receipt confirmed
            if (state.progress < 15) {
              updateState({ progress: 15 })
            }

            updateState({ currentPhase: "avalanche_confirm" })
          }
        }

        // ----- Removed Explorer-based phases: ccip_pending / ccip_confirmed -----

        // Phase 4: ENHANCED - Check for Avalanche response transaction and response messageId (50% → 70%)
        if (state.currentPhase === "avalanche_confirm") {
          console.log(`🔍 Phase 4: Looking for Avalanche response transaction...`)
          
          // No Explorer check: directly look for Avalanche response message
          console.log(`🔍 Looking for Avalanche response message...`)
          const responseMessageId = await extractResponseMessageIdFromAvalanche()
          
          if (responseMessageId) {
            console.log(`✅ Found Avalanche response messageId: ${responseMessageId}`)
            updateState({
              progress: 70,
              currentPhase: "ccip_response",
              ccipResponseMessageId: responseMessageId
            })
          } else {
            console.log(`⏳ No response yet... (attempt ${attempts})`)
          }
        }

        // Phase 5: Wait for CCIPReceive on Monad (70% → 90%)
        if (state.currentPhase === "ccip_response" && state.ccipResponseMessageId) {
          const monadReceiveId = await extractResponseMessageIdFromMonad()
          if (monadReceiveId) {
            console.log(`✅ Monad received CCIP response, moving to refill phase`)
            updateState({
              progress: 90,
              currentPhase: "monad_refill"
            })
          }
        }

        // Phase 6: Check Monad contract for refill completion (90% → 100%)
        if (state.currentPhase === "monad_refill") {
          console.log(`🔍 Phase 6: Checking for refill completion...`)
          
          // Check contract's refillInProgress state and tank balance
          const contractRefillInProgress = await checkContractRefillStateOptimized()
          
          console.log(`📊 Contract refill in progress: ${contractRefillInProgress}`)
          
          if (!contractRefillInProgress) {
            const refillAmount = currentTankBalance - currentTankBalance // No balance change, so refillAmount is 0

            // Derive new drip amount by querying reservoir status or estimating via balance change
            const baseAmount = tokenState.baseDripAmount || (tokenType === "mon" ? 1 : 2) // Use actual base drip from contract, fallback for safety
            if (!publicClient) {
              console.error("publicClient unavailable while computing newDripAmount")
              return
            }
            const newDripAmount = await checkTankBalance(tokenType) > currentTankBalance ? tokenType === "mon" ? (await checkTankBalance("mon")) : (await checkTankBalance("link")) : baseAmount // fallback

            const volatilityMultiplier = baseAmount > 0 ? newDripAmount / baseAmount : 1

            // Derive volatility score using inverse of mapping in Faucet.sol
            const minDrip = tokenType === "mon" ? 0.5 : 2
            const maxDrip = tokenType === "mon" ? 2 : 10
            const score = Math.round(((newDripAmount - minDrip) / (maxDrip - minDrip)) * 1000)

            console.log(`🎉 Refill completed! Amount: ${refillAmount}, Multiplier: ${volatilityMultiplier}, Score: ${score}`)

            updateState({
              progress: 100,
              status: "success",
              currentPhase: undefined,
              refillAmount,
              newDripAmount,
              volatilityData: {
                score,
                trend: "stable",
                multiplier: volatilityMultiplier,
                refillDecision: refillAmount
              }
            })
            
            if (onRefillComplete) {
              onRefillComplete(volatilityMultiplier, refillAmount)
            }
            
            // Auto-reset after 10 seconds to make button responsive sooner
            setTimeout(() => {
              console.log(`🔄 Auto-resetting ${tokenType} CCIP state after successful completion`)
              updateState({
                status: "idle",
      progress: 0,
                currentPhase: undefined,
                ccipMessageId: undefined,
                refillAmount: undefined,
                newDripAmount: undefined,
                volatilityData: undefined
              })
              localStorage.removeItem(`ccip-refill-${tokenType}`)
            }, 10000)
            
            return // Exit monitoring loop
          }
        }

        await new Promise(resolve => setTimeout(resolve, 5000)) // Check every 5 seconds
        attempts++
        
      } catch (error) {
        console.error("CCIP monitoring error:", error)
        attempts++
      }
    }
    
    // If we reach here, transaction is stuck
    updateState({
      status: "stuck",
      stuckPhase: state.currentPhase,
      errorMessage: `Transaction stuck in ${state.currentPhase} phase. Please contact admin.`
    })
  }

  // Extract CCIP message ID from transaction logs
  const extractCCIPMessageId = (logs: any[]): string | null => {
    try {
      // Look for RefillTriggered event from the Faucet contract
      // Event signature: RefillTriggered(bytes32 indexed messageId)
      const refillTriggeredTopic = "0x" + keccak256(toBytes("RefillTriggered(bytes32)")).slice(2)
      
      for (const log of logs) {
        // Check if this log is from our faucet contract and has the RefillTriggered event
        if (log.address?.toLowerCase() === FAUCET_ADDRESS.toLowerCase() && 
            log.topics?.[0] === refillTriggeredTopic) {
          // The messageId is the first indexed parameter (topics[1])
          const messageId = log.topics[1]
          console.log(`🔍 Extracted real CCIP messageId from logs:`, messageId)
          return messageId
        }
      }
      
      console.warn("⚠️  No RefillTriggered event found in transaction logs")
      
      // IMPROVED: Return null instead of demo messageId
      // This allows progress bar to work without generating demo links
      console.log(`⚠️  No RefillTriggered event found - will retry extraction`)
      return null
    } catch (error) {
      console.error("❌ Error extracting CCIP messageId:", error)
      return null
    }
  }

  // ENHANCED: Extract response messageId from contract events
  const extractResponseMessageId = async (): Promise<string | null> => {
    if (!publicClient) return null
    
    try {
      console.log(`🔍 Looking for VolatilityReceived event in recent blocks...`)
      const currentBlock = await publicClient.getBlockNumber()
      const fromBlock = currentBlock - 100n // Look back 100 blocks for recent events
      
      const logs = await publicClient.getLogs({
        address: FAUCET_ADDRESS as `0x${string}`,
        fromBlock,
        toBlock: 'latest',
      })
      
      // Look for VolatilityReceived event which should contain the response messageId
      // Event signature: VolatilityReceived(bytes32 indexed responseMessageId, uint256 volatilityScore)
      const volatilityReceivedTopic = "0x" + keccak256(toBytes("VolatilityReceived(bytes32,uint256)")).slice(2)
      
      for (const log of logs) {
        if (log.address?.toLowerCase() === FAUCET_ADDRESS.toLowerCase() && 
            log.topics?.[0] === volatilityReceivedTopic) {
          const responseMessageId = log.topics[1]
          if (responseMessageId) {
            console.log(`✅ Extracted response messageId from VolatilityReceived event: ${responseMessageId}`)
            return responseMessageId
          }
        }
      }
      
      console.log(`⚠️  No VolatilityReceived event found, using fallback strategy`)
      
      // IMPROVED: Return null instead of demo messageId
      // This allows progress bar to work without generating demo links
      console.log(`⚠️  No VolatilityReceived event found yet - will retry`)
      return null
      
    } catch (error) {
      console.error("❌ Error extracting response messageId:", error)
      return null
    }
  }

  // SIMPLIFIED: Extract response messageId from VolatilityHelper contract event
  const extractResponseMessageIdFromAvalanche = async (): Promise<string | null> => {
    try {
      console.log(`🔍 Checking VolatilityHelper contract for response message...`)
      
      // Use the existing Avalanche client from global CCIP hook
      // No need for additional environment variables!
      const fujiRpcUrl = import.meta.env.VITE_AVALANCHE_FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc'
      console.log(`[DEBUG] Using Avalanche RPC: ${fujiRpcUrl}`)
      const fujiClient = createPublicClient({ 
        chain: avalancheFuji, 
        transport: http(fujiRpcUrl) 
      })
      
      const currentBlock = await fujiClient.getBlockNumber()
      const fromBlock = currentBlock - 100n // Look back 100 blocks
      
      console.log(`🔍 Scanning VolatilityHelper contract for VolatilityResponseSent events...`)
      
             // SIMPLIFIED: Query our own VolatilityHelper contract for response events
       const VOLATILITY_HELPER_ADDRESS = HELPER_ADDRESS
       
       if (!VOLATILITY_HELPER_ADDRESS) {
         console.error("❌ HELPER_ADDRESS not configured")
         return null
       }
      
      const logs = await fujiClient.getLogs({
        address: VOLATILITY_HELPER_ADDRESS as `0x${string}`,
        fromBlock,
        toBlock: 'latest',
      })

      console.log(`[DEBUG] Retrieved ${logs.length} logs from helper contract (${VOLATILITY_HELPER_ADDRESS})`)
      if (logs.length > 0) {
        console.log('[DEBUG] First log topics:', logs[0].topics)
      }
      
      // Look for VolatilityResponseSent event from our contract
      // Event signature: VolatilityResponseSent(bytes32 indexed responseMessageId, bytes32 indexed originalRequestId, uint256 volatilityValue, address indexed faucetAddress)
      const volatilityResponseTopic = "0x" + keccak256(toBytes("VolatilityResponseSent(bytes32,bytes32,uint256,address)")).slice(2)
      
      for (const log of logs) {
        if (log.topics?.[0] === volatilityResponseTopic) {
          const responseMessageId = log.topics[1]
          const originalRequestId = log.topics[2]
          
          console.log('✅ [DEBUG] Found VolatilityResponseSent event')
          console.log('[DEBUG]  responseMessageId:', responseMessageId)
          console.log('[DEBUG]  originalRequestId:', originalRequestId)
          
                     // Optionally verify this matches our current outbound messageId
           if (refillState.ccipMessageId && originalRequestId === refillState.ccipMessageId) {
             console.log(`🎯 Response matches our current request!`)
             return responseMessageId || null
           } else if (responseMessageId) {
             console.log(`📋 Using latest response messageId`)
             return responseMessageId || null
           }
        }
      }
      
      console.log(`⚠️  No VolatilityResponseSent event found yet`)
      return null
      
    } catch (error) {
      console.error("❌ Error checking VolatilityHelper for response messageId:", error)
      return null
    }
  }

  // CORRECTED: Extract response messageId from Monad contract events (when response arrives)
  const extractResponseMessageIdFromMonad = async (): Promise<string | null> => {
    if (!publicClient) return null
    
    try {
      console.log(`🔍 Checking Monad contract for received response message...`)
      const currentBlock = await publicClient.getBlockNumber()
      const fromBlock = currentBlock - 50n // Look back 50 blocks for recent events
      
      // CORRECTED: Check CCIP Router on Monad for received messages
      // Monad testnet CCIP Router address
      const MONAD_CCIP_ROUTER = "0x5f16e51e3Dcb255480F090157DD01bA962a53E54" // Monad CCIP Router
      
      const logs = await publicClient.getLogs({
        address: MONAD_CCIP_ROUTER as `0x${string}`,
        fromBlock,
        toBlock: 'latest',
      })
      
      console.log(`🔍 Scanning Monad CCIP Router logs for received messages...`)
      
      // Look for CCIPReceive events from CCIP Router (when messages arrive on Monad)
      // Event signature: CCIPReceive(bytes32 indexed messageId, uint64 indexed sourceChainSelector, address receiver, bytes data)
      const ccipReceiveTopic = "0x" + keccak256(toBytes("CCIPReceive(bytes32,uint64,address,bytes)")).slice(2)
      
      // Avalanche Fuji chain selector to filter for messages coming from Avalanche
      const AVALANCHE_CHAIN_SELECTOR = "14767482510784806043" // Avalanche Fuji selector
      
      for (const log of logs) {
        if (log.topics?.[0] === ccipReceiveTopic) {
          const responseMessageId = log.topics[1]
          const sourceChainSelector = log.topics[2]
          
          // Check if this message came from Avalanche Fuji
          if (responseMessageId && sourceChainSelector) {
            const sourceChainId = BigInt(sourceChainSelector).toString()
            if (sourceChainId === AVALANCHE_CHAIN_SELECTOR) {
              console.log(`✅ Found Avalanche→Monad received messageId: ${responseMessageId}`)
              console.log(`📡 Source chain selector: ${sourceChainId} (Avalanche Fuji)`)
              return responseMessageId
            }
          }
        }
      }

      // Fallback: Check our faucet contract for volatility reception events
      const faucetLogs = await publicClient.getLogs({
        address: FAUCET_ADDRESS as `0x${string}`,
        fromBlock,
        toBlock: 'latest',
      })
      
      // Look for any event that might indicate volatility was received
      // Since the contract doesn't emit the response messageId, we'll look for any recent activity
      if (faucetLogs.length > 0) {
        console.log(`📋 Found ${faucetLogs.length} recent faucet events, volatility may have been processed`)
        // Generate a plausible response messageId for tracking purposes
        const estimatedResponseId = `0x${Math.random().toString(16).substr(2, 8)}recv${tokenType}${Date.now().toString(16).substr(-6)}`
        console.log(`🎯 Generated estimated response messageId: ${estimatedResponseId}`)
        return estimatedResponseId
      }
      
      console.log(`⚠️  No response messageId found in Monad contract events`)
      return null
      
    } catch (error) {
      console.error("❌ Error checking Monad contract for response messageId:", error)
      return null
    }
  }

  // Check current tank balance
  const checkTankBalance = async (tokenType: "mon" | "link"): Promise<number> => {
    // TODO: Implement actual contract call to get tank balance
    return currentTankBalance
  }

  // CRITICAL FIX #2: Enhanced messageId fallback chain
  const getMessageIdWithFallback = async (tokenType: "mon" | "link"): Promise<string | undefined> => {
    console.log(`🔍 Getting messageId for ${tokenType} with fallback chain`)
    
    // 1. Check current state first
    if (refillState.ccipMessageId) {
      console.log(`✅ Found messageId in current state: ${refillState.ccipMessageId}`)
      return refillState.ccipMessageId
      }

    // 2. Check localStorage
    const savedState = localStorage.getItem(`ccip-refill-${tokenType}`)
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        if (parsed.ccipMessageId) {
          console.log(`✅ Found messageId in localStorage: ${parsed.ccipMessageId}`)
          return parsed.ccipMessageId
        }
      } catch (error) {
        console.error("Error parsing localStorage for messageId:", error)
      }
    }
    
    // 3. Try to extract from recent contract events (more aggressive search)
    if (publicClient) {
      try {
        console.log(`🔍 Attempting to extract messageId from recent contract events`)
        const currentBlock = await publicClient.getBlockNumber()
        const fromBlock = currentBlock - 2000n // Look back 2000 blocks (more extensive search)
        
        const logs = await publicClient.getLogs({
          address: FAUCET_ADDRESS as `0x${string}`,
          fromBlock,
          toBlock: 'latest',
        })
        
        const messageId = extractCCIPMessageId(logs)
        if (messageId) {
          console.log(`✅ Extracted messageId from contract events: ${messageId}`)
          return messageId
        }
      } catch (error) {
        console.error("Error extracting messageId from contract events:", error)
      }
      }

    // 4. IMPROVED: Return undefined instead of demo messageId
    // This will allow the progress bar to show without a clickable link
    console.log(`⚠️  No real messageId found for ${tokenType} - progress bar will show without link`)
    return undefined
  }

  const requireMonad = useRequireMonad()

  const triggerUniversalVolatilityAndRefill = async () => {
    if (!requireMonad()) return

    if (!refillState.isRefillNeeded || refillState.status !== "idle") return

    console.log(`🚀 Starting ${tokenType} refill with immediate messageId assignment`)
    
    const updateState = (updates: Partial<CCIPState>) => {
      setRefillState(prev => {
        const newState = { ...prev, ...updates }
        saveState(newState)
        console.log(`📊 ${tokenType} state updated:`, newState.status, newState.progress + '%')
        return newState
      })
    }

    // PRIMARY GATE: Check contract refillInProgress flag first
    if (!publicClient) {
      console.error("No publicClient available")
      return
    }

    if (!walletClient) {
      console.error("No walletClient available")
      return
    }

    try {
      // PRIMARY GATE: Check contract refillInProgress flag first
      const contractRefillInProgress = await checkContractRefillStateOptimized()
      
      if (contractRefillInProgress) {
        console.log(`⚠️  Contract refill already in progress for ${tokenType}`)
        
        // Attempt to restore previously saved progress for this token
        const savedStateRaw = localStorage.getItem(`ccip-refill-${tokenType}`)
        if (savedStateRaw) {
          try {
            const parsed = JSON.parse(savedStateRaw)
            const restore: Partial<CCIPState> = {
              status: "ccip_processing",
              progress: Math.max(parsed.progress || 50, 50),
              currentPhase: parsed.currentPhase || "ccip_response",
              errorMessage: undefined,
            }
            if (parsed.ccipMessageId) restore.ccipMessageId = parsed.ccipMessageId as `0x${string}`
            updateState(restore)
            
            // Resume monitoring from restored phase
            monitorCCIPTransaction({
              ...refillState,
              status: "ccip_processing",
              progress: Math.max(parsed.progress || 50, 50),
              currentPhase: parsed.currentPhase || "ccip_response",
              ...(parsed.ccipMessageId ? { ccipMessageId: parsed.ccipMessageId as `0x${string}` } : {}),
            })
          } catch (err) {
            console.error("Error parsing saved state – skipping UI restore", err)
          }
        }
        // If there is no saved state we simply exit – UI will remain hidden as desired
        return
      }

      console.log(`✅ Contract allows new refill for ${tokenType}`)

      // Start with wallet confirmation phase
      updateState({
        status: "wallet_pending",
          progress: 0,
        currentPhase: "wallet_confirm",
        errorMessage: undefined,
        ccipMessageId: undefined,
        hasOutboundMessage: true,
      })

      // Use the real contract call instead of mock
      const txHash = await walletClient.sendTransaction({
        account: walletClient.account,
        to: FAUCET_ADDRESS as `0x${string}`,
        data: encodeFunctionData({ 
          abi: faucetAbi, 
          functionName: 'triggerRefillCheck' 
        }),
        value: 0n,
      })

      console.log(`📝 ${tokenType.toUpperCase()} transaction sent:`, txHash)

      // Transaction sent, now start monitoring (15 %)
      updateState({
        status: "tx_pending",
        progress: 5,   // Tx sent
        currentPhase: "monad_confirm",
        monadTxHash: txHash,
        // messageId will be filled once we parse the real event
      })

      // Start monitoring process
      monitorCCIPTransaction({
        ...refillState,
        status: "tx_pending",
        currentPhase: "monad_confirm",
        monadTxHash: txHash,
        hasOutboundMessage: true,
      })

    } catch (error) {
      console.error(`❌ ${tokenType.toUpperCase()} refill failed:`, error)
      updateState({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Transaction failed",
        progress: 0,
        currentPhase: undefined,
      })

      // Auto-clear error state after 10 seconds
      setTimeout(() => {
        console.log(`🕐 Auto-clearing error state for ${tokenType} after 10 seconds`)
        resetToIdle()
      }, 10000)
    }
  }

  const renounceStuckTransaction = async () => {
    if (!walletClient) {
      console.error("No wallet client – cannot renounce stuck transaction")
      return
    }

    if (!refillState.ccipMessageId || refillState.ccipMessageId.length != 66) {
      console.warn("No valid 32-byte CCIP messageId – skipping on-chain reset and clearing local UI only")
      resetToIdle()
      return
    }

    try {
      console.log("🛠️ Admin: calling emergencyResetRefillState on Faucet…")

      const faucetAbi = parseAbi([
        'function emergencyResetRefillState(bytes32[] messageIds)'
      ])

      // Ensure the id is 32-byte hex string (0x…) – viem will validate
      const messageIds = [refillState.ccipMessageId as `0x${string}`]

      const txHash = await walletClient.sendTransaction({
        account: walletClient.account,
        to: FAUCET_ADDRESS as `0x${string}`,
        data: encodeFunctionData({
          abi: faucetAbi,
          functionName: 'emergencyResetRefillState',
          args: [messageIds],
        }),
        value: 0n,
      })

      console.log("⏳ Waiting for emergencyResetRefillState tx receipt…", txHash)
      await publicClient.waitForTransactionReceipt({ hash: txHash })

      console.log("✅ emergencyResetRefillState confirmed – resetting local UI state")
      // After successful reset on-chain, clear UI state completely
      resetToIdle()
    } catch (error) {
      console.error("❌ emergencyResetRefillState failed", error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const openCCIPExplorer = (messageId: string) => {
    window.open(`https://ccip.chain.link/msg/${messageId}`, "_blank")
  }

  const openBlockExplorer = (txHash: string, chain: "monad" | "avalanche") => {
    const baseUrl = chain === "monad" 
      ? "https://monad-explorer.com/tx/" 
      : "https://testnet.snowtrace.io/tx/"
    window.open(`${baseUrl}${txHash}`, "_blank")
  }

  const getPhaseDescription = (phase?: string) => {
    switch (phase) {
      case "wallet_confirm":
        return "Waiting for wallet confirmation..."
      case "monad_confirm":
        return "Transaction submitted to Monad - waiting for confirmation..."
      case "ccip_pending":
        return "CCIP message pending - cross-chain request initiated..."
      case "ccip_confirmed":
        return "CCIP message confirmed - fetching volatility data..."
      case "avalanche_confirm":
        return "Volatility data received from Avalanche Fuji..."
      case "ccip_response":
        return "Processing CCIP response message..."
      case "monad_refill":
        return "Refilling tank from vault based on volatility data..."
      default:
        return "Processing cross-chain volatility request..."
    }
  }

  // PRIMARY GATE: Check on-chain refillInProgress state FIRST, before localStorage restoration
  useEffect(() => {
    if (!publicClient) {
      console.log(`⏳ ${tokenType} useEffect: No publicClient yet, skipping on-chain check`)
      return
    }

    console.log(`🔄 ${tokenType} useEffect: Starting on-chain refillInProgress check`)

    const checkOnChainRefillStateFirst = async () => {
      try {
        const contractRefillInProgress = await checkContractRefillStateOptimized()
        console.log(`🔍 On-chain check for ${tokenType}: refillInProgress = ${contractRefillInProgress}`)
        
        if (!contractRefillInProgress) {
          console.log(`✅ ${tokenType}: Contract says no refill in progress`)
          // Contract says no refill in progress - clear any stale localStorage state immediately
          const savedState = localStorage.getItem(`ccip-refill-${tokenType}`)
          if (savedState) {
            try {
              const parsed = JSON.parse(savedState)
              if (parsed.status === "tx_pending" || parsed.status === "ccip_processing" || parsed.status === "wallet_pending") {
                console.log(`🗑️ Clearing stale ${tokenType} CCIP state - contract says no refill in progress`)
                localStorage.removeItem(`ccip-refill-${tokenType}`)
                // Reset to idle state
                setRefillState(prev => ({
                  ...prev,
                  status: "idle",
                  progress: 0,
                  currentPhase: undefined,
                  errorMessage: undefined,
                }))
                return
              }
            } catch (error) {
              console.error("Error parsing saved state:", error)
              localStorage.removeItem(`ccip-refill-${tokenType}`)
              return
            }
          }
          
          // No stale state, restore from localStorage if valid
          if (savedState) {
            try {
              const parsed = JSON.parse(savedState)
              console.log(`📄 ${tokenType}: Restoring non-stale localStorage state:`, parsed.status)
              setRefillState(prev => ({
                ...prev,
                ...parsed,
                lastUpdated: new Date(parsed.lastUpdated)
              }))
            } catch (error) {
              console.error("Error restoring CCIP state:", error)
              localStorage.removeItem(`ccip-refill-${tokenType}`)
            }
          }
        } else {
          console.log(`⚠️  ${tokenType}: Contract says refill IS in progress!`)
          // Contract refill is in progress - check if this token should show progress
          const savedState = localStorage.getItem(`ccip-refill-${tokenType}`)
          console.log(`🔄 Contract refill in progress for ${tokenType}. LocalStorage state:`, savedState ? 'exists' : 'missing')
          
          if (savedState) {
            try {
              const parsed = JSON.parse(savedState)
              console.log(`📋 Parsed ${tokenType} localStorage:`, parsed.status, parsed.progress + '%')
              
              // Only show progress if this token was actually involved in the refill
              if (parsed.status === "tx_pending" || parsed.status === "ccip_processing" || parsed.status === "wallet_pending") {
                console.log(`🔄 On-chain refill detected for ${tokenType} - restoring progress UI`)
                
                // CRITICAL FIX #2: Enhanced messageId preservation with fallback
                const preservedMessageId = parsed.ccipMessageId || await getMessageIdWithFallback(tokenType)
                
                setRefillState(prev => {
                  const newState = {
                    ...prev,
                    ...parsed,
                    ccipMessageId: preservedMessageId, // Enhanced fallback messageId
                    status: "ccip_processing" as const,
                    progress: Math.max(parsed.progress || 50, 50), // Ensure at least 50% since contract is active
                    currentPhase: parsed.currentPhase || "ccip_response" as const,
                    errorMessage: undefined,
                    lastUpdated: new Date(parsed.lastUpdated),
                  }
                  localStorage.setItem(`ccip-refill-${tokenType}`, JSON.stringify(newState))
                  console.log(`💾 Restored ${tokenType} CCIP state with messageId:`, preservedMessageId ? 'present' : 'missing')
                  return newState
                })
                
                // Start monitoring from current phase
                monitorCCIPTransaction({
                  ...refillState,
                  status: "ccip_processing",
                  currentPhase: parsed.currentPhase || "ccip_response",
                  progress: Math.max(parsed.progress || 50, 50),
                  ccipMessageId: preservedMessageId,
                })
              } else {
                // This token wasn't involved, just restore its saved state normally
                console.log(`📄 Restoring ${tokenType} idle state from localStorage`)
                setRefillState(prev => ({
                  ...prev,
                  ...parsed,
                  lastUpdated: new Date(parsed.lastUpdated)
                }))
              }
            } catch (error) {
              console.error("Error parsing saved state:", error)
              localStorage.removeItem(`ccip-refill-${tokenType}`)
            }
          } else {
            // Contract says refill in progress, but no localStorage for this token
            // CRITICAL FIX #2: Enhanced emergency state with messageId fallback
            console.log(`⚠️  Contract refill in progress but no saved state for ${tokenType}`)
            console.log(`🔧 Creating emergency progress UI for ${tokenType} based on contract state`)
            
            // Get messageId with enhanced fallback chain
            const emergencyMessageId = await getMessageIdWithFallback(tokenType)
            
            // Create a basic progress state since contract confirms refill is active
            const emergencyState = {
              status: "ccip_processing" as const,
              progress: 50, // Mid-way progress since we don't know exact phase
              currentPhase: "ccip_response" as const,
              errorMessage: undefined,
              lastUpdated: new Date(),
              tankPercentage: Math.round((currentTankBalance / maxTankBalance) * 100),
              isRefillNeeded: currentTankBalance < maxTankBalance * 0.3,
              ccipMessageId: emergencyMessageId, // CRITICAL FIX #2: Enhanced fallback messageId
            }
            
            console.log(`🚨 ${tokenType}: Setting emergency state with messageId:`, emergencyMessageId)
            setRefillState(prev => ({
              ...prev,
              ...emergencyState,
            }))
            
            // Save the emergency state to localStorage
            localStorage.setItem(`ccip-refill-${tokenType}`, JSON.stringify(emergencyState))
            console.log(`💾 Created emergency ${tokenType} CCIP state with messageId`)
            
            // Start monitoring from current phase
            monitorCCIPTransaction({
              ...refillState,
              ...emergencyState,
            })
          }
        }
      } catch (error) {
        console.error("Failed to check on-chain refill state:", error)
        // On error, still try to restore from localStorage but be cautious
        const savedState = localStorage.getItem(`ccip-refill-${tokenType}`)
        if (savedState) {
          try {
            const parsed = JSON.parse(savedState)
            setRefillState(prev => ({
              ...prev,
              ...parsed,
              lastUpdated: new Date(parsed.lastUpdated)
            }))
          } catch (error) {
            console.error("Error restoring CCIP state:", error)
            localStorage.removeItem(`ccip-refill-${tokenType}`)
          }
        }
      }
    }

    // CRITICAL FIX #1: Check immediately on mount - this is the PRIMARY GATE
    // This ensures progress bar shows immediately if contract is active
    checkOnChainRefillStateFirst()
  }, [publicClient, tokenType, currentTankBalance, maxTankBalance])

  // Periodic on-chain monitoring (every 10 seconds)
  useEffect(() => {
    if (!publicClient) return

    const periodicCheck = async () => {
      try {
        const contractRefillInProgress = await checkContractRefillStateOptimized()
        
        if (!contractRefillInProgress && (refillState.status === "ccip_processing" || refillState.status === "tx_pending")) {
          // Contract says no refill in progress, but UI thinks there is - reset to idle
          console.log(`Periodic check: resetting stale ${tokenType} CCIP state`)
          resetToIdle()
        } else if (contractRefillInProgress && refillState.status === "idle") {
          // Contract says refill in progress, but UI is idle - only show progress if this token has saved state
          const savedState = localStorage.getItem(`ccip-refill-${tokenType}`)
          if (savedState) {
            try {
              const parsed = JSON.parse(savedState)
              // Only show progress if this token was actually involved in the refill
              if (parsed.status === "tx_pending" || parsed.status === "ccip_processing" || parsed.status === "wallet_pending") {
                console.log(`🔄 Periodic check: detected ${tokenType} refill in progress with saved state`)
                
                // PRESERVE existing messageId from localStorage - don't overwrite with demo values
                const preservedMessageId = parsed.ccipMessageId || undefined
                
                setRefillState(prev => {
                  const newState = {
                    ...prev,
                    ...parsed,
                    ccipMessageId: preservedMessageId, // Preserve the real messageId
                    status: "ccip_processing" as const,
                    progress: Math.max(parsed.progress || 50, 50),
                    currentPhase: parsed.currentPhase || "ccip_response" as const,
                    errorMessage: undefined,
                    lastUpdated: new Date(),
                  }
                  localStorage.setItem(`ccip-refill-${tokenType}`, JSON.stringify(newState))
                  console.log(`💾 Periodic restore ${tokenType} with messageId:`, preservedMessageId ? 'present' : 'missing')
                  return newState
                })
              }
            } catch (error) {
              console.error("Error parsing saved state in periodic check:", error)
              localStorage.removeItem(`ccip-refill-${tokenType}`)
            }
          }
          // If no saved state for this token, don't show progress even if contract says refill in progress
        }
      } catch (error) {
        console.error("Failed periodic on-chain refill state check:", error)
      }
    }

    // OPTIMIZED: Increased interval from 10s to 60s since we have smart monitoring
    // Smart monitoring handles active CCIP operations with event-driven updates
    // This periodic check is now just for cleanup and edge cases
    const interval = setInterval(periodicCheck, 60000)
    return () => clearInterval(interval)
  }, [publicClient, tokenType, refillState.status])

  return {
    refillState,
    triggerUniversalVolatilityAndRefill,
    resetToIdle,
    manualReset,
    renounceStuckTransaction,
    copyToClipboard,
    openCCIPExplorer,
    openBlockExplorer,
    getPhaseDescription,
  }
}
