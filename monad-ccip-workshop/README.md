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
Fill your .env file with RPC URLs & deployer private key:
```bash
MONAD_TESTNET_RPC_URL=https://testnet-rpc.monad.xyz
AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
PRIVATE_KEY=your_private_key_here
```

### [Deploy Faucet.sol]
```bash
forge script script/DeployFaucet.s.sol:DeployFaucet --rpc-url $MONAD_TESTNET_RPC_URL --broadcast -vvvv
```

### [Update .env]
Add the deployed Faucet address to your .env file:
```bash
FAUCET_ADDRESS=0x...
```

### [Deploy VolatilityHelper.sol]
```bash
forge script script/DeployVolatilityHelper.s.sol:DeployVolatilityHelper --rpc-url $AVALANCHE_FUJI_RPC_URL --broadcast -vvvv
```

### [Update .env]
Add the deployed VolatilityHelper address to your .env file:
```bash
HELPER_ADDRESS=0x...
```

### [Configure Faucet.sol] 
Whitelist the deployed VolatilityHelper.sol on Fuji:
```bash
forge script script/ConfigureFaucet.s.sol:ConfigureFaucet --rpc-url $MONAD_TESTNET_RPC_URL --broadcast -vvvv
```

## Example Deployed Addresses
```bash
FAUCET_ADDRESS=0x93EB461cF90bF505Adc00E295FD91A6063e46eDa
HELPER_ADDRESS=0x3feeacec974ca351cc563bE8542e690c29C0a64e
```

## Fund Contracts
Send LINK to both Faucet (Monad) and Helper (Avalanche) contracts - around 10-20 LINK should suffice for testing.

## Trigger Refill Requests
```bash
cast send --rpc-url $MONAD_RPC_URL --private-key $FAUCET_PRIVATE_KEY --legacy --gas-limit 6000000 $FAUCET_ADDRESS "triggerRefillCheck()"
```

## Link Frontend
Update addresses in the .env file in the project root directory:
```bash
cd ..
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
