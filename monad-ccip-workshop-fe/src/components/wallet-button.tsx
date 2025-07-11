import { useAccount, useDisconnect } from 'wagmi'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { Button } from '@/components/ui/button'

function truncate(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-3)}`
}

export function WalletButton() {
  const { address, isConnected } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { disconnect } = useDisconnect()

  if (!isConnected) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="border border-white/40 text-white hover:bg-white hover:text-monad-purple bg-transparent font-body font-medium transition-all duration-200 text-xs px-3 py-1 h-8"
        onClick={openConnectModal}
      >
        Connect Wallet
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => disconnect()}
      className="border border-white/40 text-white hover:bg-white hover:text-monad-purple bg-transparent font-body font-medium transition-all duration-200 text-xs px-3 py-1 h-8"
    >
      {truncate(address!)}
    </Button>
  )
} 