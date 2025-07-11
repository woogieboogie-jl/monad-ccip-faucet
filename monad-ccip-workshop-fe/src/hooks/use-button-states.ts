import { formatCooldown } from "@/lib/utils"

interface TokenState {
  tankBalance: number
  currentDripAmount: number
  isDripLoading: boolean
  dripCooldownTime: number
  requestCooldownTime: number
}

interface WalletState {
  isConnected: boolean
  monBalance: number
}

interface GlobalCCIPState {
  status: string
}

export function useDripButtonState(
  token: TokenState,
  wallet: WalletState,
  tokenType: "mon" | "link",
  isTankLow: (type: "mon" | "link") => boolean
) {
  if (!wallet.isConnected) {
    return { text: "Connect Wallet", disabled: true, isGasFree: false }
  }

  // Check if tank is empty or insufficient for drip
  if (token.tankBalance <= 0) {
    return { text: "Tank Empty - Use Refuel", disabled: true, isGasFree: false, isEmpty: true }
  }
  
  if (token.tankBalance < token.currentDripAmount) {
    return { 
      text: `Insufficient Tank (${token.tankBalance} < ${token.currentDripAmount})`, 
      disabled: true, 
      isGasFree: false, 
      isEmpty: true 
    }
  }

  // New user with zero balance - show gas-free option for MON drip only
  if (wallet.monBalance === 0 && tokenType === "mon") {
    return { text: "Get First MON (Gas-Free)", disabled: false, isGasFree: true }
  }

  if (token.isDripLoading) {
    return { text: "Dripping...", disabled: true, loading: true, isGasFree: false }
  }

  if (token.dripCooldownTime > 0) {
    return { text: formatCooldown(token.dripCooldownTime), disabled: true, isGasFree: false }
  }

  return { text: "Drip", disabled: false, isGasFree: false }
}

export function useFuelButtonState(
  token: TokenState,
  wallet: WalletState,
  isTankLow: (type: "mon" | "link") => boolean,
  tokenType: "mon" | "link"
) {
  if (!wallet.isConnected) {
    return { text: "Connect Wallet", disabled: true, canRequest: false }
  }

  if (token.requestCooldownTime > 0) {
    return { text: formatCooldown(token.requestCooldownTime), disabled: true, canRequest: false }
  }

  const isBelowThreshold = isTankLow(tokenType)
  return {
    text: isBelowThreshold ? "Request Volatility & Refill" : "Tank Above Threshold",
    disabled: !isBelowThreshold,
    canRequest: isBelowThreshold,
  }
}

export function useTankStatus(
  token: TokenState,
  isTankLow: (type: "mon" | "link") => boolean,
  tokenType: "mon" | "link",
  maxTankBalance: number
) {
  const isBelowThreshold = isTankLow(tokenType)
  const threshold = Math.floor(maxTankBalance * 0.3)
  
  return {
    status: isBelowThreshold ? "Below Threshold" : "Above Threshold",
    color: isBelowThreshold ? "text-red-400" : "text-green-400",
    isBelowThreshold,
    threshold,
    lastUpdated: new Date() // This should come from the actual data
  }
} 