/**
 * Shared CCIP utilities for phase management and display
 */

export const getCCIPPhaseText = (phase?: string): string => {
  switch (phase) {
    case "wallet_confirm":
      return "⚡ Wallet confirmation..."
    case "monad_confirm":
      return "🔗 CCIP Transaction sent..."
    case "ccip_pending":
      return "🌐 CCIP transaction pending..."
    case "ccip_confirmed":
      return "📡 CCIP transaction confirmed on Monad..."
    case "avalanche_confirm":
      return "⌛ Waiting for finality from Monad..."
    case "ccip_response":
      return "📡 Waiting for finality from Avalanche..."
    case "monad_refill":
      return "🔄 Refilling tank..."
    case "initializing":
      return "⚡ Initializing..."
    case "fetching_volatility":
      return "🌐 Fetching volatility..."
    case "processing_ccip":
      return "📡 Processing..."
    case "updating_rates":
      return "⚡ Updating rates..."
    case "vault_to_tank":
      return "🔄 Refilling..."
    default:
      return "Processing..."
  }
}

export const getCCIPPhaseTooltip = (phase?: string): string => {
  switch (phase) {
    case "wallet_confirm":
      return "Waiting for wallet confirmation"
    case "monad_confirm":
      return "Transaction submitted to Monad - waiting for confirmation"
    case "ccip_pending":
      return "CCIP message pending - cross-chain request initiated"
    case "ccip_confirmed":
      return "CCIP message confirmed - waiting for finality from Monad"
    case "avalanche_confirm":
      return "Volatility data request received from Monad"
    case "ccip_response":
      return "Waiting for Avalanche → Monad CCIP response (finality)"
    case "monad_refill":
      return "Refilling tank from vault based on volatility data"
    default:
      return "Processing cross-chain volatility request"
  }
}

/**
 * Get the progress percentage for a given CCIP phase
 */
export const getCCIPPhaseProgress = (phase?: string): number => {
  switch (phase) {
    case "wallet_confirm":
      return 10
    case "monad_confirm":
      return 25
    case "ccip_pending":
      return 40
    case "ccip_confirmed":
      return 60
    case "avalanche_confirm":
      return 75
    case "ccip_response":
      return 85
    case "monad_refill":
      return 95
    default:
      return 50
  }
}

/**
 * Check if a CCIP phase is considered "active" (in progress)
 */
export const isCCIPPhaseActive = (status?: string): boolean => {
  return status === "tx_pending" || 
         status === "ccip_processing" || 
         status === "wallet_pending"
}

/**
 * Get the next expected phase in the CCIP flow
 */
export const getNextCCIPPhase = (currentPhase?: string): string | null => {
  switch (currentPhase) {
    case "wallet_confirm":
      return "monad_confirm"
    case "monad_confirm":
      return "ccip_pending"
    case "ccip_pending":
      return "ccip_confirmed"
    case "ccip_confirmed":
      return "avalanche_confirm"
    case "avalanche_confirm":
      return "ccip_response"
    case "ccip_response":
      return "monad_refill"
    case "monad_refill":
      return null // Final phase
    default:
      return null
  }
} 