# Monad CCIP Faucet

**Keep Calm and Build with Monad & LINK** 

A modern faucet dApp built with **Vite + React + Wagmi + Viem** featuring cross-chain CCIP volatility-based token distribution with dynamic token rain animations.

## Features

### Dual Token System
- **MON Tokens**: Monad native tokens with purple theming
- **LINK Tokens**: Chainlink tokens with blue theming
- **Vault → Tank**: Two-tier distribution system with deep reserves and immediate drip pools

### CCIP Cross-Chain Integration
- **Universal Volatility Requests**: Real-time BTC-based crypto volatility fetching
- **Separate Token Requests**: Independent MON/LINK fuel button requests
- **Progress Tracking**: Live progress bars with message IDs and transaction hashes
- **Phase Indicators**: Detailed status updates through 5 phases of CCIP operations

### Premium UX
- **Token Rain Animation**: Dynamic falling coins with angled trajectories and rotation
- **Monad Purple → Chainlink Blue Gradient**: Beautiful background theme matching brand colors
- **Enhanced Drip Animation**: Success feedback with scaling and green glow effects
- **Responsive Design**: Perfect on desktop and mobile with adaptive layouts

### Gas-Free Onboarding
- **Account Abstraction**: Powered by Pimlico/Alchemy for gasless first transactions
- **Smart Wallet Integration**: Automatic smart contract wallet creation
- **Paymaster Support**: Sponsored transactions for new users

### Web3 Stack
- **Wagmi v2.15.2**: Type-safe Ethereum interactions
- **Viem v2.31.0**: Low-level Ethereum utilities  
- **Permissionless.js v0.2.0**: Account abstraction primitives
- **React Query**: Async state management for Web3 calls

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or pnpm

### Installation

```bash
# Clone and enter directory
cd monad-ccip-workshop-fe

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys:
# - VITE_WALLETCONNECT_PROJECT_ID
# - VITE_INFURA_API_KEY  
# - VITE_ALCHEMY_API_KEY

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

## Architecture

### Directory Structure
```
src/
├── components/           # React components
│   ├── ui/              # shadcn/ui components
│   ├── header.tsx       # Navigation with CCIP progress
│   ├── faucet-section.tsx
│   ├── tank-status.tsx  # Tank management with fuel buttons
│   ├── token-rain.tsx   # Background animation
│   └── ...
├── hooks/               # Custom React hooks
│   ├── use-global-ccip.ts    # Universal CCIP state
│   ├── use-faucet.ts         # Token distribution logic
│   ├── use-volatility.ts     # BTC volatility tracking
│   └── ...
├── lib/                 # Utilities and configurations
│   ├── wagmi.ts         # Web3 configuration
│   ├── utils.ts         # Tailwind utilities
│   └── account-abstraction.ts
└── pages/
    └── HomePage.tsx     # Main application page
```

### Key Components

**Global CCIP State Management**
- Separate MON/LINK request tracking
- Universal volatility data sharing
- Real-time progress updates with phases

**Tank Status Integration**
- Fuel buttons embedded in tank cards
- Token-specific progress display
- Success animations with drip effects

**Web3 Provider Setup**
- Multi-chain support (Ethereum, Polygon, Arbitrum, etc.)
- Multiple wallet connectors (MetaMask, WalletConnect, Coinbase)
- Account abstraction for gasless transactions

## CCIP Workflow

1. **User clicks fuel button** → Triggers volatility request
2. **Fetching BTC volatility** → Cross-chain CCIP message sent  
3. **Processing response** → Volatility data received and processed
4. **Updating drip rates** → Token amounts adjusted based on volatility
5. **Vault→Tank refill** → Automatic tank replenishment

## Drip Button Flow Documentation

### Complete Call Chain: UI → Handler → Hook

Here's the comprehensive flow of all components and hooks involved in the Drip button functionality:

### 1. UI Layer - Drip Button Component
**Location:** `src/components/faucet-section.tsx:463-543`

**Two Button Types:**
- **Gas-Free Button** (Green) - For users with 0 MON balance
- **Regular Drip Button** (Blue) - For existing users

```typescript
// Gas-Free Button (Green)
<button onClick={() => setGasFreeModalOpen(true)}>
  "Get First MON (Gas-Free)"
</button>

// Regular Drip Button (Blue)  
<button onClick={() => handleDripWithAnimation(tokenType)}>
  "Drip" | "Dripping..." | "Wrong Network" | "Tank Empty"
</button>
```

### 2. Event Handler Layer
**Location:** `src/components/faucet-section.tsx:220-240`

```typescript
// Main MON drip handler
const handleMonDrip = useCallback(() => {
  if (monDripButtonState.isGasFree) {
    setGasFreeModalOpen(true)  // → Opens GasFreeModal
  } else {
    dripTokens("mon")          // → Calls useFaucet hook
  }
}, [monDripButtonState.isGasFree, setGasFreeModalOpen, dripTokens])

// Animation wrapper
const handleDripWithAnimation = (tokenType: "mon" | "link") => {
  setDripState(tokenType, true)    // → Zustand UI state
  if (tokenType === "mon") {
    handleMonDrip()                // → Calls above handler
  } else {
    handleLinkDrip()               // → Direct dripTokens call
  }
  // Reset animation after 800ms
}
```

### 3. Button State Logic
**Location:** `src/components/faucet-section.tsx:125-169`

```typescript
const getDripButtonState = useCallback((tokenType: "mon" | "link") => {
  // Priority order:
  // 1. Wallet not connected → "Connect Wallet"
  // 2. Wrong network → "Wrong Network" 
  // 3. Tank empty → "Tank Empty - Use Refuel"
  // 4. Insufficient tank → "Insufficient Tank"
  // 5. Zero balance + MON → "Get First MON (Gas-Free)"
  // 6. Loading → "Dripping..."
  // 7. Cooldown → "HH:MM:SS"
  // 8. Ready → "Drip"
})
```

### 4. Gas-Free Flow
**Location:** `src/components/gas-free-modal.tsx`

```typescript
<GasFreeModal
  isOpen={isGasFreeModalOpen}
  onClose={() => setGasFreeModalOpen(false)}
  onSuccess={handleGasFreeSuccess}
  walletAddress={wallet.address}
  dripAmount={faucet.mon.currentDripAmount}
/>
```

**Account Abstraction Hook:**
```typescript
// src/hooks/use-account-abstraction.ts
executeGaslessTransaction(
  recipientAddress,  // EOA address (where tokens go)
  faucetAddress     // Contract address
)
```

### 5. Regular Drip Flow
**Location:** `src/hooks/use-faucet.ts:150-219`

```typescript
const dripTokens = async (tokenType: "mon" | "link") => {
  // 1. Network validation
  if (!requireMonad()) return
  
  // 2. Wallet validation  
  if (!walletClient) return
  
  // 3. Cooldown check (Zustand store)
  if (tokens[tokenType].dripCooldownTime > 0) return

  // 4. Update loading state
  updateTokenState(tokenType, { isDripLoading: true })

  // 5. Contract simulation & execution
  const { request } = await publicClient.simulateContract({
    address: FAUCET_ADDRESS,
    abi: faucetAbi,
    functionName: tokenType === "mon" ? "requestMonTokens" : "requestLinkTokens",
    account: walletClient.account,
  })

  // 6. Send transaction
  const txHash = await walletClient.writeContract(request)
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  // 7. Success handling
  if (receipt.status === 'success') {
    // Set cooldown from contract
    setDripCooldown(tokenType, contractCooldown)
    
    // Refresh tank balance from contract
    const freshSnap = await getFaucetSnapshot(walletClient.account.address)
    updateTokenState(tokenType, { 
      tankBalance: freshTankBalance,
      isRefreshing: false 
    })
  }
}
```

### 6. Supporting Hooks & State

**Network Validation:**
- `useRequireMonad()` - Checks if user is on Monad Testnet
- `useChainModal()` - Opens RainbowKit chain switching modal

**State Management:**
- `useFaucetStore()` - Zustand store for token states, cooldowns, UI state
- `useTokenState()` - Selective subscription to specific token data
- `useAutoCooldownManager()` - Centralized cooldown timer management

**Contract Interaction:**
- `usePublicClient()` - Viem public client for contract reads
- `useWalletClient()` - Viem wallet client for transactions
- `getFaucetSnapshot()` - Consolidated contract data fetching

### 7. Complete Flow Diagram

```
User Clicks Drip Button
         ↓
handleDripWithAnimation()
         ↓
    handleMonDrip()
         ↓
   [Check isGasFree?]
    ↓         ↓
   YES        NO
    ↓         ↓
GasFreeModal  dripTokens()
    ↓         ↓
useAccountAb  Contract Call
    ↓         ↓
Paymaster     Wait Receipt
    ↓         ↓
Success   →   Update State
    ↓         ↓
handleGasFreeSuccess()
         ↓
   Update Balance
         ↓
   Set Cooldown
         ↓
 Refresh Tank Balance
```

## Design System

### Colors
- **Monad Purple**: `#8A5CF6` (medium purple, matching brand)
- **Chainlink Blue**: `#006FEE` (bright blue, matching brand)
- **Mid-Color**: `#4566F2` (blend between purple and blue)
- **Gradient Background**: Purple → Mid-Color → Blue horizontal gradient

### Typography
- **Poster Font**: Impact, Arial Black for headlines
- **Body Font**: Inter Tight for UI text
- **Mono Font**: JetBrains Mono for addresses/hashes

### Animations
- **Token Rain**: CSS keyframes with random angles and speeds
- **Drip Success**: Scaling + green glow feedback
- **Progress Bars**: Smooth transitions with phase indicators

## Configuration

### Environment Variables
```bash
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
VITE_INFURA_API_KEY=your_infura_key
VITE_ALCHEMY_API_KEY=your_alchemy_key
```

### Supported Networks
- Ethereum Mainnet & Sepolia
- Polygon, Optimism, Arbitrum, Base
- Extensible for additional chains

## Development

### Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production  
- `npm run preview` - Preview production build
- `npm run lint` - ESLint checking

### Tech Stack
- **Framework**: Vite 6.3.5 + React 19.1.0
- **Web3**: Wagmi 2.15.2 + Viem 2.31.0
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Query + Zustand
- **TypeScript**: Full type safety

## Mobile Support

The application is fully responsive with:
- Adaptive layouts for mobile/tablet/desktop
- Touch-friendly interactions
- Optimized token rain for mobile performance
- Mobile-first navigation patterns

## Security

- **Client-side only**: No server-side data exposure
- **Wallet-based authentication**: No username/password required
- **Gas-sponsored transactions**: Safe account abstraction patterns
- **Environment variable protection**: Sensitive keys in .env files

---

**Built with the latest Web3 technologies** 

## CCIP UX Data Flow Documentation

### Complete Cross-Chain Volatility System Architecture

The CCIP (Chainlink Cross-Chain Interoperability Protocol) system enables dynamic token distribution based on real-world volatility data. Here's the complete data flow from UI interaction to cross-chain execution:

### 1. System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Monad Testnet │    │ Chainlink CCIP  │    │ Avalanche Fuji  │
│                 │    │    Network      │    │                 │
│  Faucet.sol     │◄──►│                 │◄──►│ VolatilityHelper│
│  (Tank System)  │    │  DON + RMN      │    │  (Oracle)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 2. CCIP Request Flow (Frontend → Cross-Chain)

#### Phase 1: UI Initiation (0-10%)
**Location:** `src/components/faucet-section.tsx:handleFuelButtonClick()`
```typescript
// User clicks "Refuel" button
handleFuelButtonClick("mon") → 
  setVolatilityUpdating(true) → 
  monCCIPRefill.triggerUniversalVolatilityAndRefill()
```

**State Updates:**
- Button: "Request Volatility & Refill" → "Confirm in Wallet"
- Progress: 0% → 10%
- Phase: `wallet_confirm`

#### Phase 2: Wallet Confirmation (10-25%)
**Location:** `src/hooks/use-ccip-refill.ts:triggerUniversalVolatilityAndRefill()`
```typescript
// Contract call preparation
const txHash = await walletClient.sendTransaction({
  to: FAUCET_ADDRESS,
  data: encodeFunctionData({ 
    abi: faucetAbi, 
    functionName: 'triggerRefillCheck' 
  })
})
```

**State Updates:**
- Status: `wallet_pending` → `tx_pending`
- Progress: 10% → 25%
- Phase: `wallet_confirm` → `monad_confirm`
- `monadTxHash`: Set to transaction hash

#### Phase 3: Monad Transaction Confirmation (25-40%)
**Location:** `src/hooks/use-ccip-refill.ts:monitorCCIPTransaction()`
```typescript
// Monitor transaction receipt
const receipt = await publicClient.getTransactionReceipt({ 
  hash: monadTxHash 
})

// Extract CCIP message ID from logs
const ccipMessageId = extractCCIPMessageId(receipt.logs)
```

**Smart Contract Interaction:**
- `Faucet.sol:triggerRefillCheck()` → Emits `RefillTriggered(messageId)`
- CCIP message sent to Avalanche Fuji
- Real `ccipMessageId` extracted from transaction logs

**State Updates:**
- Progress: 25% → 40%
- Phase: `monad_confirm` → `avalanche_confirm`
- `ccipMessageId`: Set to real message ID

#### Phase 4: Cross-Chain Processing (40-70%)
**Location:** `src/hooks/use-ccip-refill.ts:extractResponseMessageIdFromAvalanche()`

**CCIP Network Processing:**
1. **Committing DON**: Waits for Monad finality, batches message
2. **Risk Management Network**: Validates and blesses the message
3. **Executing DON**: Delivers to Avalanche Fuji

**Avalanche Processing:**
```typescript
// VolatilityHelper.sol receives CCIP message
function _ccipReceive(Client.Any2EVMMessage memory message) {
  // Fetch ETH/USD 24h volatility from Chainlink feed
  (, int256 vol,,,) = volatilityFeed.latestRoundData();
  uint256 score = uint256(vol) / 100; // Convert to 0-1000 scale
  
  // Send response back to Monad
  Client.EVM2AnyMessage memory response = Client.EVM2AnyMessage({
    receiver: message.sender, // Faucet address
    data: abi.encode(message.messageId, score)
  });
}
```

**State Updates:**
- Progress: 40% → 70%
- Phase: `avalanche_confirm` → `ccip_response`
- `ccipResponseMessageId`: Set when response found

#### Phase 5: Response Processing (70-90%)
**Location:** `src/hooks/use-ccip-refill.ts:extractResponseMessageIdFromMonad()`

**Response Journey:**
1. **Avalanche → CCIP**: VolatilityHelper sends response message
2. **CCIP Network**: Processes return message to Monad
3. **Monad Reception**: Faucet.sol receives volatility data

**State Updates:**
- Progress: 70% → 90%
- Phase: `ccip_response` → `monad_refill`

#### Phase 6: Tank Refill & Completion (90-100%)
**Location:** `src/hooks/use-ccip-refill.ts:monitorCCIPTransaction()`

**Smart Contract Processing:**
```solidity
// Faucet.sol:_ccipReceive() processes volatility response
function _ccipReceive(Client.Any2EVMMessage memory message) {
  (bytes32 requestId, uint256 volatility) = abi.decode(message.data, (bytes32, uint256));
  
  // Map volatility to new drip amounts
  uint256 newMonDrip = _mapVolToDrip(volatility, 2 ether, 0.5 ether);
  uint256 newLinkDrip = _mapVolToDrip(volatility, 10 ether, 2 ether);
  
  // Refill tanks from vault
  monReservoir += refillAmount;
  linkReservoir += refillAmount;
  
  // Update drip rates
  currentMonDrip = newMonDrip;
  currentLinkDrip = newLinkDrip;
  
  // Clear refill mutex
  refillInProgress = false;
}
```

**Final State Updates:**
- Progress: 90% → 100%
- Status: `ccip_processing` → `success`
- Phase: `monad_refill` → `undefined`
- Results: `newDripAmount`, `refillAmount`, `volatilityData`

### 3. Frontend State Management Architecture

#### State Persistence Strategy
```typescript
// localStorage keys for persistence
`ccip-refill-mon` → MonCCIPState
`ccip-refill-link` → LinkCCIPState

// Zustand store structure
interface FaucetStore {
  tokens: { mon: TokenState, link: TokenState }
  ccip: { mon: CCIPState, link: CCIPState }
  vaults: { mon: number, link: number }
  volatility: VolatilityState
}
```

#### Multi-Layer State Synchronization
1. **Hook Level**: `useCCIPRefill()` - Token-specific CCIP operations
2. **Global Level**: `useGlobalCCIP()` - Cross-token state aggregation  
3. **Store Level**: `useFaucetStore()` - Persistent state management
4. **UI Level**: Real-time progress bars and status updates

#### Progress Tracking System
```typescript
// Phase-based progress mapping
const phaseProgress = {
  wallet_confirm: 10,
  monad_confirm: 25,
  avalanche_confirm: 40,
  ccip_response: 70,
  monad_refill: 90,
  success: 100
}
```

### 4. Real-Time UI Updates

#### Progress Bar Components
**Location:** `src/components/faucet-section.tsx:650-734`
```typescript
// Vibrant CCIP Progress Bar
<div className="bg-gradient-to-r from-blue-500/25 via-purple-500/25 to-cyan-500/25">
  <Progress value={ccipRefill.refillState.progress} />
  <span>{ccipRefill.refillState.progress}%</span>
  <p>{getCCIPPhaseText(ccipRefill.refillState.currentPhase)}</p>
</div>
```

#### Button State Management
```typescript
// Dynamic button states based on CCIP phase
const buttonStates = {
  idle: "Request Volatility & Refill",
  wallet_pending: "Confirm in Wallet", 
  tx_pending: "Transaction Pending",
  ccip_processing: "CCIP Processing",
  success: "Request Complete"
}
```

#### Success Message Display
```typescript
// Enhanced success alert with real data
<div className="bg-green-500/10 border border-green-400/30">
  <p>CCIP Volatility Request Complete</p>
  <p>Market Volatility: {score}/100 ({trend})</p>
  <p>Drip adjusted: {baseDrip} → {newDrip} ({percentage}%)</p>
  <p>Tank refilled: +{refillAmount} {symbol}</p>
</div>
```

### 5. Error Handling & Recovery

#### Error States
- **Failed**: Transaction or CCIP processing failed
- **Stuck**: Transaction stuck in specific phase (timeout)
- **Network**: Wrong network or connection issues

#### Recovery Mechanisms
1. **Auto-retry**: Automatic phase progression monitoring
2. **Manual reset**: User can dismiss stuck/failed states
3. **Emergency reset**: Admin can force-reset contract state
4. **Fallback**: Graceful degradation with cached data

### 6. Performance Optimizations

#### RPC Call Reduction
- **Batched Contract Reads**: `useBatchOperations()` consolidates multiple calls
- **Smart Caching**: `request-cache.ts` with TTL-based invalidation
- **Selective Monitoring**: Only active CCIP operations are monitored

#### State Optimization
- **Memoized Calculations**: Button states and progress calculations
- **Selective Subscriptions**: Zustand subscriptions only to relevant state slices
- **Persistent Storage**: localStorage prevents state loss on refresh

### 7. Cross-Chain Security

#### Message Validation
- **Source Chain Validation**: Only accept messages from trusted chains
- **Sender Validation**: Verify message sender is authorized contract
- **Signature Verification**: CCIP DON signatures validated on-chain

#### Risk Management
- **Rate Limiting**: Token pool rate limits prevent abuse
- **Curse Protection**: RMN can halt operations if issues detected
- **Emergency Controls**: Admin functions for emergency situations

### 8. Monitoring & Debugging

#### CCIP Explorer Integration
- **Message Tracking**: Direct links to CCIP Explorer for message status
- **Dual Message Support**: Track both outbound and response messages
- **Real-time Status**: Live updates from CCIP network

#### Development Tools
- **Console Logging**: Comprehensive logging for debugging
- **State Inspection**: Zustand devtools for state debugging
- **Performance Metrics**: RPC call tracking and optimization

This comprehensive CCIP system ensures reliable, secure, and user-friendly cross-chain volatility-based token distribution with real-time feedback and robust error handling. 