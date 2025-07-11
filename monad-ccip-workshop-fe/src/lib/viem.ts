import { createPublicClient, http } from 'viem'
import { type Transport } from 'viem'
import { monadTestnet } from './chain'
 
export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(monadTestnet.rpcUrls.default.http[0] as string) as Transport,
}) 