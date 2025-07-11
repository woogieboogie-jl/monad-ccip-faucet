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
  contractAddress: string
  lowTankThreshold: number
}

export interface FaucetState {
  mon: TokenState
  link: TokenState
  vaultMon: number
  vaultLink: number
}

// Volatility types
export interface VolatilityData {
  score: number
  trend: "increasing" | "decreasing" | "stable"
  lastUpdate: Date
  source: string
}

export interface GlobalVolatilityState {
  multiplier: number
  lastUpdated: Date
  isUpdating: boolean
}

// CCIP types
export interface CCIPState {
  status: "idle" | "pending" | "completed" | "failed"
  progress: number
  currentPhase?: string
  messageId?: string
  lastUpdated: Date
}

export interface GlobalCCIPState {
  mon: CCIPState
  link: CCIPState
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