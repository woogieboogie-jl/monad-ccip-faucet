import { defineChain } from 'viem'

export const monadTestnet = defineChain({
  id: Number(import.meta.env.VITE_CHAIN_ID ?? 212),
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