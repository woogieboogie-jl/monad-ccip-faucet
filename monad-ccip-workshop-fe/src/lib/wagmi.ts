import { createConfig, http } from 'wagmi'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'
import { mainnet, sepolia, polygon, optimism, arbitrum, base } from 'wagmi/chains'

import { monadTestnet, avalancheFuji } from './chain'

// WalletConnect project ID (obtain one at https://cloud.walletconnect.com)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo'

export const chains = [monadTestnet] as const

export const config = createConfig({
  chains,
  connectors: [
    injected(),
    coinbaseWallet({
      appName: 'Monad CCIP Faucet',
      appLogoUrl: 'https://via.placeholder.com/128',
    }),
    walletConnect({ projectId }),
  ],
  transports: Object.fromEntries(
    chains.map((c) => [c.id, http()])
  ),
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
} 