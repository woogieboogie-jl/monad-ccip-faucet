// Wallet and authentication types
export interface WalletState {
  address: string | null
  isConnected: boolean
  isOwner: boolean
  monBalance: number
}

// Token and faucet types
export interface TokenState {
  tankBalance: number
  maxTankBalance: number
  baseDripAmount: number
  currentDripAmount: number
  dripCooldownTime: number
  requestCooldownTime: number
  isDripLoading: boolean
  isRequestLoading: boolean
  isRefreshing: boolean // Show spinner when refreshing tank balance from contract
  contractAddress: string
  lowTankThreshold: number
}

export interface FaucetState {
  mon: TokenState
  link: TokenState
  vaultMon: number
  vaultLink: number
}

// Volatility data structure
export interface VolatilityData {
  score: number
  trend: "increasing" | "decreasing" | "stable"
  multiplier: number
  refillDecision: number
}

// CCIP Phase types - consolidated from all sources
export type CCIPPhase = 
  | "wallet_confirm" 
  | "monad_confirm" 
  | "ccip_pending" 
  | "ccip_confirmed" 
  | "avalanche_confirm" 
  | "ccip_response" 
  | "monad_refill"
  | "initializing"
  | "fetching_volatility"
  | "processing_ccip"
  | "updating_rates"
  | "vault_to_tank"

// CCIP Status types - consolidated from all sources
export type CCIPStatus = 
  | "idle" 
  | "wallet_pending" 
  | "tx_pending" 
  | "ccip_processing" 
  | "success" 
  | "failed" 
  | "stuck"
  | "pending"  // For backward compatibility
  | "completed" // For backward compatibility

// CONSOLIDATED: Unified CCIP State Interface
// This replaces all fragmented interfaces across the codebase
export interface CCIPState {
  // Core status and progress
  status: CCIPStatus
  progress: number
  currentPhase?: CCIPPhase
  lastUpdated: Date
  
  // Transaction tracking - Enhanced dual CCIP message support
  messageId?: string // Primary messageId (for backward compatibility)
  ccipMessageId?: string // Outbound message (Monad → Avalanche)
  ccipResponseMessageId?: string // Inbound message (Avalanche → Monad)
  monadTxHash?: string
  avalancheTxHash?: string
  transactionHash?: string // For backward compatibility
  
  // State management
  tankPercentage?: number
  isRefillNeeded?: boolean
  hasOutboundMessage?: boolean // indicates tx broadcast but real messageId not yet known
  
  // Results and completion data
  newDripAmount?: number
  refillAmount?: number
  volatilityData?: VolatilityData
  
  // Error handling
  errorMessage?: string
  stuckPhase?: string
}

// CONSOLIDATED: Global CCIP State
export interface GlobalCCIPState {
  mon: CCIPState
  link: CCIPState
  universalVolatility?: {
    score: number
    trend: "increasing" | "decreasing" | "stable"
    multiplier: number
    lastUpdated: Date
  }
}

// CONSOLIDATION: Global volatility state interface
export interface GlobalVolatilityState {
  multiplier: number
  lastUpdated: Date
  isUpdating: boolean
}

// CCIP Monitoring Configuration
export interface CCIPMonitorConfig {
  messageId: string
  tokenType: 'mon' | 'link'
  currentPhase: string
  onPhaseUpdate: (phase: string, progress: number, data?: any) => void
  onComplete: (result: any) => void
  onError: (error: string) => void
}

// CCIP Monitoring State
export interface CCIPMonitoringState {
  isActive: boolean
  lastBlockChecked: bigint
  failureCount: number
  nextCheckTime: number
}

// UI Component types
export type ButtonVariant = "primary" | "secondary" | "green" | "red" | "blue" | "orange"
export type ButtonState = "enabled" | "disabled" | "loading"
export type StatusLevel = "good" | "warning" | "critical"
export type AlertType = "info" | "success" | "warning" | "error"

// Status threshold types
export interface StatusThresholds {
  critical: number
  warning: number
}

// Button state types
export interface DripButtonState {
  text: string
  disabled: boolean
  isGasFree?: boolean
  isEmpty?: boolean
  loading?: boolean
}

export interface FuelButtonState {
  text: string
  disabled: boolean
  canRequest: boolean
}

export interface TankStatusState {
  status: string
  color: string
  isBelowThreshold: boolean
  threshold: number
  lastUpdated: Date
} 