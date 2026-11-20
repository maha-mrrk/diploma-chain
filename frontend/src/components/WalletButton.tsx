import { useWallet } from '../context/useWallet'
import { hasWallet, networkName } from '../lib/contract'

function short(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export default function WalletButton() {
  const { session, roles, connecting, connect } = useWallet()

  if (!hasWallet()) {
    return (
      <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
        Installer MetaMask
      </a>
    )
  }

  if (!session) {
    return (
      <button onClick={connect} disabled={connecting}>
        {connecting ? 'Connexion…' : 'Connecter le wallet'}
      </button>
    )
  }

  return (
    <div className="wallet">
      <span className="chip">{networkName(session.chainId)}</span>
      {roles?.isOwner && <span className="chip chip-admin">Admin</span>}
      {roles?.isIssuer && <span className="chip chip-issuer">Émetteur</span>}
      <code title={session.address}>{short(session.address)}</code>
    </div>
  )
}