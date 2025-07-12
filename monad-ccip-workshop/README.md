# Monad CCIP Faucet - Contract Deployment

Contains contracts for monad-ccip-faucet project

## Contract Overview

### (1) What Faucet.sol does
Faucet.sol is a dual-reservoir faucet contract deployed on Monad testnet that dispenses MON and LINK tokens to users. It features dynamic drip amounts based on volatility data received via Chainlink CCIP from VolatilityHelper on Avalanche Fuji. Key functions include `requestMonTokens()`, `requestLinkTokens()`, `triggerRefillCheck()` for CCIP-based reservoir refilling, and various admin functions for managing cooldowns, capacities, and emergency operations.

### (2) What VolatilityHelper.sol does  
VolatilityHelper.sol is a stateless CCIP application deployed on Avalanche Fuji that responds with ETH/USD 24-hour realized volatility data. It receives CCIP messages from the Faucet contract, fetches current volatility from Chainlink price feeds, and sends the volatility index back to adjust the faucet's drip rates dynamically based on market conditions.

## Deployment Process

We're going to deploy using foundry scripts:

1. **DeployFaucet.s.sol** - deploys your faucet contract with initial values (initial drip values, etc) on Monad
2. **DeployVolatilityHelper.s.sol** - deploys your volatility helper (gets volatility index from the volatility feed) on Fuji. During setup, it reads your deployed Faucet address to whitelist it, so make sure you update .env
3. **ConfigureFaucet.s.sol** - configures your Faucet contract to enable receiving messages from your deployed VolatilityHelper on Avalanche. It reads your deployed volatility helper address to whitelist it, so make sure you update .env

## Step-by-Step Deployment

### [.env Setup]
**Important**: This project uses a consolidated `.env` file located at the project root (`../`). 

**Setup Steps:**
1. Ensure the root `.env` file exists with your deployer private key 
```bash
cp .env.example .env
```

2. Create a symbolic link to make it accessible to foundry scripts:
```bash
ln -sf ../.env .env
```

**Required Environment Variables:**
```bash
# Deployment key
FAUCET_PRIVATE_KEY=your_private_key_here

# RPC endpoints (already configured)
MONAD_TESTNET_RPC_URL=https://monad-testnet.g.alchemy.com/v2/...
AVALANCHE_FUJI_RPC_URL=https://avax-fuji.g.alchemy.com/v2/...

# Contract addresses (updated after deployment)
FAUCET_ADDRESS=
HELPER_ADDRESS=
```

**Why This Works:**
- Single source of truth for all environment variables
- Frontend automatically picks up changes via Vite environment router
- No duplication between contracts and frontend configuration

### [Deploy Faucet.sol]
```bash
source .env && forge script script/DeployFaucet.s.sol:DeployFaucet --rpc-url $MONAD_TESTNET_RPC_URL --broadcast -vvvv
```

### [Update .env]
Add the deployed Faucet address to your root `.env` file:
```bash
FAUCET_ADDRESS=0x...
```

**Note**: The frontend will automatically pick up this address via the Vite environment router.

### [Deploy VolatilityHelper.sol]
```bash
source .env && forge script script/DeployVolatilityHelper.s.sol:DeployVolatilityHelper --rpc-url $AVALANCHE_FUJI_RPC_URL --broadcast -vvvv
```

### [Update .env]
Add the deployed VolatilityHelper address to your root `.env` file:
```bash
HELPER_ADDRESS=0x...
```

**Note**: The frontend will automatically pick up this address via the Vite environment router.

### [Configure Faucet.sol] 
Whitelist the deployed VolatilityHelper.sol on Fuji:
```bash
source .env && forge script script/ConfigureFaucet.s.sol:ConfigureFaucet --rpc-url $MONAD_TESTNET_RPC_URL --broadcast -vvvv
```

## Example Deployed Addresses
```bash
FAUCET_ADDRESS=0x0638dED53d44c38fed362F987feacAf067357509
HELPER_ADDRESS=0xb8985AC25eE965e8812E33bc618a3a62e69e648B
```

## Fund Contracts
Send LINK to both Faucet (Monad) and Helper (Avalanche) contracts - around 10-20 LINK should suffice for testing.

## Trigger Refill Requests
```bash
source .env && cast send --rpc-url $MONAD_TESTNET_RPC_URL --private-key $FAUCET_PRIVATE_KEY --legacy --gas-limit 6000000 $FAUCET_ADDRESS "triggerRefillCheck()"
```

## Link Frontend
Contract addresses are automatically available to the frontend via the consolidated `.env` file at the project root. 

**How It Works:**
- The Vite configuration automatically maps base variables to VITE_ versions
- `FAUCET_ADDRESS` becomes `VITE_FAUCET_ADDRESS` for frontend use
- `HELPER_ADDRESS` becomes `VITE_HELPER_ADDRESS` for frontend use
- No manual duplication needed - single source of truth

**Start Frontend:**
```bash
cd .. && pnpm run dev:frontend
```

Happy Hacking! 🚀

## Contract Verification

### Verify Faucet.sol
```bash
forge verify-contract --rpc-url https://testnet-rpc.monad.xyz --verifier sourcify --verifier-url 'https://sourcify-api-monad.blockvision.org' $FAUCET_ADDRESS src/Faucet.sol:Faucet --flatten
```

### Verify VolatilityHelper.sol
```bash
forge verify-contract --chain-id 43113 --verifier etherscan --verifier-url "https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api" $HELPER_ADDRESS src/VolatilityHelper.sol:VolatilityHelper --flatten --etherscan-api-key "YourApiKeyToken"
```
