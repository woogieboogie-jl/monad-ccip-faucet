import { useState, useEffect } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { monadTestnet } from '@/lib/chain'

interface NetworkSwitchState {
  isWrongNetwork: boolean
  isNetworkModalOpen: boolean
  isSwitching: boolean
  switchError: string | null
  currentChainId: number | undefined
  targetChainId: number
  targetChainName: string
}

export function useNetworkSwitch() {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitchPending, error: switchError } = useSwitchChain()
  
  const [state, setState] = useState<NetworkSwitchState>({
    isWrongNetwork: false,
    isNetworkModalOpen: false,
    isSwitching: false,
    switchError: null,
    currentChainId: undefined,
    targetChainId: monadTestnet.id,
    targetChainName: monadTestnet.name,
  })

  // Check if user is on wrong network
  useEffect(() => {
    if (isConnected && chainId) {
      const isWrongNetwork = chainId !== monadTestnet.id
      setState(prev => ({
        ...prev,
        isWrongNetwork,
        currentChainId: chainId,
        isNetworkModalOpen: isWrongNetwork && !prev.isNetworkModalOpen ? true : prev.isNetworkModalOpen,
      }))
    } else {
      setState(prev => ({
        ...prev,
        isWrongNetwork: false,
        currentChainId: undefined,
      }))
    }
  }, [isConnected, chainId])

  // Handle switch chain loading state
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isSwitching: isSwitchPending,
      switchError: switchError?.message || null,
    }))
  }, [isSwitchPending, switchError])

  const handleSwitchNetwork = async () => {
    try {
      setState(prev => ({ ...prev, switchError: null }))
      await switchChain({ chainId: monadTestnet.id })
      // Modal will close automatically when network changes
    } catch (error) {
      console.error('Failed to switch network:', error)
      setState(prev => ({
        ...prev,
        switchError: error instanceof Error ? error.message : 'Failed to switch network',
      }))
    }
  }

  const closeNetworkModal = () => {
    setState(prev => ({ ...prev, isNetworkModalOpen: false }))
  }

  const openNetworkModal = () => {
    setState(prev => ({ ...prev, isNetworkModalOpen: true }))
  }

  // Auto-close modal when network is correct
  useEffect(() => {
    if (!state.isWrongNetwork && state.isNetworkModalOpen) {
      setState(prev => ({ ...prev, isNetworkModalOpen: false }))
    }
  }, [state.isWrongNetwork, state.isNetworkModalOpen])

  const getNetworkName = (chainId: number): string => {
    switch (chainId) {
      case 1: return 'Ethereum Mainnet'
      case 11155111: return 'Sepolia Testnet'
      case 137: return 'Polygon Mainnet'
      case 80002: return 'Polygon Amoy Testnet'
      case 42161: return 'Arbitrum One'
      case 421614: return 'Arbitrum Sepolia'
      case 10: return 'Optimism Mainnet'
      case 11155420: return 'Optimism Sepolia'
      case 8453: return 'Base Mainnet'
      case 84532: return 'Base Sepolia'
      case 43114: return 'Avalanche Mainnet'
      case 43113: return 'Avalanche Fuji'
      case monadTestnet.id: return monadTestnet.name
      default: return `Chain ${chainId}`
    }
  }

  return {
    ...state,
    handleSwitchNetwork,
    closeNetworkModal,
    openNetworkModal,
    currentNetworkName: state.currentChainId ? getNetworkName(state.currentChainId) : 'Unknown',
    targetNetworkName: state.targetChainName,
  }
} 