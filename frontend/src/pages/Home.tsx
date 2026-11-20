import { useState } from 'react'
import {
  connectWallet,
  getContract,
  getRoles,
  networkName,
  toWalletError,
} from '../lib/contract'

export default function Home() {
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')

  async function onConnect() {
    setError('')
    try {
      const s = await connectWallet()
      const roles = await getRoles(getContract(s.signer), s.address)
      setInfo(
        `${s.address} sur ${networkName(s.chainId)} | owner : ${roles.isOwner} | émetteur : ${roles.isIssuer}`,
      )
    } catch (err) {
      setError(toWalletError(err).message)
    }
  }

  return (
    <section>
      <h1>Diploma Chain</h1>
      <button onClick={onConnect}>Connecter MetaMask</button>
      {info && <p>{info}</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
    </section>
  )
}