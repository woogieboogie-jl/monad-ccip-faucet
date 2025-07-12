# Monad CCIP Faucet

A sophisticated, cross-chain faucet application built for the Monad testnet. This project features gas-sponsorship for new users via Account Abstraction (Pimlico) and dynamically-adjusted drip rates powered by real-world volatility data from Avalanche Fuji, delivered via Chainlink CCIP.

It is designed to serve two primary user flows:

- **Initial Users (No Gas)**: A seamless, gas-free experience using Account Abstraction
- **Standard Users**: Direct interaction for users who already have native tokens in their EOA wallets

## 🏛️ Architecture

This project's architecture is designed for robustness and decentralization, spanning two blockchains and off-chain infrastructure to provide a seamless user experience.

- **User Onboarding (Monad)**: A dual-flow system handles both new, gas-less users via an EIP-4337 Account Abstraction stack (Pimlico) and traditional users via standard EOA transactions

- **Central Application (Monad)**: The `Faucet.sol` contract acts as the central hub, dispensing MON and LINK tokens with dynamic drip amounts based on volatility data

- **Cross-Chain Backend (Fuji & CCIP)**: When the faucet runs low or needs volatility updates, it uses Chainlink CCIP to request data from a `VolatilityHelper.sol` contract on the Avalanche Fuji testnet. This helper fetches real-world volatility data from Chainlink Data Feeds, allowing the faucet to dynamically adjust its drip rates

- **Frontend (Next.js)**: A modern React application with real-time updates, Zustand state management, and optimized RPC batching for superior performance

## 📁 Project Structure

```
monad-ccip-faucet/
├── monad-ccip-workshop/          # Smart contracts (Foundry)
│   ├── src/
│   │   ├── Faucet.sol            # Main faucet contract (Monad)
│   │   └── VolatilityHelper.sol  # Volatility oracle (Avalanche Fuji)
│   ├── script/                   # Deployment scripts
│   └── README.md                 # Contract deployment guide
├── monad-ccip-workshop-fe/       # Frontend application (Next.js)
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Utilities and configurations
│   │   └── store/               # Zustand state management
│   └── public/                  # Static assets
├── package.json                  # Root package configuration
├── pnpm-workspace.yaml          # Workspace configuration
├── turbo.json                   # Build orchestration
└── vercel.json                  # Deployment configuration
```

## 🚀 Quick Start & Deployment

### Prerequisites

- **Node.js 18+**
- **pnpm** (recommended package manager)
- **Git**
- **Foundry** (for smart contract deployment)
- **Wallet with testnet funds** (for contract deployment)

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/monad-ccip-faucet.git
cd monad-ccip-faucet
```

### Step 2: Install Dependencies

```bash
pnpm install
```

This will install dependencies for both the contracts and frontend workspaces.

### Step 3: Environment Configuration

**Important**: This project uses a single consolidated `.env` file at the project root for both contracts and frontend.

Create the `.env` file at the project root:

```bash
touch .env
```

Add the following configuration to your `.env` file:

```bash
# ═══════════════════════════════════════════════════════════════════════════════
# MONAD CCIP FAUCET - CONSOLIDATED ENVIRONMENT CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# ── DEPLOYMENT SECRETS ──────────────────────────────────────────────────────
FAUCET_PRIVATE_KEY=your_private_key_here

# ── RPC ENDPOINTS ────────────────────────────────────────────────────────────
MONAD_TESTNET_RPC_URL=https://monad-testnet.g.alchemy.com/v2/your_key
AVALANCHE_FUJI_RPC_URL=https://avax-fuji.g.alchemy.com/v2/your_key

# ── EXTERNAL SERVICES ───────────────────────────────────────────────────────
PIMLICO_API_KEY=your_pimlico_key
WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# ── NETWORK CONFIGURATION ───────────────────────────────────────────────────
CHAIN_ID=10143
POLICY_ID=your_policy_id

# ── TOKEN ADDRESSES ─────────────────────────────────────────────────────────
LINK_TOKEN_ADDRESS=0x6fE981Dbd557f81ff66836af0932cba535Cbc343
MONAD_TESTNET_ROUTER_ADDRESS=0x5f16e51e3Dcb255480F090157DD01bA962a53E54

# ── DEPLOYED CONTRACT ADDRESSES ─────────────────────────────────────────────
# These will be updated after deployment
FAUCET_ADDRESS=
HELPER_ADDRESS=
```

**How the Environment Router Works:**
- The frontend uses a sophisticated Vite configuration that automatically maps base variables to `VITE_` prefixed versions
- `FAUCET_ADDRESS` becomes `VITE_FAUCET_ADDRESS` for frontend use
- `HELPER_ADDRESS` becomes `VITE_HELPER_ADDRESS` for frontend use
- No manual duplication needed - single source of truth

### Step 4: Deploy Smart Contracts

Navigate to the contracts directory and deploy:

```bash
cd monad-ccip-workshop

# Create symbolic link to root .env file
ln -sf ../.env .env

# Deploy Faucet contract to Monad testnet
source .env && forge script script/DeployFaucet.s.sol:DeployFaucet --rpc-url $MONAD_TESTNET_RPC_URL --broadcast -vvvv

# Update root .env with deployed Faucet address
# Edit ../.env and add: FAUCET_ADDRESS=0x...

# Deploy VolatilityHelper to Avalanche Fuji
source .env && forge script script/DeployVolatilityHelper.s.sol:DeployVolatilityHelper --rpc-url $AVALANCHE_FUJI_RPC_URL --broadcast -vvvv

# Update root .env with deployed Helper address
# Edit ../.env and add: HELPER_ADDRESS=0x...

# Configure cross-chain communication
source .env && forge script script/ConfigureFaucet.s.sol:ConfigureFaucet --rpc-url $MONAD_TESTNET_RPC_URL --broadcast -vvvv
```

**Important**: Follow the comprehensive deployment guide in `monad-ccip-workshop/README.md` for detailed instructions, including contract verification and funding.

### Step 5: Start Frontend Development

```bash
# Return to project root
cd ..

# Start the frontend development server
pnpm run dev:frontend
```

The application will be available at `http://localhost:3000`

**Frontend Environment Handling:**
- The Vite configuration automatically loads the root `.env` file
- Base variables are automatically mapped to `VITE_` versions for frontend use
- No separate frontend environment setup required

## 🛠️ Available Scripts

From the root directory:

```bash
# Development
pnpm run build            # Build all workspaces
pnpm run build:frontend   # Build frontend only

# Deployment
pnpm run deploy:frontend  # Deploy frontend to Vercel
```

## 🌐 Deployment to Production

### Frontend Deployment (Vercel)

The frontend is configured for automatic deployment to Vercel with the consolidated environment setup:

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard:
   ```bash
   # Copy these from your root .env file
   VITE_FAUCET_ADDRESS=your_deployed_faucet_address
   VITE_HELPER_ADDRESS=your_deployed_helper_address
   VITE_PIMLICO_API_KEY=your_pimlico_key
   VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
   VITE_MONAD_TESTNET_RPC_URL=your_monad_rpc_url
   VITE_AVALANCHE_FUJI_RPC_URL=your_avalanche_rpc_url
   VITE_CHAIN_ID=10143
   VITE_POLICY_ID=your_policy_id
   VITE_LINK_TOKEN_ADDRESS=0x6fE981Dbd557f81ff66836af0932cba535Cbc343
   VITE_MONAD_TESTNET_ROUTER_ADDRESS=0x5f16e51e3Dcb255480F090157DD01bA962a53E54
   ```
3. **Deploy** - Vercel will automatically detect the Next.js app and deploy

**Note**: The Vite environment router automatically creates these `VITE_` variables during local development, but for production deployment, you need to set them manually in Vercel.

The `vercel.json` configuration handles:
- Build command optimization
- Static file routing
- Environment-specific configurations

### Contract Deployment

Contracts are deployed to:
- **Monad Testnet**: Faucet.sol (main application)
- **Avalanche Fuji**: VolatilityHelper.sol (volatility oracle)

See `monad-ccip-workshop/README.md` for detailed deployment instructions.

## 🔧 Key Features

### Smart Contracts
- **Dual-reservoir faucet** with MON and LINK token dispensing
- **Dynamic drip rates** based on real-world volatility data
- **Cross-chain communication** via Chainlink CCIP
- **Admin controls** for managing cooldowns, capacities, and emergency operations

### Frontend
- **Account Abstraction** support for gas-free transactions
- **Real-time updates** with optimized RPC batching
- **Zustand state management** for consistent application state
- **Responsive design** with modern UI components
- **Performance optimized** with 85% RPC call reduction

### Environment Router
- **Consolidated Configuration**: Single `.env` file for both contracts and frontend
- **Automatic Variable Mapping**: Base variables automatically become `VITE_` prefixed for frontend use
- **No Duplication**: DRY principle maintained across the entire stack
- **Developer Friendly**: Simple setup with intelligent defaults

### Architecture Benefits
- **Decentralized**: No single point of failure
- **Scalable**: Modular design supports easy expansion
- **User-friendly**: Both gas-free and traditional transaction flows
- **Data-driven**: Real-world volatility affects token distribution

## 🧪 Testing

### Contract Testing
```bash
cd monad-ccip-workshop
forge test
```

### Frontend Testing
```bash
cd monad-ccip-workshop-fe
pnpm run test
```

### Integration Testing
```bash
pnpm run test:integration
```

## 🔧 Troubleshooting

### Environment Variable Issues

**Problem**: `vm.envUint: environment variable "FAUCET_PRIVATE_KEY" not found`
**Solution**: 
```bash
cd monad-ccip-workshop
# Recreate the symlink
ln -sf ../.env .env
# Always source the environment before running forge commands
source .env && forge script ...
```

**Problem**: Frontend can't find contract addresses
**Solution**: 
- Ensure your root `.env` file has `FAUCET_ADDRESS` and `HELPER_ADDRESS` set
- The Vite environment router automatically creates `VITE_FAUCET_ADDRESS` and `VITE_HELPER_ADDRESS`
- Restart the frontend dev server after updating contract addresses

**Problem**: RPC URL not found during deployment
**Solution**:
```bash
# Check if environment variables are loaded
cd monad-ccip-workshop
source .env
echo $MONAD_TESTNET_RPC_URL
# Should output your RPC URL
```

### Deployment Issues

**Problem**: Contract deployment fails with gas estimation errors
**Solution**:
- Ensure your wallet has sufficient testnet funds
- Try adding `--legacy` flag for legacy transaction format
- Increase gas limit with `--gas-limit 6000000`

**Problem**: CCIP messages not being delivered
**Solution**:
- Verify both contracts are funded with LINK tokens
- Check that `ConfigureFaucet.s.sol` was run successfully
- Monitor CCIP explorer for message status

### Development Workflow

**After cloning the repository:**
1. `pnpm install` - Install all dependencies
2. Create root `.env` file with your configuration
3. `cd monad-ccip-workshop && ln -sf ../.env .env` - Create symlink
4. Deploy contracts following the deployment guide
5. `cd .. && pnpm run dev:frontend` - Start frontend

**When updating contract addresses:**
1. Update root `.env` file only
2. Frontend automatically picks up changes via environment router
3. No need to restart dev server (hot reload works)

## 📚 Documentation

- **Contract Documentation**: `monad-ccip-workshop/README.md`
- **Frontend Documentation**: `monad-ccip-workshop-fe/README.md`
- **Environment Setup**: Consolidated `.env` configuration with automatic variable mapping

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🚨 Security Notice

This is a testnet application. Do not use with mainnet funds. Always verify contract addresses and transaction details before signing.

## 🔗 Links

- **Live Demo**: [https://monad-ccip-faucet-monad-ccip-worksh-seven.vercel.app/]
- **Chainlink CCIP**: https://chain.link/cross-chain
- **Pimlico**: https://pimlico.io

---

**Happy Hacking!** 🚀

For detailed deployment instructions, see the README files in each workspace directory.