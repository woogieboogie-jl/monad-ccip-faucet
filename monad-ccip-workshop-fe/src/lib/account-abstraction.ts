import { ethers } from "ethers"
import { toHex } from 'viem'

// Types for UserOperation
interface UserOperation {
  sender: string
  nonce: string
  initCode: string
  callData: string
  callGasLimit: string
  verificationGasLimit: string
  preVerificationGas: string
  maxFeePerGas: string
  maxPriorityFeePerGas: string
  paymasterAndData: string
  signature: string
}

interface AAConfig {
  bundlerUrl: string
  paymasterUrl: string
  entryPointAddress: string
  factoryAddress: string
  rpcUrl: string
}

// Configuration for different AA providers
export const AA_CONFIGS = {
  pimlico: {
    // Use the v2 endpoint – v1 only supports EntryPoint 0.6  
    bundlerUrl: `https://api.pimlico.io/v2/monad-testnet/rpc?apikey=${import.meta.env.VITE_PIMLICO_API_KEY ?? ""}`,
    paymasterUrl: `https://api.pimlico.io/v2/monad-testnet/rpc?apikey=${import.meta.env.VITE_PIMLICO_API_KEY ?? ""}`,
    entryPointAddress: "0x49048044D57a18c5b3b7d432ADfF8a4B0E0e1329", // entryPoint 0.7 on Monad
    // Safe factory 1.4.1 deployed by Pimlico on Monad Testnet
    factoryAddress: "0x4fed0a5b65eac383d36e65733786386709b86be8", // lowercase avoids checksum error
    rpcUrl: import.meta.env.VITE_MONAD_TESTNET_RPC_URL as string,
  },
  alchemy: {
    bundlerUrl: "https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY",
    paymasterUrl: "https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY",
    entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    factoryAddress: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY",
  },
}

export class AccountAbstractionService {
  private config: AAConfig
  private provider: ethers.JsonRpcProvider
  private bundlerProvider: ethers.JsonRpcProvider

  constructor(provider: "pimlico" | "alchemy" = "pimlico") {
    this.config = AA_CONFIGS[provider]
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl)
    this.bundlerProvider = new ethers.JsonRpcProvider(this.config.bundlerUrl)
  }

  // Create a smart contract wallet address
  async getSmartWalletAddress(ownerAddress: string): Promise<string> {
    try {
      // This would typically use CREATE2 to predict the wallet address
      // For demo purposes, we'll simulate this
      const salt = ethers.keccak256(ethers.toUtf8Bytes(ownerAddress))
      const initCode = ethers.concat([
        this.config.factoryAddress,
        ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [ownerAddress, salt]),
      ])

      // Simulate smart wallet address generation
      const mockAddress = ethers.getCreateAddress({
        from: this.config.factoryAddress,
        nonce: Number.parseInt(salt.slice(2, 10), 16),
      })

      return mockAddress
    } catch (error) {
      console.error("Error getting smart wallet address:", error)
      throw error
    }
  }

  // Create UserOperation for faucet request
  async createFaucetUserOperation(
    smartWalletAddress: string,
    ownerAddress: string,
    faucetContractAddress: string,
  ): Promise<UserOperation> {
    try {
      // Encode the faucet call data
      const faucetInterface = new ethers.Interface(["function requestMonTokensTo(address recipient)"])

      const callData = faucetInterface.encodeFunctionData("requestMonTokensTo", [
        smartWalletAddress,
      ])

      // Get nonce for the smart wallet
      const nonce = await this.getNonce(smartWalletAddress)

      // Estimate gas limits
      const gasEstimates = await this.estimateUserOperationGas({
        sender: smartWalletAddress,
        callData,
        nonce: nonce.toString(),
      })

      // Get paymaster data for sponsoring
      const paymasterData = await this.getPaymasterData(smartWalletAddress, callData)

      const hex = (n: string | number | bigint) => toHex(BigInt(n))

      const userOp: UserOperation = {
        sender: smartWalletAddress,
        nonce: hex(nonce),
        initCode: nonce === 0n ? await this.getInitCode(ownerAddress) : "0x",
        callData,
        callGasLimit: hex(gasEstimates.callGasLimit),
        verificationGasLimit: hex(gasEstimates.verificationGasLimit),
        preVerificationGas: hex(gasEstimates.preVerificationGas),
        maxFeePerGas: hex(gasEstimates.maxFeePerGas),
        maxPriorityFeePerGas: hex(gasEstimates.maxPriorityFeePerGas),
        paymasterAndData: paymasterData,
        signature: "0x", // Will be filled after signing
      }

      return userOp
    } catch (error) {
      console.error("Error creating UserOperation:", error)
      throw error
    }
  }

  // Get nonce for smart wallet
  private async getNonce(smartWalletAddress: string): Promise<bigint> {
    try {
      // Call EntryPoint to get nonce
      const entryPointContract = new ethers.Contract(
        this.config.entryPointAddress,
        ["function getNonce(address sender, uint192 key) view returns (uint256 nonce)"],
        this.provider,
      )

      return await entryPointContract.getNonce(smartWalletAddress, 0)
    } catch (error) {
      // If wallet doesn't exist yet, nonce is 0
      return 0n
    }
  }

  // Get init code for wallet creation
  private async getInitCode(ownerAddress: string): Promise<string> {
    const salt = ethers.keccak256(ethers.toUtf8Bytes(ownerAddress))
    const factoryInterface = new ethers.Interface([
      "function createAccount(address owner, uint256 salt) returns (address)",
    ])

    const createAccountCallData = factoryInterface.encodeFunctionData("createAccount", [ownerAddress, salt])

    return ethers.concat([this.config.factoryAddress, createAccountCallData])
  }

  // Estimate gas for UserOperation
  private async estimateUserOperationGas(partialUserOp: Partial<UserOperation>) {
    try {
      // This would call eth_estimateUserOperationGas on the bundler
      // For demo, we'll return reasonable estimates
      const feeData = await this.provider.getFeeData()

      return {
        callGasLimit: 100000n,
        verificationGasLimit: 150000n,
        preVerificationGas: 50000n,
        maxFeePerGas: feeData.maxFeePerGas ?? 2000000000n,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? 1000000000n,
      }
    } catch (error) {
      console.error("Error estimating gas:", error)
      throw error
    }
  }

  // Get paymaster data for sponsoring
  private async getPaymasterData(sender: string, callData: string): Promise<string> {
    try {
      // This would call pm_sponsorUserOperation on the paymaster
      // For demo, we'll return mock paymaster data
      const paymasterAddress = "0x1234567890123456789012345678901234567890"
      const validUntil = Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      const validAfter = Math.floor(Date.now() / 1000)

      // Encode paymaster data
      return ethers.concat([
        paymasterAddress,
        ethers.AbiCoder.defaultAbiCoder().encode(["uint48", "uint48"], [validUntil, validAfter]),
        "0x" + "00".repeat(65), // Mock signature
      ])
    } catch (error) {
      console.error("Error getting paymaster data:", error)
      throw error
    }
  }

  // Sign UserOperation
  async signUserOperation(userOp: UserOperation, signer: ethers.Signer): Promise<UserOperation> {
    try {
      // Create the hash to sign
      const userOpHash = await this.getUserOperationHash(userOp)

      // Sign the hash
      const signature = await signer.signMessage(ethers.getBytes(userOpHash))

      return {
        ...userOp,
        signature,
      }
    } catch (error) {
      console.error("Error signing UserOperation:", error)
      throw error
    }
  }

  // Get UserOperation hash for signing
  private async getUserOperationHash(userOp: UserOperation): Promise<string> {
    // This would typically call eth_getUserOperationByHash or compute locally
    // For demo, we'll create a simple hash
    const packed = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "bytes32", "bytes32"],
      [userOp.sender, userOp.nonce, ethers.keccak256(userOp.callData), ethers.keccak256(userOp.paymasterAndData)],
    )

    return ethers.keccak256(packed)
  }

  // Send UserOperation to bundler
  async sendUserOperation(userOp: UserOperation): Promise<string> {
    try {
      // Pimlico v2 expects the second param to be an object with address & version
      const response = await this.bundlerProvider.send("eth_sendUserOperation", [
        userOp,
        this.config.entryPointAddress,
      ])

      return response // Returns userOpHash
    } catch (error) {
      console.error("Error sending UserOperation:", error)
      throw error
    }
  }

  // Wait for UserOperation to be mined
  async waitForUserOperation(userOpHash: string): Promise<any> {
    try {
      let receipt = null
      let attempts = 0
      const maxAttempts = 30

      while (!receipt && attempts < maxAttempts) {
        try {
          receipt = await this.bundlerProvider.send("eth_getUserOperationReceipt", [userOpHash])
          if (receipt) break
        } catch (error) {
          // UserOp not mined yet
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))
        attempts++
      }

      if (!receipt) {
        throw new Error("UserOperation not mined within timeout")
      }

      return receipt
    } catch (error) {
      console.error("Error waiting for UserOperation:", error)
      throw error
    }
  }
} 