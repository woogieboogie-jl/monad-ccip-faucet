import { useChainId, useWalletClient } from 'wagmi'
import { monadTestnet } from '@/lib/chain'

/**
 * useRequireMonad
 *
 * Returns a function that checks if the wallet is connected to Monad Testnet.
 * This is used to disable buttons when on wrong network instead of opening modals.
 *
 * Usage:
 *   const requireMonad = useRequireMonad();
 *   const isCorrectNetwork = requireMonad();
 */
export function useRequireMonad() {
  const fallbackChainId = useChainId()
  const { data: walletClient } = useWalletClient({})

  return () => {
    // Get the actual wallet chain ID directly from window.ethereum
    const windowChainId = typeof window !== 'undefined' && (window as any).ethereum?.chainId 
      ? parseInt((window as any).ethereum.chainId, 16) 
      : undefined

    // Use window.ethereum.chainId as primary source since it's the only reliable way
    // to detect when wallet is on unsupported chains. Wagmi normalizes unsupported chains
    // to the first configured chain, which is misleading.
    const actualChainId = windowChainId ?? walletClient?.chain?.id ?? fallbackChainId

    console.log('[useRequireMonad] chain check', { 
      actual: actualChainId,
      required: monadTestnet.id,
      source: windowChainId ? 'window.ethereum' : 'wagmi'
    })

    // Return true if on correct network, false otherwise
    return actualChainId != null && actualChainId === monadTestnet.id
  }
}