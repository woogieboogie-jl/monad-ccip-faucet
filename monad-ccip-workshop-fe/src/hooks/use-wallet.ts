

import { useState } from "react"

interface WalletState {
  address: string | null
  isConnected: boolean
  isOwner: boolean
  monBalance: number // Add MON balance tracking
}

export function useWallet() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    isOwner: false,
    monBalance: 0, // Start with 0 balance for new users
  })
  const [isConnecting, setIsConnecting] = useState(false)

  // Mock owner address for demo
  const OWNER_ADDRESS = "0x1234567890123456789012345678901234567890"

  const connectWallet = async () => {
    setIsConnecting(true)

    // Simulate wallet connection
    setTimeout(() => {
      const mockAddress = "0x1234567890123456789012345678901234567890"
      // Simulate random balance - some users have 0, others have existing balance
      const mockBalance = Math.random() > 0.5 ? 0 : Math.floor(Math.random() * 100)

      setWallet({
        address: mockAddress,
        isConnected: true,
        isOwner: mockAddress.toLowerCase() === OWNER_ADDRESS.toLowerCase(),
        monBalance: mockBalance,
      })
      setIsConnecting(false)
    }, 1000)
  }

  const disconnectWallet = () => {
    setWallet({
      address: null,
      isConnected: false,
      isOwner: false,
      monBalance: 0,
    })
  }

  const updateMonBalance = (newBalance: number) => {
    setWallet((prev) => ({ ...prev, monBalance: newBalance }))
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return {
    ...wallet,
    isConnecting,
    connectWallet,
    disconnectWallet,
    updateMonBalance,
    truncateAddress,
  }
}
