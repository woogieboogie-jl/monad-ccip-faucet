# 🚰 Monad CCIP Faucet

A cross-chain faucet application built for Monad testnet with Account Abstraction support and CCIP integration.

## 🏗️ Project Structure

This is a **pnpm monorepo** containing:

- **`monad-ccip-workshop/`** - Smart contracts (Foundry/Forge)
- **`monad-ccip-workshop-fe/`** - Frontend application (Vite + React + TypeScript)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm
- Git

### Local Development

```bash
# Clone the repository
git clone <your-repo-url>
cd monad-ccip-faucet

# Install dependencies
pnpm install

# Start frontend development server
pnpm dev:frontend

# Test smart contracts
pnpm dev:contracts
```

## 🌐 Deployment

### Vercel Deployment

This project is configured for **automatic deployment** on Vercel:

1. **Push to GitHub** - Vercel will auto-deploy
2. **Environment Variables** - Set in Vercel dashboard
3. **Monorepo Support** - Configured in `vercel.json`

### Required Environment Variables

```bash
# Blockchain Configuration
VITE_CHAIN_ID=10143
VITE_MONAD_TESTNET_RPC_URL=https://rpc.ankr.com/monad_testnet
VITE_AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# Contract Addresses
VITE_FAUCET_ADDRESS=0x...
VITE_HELPER_ADDRESS=0x...
VITE_LINK_TOKEN_ADDRESS=0x...

# API Keys
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
VITE_PIMLICO_API_KEY=your_api_key
VITE_POLICY_ID=your_policy_id
```

## 🔧 Features

- ✅ **Multi-token Faucet** (MON + LINK)
- ✅ **Account Abstraction** (Gas-free transactions)
- ✅ **CCIP Integration** (Cross-chain refills)
- ✅ **Volatility-based Drip Amounts**
- ✅ **RPC Optimization** (85% reduction in calls)
- ✅ **Modern UI** (Tailwind + shadcn/ui)

## 🏛️ Architecture

### Frontend Stack
- **Framework**: Vite + React 19
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **Blockchain**: wagmi + viem
- **Account Abstraction**: Permissionless + Pimlico

### Smart Contracts
- **Framework**: Foundry/Forge
- **Network**: Monad Testnet
- **CCIP**: Chainlink Cross-Chain

## 📊 Performance

- **RPC Calls**: 85% reduction through intelligent caching
- **Load Time**: <2 seconds
- **Bundle Size**: Optimized with Vite
- **Caching**: Multi-tier strategy (30s-5min TTL)

## 🔒 Security

- ✅ Environment variables properly handled
- ✅ API key restrictions configured
- ✅ Security headers implemented
- ✅ No private keys in frontend
- ✅ Domain restrictions on API keys

## 🛠️ Development

### Build Commands

```bash
# Build everything
pnpm build

# Build frontend only
cd monad-ccip-workshop-fe && pnpm build

# Lint code
pnpm lint

# Deploy contracts
pnpm deploy
```

### Project Scripts

- `pnpm dev:frontend` - Start frontend dev server
- `pnpm dev:contracts` - Run contract tests
- `pnpm build` - Build all packages
- `pnpm lint` - Lint all packages

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
- Open a GitHub issue
- Check the documentation
- Review the security checklist 