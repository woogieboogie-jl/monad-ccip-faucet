

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusCard, StatusAlert, ActionButton, ContractAddress } from "@/components/ui"
import { SaveIcon as Safe } from "lucide-react"
import { MarketStatus } from "@/components/market-status"
import { useFaucet } from "@/hooks/use-faucet"
import { useStatus } from "@/hooks/use-status"
import { CONTRACT_ADDRESSES } from "@/lib/constants"

export function AdminPanel() {
  const { faucet } = useFaucet()
  const [isRefilling, setIsRefilling] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawToken, setWithdrawToken] = useState<"mon" | "link">("mon")

  // Minimum thresholds for refill
  const MIN_THRESHOLDS = {
    mon: { critical: 200, warning: 400 },
    link: { critical: 2000, warning: 4000 },
  }

  // Use status hooks for both tokens
  const monStatus = useStatus(faucet.mon.tankBalance, faucet.mon.maxTankBalance, MIN_THRESHOLDS.mon)
  const linkStatus = useStatus(faucet.link.tankBalance, faucet.link.maxTankBalance, MIN_THRESHOLDS.link)

  const handleRefill = async () => {
    setIsRefilling(true)
    // Mock refill action - replace with actual implementation
    setTimeout(() => setIsRefilling(false), 3000)
  }

  const needsRefill = monStatus.level === "critical" || linkStatus.level === "critical"

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center mb-8">
        <h1 className="font-poster text-4xl font-bold text-white mb-2">ADMIN PANEL</h1>
        <p className="font-body text-white/80">Manage faucet operations and monitor market conditions</p>
      </div>

      {/* 1. Faucet Assets Overview */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader className="text-center">
          <CardTitle className="text-white font-body text-xl">🚰 Faucet Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* MON Asset */}
            <div className="bg-white/5 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-body text-white font-semibold text-lg">MON</h3>
                <span className="font-body text-white/70 text-sm">Drip: {faucet.mon.dripAmount}</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-body text-white/70 text-sm">Pool Balance:</span>
                  <span className={`font-body font-semibold ${getStatusColor(faucet.mon.balance, MIN_THRESHOLDS.mon)}`}>
                    {faucet.mon.balance} / {faucet.mon.maxBalance}
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(faucet.mon.balance / faucet.mon.maxBalance) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-body text-white/50">Min: {MIN_THRESHOLDS.mon}</span>
                  <span className="font-body text-white/50">Max: {faucet.mon.maxBalance}</span>
                </div>
              </div>
            </div>

            {/* LINK Asset */}
            <div className="bg-white/5 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-body text-white font-semibold text-lg">LINK</h3>
                <span className="font-body text-white/70 text-sm">Drip: {faucet.link.dripAmount}</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-body text-white/70 text-sm">Pool Balance:</span>
                  <span
                    className={`font-body font-semibold ${getStatusColor(faucet.link.balance, MIN_THRESHOLDS.link)}`}
                  >
                    {faucet.link.balance} / {faucet.link.maxBalance}
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(faucet.link.balance / faucet.link.maxBalance) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-body text-white/50">Min: {MIN_THRESHOLDS.link}</span>
                  <span className="font-body text-white/50">Max: {faucet.link.maxBalance}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Market Status */}
      <MarketStatus />

      {/* 3. Vault Status */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader className="text-center">
          <CardTitle className="text-white font-body text-xl flex items-center justify-center space-x-2">
            <Safe className="h-5 w-5" />
            <span>Vault Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Refill Status */}
          {needsRefill && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-body text-red-400 font-semibold text-sm">Refill Required</p>
                <p className="font-body text-red-300 text-xs">
                  One or more assets are below minimum threshold and need refilling.
                </p>
              </div>
            </div>
          )}

          {/* Refill Action */}
          <div className="text-center">
            <Button
              onClick={handleRefill}
              disabled={!needsRefill || isRefilling}
              className="bg-white text-monad-purple hover:bg-white/90 font-body text-lg py-3 px-8"
            >
              {isRefilling ? "Refill in Progress..." : needsRefill ? "Trigger Refill Check" : "Refill Not Needed"}
            </Button>
          </div>

          {/* Vault Balances */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/20">
            <div className="text-center bg-white/5 rounded-lg p-4">
              <p className="font-body text-white/70 text-sm mb-1">Total MON in Vault</p>
              <p className="font-body text-white text-2xl font-bold">{faucet.vaultMon.toLocaleString()}</p>
            </div>
            <div className="text-center bg-white/5 rounded-lg p-4">
              <p className="font-body text-white/70 text-sm mb-1">Total LINK in Vault</p>
              <p className="font-body text-white text-2xl font-bold">{faucet.vaultLink.toLocaleString()}</p>
            </div>
          </div>

          {/* Fund Instructions */}
          <div className="space-y-4 pt-4 border-t border-white/20">
            <div className="bg-white/5 border border-white/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <code className="font-mono text-white text-xs flex-1 mr-4">{contractAddress}</code>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/50 text-white hover:bg-white hover:text-monad-purple bg-transparent font-body text-xs"
                  onClick={() => copyToClipboard(contractAddress)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
            </div>

            {/* Withdraw Button */}
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full border-2 border-white/50 text-white hover:bg-white hover:text-monad-purple font-body py-2 bg-transparent"
                >
                  Withdraw Funds
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-white font-body text-xl">Withdraw Funds</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="token" className="text-white font-body">
                      Token
                    </Label>
                    <select
                      id="token"
                      className="w-full p-3 rounded bg-white/10 border border-white/20 text-white font-body"
                      value={withdrawToken}
                      onChange={(e) => setWithdrawToken(e.target.value as "mon" | "link")}
                    >
                      <option value="mon">MON</option>
                      <option value="link">LINK</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="amount" className="text-white font-body">
                      Amount
                    </Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/90 p-3"
                    />
                  </div>
                  <Button className="w-full bg-white text-monad-purple hover:bg-white/90 font-body text-lg py-3">
                    Withdraw {withdrawToken.toUpperCase()}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
