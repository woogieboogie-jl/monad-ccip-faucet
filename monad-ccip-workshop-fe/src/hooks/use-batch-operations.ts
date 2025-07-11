import { usePublicClient, useWalletClient } from 'wagmi'
import { useFaucetStore } from '@/store/faucet-store'
import { encodeFunctionData, parseAbi, formatEther, decodeAbiParameters } from 'viem'
import { FAUCET_ADDRESS, LINK_TOKEN_ADDRESS } from '@/lib/addresses'
import { faucetAbi } from '@/lib/faucetAbi'
import { publicClient } from '@/lib/viem'
import { cachedContractRead } from '@/lib/request-cache'

interface BatchCall {
  target: `0x${string}`
  data: `0x${string}`
  value?: bigint
}

interface BatchResult {
  success: boolean
  returnData?: `0x${string}`
  error?: string
}

export function useBatchOperations() {
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { batchUpdateTokens, updateVaultBalance } = useFaucetStore()

  /**
   * Batch multiple contract reads into a single multicall
   */
  const batchRead = async (calls: BatchCall[]): Promise<BatchResult[]> => {
    if (!publicClient) throw new Error('Public client not available')

    try {
      // Use multicall3 for batched reads
      const multicallAbi = parseAbi([
        'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) external payable returns (tuple(bool success, bytes returnData)[] returnData)'
      ])

      const multicallCalls = calls.map(call => ({
        target: call.target,
        allowFailure: true,
        callData: call.data,
      }))

      const results = await publicClient.readContract({
        address: '0xcA11bde05977b3631167028862bE2a173976CA11', // Multicall3 address
        abi: multicallAbi,
        functionName: 'aggregate3',
        args: [multicallCalls],
      }) as { success: boolean; returnData: `0x${string}` }[]

      return results.map(result => ({
        success: result.success,
        returnData: result.returnData,
        error: result.success ? undefined : 'Call failed',
      }))
    } catch (error) {
      console.error('Batch read failed:', error)
      throw error
    }
  }

  /**
   * Batch multiple state reads for faucet data
   * NOW WITH CACHING: Prevents duplicate calls within configured time windows
   */
  const fetchAllFaucetData = async () => {
    if (!publicClient) return

    try {
      console.log('🔄 Fetching faucet data using cached individual calls...')
      
      // Use cached contract reads with optimized TTL values
      const [reservoirResult, treasuryResult, linkBalanceResult] = await Promise.all([
        // Tank data changes frequently - shorter cache (30s)
        cachedContractRead(
          'getReservoirStatus',
          () => publicClient.readContract({
            address: FAUCET_ADDRESS as `0x${string}`,
            abi: faucetAbi,
            functionName: 'getReservoirStatus',
          }),
          [],
          30 * 1000 // 30 seconds
        ),
        
        // Treasury data changes less frequently - longer cache (60s)
        cachedContractRead(
          'getTreasuryStatus',
          () => publicClient.readContract({
            address: FAUCET_ADDRESS as `0x${string}`,
            abi: faucetAbi,
            functionName: 'getTreasuryStatus',
          }),
          [],
          60 * 1000 // 60 seconds
        ),
        
        // LINK balance changes moderately - medium cache (45s)
        cachedContractRead(
          'linkBalance',
          () => publicClient.readContract({
            address: LINK_TOKEN_ADDRESS as `0x${string}`,
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [FAUCET_ADDRESS as `0x${string}`],
          }),
          [FAUCET_ADDRESS],
          45 * 1000 // 45 seconds
        ),
      ])

      // Process reservoir status
      if (reservoirResult) {
        const [monPool, monDripRate, linkPool, linkDripRate] = reservoirResult as [bigint, bigint, bigint, bigint]

        console.log('🏊 Reservoir Status:', {
          monPool: formatEther(monPool),
          monDripRate: formatEther(monDripRate),
          linkPool: formatEther(linkPool),
          linkDripRate: formatEther(linkDripRate),
        })

        // Batch update token states
        batchUpdateTokens({
          mon: {
            tankBalance: Number(formatEther(monPool)),
            currentDripAmount: Number(formatEther(monDripRate)),
            baseDripAmount: Number(formatEther(monDripRate)),
          },
          link: {
            tankBalance: Number(formatEther(linkPool)),
            currentDripAmount: Number(formatEther(linkDripRate)),
            baseDripAmount: Number(formatEther(linkDripRate)),
          },
        })
      }

      // Process treasury status
      if (treasuryResult) {
        const [monTreasury, monReservoir, linkTreasury, linkReservoir, monCapacity, linkCapacity] = treasuryResult as [bigint, bigint, bigint, bigint, bigint, bigint]
        
        console.log('📊 Treasury Status (Raw BigInt):', {
          monTreasury: monTreasury.toString(),
          monReservoir: monReservoir.toString(), 
          linkTreasury: linkTreasury.toString(),
          linkReservoir: linkReservoir.toString(),
          monCapacity: monCapacity.toString(),
          linkCapacity: linkCapacity.toString(),
        })
        
        console.log('📊 Treasury Status (Formatted):', {
          monTreasury: formatEther(monTreasury),
          monReservoir: formatEther(monReservoir), 
          linkTreasury: formatEther(linkTreasury),
          linkReservoir: formatEther(linkReservoir),
          monCapacity: formatEther(monCapacity),
          linkCapacity: formatEther(linkCapacity),
        })
        
        // FIXED: Use treasury values for vault balances (deep reserves), not reservoir values (tank balances)
        const monVaultBalance = Number(formatEther(monTreasury))
        const linkVaultBalance = Number(formatEther(linkTreasury))
        
        console.log('💰 Calculated vault balances:', {
          monVault: monVaultBalance,
          linkVault: linkVaultBalance,
        })
        
        updateVaultBalance('mon', monVaultBalance)
        updateVaultBalance('link', linkVaultBalance)
        
        console.log('💰 Updated vault balances in store')
      } else {
        console.warn('⚠️ No treasury result received from contract call')
      }

      console.log('✅ Batch fetch completed successfully')
    } catch (error) {
      console.error('❌ Batch fetch failed:', error)
    }
  }

  /**
   * Batch write operations (when supported by the contract)
   */
  const batchWrite = async (calls: BatchCall[]) => {
    if (!walletClient) throw new Error('Wallet client not available')

    try {
      // For now, execute calls sequentially
      // TODO: Implement actual batch write when contract supports it
      const results: BatchResult[] = []

      for (const call of calls) {
        try {
          const txHash = await walletClient.sendTransaction({
            to: call.target,
            data: call.data,
            value: call.value || 0n,
          })

          results.push({ success: true, returnData: txHash as `0x${string}` })
        } catch (error) {
          results.push({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          })
        }
      }

      return results
    } catch (error) {
      console.error('Batch write failed:', error)
      throw error
    }
  }

  /**
   * Optimized balance fetching for multiple tokens
   */
  const fetchUserBalances = async (userAddress: `0x${string}`) => {
    if (!publicClient) return { mon: 0, link: 0 }

    try {
      const calls: BatchCall[] = [
        // MON balance (native)
        {
          target: userAddress,
          data: '0x', // Empty data for balance query
        },
        // LINK balance (ERC20)
        {
          target: LINK_TOKEN_ADDRESS as `0x${string}`,
          data: encodeFunctionData({
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [userAddress],
          }),
        },
      ]

      // Direct balance calls instead of multicall for better compatibility
      const [monBalance, linkBalanceResult] = await Promise.all([
        publicClient.getBalance({ address: userAddress }),
        publicClient.readContract({
          address: LINK_TOKEN_ADDRESS as `0x${string}`,
          abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
          functionName: 'balanceOf',
          args: [userAddress],
        }),
      ])

      return {
        mon: Number(formatEther(monBalance)),
        link: Number(formatEther(linkBalanceResult as bigint)),
      }
    } catch (error) {
      console.error('Failed to fetch user balances:', error)
      return { mon: 0, link: 0 }
    }
  }

  /**
   * Optimized contract state check for CCIP and cooldown operations
   * Uses individual Promise.all calls instead of multicall for better reliability
   */
  const batchContractStateCheck = async (userAddress?: `0x${string}`) => {
    if (!publicClient) return null

    try {
      console.log('🔍 Checking contract state using individual calls...')
      
      // Prepare base calls that are always needed
      const baseCalls = [
        // Check refill in progress
        publicClient.readContract({
          address: FAUCET_ADDRESS as `0x${string}`,
          abi: faucetAbi,
          functionName: 'refillInProgress',
        }),
        // Get cooldown constant
        publicClient.readContract({
          address: FAUCET_ADDRESS as `0x${string}`,
          abi: parseAbi(['function COOLDOWN() view returns (uint256)']),
          functionName: 'COOLDOWN',
        }),
      ]

      // Add user-specific calls if address provided
      const userCalls = userAddress ? [
        // Get user's last MON claim
        publicClient.readContract({
          address: FAUCET_ADDRESS as `0x${string}`,
          abi: parseAbi(['function lastClaimMon(address) view returns (uint256)']),
          functionName: 'lastClaimMon',
          args: [userAddress],
        }),
        // Get user's last LINK claim
        publicClient.readContract({
          address: FAUCET_ADDRESS as `0x${string}`,
          abi: parseAbi(['function lastClaimLink(address) view returns (uint256)']),
          functionName: 'lastClaimLink',
          args: [userAddress],
        }),
      ] : []

      // Execute all calls in parallel
      const results = await Promise.all([...baseCalls, ...userCalls])
      
      if (results.length >= 2) {
        const refillInProgress = results[0] as boolean
        const cooldown = results[1] as bigint

        console.log('📋 Contract State:', {
          refillInProgress,
          cooldown: Number(cooldown),
          userAddress: userAddress || 'none',
        })

        const contractState = {
          refillInProgress,
          cooldown: Number(cooldown),
        }

        // Add user cooldown data if available
        if (userAddress && results.length >= 4) {
          const lastClaimMon = results[2] as bigint
          const lastClaimLink = results[3] as bigint

          const now = Math.floor(Date.now() / 1000)
          const monCooldownRemaining = Math.max(0, Number(cooldown) - (now - Number(lastClaimMon)))
          const linkCooldownRemaining = Math.max(0, Number(cooldown) - (now - Number(lastClaimLink)))

          console.log('⏰ User Cooldowns:', {
            monRemaining: monCooldownRemaining,
            linkRemaining: linkCooldownRemaining,
          })

          return {
            ...contractState,
            userCooldowns: {
              mon: monCooldownRemaining,
              link: linkCooldownRemaining,
            }
          }
        }

        return contractState
      }

      console.warn('⚠️ Contract state check failed, insufficient results')
      return null
    } catch (error) {
      console.error('❌ Contract state check failed:', error)
      return null
    }
  }

  /**
   * Debounced batch update to prevent excessive calls
   */
  let fetchTimeout: NodeJS.Timeout | null = null
  const debouncedFetchAll = () => {
    if (fetchTimeout) clearTimeout(fetchTimeout)
    fetchTimeout = setTimeout(fetchAllFaucetData, 500)
  }

  return {
    batchRead,
    batchWrite,
    fetchAllFaucetData,
    fetchUserBalances,
    debouncedFetchAll,
    batchContractStateCheck,
  }
} 