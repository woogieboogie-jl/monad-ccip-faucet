import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Header } from '@/components/header'
import { FaucetSection } from '@/components/faucet-section'
import { VolatilityCard } from '@/components/volatility/VolatilityCard'
import { VaultStatus } from '@/components/vault-status'
import { CollapsibleSection } from '@/components/collapsible-section'
import { TokenRain } from '@/components/token-rain'
import { NetworkSwitchModal } from '@/components/network-switch-modal'
// CONSOLIDATION: Use Zustand volatility state instead of useVolatility hook
import { useVolatilityData, useVolatilityUtils } from '@/store/faucet-store'
import { useNetworkSwitch } from '@/hooks/use-network-switch'
import { Activity, Vault } from 'lucide-react'
import { publicClient } from '@/lib/viem'
import { formatEther, parseAbi } from 'viem'
import { LINK_TOKEN_ADDRESS } from '@/lib/addresses'
import { cachedContractRead } from '@/lib/request-cache'

// Mock owner address for demo
const OWNER_ADDRESS = "0x1234567890123456789012345678901234567890"

export function HomePage() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [monBalance, setMonBalance] = useState(0)
  const [linkBalance, setLinkBalance] = useState(0)
  const [isDemoMode, setIsDemoMode] = useState(true) // For easy vault access
  
  // CONSOLIDATION: Use Zustand volatility state instead of useVolatility hook
  const { volatility, isLoading: isVolatilityLoading } = useVolatilityData()
  const {
    getDripMultiplier,
    getVolatilityLevel,
    getVolatilityColor,
    getDripReasoning,
    updateVolatilityScore,
  } = useVolatilityUtils()
  
  // Network switching functionality
  const {
    isWrongNetwork,
    isNetworkModalOpen,
    isSwitching,
    switchError,
    currentNetworkName,
    targetNetworkName,
    handleSwitchNetwork,
    closeNetworkModal,
  } = useNetworkSwitch()
  
  // Mock fetchVolatilityData for backward compatibility (not used in current flow)
  const fetchVolatilityData = async () => {
    // This function is not used in the current flow since volatility updates come from CCIP
    console.log('fetchVolatilityData called - volatility updates now come from CCIP responses')
  }

  // Fetch real MON and LINK balances from blockchain when wallet connects
  useEffect(() => {
    const fetchBalances = async () => {
      if (!address || !isConnected) {
        console.log('HomePage: No address or not connected, setting balances to 0')
        setMonBalance(0)
        setLinkBalance(0)
        return
      }

      try {
        console.log('HomePage: Fetching balances for address:', address)
        
        const linkTokenAbi = parseAbi(['function balanceOf(address) view returns (uint256)'])

        // Use cached contract reads for user balances
        const [monBalanceRaw, linkBalanceRaw] = await Promise.all([
          cachedContractRead(
            'userMonBalance',
            () => publicClient.getBalance({ address }),
            [address],
            30 * 1000 // 30 seconds cache for user balances
          ),
          LINK_TOKEN_ADDRESS ? cachedContractRead(
            'userLinkBalance',
            () => publicClient.readContract({
              address: LINK_TOKEN_ADDRESS as `0x${string}`,
              abi: linkTokenAbi,
              functionName: 'balanceOf',
              args: [address],
            }) as Promise<bigint>,
            [address],
            30 * 1000 // 30 seconds cache for user balances
          ) : Promise.resolve(0n)
        ])

        setMonBalance(Number(formatEther(monBalanceRaw)))
        setLinkBalance(Number(formatEther(linkBalanceRaw)))
      } catch (error) {
        console.error('Failed to fetch balances:', error)
        setMonBalance(0)
        setLinkBalance(0)
      }
    }

    fetchBalances()

    // OPTIMIZED: Increased interval from 30s to 60s since we have caching
    const interval = setInterval(fetchBalances, 60000)
    return () => clearInterval(interval)
  }, [address, isConnected])

  // Mock wallet state for compatibility with existing components
  const walletState = {
    address: address || null,
    isConnected,
    isOwner: isDemoMode ? isConnected : address?.toLowerCase() === OWNER_ADDRESS.toLowerCase(),
    monBalance,
    linkBalance,
  }

  const updateMonBalance = (newBalance: number) => {
    setMonBalance(newBalance)
    
    // Also fetch the real balance to ensure accuracy
    if (address && isConnected) {
      setTimeout(async () => {
        try {
          const realBalance = await publicClient.getBalance({ address })
          const realBalanceInEther = Number(formatEther(realBalance))
          setMonBalance(realBalanceInEther)
        } catch (error) {
          console.error('Failed to refresh real MON balance:', error)
        }
      }, 2000) // Wait 2 seconds for transaction to be mined
    }
  }

  // Manual balance refresh function
  const refreshBalances = async () => {
    if (!address || !isConnected) return
    
    try {
      // Refresh MON balance
      const monBalanceRaw = await publicClient.getBalance({ address })
      const monBalanceInEther = Number(formatEther(monBalanceRaw))
      setMonBalance(monBalanceInEther)

      // Refresh LINK balance
      if (LINK_TOKEN_ADDRESS) {
        const linkTokenAbi = parseAbi([
          'function balanceOf(address owner) view returns (uint256)'
        ])
        const linkBalanceRaw = await publicClient.readContract({
          address: LINK_TOKEN_ADDRESS as `0x${string}`,
          abi: linkTokenAbi,
          functionName: 'balanceOf',
          args: [address],
        }) as bigint
        const linkBalanceInEther = Number(formatEther(linkBalanceRaw))
        setLinkBalance(linkBalanceInEther)
      }
    } catch (error) {
      console.error('Failed to refresh balances:', error)
    }
  }

  // Update global volatility when CCIP request completes
  const updateGlobalVolatility = (volatilityMultiplier: number) => {
    // Convert multiplier back to score for volatility display
    const newScore = volatilityMultiplier >= 2.0 ? 20 
                   : volatilityMultiplier >= 1.5 ? 40
                   : volatilityMultiplier >= 1.0 ? 60
                   : volatilityMultiplier >= 0.7 ? 80
                   : 90
    updateVolatilityScore(newScore)
  }

  const setVolatilityUpdating = (updating: boolean) => {
    // This can be used for additional UI states if needed
  }

  const connectWallet = async () => {
    // Connect with the first available connector (usually MetaMask/Injected)
    const connector = connectors[0]
    if (connector) {
      connect({ connector })
    }
  }

  const disconnectWallet = () => {
    disconnect()
    setMonBalance(0)
    setLinkBalance(0)
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="min-h-screen bg-monad-gradient relative">
      {/* Dynamic Token Rain Background */}
      <TokenRain />
      
      <Header
        wallet={walletState}
        isConnecting={isPending}
        onConnect={connectWallet}
        onDisconnect={disconnectWallet}
        truncateAddress={truncateAddress}
        volatility={volatility}
        getVolatilityColor={getVolatilityColor}
        getVolatilityLevel={getVolatilityLevel}
        isDemoMode={isDemoMode}
        onToggleDemoMode={() => setIsDemoMode(!isDemoMode)}
      />

      <main className="space-y-8 pb-8">
        {/* 1. Faucet Section - Always visible */}
        <FaucetSection
          wallet={walletState}
          updateMonBalance={updateMonBalance}
          volatilityMultiplier={getDripMultiplier()}
          volatilityReasoning={getDripReasoning()}
          updateGlobalVolatility={updateGlobalVolatility}
          setVolatilityUpdating={setVolatilityUpdating}
        />

        {/* Separator Line */}
        <div className="container mx-auto px-4">
          <div className="w-full max-w-4xl mx-auto">
            <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
          </div>
        </div>

        {/* 3. Volatility Status - Collapsible */}
        <div className="container mx-auto px-4">
          <CollapsibleSection title="Volatility Status" icon={<Activity className="h-4 w-4" />} defaultOpen={true}>
            <VolatilityCard
              volatility={volatility}
              getVolatilityLevel={getVolatilityLevel}
              getDripMultiplier={getDripMultiplier}
            />
          </CollapsibleSection>
        </div>

        {/* 3. Vault Status - Collapsible (Admin only) */}
        {walletState.isOwner && (
          <div className="container mx-auto px-4">
            <CollapsibleSection title="Vault Status" icon={<Vault className="h-4 w-4" />} defaultOpen={true}>
              <VaultStatus isOwner={walletState.isOwner} />
            </CollapsibleSection>
          </div>
        )}
      </main>
      
      {/* Network Switch Modal */}
      <NetworkSwitchModal
        isOpen={isNetworkModalOpen}
        onClose={closeNetworkModal}
        onSwitchNetwork={handleSwitchNetwork}
        currentNetworkName={currentNetworkName}
        targetNetworkName={targetNetworkName}
        isSwitching={isSwitching}
        switchError={switchError}
      />
    </div>
  )
} 