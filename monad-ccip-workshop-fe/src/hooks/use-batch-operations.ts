import { getFaucetSnapshot } from '@/lib/faucetClient'
import { useFaucetStore } from '@/store/faucet-store'
import { formatEther } from 'viem'
import { useCallback } from 'react'
import { publicClient } from '@/lib/viem'
import { faucetAbi } from '@/lib/faucetAbi'
import { FAUCET_ADDRESS } from '@/lib/addresses'

/**
 * Lightweight replacement for the old batch-operations hook.
 * Only the functionality that is still referenced by live code is implemented.
 */
export function useBatchOperations() {
  const { updateTokenState, updateVaultBalance } = useFaucetStore()

  /**
   * Refresh both token tanks and vault balances in one RPC call.
   * Uses the same getFaucetSnapshot helper already leveraged elsewhere.
   */
  const fetchAllFaucetData = useCallback(async () => {
    try {
      const snap = await getFaucetSnapshot()

      // Tank pools & drip rates are handled by use-faucet → we only need vaults here
      const vaultMonNum  = Number(formatEther(snap.treasury.mon))
      const vaultLinkNum = Number(formatEther(snap.treasury.link))

      updateVaultBalance('mon', vaultMonNum)
      updateVaultBalance('link', vaultLinkNum)
    } catch (err) {
      console.error('fetchAllFaucetData failed', err)
    }
  }, [updateVaultBalance])

  /**
   * Check contract state including refillInProgress flag
   */
  const batchContractStateCheck = useCallback(async () => {
    try {
      const refillInProgress = await publicClient.readContract({
        address: FAUCET_ADDRESS as `0x${string}`,
        abi: faucetAbi,
        functionName: 'refillInProgress',
      }) as boolean

      return {
        refillInProgress,
      }
    } catch (err) {
      console.error('batchContractStateCheck failed', err)
      return null
    }
  }, [])

  // Return exactly the API still used by runtime code
  return {
    fetchAllFaucetData,
    batchContractStateCheck,
  }
} 