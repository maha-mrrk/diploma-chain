export interface NetworkInfo {
  chainId: number
  name: string
  explorerUrl?: string
}

export const SUPPORTED_NETWORKS: Record<number, NetworkInfo> = {
  31337: { chainId: 31337, name: 'Hardhat local' },
  11155111: {
    chainId: 11155111,
    name: 'Sepolia',
    explorerUrl: 'https://sepolia.etherscan.io',
  },
}

export const CONTRACT_ADDRESS: string = import.meta.env.VITE_CONTRACT_ADDRESS ?? ''