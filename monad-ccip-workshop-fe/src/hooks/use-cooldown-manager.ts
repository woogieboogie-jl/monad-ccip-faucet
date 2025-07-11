import { useEffect } from 'react'
import { useFaucetStore } from '@/store/faucet-store'

/**
 * Centralized cooldown manager hook
 * 
 * This hook manages a single 1-second interval for all cooldown timers
 * across the entire application, replacing multiple individual timers.
 * 
 * Features:
 * - Single interval for the entire app
 * - Auto-starts when cooldowns are set
 * - Auto-stops when no cooldowns are active
 * - Prevents multiple timer instances
 */
export function useCooldownManager() {
  const { startCooldownTimer, stopCooldownTimer, updateCooldowns } = useFaucetStore()

  // Start the timer on mount
  useEffect(() => {
    startCooldownTimer()
    
    // Cleanup on unmount
    return () => {
      stopCooldownTimer()
    }
  }, [startCooldownTimer, stopCooldownTimer])

  // Expose manual controls (for testing or special cases)
  return {
    startTimer: startCooldownTimer,
    stopTimer: stopCooldownTimer,
    updateCooldowns,
  }
}

/**
 * Auto-starting cooldown manager
 * 
 * Use this when you want cooldowns to be set and automatically
 * start the centralized timer if it's not already running.
 */
export function useAutoCooldownManager() {
  const { startCooldownTimer } = useFaucetStore()

  const setCooldown = (token: 'mon' | 'link', type: 'drip' | 'request', seconds: number) => {
    const { updateTokenState } = useFaucetStore.getState()
    
    // Set the cooldown
    if (type === 'drip') {
      updateTokenState(token, { dripCooldownTime: seconds })
    } else {
      updateTokenState(token, { requestCooldownTime: seconds })
    }
    
    // Ensure timer is running
    startCooldownTimer()
    
    console.log(`⏱️ Set ${token} ${type} cooldown: ${seconds}s`)
  }

  return {
    setCooldown,
    setDripCooldown: (token: 'mon' | 'link', seconds: number) => setCooldown(token, 'drip', seconds),
    setRequestCooldown: (token: 'mon' | 'link', seconds: number) => setCooldown(token, 'request', seconds),
  }
} 