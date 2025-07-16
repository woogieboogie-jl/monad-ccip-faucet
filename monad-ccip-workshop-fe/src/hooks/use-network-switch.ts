import { useState, useEffect } from 'react'
import { useAccount, useChainId, useSwitchChain, useWalletClient } from 'wagmi'
import { monadTestnet } from '@/lib/chain'

// CONSOLIDATION: NetworkSwitchState is specific to this hook only, so keeping it local
// If this interface is used elsewhere, it should be moved to types.ts
interface NetworkSwitchState {
  isWrongNetwork: boolean
  currentChainId: number | undefined
  targetChainId: number
  targetChainName: string
}

// Get the actual wallet chain ID, bypassing Wagmi's normalization
function getActualChainId(wagmiChainId: number | undefined, walletClient: any): number | undefined {
  // Use window.ethereum.chainId as primary source since it's the only reliable way
  // to detect when wallet is on unsupported chains. Wagmi normalizes unsupported chains
  // to the first configured chain, which is misleading.
  const windowChainId = typeof window !== 'undefined' && (window as any).ethereum?.chainId 
    ? parseInt((window as any).ethereum.chainId, 16) 
    : undefined
  
  return windowChainId ?? walletClient?.chain?.id ?? wagmiChainId
}

export function useNetworkSwitch() {
  const { isConnected } = useAccount()
  const fallbackChainId = useChainId()
  const { data: walletClient } = useWalletClient({})
  
  const [state, setState] = useState<NetworkSwitchState>({
    isWrongNetwork: false,
    currentChainId: undefined,
    targetChainId: monadTestnet.id,
    targetChainName: monadTestnet.name,
  })

  // Listen for chain changes directly from window.ethereum
  useEffect(() => {
    const handleChainChanged = (chainId: string) => {
      const newChainId = parseInt(chainId, 16)
      console.log('[useNetworkSwitch] chain changed event', { newChainId, required: monadTestnet.id })
      
      setState(prev => ({
        ...prev,
        currentChainId: newChainId,
        isWrongNetwork: newChainId !== monadTestnet.id,
      }))
    }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      (window as any).ethereum.on('chainChanged', handleChainChanged)
      
      return () => {
        (window as any).ethereum?.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [])

  // Check if user is on wrong network
  useEffect(() => {
    const actualChainId = getActualChainId(fallbackChainId, walletClient)
    
    if (isConnected && actualChainId) {
      const isWrongNetwork = actualChainId !== monadTestnet.id
      
      console.log('[useNetworkSwitch] network check', {
        actual: actualChainId,
        required: monadTestnet.id,
        isWrongNetwork,
      })
      
      setState(prev => ({
        ...prev,
        isWrongNetwork,
        currentChainId: actualChainId,
      }))
    } else {
      setState(prev => ({
        ...prev,
        isWrongNetwork: false,
        currentChainId: undefined,
      }))
    }
  }, [isConnected, fallbackChainId, walletClient])

  const getNetworkName = (chainId: number): string => {
    return chainId === monadTestnet.id ? monadTestnet.name : 'Unsupported Network'
  }

  return {
    ...state,
    currentNetworkName: state.currentChainId ? getNetworkName(state.currentChainId) : 'Unknown',
    targetNetworkName: state.targetChainName,
  }
} 