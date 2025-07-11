// Contract addresses from environment variables
// SIMPLIFIED: Vite config automatically maps FAUCET_ADDRESS -> VITE_FAUCET_ADDRESS

// Primary addresses - Vite config handles the mapping from base variables
export const FAUCET_ADDRESS: string = import.meta.env.VITE_FAUCET_ADDRESS as string
export const HELPER_ADDRESS: string | undefined = import.meta.env.VITE_HELPER_ADDRESS as string | undefined

// Optional token addresses (used for display & explorer links)
export const LINK_TOKEN_ADDRESS: string | undefined = import.meta.env.VITE_LINK_TOKEN_ADDRESS as string | undefined
export const MON_TOKEN_ADDRESS: string | undefined = undefined // native token on Monad

// Validate required addresses
if (!FAUCET_ADDRESS) {
  throw new Error('FAUCET_ADDRESS environment variable is required')
} 