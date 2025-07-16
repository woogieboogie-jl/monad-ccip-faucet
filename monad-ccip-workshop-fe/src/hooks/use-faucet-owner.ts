import { useState, useEffect } from 'react'
import { getFaucetSnapshot } from '@/lib/faucetClient'

/**
 * Hook to fetch the faucet contract owner address
 * Uses the consolidated pipeline with caching
 */
export function useFaucetOwner() {
  const [owner, setOwner] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOwner = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const snapshot = await getFaucetSnapshot()
        setOwner(snapshot.owner)
      } catch (err) {
        console.error('Failed to fetch faucet owner:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch owner')
        setOwner(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOwner()
  }, [])

  return { owner, isLoading, error }
}
