// New aggregated faucet client for minimal RPC usage
import { publicClient } from '@/lib/viem'
import { parseAbi } from 'viem'
import { FAUCET_ADDRESS } from '@/lib/addresses'
import { cachedContractRead } from '@/lib/request-cache'

const faucetAbi = parseAbi([
  // Reservoir + drip
  'function getReservoirStatus() view returns (uint256 monPool,uint256 monDrip,uint256 linkPool,uint256 linkDrip)',
  // Treasury vs reservoir split
  'function getTreasuryStatus() view returns (uint256 monTreasury,uint256 monReservoir,uint256 linkTreasury,uint256 linkReservoir,uint256 monCap,uint256 linkCap)',
  // Global constants
  'function COOLDOWN() view returns (uint256)',
  'function thresholdFactor() view returns (uint256)',
  // User-specific timestamps
  'function lastClaimMon(address) view returns (uint256)',
  'function lastClaimLink(address) view returns (uint256)'
])

export interface FaucetSnapshot {
  mon: { pool: bigint; drip: bigint }
  link: { pool: bigint; drip: bigint }
  treasury: { mon: bigint; link: bigint }
  constants: { cooldown: number; thresholdFactor: number }
  lastClaim?: { mon: bigint; link: bigint }
}

/**
 * Aggregate every read we need into a single RPC round-trip (3 ‑> 1).
 * Pass the current user address if you need cooldown data.
 * NOW WITH CACHING: Prevents duplicate calls within 30 seconds
 */
export async function getFaucetSnapshot(user?: `0x${string}`): Promise<FaucetSnapshot> {
  // Use cached contract reads with different TTL based on data type
  const calls: Promise<any>[] = [
    // Tank data changes more frequently - shorter cache (30s)
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
    
    // Constants never change - very long cache (5 minutes)
    cachedContractRead(
      'COOLDOWN',
      () => publicClient.readContract({
        address: FAUCET_ADDRESS as `0x${string}`,
        abi: faucetAbi,
        functionName: 'COOLDOWN',
      }),
      [],
      5 * 60 * 1000 // 5 minutes
    ),
    
    cachedContractRead(
      'thresholdFactor',
      () => publicClient.readContract({
        address: FAUCET_ADDRESS as `0x${string}`,
        abi: faucetAbi,
        functionName: 'thresholdFactor',
      }),
      [],
      5 * 60 * 1000 // 5 minutes
    ),
  ]

  if (user) {
    // User-specific data - medium cache (45s)
    calls.push(
      cachedContractRead(
        'lastClaimMon',
        () => publicClient.readContract({
          address: FAUCET_ADDRESS as `0x${string}`,
          abi: faucetAbi,
          functionName: 'lastClaimMon',
          args: [user],
        }),
        [user],
        45 * 1000 // 45 seconds
      ),
      
      cachedContractRead(
        'lastClaimLink',
        () => publicClient.readContract({
          address: FAUCET_ADDRESS as `0x${string}`,
          abi: faucetAbi,
          functionName: 'lastClaimLink',
          args: [user],
        }),
        [user],
        45 * 1000 // 45 seconds
      )
    )
  }

  const results = await Promise.all(calls)

  const [reservoir, treasury, cooldownB, threshB, ...claims] = results

  const [monPool, monDrip, linkPool, linkDrip] = reservoir as [bigint, bigint, bigint, bigint]
  // FIXED: Properly destructure all 6 values from getTreasuryStatus: (monTreasury, monReservoir, linkTreasury, linkReservoir, monCapacity, linkCapacity)
  const [monTreasury, monReservoir, linkTreasury, linkReservoir, monCapacity, linkCapacity] = treasury as [bigint, bigint, bigint, bigint, bigint, bigint]

  return {
    mon: { pool: monPool, drip: monDrip },
    link: { pool: linkPool, drip: linkDrip },
    treasury: { mon: monTreasury, link: linkTreasury },
    constants: {
      cooldown: Number(cooldownB as bigint),
      thresholdFactor: Number(threshB as bigint),
    },
    lastClaim: user ? { mon: claims[0] as bigint, link: claims[1] as bigint } : undefined,
  }
} 