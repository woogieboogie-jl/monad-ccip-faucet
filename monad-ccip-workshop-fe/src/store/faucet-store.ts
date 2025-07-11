import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// Types
interface TokenState {
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

interface CCIPState {
  status: "idle" | "wallet_pending" | "tx_pending" | "ccip_processing" | "success" | "failed" | "stuck"
  progress: number
  currentPhase?: string
  messageId?: string
  ccipResponseMessageId?: string
  errorMessage?: string
  lastUpdated: Date
  
  // CONSOLIDATION: Additional fields from useCCIPRefill for complete state management
  tankPercentage?: number
  isRefillNeeded?: boolean
  
  // Transaction tracking - Enhanced dual CCIP message support
  monadTxHash?: string
  avalancheTxHash?: string
  
  // Results
  newDripAmount?: number
  refillAmount?: number
  stuckPhase?: string
  
  // Volatility data from CCIP response
  volatilityData?: {
    score: number
    trend: "increasing" | "decreasing" | "stable"
    multiplier: number
    refillDecision: number
  }
}

interface FaucetState {
  // Token states
  tokens: {
    mon: TokenState
    link: TokenState
  }
  
  // CCIP states
  ccip: {
    mon: CCIPState
    link: CCIPState
  }
  
  // Vault balances
  vaults: {
    mon: number
    link: number
  }
  
  // Volatility data
  volatility: {
    score: number
    trend: "increasing" | "decreasing" | "stable"
    multiplier: number
    lastUpdated: Date
    isUpdating: boolean
  }
  
  // UI states
  ui: {
    copiedAddresses: Record<string, boolean>
    dripStates: Record<string, boolean>
    isGasFreeModalOpen: boolean
  }
}

interface FaucetActions {
  // Token operations
  updateTokenState: (token: 'mon' | 'link', updates: Partial<TokenState>) => void
  updateTokenBalance: (token: 'mon' | 'link', balance: number) => void
  setDripLoading: (token: 'mon' | 'link', loading: boolean) => void
  
  // CCIP operations
  updateCCIPState: (token: 'mon' | 'link', updates: Partial<CCIPState>) => void
  resetCCIPState: (token: 'mon' | 'link') => void
  
  // CONSOLIDATION: Enhanced CCIP operations for complete state management
  setCCIPProgress: (token: 'mon' | 'link', progress: number, phase?: string) => void
  setCCIPResult: (token: 'mon' | 'link', result: { newDripAmount?: number; refillAmount?: number; volatilityData?: CCIPState['volatilityData'] }) => void
  setCCIPError: (token: 'mon' | 'link', error: string, stuckPhase?: string) => void
  
  // Vault operations
  updateVaultBalance: (token: 'mon' | 'link', balance: number) => void
  
  // Volatility operations
  updateVolatility: (updates: Partial<FaucetState['volatility']>) => void
  
  // CONSOLIDATION: Volatility utility functions (moved from useVolatility hook)
  getDripMultiplier: () => number
  getVolatilityLevel: () => string
  getVolatilityColor: () => string
  getDripReasoning: () => string
  updateVolatilityScore: (newScore: number) => void
  
  // UI operations
  setCopiedAddress: (address: string, copied: boolean) => void
  setDripState: (token: string, active: boolean) => void
  setGasFreeModalOpen: (open: boolean) => void
  
  // Batch operations
  batchUpdateTokens: (updates: { mon?: Partial<TokenState>, link?: Partial<TokenState> }) => void
  
  // Centralized cooldown management
  startCooldownTimer: () => void
  stopCooldownTimer: () => void
  updateCooldowns: () => void
  
  // Reset operations
  resetAllStates: () => void
}

const initialTokenState: TokenState = {
  tankBalance: 0,
  maxTankBalance: 100, // Updated default capacity
  baseDripAmount: 0,
  currentDripAmount: 0,
  dripCooldownTime: 0,
  requestCooldownTime: 0,
  isDripLoading: false,
  isRequestLoading: false,
  contractAddress: '',
  lowTankThreshold: 30, // 30% of capacity
}

const initialCCIPState: CCIPState = {
  status: "idle",
  progress: 0,
  lastUpdated: new Date(),
  ccipResponseMessageId: undefined,
}

const initialState: FaucetState = {
  tokens: {
    mon: { ...initialTokenState },
    link: { ...initialTokenState },
  },
  ccip: {
    mon: { ...initialCCIPState },
    link: { ...initialCCIPState },
  },
  vaults: {
    mon: 0,
    link: 0,
  },
  volatility: {
    score: 50,
    trend: "stable",
    multiplier: 1,
    lastUpdated: new Date(),
    isUpdating: false,
  },
  ui: {
    copiedAddresses: {},
    dripStates: {},
    isGasFreeModalOpen: false,
  },
}

// Global cooldown timer reference
let cooldownInterval: NodeJS.Timeout | null = null

export const useFaucetStore = create<FaucetState & FaucetActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          ...initialState,
          
          // Token operations
          updateTokenState: (token, updates) =>
            set((state) => {
              Object.assign(state.tokens[token], updates)
            }),
            
          updateTokenBalance: (token, balance) =>
            set((state) => {
              state.tokens[token].tankBalance = balance
            }),
            
          setDripLoading: (token, loading) =>
            set((state) => {
              state.tokens[token].isDripLoading = loading
            }),
          
          // CCIP operations
          updateCCIPState: (token, updates) =>
            set((state) => {
              Object.assign(state.ccip[token], updates, { lastUpdated: new Date() })
            }),
            
          resetCCIPState: (token) =>
            set((state) => {
              state.ccip[token] = { ...initialCCIPState }
            }),
          
          // CONSOLIDATION: Enhanced CCIP operations for complete state management
          setCCIPProgress: (token, progress, phase) =>
            set((state) => {
              state.ccip[token].progress = progress
              if (phase) state.ccip[token].currentPhase = phase
            }),
          
          setCCIPResult: (token, result) =>
            set((state) => {
              state.ccip[token].newDripAmount = result.newDripAmount
              state.ccip[token].refillAmount = result.refillAmount
              state.ccip[token].volatilityData = result.volatilityData
            }),
          
          setCCIPError: (token, error, stuckPhase) =>
            set((state) => {
              state.ccip[token].status = "failed"
              state.ccip[token].errorMessage = error
              state.ccip[token].stuckPhase = stuckPhase
            }),
          
          // Vault operations
          updateVaultBalance: (token, balance) =>
            set((state) => {
              state.vaults[token] = balance
            }),
          
          // Volatility operations
          updateVolatility: (updates) =>
            set((state) => {
              Object.assign(state.volatility, updates, { lastUpdated: new Date() })
            }),
          
          // CONSOLIDATION: Volatility utility functions (moved from useVolatility hook)
          getDripMultiplier: () => {
            const score = get().volatility.score
            if (score <= 20) return 2.0 // Low volatility = higher drip
            if (score <= 40) return 1.5
            if (score <= 60) return 1.0 // Normal drip
            if (score <= 80) return 0.7
            return 0.5 // High volatility = lower drip
          },
          
          getVolatilityLevel: () => {
            const score = get().volatility.score
            if (score <= 20) return "Very Low"
            if (score <= 40) return "Low"
            if (score <= 60) return "Moderate"
            if (score <= 80) return "High"
            return "Very High"
          },
          
          getVolatilityColor: () => {
            const score = get().volatility.score
            if (score <= 20) return "text-green-400"
            if (score <= 40) return "text-green-300"
            if (score <= 60) return "text-yellow-400"
            if (score <= 80) return "text-orange-400"
            return "text-red-400"
          },
          
          getDripReasoning: () => {
            const state = get()
            const score = state.volatility.score
            const level = state.getVolatilityLevel()
            const multiplier = state.getDripMultiplier()

            if (score <= 20) {
              return `${level} volatility detected - increased drip amounts (${multiplier}x) to encourage testing`
            }
            if (score <= 40) {
              return `${level} volatility - slightly increased drip amounts (${multiplier}x) for stable testing`
            }
            if (score <= 60) {
              return `${level} volatility - standard drip amounts (${multiplier}x) maintained`
            }
            if (score <= 80) {
              return `${level} volatility - reduced drip amounts (${multiplier}x) to preserve reserves`
            }
            return `${level} volatility - minimal drip amounts (${multiplier}x) to protect faucet reserves`
          },
          
          updateVolatilityScore: (newScore) =>
            set((state) => {
              const currentScore = state.volatility.score
              const clampedScore = Math.max(1, Math.min(100, newScore)) // Clamp between 1-100
              
              let trend: "increasing" | "decreasing" | "stable" = "stable"
              if (clampedScore > currentScore + 5) trend = "increasing"
              else if (clampedScore < currentScore - 5) trend = "decreasing"
              
              state.volatility.score = clampedScore
              state.volatility.trend = trend
              state.volatility.lastUpdated = new Date()
              
              // Update multiplier based on new score
              state.volatility.multiplier = state.getDripMultiplier()
            }),
          
          // UI operations
          setCopiedAddress: (address, copied) =>
            set((state) => {
              state.ui.copiedAddresses[address] = copied
              if (copied) {
                // Auto-clear after 2 seconds
                setTimeout(() => {
                  set((state) => {
                    state.ui.copiedAddresses[address] = false
                  })
                }, 2000)
              }
            }),
            
          setDripState: (token, active) =>
            set((state) => {
              state.ui.dripStates[token] = active
            }),
            
          setGasFreeModalOpen: (open) =>
            set((state) => {
              state.ui.isGasFreeModalOpen = open
            }),
          
          // Batch operations
          batchUpdateTokens: (updates) =>
            set((state) => {
              if (updates.mon) Object.assign(state.tokens.mon, updates.mon)
              if (updates.link) Object.assign(state.tokens.link, updates.link)
            }),
          
          // Centralized cooldown management
          startCooldownTimer: () => {
            // Prevent multiple timers
            if (cooldownInterval) return
            
            console.log('🕐 Starting centralized cooldown timer')
            cooldownInterval = setInterval(() => {
              get().updateCooldowns()
            }, 1000)
          },
          
          stopCooldownTimer: () => {
            if (cooldownInterval) {
              console.log('⏹️ Stopping centralized cooldown timer')
              clearInterval(cooldownInterval)
              cooldownInterval = null
            }
          },
          
          updateCooldowns: () =>
            set((state) => {
              // Check if any cooldowns are active
              const hasMonCooldowns = state.tokens.mon.dripCooldownTime > 0 || state.tokens.mon.requestCooldownTime > 0
              const hasLinkCooldowns = state.tokens.link.dripCooldownTime > 0 || state.tokens.link.requestCooldownTime > 0
              
              // If no cooldowns are active, stop the timer to save resources
              if (!hasMonCooldowns && !hasLinkCooldowns) {
                if (cooldownInterval) {
                  clearInterval(cooldownInterval)
                  cooldownInterval = null
                  console.log('⏹️ Auto-stopping cooldown timer (no active cooldowns)')
                }
                return // Don't update state if no cooldowns
              }
              
              // Update cooldowns
              if (hasMonCooldowns) {
                state.tokens.mon.dripCooldownTime = Math.max(0, state.tokens.mon.dripCooldownTime - 1)
                state.tokens.mon.requestCooldownTime = Math.max(0, state.tokens.mon.requestCooldownTime - 1)
              }
              
              if (hasLinkCooldowns) {
                state.tokens.link.dripCooldownTime = Math.max(0, state.tokens.link.dripCooldownTime - 1)
                state.tokens.link.requestCooldownTime = Math.max(0, state.tokens.link.requestCooldownTime - 1)
              }
            }),
          
          // Reset operations
          resetAllStates: () => set(() => ({ ...initialState })),
        }))
      ),
      {
        name: 'faucet-store',
        partialize: (state) => ({
          // Only persist certain parts
          volatility: state.volatility,
          ccip: state.ccip,
        }),
      }
    ),
    { name: 'faucet-store' }
  )
)

// Selectors for better performance
export const useTokenState = (token: 'mon' | 'link') =>
  useFaucetStore((state) => state.tokens[token])

export const useCCIPState = (token: 'mon' | 'link') =>
  useFaucetStore((state) => state.ccip[token])

export const useVolatilityState = () =>
  useFaucetStore((state) => state.volatility)

export const useVaultState = () =>
  useFaucetStore((state) => state.vaults)

export const useUIState = () =>
  useFaucetStore((state) => state.ui)

// CONSOLIDATION: Volatility utility selectors (replacing useVolatility hook)
export const useVolatilityUtils = () =>
  useFaucetStore((state) => ({
    getDripMultiplier: state.getDripMultiplier,
    getVolatilityLevel: state.getVolatilityLevel,
    getVolatilityColor: state.getVolatilityColor,
    getDripReasoning: state.getDripReasoning,
    updateVolatilityScore: state.updateVolatilityScore,
  }))

export const useVolatilityData = () =>
  useFaucetStore((state) => ({
    volatility: {
      score: state.volatility.score,
      trend: state.volatility.trend,
      lastUpdate: state.volatility.lastUpdated,
      source: "BTC-based Crypto", // For compatibility with existing components
    },
    isLoading: state.volatility.isUpdating,
  }))

// Computed selectors
export const useTokenThresholdStatus = (token: 'mon' | 'link') =>
  useFaucetStore((state) => {
    const tokenState = state.tokens[token]
    const percentage = (tokenState.tankBalance / tokenState.maxTankBalance) * 100
    const isLow = percentage < 30
    const isCritical = percentage < 10
    
    return { percentage, isLow, isCritical }
  })

export const useAnyRequestActive = () =>
  useFaucetStore((state) => 
    state.ccip.mon.status !== "idle" || state.ccip.link.status !== "idle"
  ) 