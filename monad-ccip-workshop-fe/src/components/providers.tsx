import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config, chains } from '@/lib/wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          chains={chains}
          theme={darkTheme({ accentColor: '#884DFF', accentColorForeground: 'white', borderRadius: 'small' })}
          modalSize="compact"
        >
        {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
} 