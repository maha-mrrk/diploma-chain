import {
  BrowserProvider,
  Contract,
  type Eip1193Provider,
  type JsonRpcSigner,
  type ContractRunner,
} from 'ethers'
import abi from '../../../shared/abi/DiplomaRegistry.json'
import { getContractAddress, SUPPORTED_NETWORKS } from './config'

type InjectedProvider = Eip1193Provider & {
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: InjectedProvider
  }
}

export interface WalletSession {
  provider: BrowserProvider
  signer: JsonRpcSigner
  address: string
  chainId: number
}

export interface Roles {
  isOwner: boolean
  isIssuer: boolean
}

/** Erreur lisible, affichable directement dans l'interface. */
export class WalletError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const CONTRACT_ERRORS: Record<string, string> = {
  OwnableUnauthorizedAccount: 'Action réservée à l’administrateur (owner).',
  UnauthorizedIssuer: 'Votre compte n’est pas un émetteur autorisé.',
  UnauthorizedRevocation:
    'Vous ne pouvez pas révoquer ce diplôme (émetteur d’origine ou admin requis).',
  DuplicateDiplomaHash: 'Ce diplôme (même hash) est déjà enregistré.',
  InvalidStudentAddress: 'Adresse de l’étudiant invalide.',
  InvalidDiplomaHash: 'Hash du diplôme invalide.',
  InvalidMetadataURI: 'URI des métadonnées invalide.',
  InvalidIssuerAddress: 'Adresse de l’émetteur invalide.',
  IssuerAlreadyAuthorized: 'Cet émetteur est déjà autorisé.',
  IssuerNotAuthorized: 'Cet émetteur n’est pas autorisé.',
  SameIssuerAddress: 'L’ancien et le nouvel émetteur sont identiques.',
  DiplomaNotFound: 'Diplôme introuvable.',
  DiplomaAlreadyRevoked: 'Ce diplôme est déjà révoqué.',
  DiplomaNotIssuedByIssuer: 'Un des diplômes n’a pas été émis par cet émetteur.',
  InvalidBatchSize: 'Nombre de diplômes invalide (voir la limite du contrat).',
}

export function hasWallet(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum
}

/** Demande la connexion à MetaMask et retourne la session. */
export async function connectWallet(): Promise<WalletSession> {
  if (!window.ethereum) {
    throw new WalletError('NO_WALLET', 'MetaMask est introuvable. Installez-le pour continuer.')
  }
  try {
    const provider = new BrowserProvider(window.ethereum)
    await provider.send('eth_requestAccounts', [])
    const signer = await provider.getSigner()
    const address = await signer.getAddress()
    const { chainId } = await provider.getNetwork()
    return { provider, signer, address, chainId: Number(chainId) }
  } catch (err) {
    throw toWalletError(err)
  }
}

export function isSupportedNetwork(chainId: number): boolean {
  return chainId in SUPPORTED_NETWORKS
}

export function networkName(chainId: number): string {
  return SUPPORTED_NETWORKS[chainId]?.name ?? `Réseau inconnu (${chainId})`
}

/** Demande à MetaMask de basculer sur un réseau qu'il connaît déjà. */
export async function switchNetwork(chainId: number): Promise<void> {
  if (!window.ethereum) {
    throw new WalletError('NO_WALLET', 'MetaMask est introuvable.')
  }
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + chainId.toString(16) }],
    })
  } catch (err) {
    throw toWalletError(err)
  }
}

/** Instance du contrat pour un réseau donné. Signer = écriture, Provider = lecture seule. */
export function getContract(runner: ContractRunner, chainId: number): Contract {
  const address = getContractAddress(chainId)
  if (!address) {
    throw new WalletError('NO_CONTRACT', 'Aucun contrat déployé sur ce réseau.')
  }
  return new Contract(address, abi, runner)
}

/** Rôles du compte : owner (admin) et/ou émetteur autorisé. */
export async function getRoles(contract: Contract, address: string): Promise<Roles> {
  const [owner, isIssuer] = await Promise.all([
    contract.owner() as Promise<string>,
    contract.authorizedIssuers(address) as Promise<boolean>,
  ])
  return { isOwner: owner.toLowerCase() === address.toLowerCase(), isIssuer }
}

/** Lien vers l'explorateur pour une transaction (undefined en local). */
export function txUrl(chainId: number, txHash: string): string | undefined {
  const base = SUPPORTED_NETWORKS[chainId]?.explorerUrl
  return base ? `${base}/tx/${txHash}` : undefined
}

/** Abonnement aux changements de compte/réseau. Retourne la fonction de désabonnement. */
export function onWalletChange(handler: () => void): () => void {
  const eth = window.ethereum
  if (!eth?.on || !eth.removeListener) return () => {}
  eth.on('accountsChanged', handler)
  eth.on('chainChanged', handler)
  return () => {
    eth.removeListener?.('accountsChanged', handler)
    eth.removeListener?.('chainChanged', handler)
  }
}

/** Convertit n'importe quelle erreur (ethers, MetaMask, contrat) en message clair. */
export function toWalletError(err: unknown): WalletError {
  if (err instanceof WalletError) return err
  const e = err as {
    code?: string | number
    revert?: { name?: string }
    shortMessage?: string
    message?: string
  }
  const code = e?.code
  const revertName = e?.revert?.name ?? ''

  if (code === 'ACTION_REJECTED' || code === 4001) {
    return new WalletError('REJECTED', 'Transaction refusée par l’utilisateur.')
  }
  if (code === -32002) {
    return new WalletError('PENDING', 'Une demande est déjà en attente dans MetaMask.')
  }
  if (code === 'INSUFFICIENT_FUNDS') {
    return new WalletError('FUNDS', 'Solde insuffisant pour payer le gas.')
  }
  if (code === 'NETWORK_ERROR' || code === 4902) {
    return new WalletError('NETWORK', 'Mauvais réseau ou réseau indisponible.')
  }
  if (code === 'CALL_EXCEPTION') {
    return new WalletError(
      revertName || 'REVERT',
      CONTRACT_ERRORS[revertName] ?? 'Le contrat a refusé l’opération.',
    )
  }
  return new WalletError('UNKNOWN', e?.shortMessage ?? e?.message ?? 'Erreur inconnue.')
}