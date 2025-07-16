import { defineChain } from 'viem'

// Validate VITE_CHAIN_ID eagerly so we fail fast if the env is missing or malformed
const envChainId = import.meta.env.VITE_CHAIN_ID
if (!envChainId) {
  throw new Error('VITE_CHAIN_ID env variable is required but was not found. Please define it in your .env file (e.g. VITE_CHAIN_ID=10143).')
}
const MONAD_TESTNET_ID = Number(envChainId)
if (!Number.isFinite(MONAD_TESTNET_ID) || MONAD_TESTNET_ID <= 0) {
  throw new Error(`VITE_CHAIN_ID must be a positive integer, got "${envChainId}"`)
}

export const monadTestnet = defineChain({
  id: MONAD_TESTNET_ID,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_MONAD_TESTNET_RPC_URL as string] },
    public: { http: [import.meta.env.VITE_MONAD_TESTNET_RPC_URL as string] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com' },
  },
  testnet: true,
})

export const avalancheFuji = defineChain({
  id: 43113,
  name: 'Avalanche Fuji',
  network: 'avalanche-fuji',
  nativeCurrency: {
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_AVALANCHE_FUJI_RPC_URL as string] },
    public: { http: [import.meta.env.VITE_AVALANCHE_FUJI_RPC_URL as string] },
  },
  blockExplorers: {
    default: { name: 'Snowtrace', url: 'https://testnet.snowtrace.io' },
  },
  testnet: true,
}) 