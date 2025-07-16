import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, TrendingDown, Minus, Zap, MessageCircle, Info, Coins, Lock, Unlock, LogIn, LogOut, ExternalLink, Network, AlertTriangle } from "lucide-react"
import { formatBalance } from "@/lib/utils"
import { useGlobalCCIP } from "@/hooks/use-global-ccip"
import { useNetworkSwitch } from "@/hooks/use-network-switch"
import { useChainModal } from '@rainbow-me/rainbowkit'
import { getCCIPPhaseText, getCCIPPhaseTooltip } from "@/lib/ccip-utils"

interface WalletState {
  address: string | null
  isConnected: boolean
  isOwner: boolean
  monBalance: number
  linkBalance: number
}

interface VolatilityData {
  score: number
  trend: "increasing" | "decreasing" | "stable"
  lastUpdate: Date
  source: string
}

interface HeaderProps {
  wallet: WalletState
  isConnecting: boolean
  onConnect: () => void
  onDisconnect: () => void
  truncateAddress: (address: string) => string
  volatility: VolatilityData
  getVolatilityColor: () => string
  getVolatilityLevel: () => string
  isDemoMode?: boolean
  onToggleDemoMode?: () => void
}

export function Header({
  wallet,
  isConnecting,
  onConnect,
  onDisconnect,
  truncateAddress,
  volatility,
  getVolatilityColor,
  getVolatilityLevel,
  isDemoMode,
  onToggleDemoMode,
}: HeaderProps) {
  const { globalCCIP, getActiveRequest } = useGlobalCCIP()
  
  // Network switching functionality
  const {
    isWrongNetwork,
    currentNetworkName,
    targetNetworkName,
  } = useNetworkSwitch()
  const { openChainModal } = useChainModal()

  const handleNetworkSwitch = () => {
    if (openChainModal) {
      // Add a delay to ensure the modal doesn't get closed by re-renders
      setTimeout(() => {
        openChainModal()
      }, 200)
    }
  }

  const getTrendIcon = () => {
    switch (volatility.trend) {
      case "increasing":
        return <TrendingUp className="h-3 w-3" />
      case "decreasing":
        return <TrendingDown className="h-3 w-3" />
      default:
        return <Minus className="h-3 w-3" />
    }
  }

  // Remove the duplicate getActiveRequest function - use the one from useGlobalCCIP

  // Simplified wallet address display
  const getWalletDisplayText = () => {
    if (!wallet.address) return ""
    return `${wallet.address.slice(0, 4)}...${wallet.address.slice(-3)}`
  }

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-[100] w-full border-b border-white/20 bg-black/10 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between px-6 py-2">
          {/* Left side - Simple Title */}
          <div className="flex items-center">
            <h1 className="font-body text-white text-xl font-bold tracking-tight">PSEUDO (水道)</h1>
                </div>

          {/* Center - Status Components Wrapper */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <div className="hidden lg:flex items-center bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 space-x-4 border border-white/20 h-8">
                  <div className="flex items-center space-x-2">
                <span className="font-body text-white/70 text-xs">
                  BTC-based Volatility Index:
                        </span>
                        <div className="flex items-center space-x-1">
                          <span className={`font-body text-sm font-semibold ${getVolatilityColor()}`}>
                            {volatility.score}
                          </span>
                          <span className={`${getVolatilityColor()}`}>{getTrendIcon()}</span>
                        </div>
                      </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-white/40 hover:text-white/70 cursor-help transition-colors" />
                    </TooltipTrigger>
                    <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
                      <p className="font-body text-xs">Volatility Level: {getVolatilityLevel()} - Score: {volatility.score}/100 ({volatility.trend})</p>
                    </TooltipContent>
                  </Tooltip>

              {/* CCIP Status Display - Minimal */}
              {(() => {
                const activeRequest = getActiveRequest()
                return activeRequest ? (
                  <>
                    <div className="w-px h-4 bg-white/30"></div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center space-x-2 px-2 cursor-help">
                          {/* Animated Lightning Bolt */}
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/30 to-purple-400/30 rounded-full animate-pulse"></div>
                            <Zap className="h-4 w-4 text-yellow-400 relative z-10 animate-bounce" />
          </div>

                          {/* Just percentage */}
                          <span className="font-body text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-300 text-xs font-bold">
                            {activeRequest.state.progress}%
                          </span>
                          
                          {/* CCIP Explorer Link */}
                          {activeRequest.state.messageId && (
              <button
                              onClick={() => window.open(`https://ccip.chain.link/msg/${activeRequest.state.messageId}`, '_blank')}
                              className="p-0.5 hover:bg-white/10 rounded transition-colors"
              >
                              <ExternalLink className="h-2.5 w-2.5 text-blue-300 hover:text-blue-200" />
              </button>
            )}

                          {/* ENHANCED: Response Message Link (when available) */}
                          {activeRequest.state.ccipResponseMessageId && (
                            <button
                              onClick={() => window.open(`https://ccip.chain.link/msg/${activeRequest.state.ccipResponseMessageId}`, '_blank')}
                              className="p-0.5 hover:bg-white/10 rounded transition-colors"
                            >
                              <ExternalLink className="h-2.5 w-2.5 text-purple-300 hover:text-purple-200" />
                            </button>
                          )}

                          {/* Animated dots */}
                          <div className="flex space-x-1">
                            <div className="w-1 h-1 bg-blue-400 rounded-full animate-ping"></div>
                            <div className="w-1 h-1 bg-purple-400 rounded-full animate-ping" style={{animationDelay: '0.2s'}}></div>
                            <div className="w-1 h-1 bg-cyan-400 rounded-full animate-ping" style={{animationDelay: '0.4s'}}></div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="z-[9999]" side="bottom" sideOffset={5}>
                        <p className="font-body text-xs">
                          {getCCIPPhaseTooltip(activeRequest.state.currentPhase)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </>
                ) : null
              })()}
            </div>
          </div>

          {/* Right side - Balance & Wallet Section */}
          <div className="flex items-center space-x-4">
            {/* Network Indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleNetworkSwitch}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-200 ${
                    isWrongNetwork
                      ? 'bg-red-500/20 border-red-400/40 hover:bg-red-500/30'
                      : 'bg-green-500/20 border-green-400/40 hover:bg-green-500/30'
                  }`}
                >
                  {isWrongNetwork ? (
                    <AlertTriangle className="h-3 w-3 text-red-400" />
                  ) : (
                    <Network className="h-3 w-3 text-green-400" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent className="z-[9999]" side="bottom" sideOffset={5}>
                <p className="font-body text-xs">
                  {isWrongNetwork 
                    ? `Switch to ${targetNetworkName}` 
                    : `Connected to ${currentNetworkName}`
                  }
                </p>
              </TooltipContent>
            </Tooltip>
            
            {wallet.isConnected ? (
              /* Connected State - Balance + Address + Logout */
              <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/20 h-8">
                {/* Balance Section */}
                <div className="flex items-center space-x-3">
                  {/* MON Balance */}
                  <div className="hidden sm:flex items-center space-x-1.5">
                    <img 
                      src="/tokens/mon.png" 
                      alt="MON Token" 
                      className="w-4 h-4 rounded-full shadow-sm border border-white/40"
                      onError={(e) => {
                        // Fallback to styled div if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = document.createElement('div');
                        fallback.className = 'flex items-center justify-center w-4 h-4 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full shadow-sm border border-white/40';
                        const text = document.createElement('span');
                        text.className = 'text-white text-[10px] font-bold';
                        text.textContent = 'M';
                        fallback.appendChild(text);
                        target.parentNode?.appendChild(fallback);
                      }}
                    />
                    <span className="font-body text-white/90 text-xs font-medium">{formatBalance(wallet.monBalance)}</span>
                  </div>

                  {/* Separator */}
                  <div className="hidden sm:block w-px h-3 bg-white/30"></div>

                  {/* LINK Balance */}
                  <div className="hidden sm:flex items-center space-x-1.5">
                    <img 
                      src="/tokens/link.png" 
                      alt="LINK Token" 
                      className="w-4 h-4 rounded-full shadow-sm border border-white/40"
                      onError={(e) => {
                        // Fallback to styled div if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = document.createElement('div');
                        fallback.className = 'flex items-center justify-center w-4 h-4 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full shadow-sm border border-white/40';
                        const icon = document.createElement('div');
                        icon.innerHTML = '<svg class="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
                        fallback.appendChild(icon);
                        target.parentNode?.appendChild(fallback);
                      }}
                    />
                    <span className="font-body text-white/90 text-xs font-medium">{formatBalance(wallet.linkBalance)}</span>
                  </div>
                </div>

                {/* Visual Separator */}
                <div className="mx-3 w-px h-4 bg-white/40"></div>

                {/* Address + Logout Section */}
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-white/80 text-xs">{truncateAddress(wallet.address || '')}</span>
                  <button 
                onClick={onDisconnect}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <LogOut className="h-3 w-3 text-white/60 hover:text-white/90" />
                  </button>
                </div>
              </div>
            ) : (
              /* Not Connected State - Simple Login Button */
              <button
                onClick={onConnect}
                disabled={isConnecting}
                className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/20 rounded-lg px-4 py-2 transition-colors h-8"
              >
                <LogIn className="h-4 w-4 text-white/80" />
                <span className="font-body text-white/90 text-sm font-medium">
                  {isConnecting ? 'Connecting...' : 'Connect'}
                    </span>
              </button>
            )}
            
            {/* Demo Mode Toggle - Icon Only (Admin Only) */}
            {wallet.isConnected && wallet.isOwner && (
                <Tooltip>
                  <TooltipTrigger asChild>
                <button
                  onClick={onToggleDemoMode}
                  className="bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20 h-8 w-8 flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  {isDemoMode ? (
                    <Unlock className="h-3 w-3 text-green-400" />
                  ) : (
                    <Lock className="h-3 w-3 text-red-400" />
                  )}
                </button>
                </TooltipTrigger>
              <TooltipContent className="z-[9999]" side="bottom" sideOffset={5}>
                <p className="font-body text-xs">
                  {isDemoMode ? 'Demo Mode: Unlocked' : 'Demo Mode: Locked'}
                </p>
                </TooltipContent>
              </Tooltip>
            )}
              </div>
            </div>
      </header>
    </TooltipProvider>
  )
}
