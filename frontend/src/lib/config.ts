export interface NetworkInfo {
  chainId: number
  name: string
  deployment: string // nom du fichier dans shared/deployments/
  explorerUrl?: string
}

export const SUPPORTED_NETWORKS: Record<number, NetworkInfo> = {
  31337: { chainId: 31337, name: 'Hardhat local', deployment: 'localhost' },
  11155111: {
    chainId: 11155111,
    name: 'Sepolia',
    deployment: 'sepolia',
    explorerUrl: 'https://sepolia.etherscan.io',
  },
}

interface Deployment {
  address?: string
}

// Charge tous les fichiers shared/deployments/*.json présents.
const deployments = import.meta.glob('../../../shared/deployments/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Deployment>

/** Adresse du contrat sur un réseau donné, ou '' si non déployé. */
export function getContractAddress(chainId: number): string {
  const name = SUPPORTED_NETWORKS[chainId]?.deployment
  if (!name) return ''
  const entry = Object.entries(deployments).find(([path]) => path.endsWith(`/${name}.json`))
  return entry?.[1].address ?? ''
}