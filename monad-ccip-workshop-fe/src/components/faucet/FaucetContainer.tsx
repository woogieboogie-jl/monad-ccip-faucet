import { memo, useCallback, useEffect } from "react"
import { useAccount } from "wagmi"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TokenCard } from "./TokenCard"
import { GasFreeModal } from "@/components/gas-free-modal"
import { useTokenOperations } from "@/hooks/use-token-operations"
import { useBatchOperations } from "@/hooks/use-batch-operations"
import { useUIState, useFaucetStore, useVolatilityState } from "@/store/faucet-store"

interface FaucetContainerProps {
  userBalances: { mon: number; link: number }
  onUpdateUserBalance?: (token: 'mon' | 'link', balance: number) => void
}

export const FaucetContainer = memo(({ userBalances, onUpdateUserBalance }: FaucetContainerProps) => {
  const { address, isConnected } = useAccount()
  const { isGasFreeModalOpen } = useUIState()
  const { setGasFreeModalOpen, updateVolatility } = useFaucetStore()
  const volatility = useVolatilityState()
  const { fetchAllFaucetData, fetchUserBalances } = useBatchOperations()

  // Token operation hooks
  const monOperations = useTokenOperations('mon')
  const linkOperations = useTokenOperations('link')

  // Mock owner check - in production this would be more sophisticated
  const isOwner = address?.toLowerCase() === "0x1234567890123456789012345678901234567890".toLowerCase()

  /**
   * Handle drip operation for any token
   */
  const handleDrip = useCallback(async (tokenType: 'mon' | 'link') => {
    const operations = tokenType === 'mon' ? monOperations : linkOperations
    
    try {
      const result = await operations.executeDrip()
      
      if (result.success) {
        console.log(`✅ ${tokenType.toUpperCase()} drip successful:`, result.txHash)
        
        // Refresh user balances
        if (address && onUpdateUserBalance) {
          const newBalances = await fetchUserBalances(address)
          onUpdateUserBalance('mon', newBalances.mon)
          onUpdateUserBalance('link', newBalances.link)
        }
      } else {
        console.error(`❌ ${tokenType.toUpperCase()} drip failed:`, result.error)
      }
    } catch (error) {
      console.error(`Unexpected error during ${tokenType} drip:`, error)
    }
  }, [monOperations, linkOperations, address, onUpdateUserBalance, fetchUserBalances])

  /**
   * Handle refill operation for any token
   */
  const handleRefill = useCallback(async (tokenType: 'mon' | 'link') => {
    const operations = tokenType === 'mon' ? monOperations : linkOperations
    
    try {
      const result = await operations.executeRefill()
      
      if (result.success) {
        console.log(`✅ ${tokenType.toUpperCase()} CCIP refill initiated:`, result.messageId)
        
        // Update global volatility based on multiplier
        // This would normally come from the CCIP response, but we can update optimistically
        updateVolatility({
          isUpdating: true,
          lastUpdated: new Date(),
        })
      } else {
        console.error(`❌ ${tokenType.toUpperCase()} CCIP refill failed:`, result.error)
      }
    } catch (error) {
      console.error(`Unexpected error during ${tokenType} refill:`, error)
    }
  }, [monOperations, linkOperations, updateVolatility])

  /**
   * Handle gas-free modal success
   */
  const handleGasFreeSuccess = useCallback(() => {
    console.log('✅ Gas-free transaction completed successfully')
    
    // Refresh user balances after gas-free transaction
    if (address && onUpdateUserBalance) {
      setTimeout(async () => {
        const newBalances = await fetchUserBalances(address)
        onUpdateUserBalance('mon', newBalances.mon)
        onUpdateUserBalance('link', newBalances.link)
      }, 2000) // Wait a bit for transaction to be processed
    }
  }, [address, onUpdateUserBalance, fetchUserBalances])

  // Fetch data once on mount
  useEffect(() => {
    fetchAllFaucetData()
  }, [fetchAllFaucetData])

  // Periodic refresh every 30s regardless of connection (public reads)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllFaucetData()
    }, 150000) // OPTIMIZED: 30s → 150s (2.5min) - reduces RPC calls by 80%

    return () => clearInterval(interval)
  }, [fetchAllFaucetData])

  return (
    <TooltipProvider>
      <div className="min-h-screen flex flex-col">
        {/* Hero Section */}
        <div className="flex-1 flex items-center justify-center px-4 pt-24 pb-20 relative z-10">
          <div className="text-center space-y-3">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black starwars-title whitespace-nowrap">
              KEEP CALM AND BUILD WITH
            </h1>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black starwars-title whitespace-nowrap">
              MON & LINK
            </h2>
            
            {/* Volatility Info */}
            <div className="mt-6 inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
              <span className="font-body text-white/70 text-sm">Market Volatility:</span>
              <span className="font-body text-white font-semibold text-sm">{volatility.score}/100</span>
              <span className="font-body text-white/60 text-sm">({volatility.trend})</span>
              <span className="font-body text-purple-300 text-sm">Multiplier: {volatility.multiplier}x</span>
            </div>
          </div>
        </div>

        {/* Token Cards Section */}
        <div className="container mx-auto px-4 space-y-6 lg:space-y-8 pb-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
            {/* MON Token Card */}
            <TokenCard
              tokenType="mon"
              walletAddress={address || null}
              isConnected={isConnected}
              isOwner={isOwner}
              userBalance={userBalances.mon}
              onDrip={handleDrip}
              onRefill={handleRefill}
              onGasFreeModalOpen={() => setGasFreeModalOpen(true)}
              formatCooldown={monOperations.formatCooldown}
            />

            {/* LINK Token Card */}
            <TokenCard
              tokenType="link"
              walletAddress={address || null}
              isConnected={isConnected}
              isOwner={isOwner}
              userBalance={userBalances.link}
              onDrip={handleDrip}
              onRefill={handleRefill}
              formatCooldown={linkOperations.formatCooldown}
            />
          </div>

          {/* Additional Info Section */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-white/5 border border-white/20 rounded-lg p-6 backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div>
                  <h4 className="font-body text-white font-semibold text-sm mb-1">Drip Frequency</h4>
                  <p className="font-body text-white/70 text-xs">Once every 24 hours</p>
                </div>
                <div>
                  <h4 className="font-body text-white font-semibold text-sm mb-1">CCIP Powered</h4>
                  <p className="font-body text-white/70 text-xs">Cross-chain volatility data</p>
                </div>
                <div>
                  <h4 className="font-body text-white font-semibold text-sm mb-1">Gas-Free Option</h4>
                  <p className="font-body text-white/70 text-xs">Account abstraction for first MON</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gas-Free Modal */}
        <GasFreeModal
          isOpen={isGasFreeModalOpen}
          onClose={() => setGasFreeModalOpen(false)}
          onSuccess={handleGasFreeSuccess}
          walletAddress={address || ""}
          dripAmount={monOperations.tokenState.currentDripAmount}
        />
      </div>
    </TooltipProvider>
  )
})

FaucetContainer.displayName = "FaucetContainer" 