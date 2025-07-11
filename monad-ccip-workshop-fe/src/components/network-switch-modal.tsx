import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Network, RefreshCw, CheckCircle, XCircle } from "lucide-react"

interface NetworkSwitchModalProps {
  isOpen: boolean
  onClose: () => void
  onSwitchNetwork: () => void
  currentNetworkName: string
  targetNetworkName: string
  isSwitching: boolean
  switchError: string | null
}

export function NetworkSwitchModal({
  isOpen,
  onClose,
  onSwitchNetwork,
  currentNetworkName,
  targetNetworkName,
  isSwitching,
  switchError,
}: NetworkSwitchModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-black/90 border border-white/20 backdrop-blur-sm">
        <DialogHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-orange-400" />
          </div>
          
          <DialogTitle className="font-body text-xl font-bold text-white">
            Wrong Network Detected
          </DialogTitle>
          
          <div className="space-y-3 text-center">
            <p className="font-body text-white/80 text-sm">
              This faucet only works on <span className="font-semibold text-blue-400">{targetNetworkName}</span>
            </p>
            
            <div className="bg-white/5 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-body text-white/60">Current Network:</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-red-400"></div>
                  <span className="font-body text-red-400 font-medium">{currentNetworkName}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="font-body text-white/60">Required Network:</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <span className="font-body text-green-400 font-medium">{targetNetworkName}</span>
                </div>
              </div>
            </div>
            
            {switchError && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                  <p className="font-body text-red-300 text-xs text-left">
                    {switchError}
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-6">
          <Button
            onClick={onSwitchNetwork}
            disabled={isSwitching}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0 font-body font-medium transition-all duration-200"
          >
            {isSwitching ? (
              <div className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Switching Network...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Network className="h-4 w-4" />
                <span>Switch to {targetNetworkName}</span>
              </div>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSwitching}
            className="w-full border border-white/40 text-white hover:bg-white hover:text-black bg-transparent font-body font-medium transition-all duration-200"
          >
            Continue Anyway
          </Button>
        </div>

        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-400/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <CheckCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-body text-blue-300 text-xs font-medium">
                Why do I need to switch?
              </p>
              <p className="font-body text-blue-200/80 text-xs">
                The faucet smart contracts are deployed on {targetNetworkName}. 
                You need to be on this network to interact with the faucet and receive tokens.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 