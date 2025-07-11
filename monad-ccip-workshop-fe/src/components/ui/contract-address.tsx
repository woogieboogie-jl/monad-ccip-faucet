import { CopyButton } from "@/components/ui/copy-button"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface ContractAddressProps {
  address: string
  label?: string
  explorerUrl?: string
  truncate?: boolean
  className?: string
  variant?: "default" | "minimal"
}

export function ContractAddress({
  address,
  label = "Contract:",
  explorerUrl = `https://testnet.monadexplorer.com/address/${address}`,
  truncate = true,
  className,
  variant = "default"
}: ContractAddressProps) {
  const displayAddress = truncate 
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address

  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <code className="font-mono text-white text-xs">{displayAddress}</code>
        <div className="flex space-x-1">
          <CopyButton text={address} size="sm" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(explorerUrl, "_blank")}
                className="h-8 w-8 p-1 hover:bg-white/20 hover:scale-110 transition-all duration-200 ease-in-out"
              >
                <ExternalLink className="h-3 w-3 text-white/70 hover:text-white transition-colors duration-200" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
              <p className="font-body text-xs">View on explorer</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("bg-white/5 rounded-lg p-2 flex items-center justify-between", className)}>
      <div className="flex items-center space-x-2 min-w-0 flex-1">
        <span className="font-body text-white/70 text-xs font-medium whitespace-nowrap">
          {label}
        </span>
        <code className="font-mono text-white text-xs truncate flex-1">
          {displayAddress}
        </code>
      </div>
      <div className="flex space-x-1 ml-2">
        <CopyButton text={address} tooltipText="Copy address" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost" 
              size="sm"
              onClick={() => window.open(explorerUrl, "_blank")}
              className="h-8 w-8 p-1 hover:bg-white/20 hover:scale-110 transition-all duration-200 ease-in-out rounded"
            >
              <ExternalLink className="h-3 w-3 text-white/70 hover:text-white transition-colors duration-200" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="z-[9999]" side="top" sideOffset={5}>
            <p className="font-body text-xs">View on explorer</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
} 
