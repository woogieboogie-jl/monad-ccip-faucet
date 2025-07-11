import { createSmartAccountClient } from 'permissionless'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { toSimpleSmartAccount } from 'permissionless/accounts'
import { entryPoint07Address } from 'viem/account-abstraction'
import { createPublicClient, defineChain, http } from 'viem'

// Monad testnet chain definition
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_MONAD_TESTNET_RPC_URL || 'https://rpc.ankr.com/monad_testnet'] },
  },
  blockExplorers: {
    default: { name: 'Monad Explorer', url: 'https://testnet.monadexplorer.com' },
  },
  testnet: true,
})

// Low-level public client
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(monadTestnet.rpcUrls.default.http[0]),
})

// Pimlico bundler/paymaster client
const pimlicoApiKey = import.meta.env.VITE_PIMLICO_API_KEY
const pimlicoUrl = `https://api.pimlico.io/v2/monad-testnet/rpc?apikey=${pimlicoApiKey || 'demo'}`

if (!pimlicoApiKey) {
  console.warn('⚠️  VITE_PIMLICO_API_KEY not found, using demo key (transactions may fail)')
}

const pimlicoClient = createPimlicoClient({
  transport: http(pimlicoUrl),
  entryPoint: {
    address: entryPoint07Address,
    version: '0.7',
  },
})

// Factory that returns a ready SmartAccountClient for a connected wallet
export async function getSmartAccountClient(walletClient: any /* wagmi WalletClient */) {
  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner: walletClient,
    entryPoint: { address: entryPoint07Address, version: '0.7' },
  })

  return createSmartAccountClient({
    account,
    chain: monadTestnet,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    // signer already attached in SimpleSmartAccount
    paymasterContext: {
      sponsorshipPolicyId: import.meta.env.VITE_POLICY_ID,
    },
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  })
} 