import { Abi } from 'viem'

export const faucetAbi = [
  {
    type: 'function',
    name: 'getReservoirStatus',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'monPool', type: 'uint256' },
      { name: 'monDripRate', type: 'uint256' },
      { name: 'linkPool', type: 'uint256' },
      { name: 'linkDripRate', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'requestMonTokens',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'requestMonTokensTo',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'recipient', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'requestLinkTokens',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'triggerRefillCheck',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'refillInProgress',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getTreasuryStatus',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'monTreasury', type: 'uint256' },
      { name: 'monReservoir', type: 'uint256' },
      { name: 'linkTreasury', type: 'uint256' },
      { name: 'linkReservoir', type: 'uint256' },
      { name: 'monCapacity', type: 'uint256' },
      { name: 'linkCapacity', type: 'uint256' },
    ],
  },
] as const satisfies Abi 