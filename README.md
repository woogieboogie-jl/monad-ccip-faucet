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

### Step 3: Deploy Smart Contracts

Navigate to the contracts directory and follow the comprehensive deployment guide:

```bash
cd monad-ccip-workshop
```

**Important**: Follow the step-by-step deployment instructions in `monad-ccip-workshop/README.md`. This includes:

1. Setting up your `.env` file with RPC URLs and private keys
2. Deploying `Faucet.sol` to Monad testnet
3. Deploying `VolatilityHelper.sol` to Avalanche Fuji
4. Configuring cross-chain communication
5. Funding contracts with LINK tokens
6. Verifying contracts on block explorers

### Step 4: Configure Frontend Environment

Navigate to the frontend directory and create your environment configuration:

```bash
cd ../monad-ccip-workshop-fe
cp .env.example .env.local
```

Fill in your `.env.local` file with:

```bash

# ── secrets / scripts ───────────────────────────────
FAUCET_PRIVATE_KEY=
PIMLICO_API_KEY=
MONAD_TESTNET_RPC_URL=
AVALANCHE_FUJI_RPC_URL=
LINK_TOKEN_ADDRESS=0x6fE981Dbd557f81ff66836af0932cba535Cbc343
MONAD_TESTNET_ROUTER_ADDRESS=0x5f16e51e3Dcb255480F090157DD01bA962a53E54

# ── browser-exposed vars ────────────────────────────
POLICY_ID=
CHAIN_ID=10143
WALLETCONNECT_PROJECT_ID=

# Contract Addresses (from your deployment)
# will be overwritten by deploy script
FAUCET_ADDRESS=
HELPER_ADDRESS=

```

### Step 5: Run the Frontend

From the root directory, start the development server:

```bash
pnpm run dev:frontend
```

The application will be available at `http://localhost:3000`

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

The frontend is configured for automatic deployment to Vercel:

1. **Connect your repository** to Vercel
2. **Set environment variables** in Vercel dashboard matching your `.env.local`
3. **Deploy** - Vercel will automatically detect the Next.js app and deploy

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

## 📚 Documentation

- **Contract Documentation**: `monad-ccip-workshop/README.md`
- **Frontend Documentation**: `monad-ccip-workshop-fe/README.md`

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
