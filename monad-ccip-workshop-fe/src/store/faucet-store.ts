import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { TokenState, CCIPState, VolatilityData, CCIPPhase } from '@/lib/types'

// CONSOLIDATION: Use unified interfaces from types.ts instead of local duplicates
// Renamed to FaucetStoreState to distinguish from external FaucetState interface
interface FaucetStoreState {
  // Token states
  tokens: {
    mon: TokenState
    link: TokenState
  }
  
  // CCIP states - using unified interface
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
  setCCIPProgress: (token: 'mon' | 'link', progress: number, phase?: CCIPPhase) => void
  setCCIPResult: (token: 'mon' | 'link', result: { newDripAmount?: number; refillAmount?: number; volatilityData?: VolatilityData }) => void
  setCCIPError: (token: 'mon' | 'link', error: string, stuckPhase?: string) => void
  
  // Vault operations
  updateVaultBalance: (token: 'mon' | 'link', balance: number) => void
  
  // Volatility operations
  updateVolatility: (updates: Partial<FaucetStoreState['volatility']>) => void
  
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
  isRefreshing: false,
  contractAddress: '',
  lowTankThreshold: 30, // 30% of capacity
}

const initialCCIPState: CCIPState = {
  status: "idle",
  progress: 0,
  lastUpdated: new Date(),
  ccipResponseMessageId: undefined,
}

const initialState: FaucetStoreState = {
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

export const useFaucetStore = create<FaucetStoreState & FaucetActions>()(
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
              Object.assign(state.volatility, updates)
            }),
          
          // CONSOLIDATION: Volatility utility functions (moved from useVolatility hook)
          getDripMultiplier: () => {
            const state = get()
            return state.volatility.multiplier
          },
          
          getVolatilityLevel: () => {
            const state = get()
            const score = state.volatility.score
            if (score <= 20) return "Very Low"
            if (score <= 40) return "Low"
            if (score <= 60) return "Medium"
            if (score <= 80) return "High"
            return "Very High"
          },
          
          getVolatilityColor: () => {
            const state = get()
            const score = state.volatility.score
            if (score <= 20) return "text-green-400"
            if (score <= 40) return "text-green-300"
            if (score <= 60) return "text-yellow-400"
            if (score <= 80) return "text-orange-400"
            return "text-red-400"
          },
          
          getDripReasoning: () => {
            const state = get()
            const score = state.volatility.score
            if (score <= 20) return "Market is stable - standard drip rates"
            if (score <= 40) return "Low volatility - slightly reduced drip rates"
            if (score <= 60) return "Medium volatility - moderate drip adjustments"
            if (score <= 80) return "High volatility - increased drip rates"
            return "Very high volatility - maximum drip rates"
          },
          
          updateVolatilityScore: (newScore) =>
            set((state) => {
              const currentScore = state.volatility.score
              let trend: "increasing" | "decreasing" | "stable" = "stable"
              if (newScore > currentScore + 5) trend = "increasing"
              else if (newScore < currentScore - 5) trend = "decreasing"
              
              state.volatility.score = Math.max(1, Math.min(100, newScore))
              state.volatility.trend = trend
              state.volatility.multiplier = 1.0 + (newScore - 50) / 100
              state.volatility.lastUpdated = new Date()
            }),
          
          // UI operations
          setCopiedAddress: (address, copied) =>
            set((state) => {
              state.ui.copiedAddresses[address] = copied
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
          
          // PHASE 4C: Optimized cooldown management
          startCooldownTimer: () => {
            if (cooldownInterval) return // Already running
            
            cooldownInterval = setInterval(() => {
              const state = get()
              const hasMonCooldowns = state.tokens.mon.dripCooldownTime > 0 || state.tokens.mon.requestCooldownTime > 0
              const hasLinkCooldowns = state.tokens.link.dripCooldownTime > 0 || state.tokens.link.requestCooldownTime > 0
              
              if (!hasMonCooldowns && !hasLinkCooldowns) {
                // Auto-stop timer when no cooldowns are active
                if (cooldownInterval) {
                  clearInterval(cooldownInterval)
                  cooldownInterval = null
                }
                return
              }
              
              // Update cooldowns
              state.updateCooldowns()
            }, 1000)
          },
          
          stopCooldownTimer: () => {
            if (cooldownInterval) {
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
        // PHASE 4C: Optimized persistence - only persist essential data
        partialize: (state) => ({
          // Only persist essential long-term data
          volatility: {
            score: state.volatility.score,
            trend: state.volatility.trend,
            multiplier: state.volatility.multiplier,
            lastUpdated: state.volatility.lastUpdated,
            // Don't persist isUpdating (transient state)
          },
          ccip: {
            mon: {
              status: state.ccip.mon.status,
              progress: state.ccip.mon.progress,
              currentPhase: state.ccip.mon.currentPhase,
              ccipMessageId: state.ccip.mon.ccipMessageId,
              ccipResponseMessageId: state.ccip.mon.ccipResponseMessageId,
              monadTxHash: state.ccip.mon.monadTxHash,
              // Don't persist lastUpdated (will be regenerated)
            },
            link: {
              status: state.ccip.link.status,
              progress: state.ccip.link.progress,
              currentPhase: state.ccip.link.currentPhase,
              ccipMessageId: state.ccip.link.ccipMessageId,
              ccipResponseMessageId: state.ccip.link.ccipResponseMessageId,
              monadTxHash: state.ccip.link.monadTxHash,
            },
          },
          // Don't persist tokens (will be refreshed from contract)
          // Don't persist vaults (will be refreshed from contract)
          // Don't persist ui (transient state)
        }),
        // PHASE 4C: Add storage event handling for better multi-tab sync
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Restore lastUpdated dates after rehydration
            state.volatility.lastUpdated = new Date(state.volatility.lastUpdated)
            state.ccip.mon.lastUpdated = new Date()
            state.ccip.link.lastUpdated = new Date()
          }
        },
      }
    ),
    { 
      name: 'faucet-store',
      // PHASE 4C: Optimize devtools for production
      enabled: process.env.NODE_ENV === 'development',
    }
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