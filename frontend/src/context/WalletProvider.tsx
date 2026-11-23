import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  connectWallet,
  getContract,
  getRoles,
  isSupportedNetwork,
  networkName,
  onWalletChange,
  toWalletError,
  type Roles,
  type WalletSession,
} from '../lib/contract'
import { WalletContext } from './useWallet'

export default function WalletProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WalletSession | null>(null)
  const [roles, setRoles] = useState<Roles | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  const connect = useCallback(async () => {
    setConnecting(true)
    setError('')
    try {
      const s = await connectWallet()
      setSession(s)
      setRoles(null)
      if (!isSupportedNetwork(s.chainId)) {
        setError(`Réseau non supporté : ${networkName(s.chainId)}.`)
        return
      }
      try {
        setRoles(await getRoles(getContract(s.signer, s.chainId), s.address))
      } catch (err) {
        const e = err as { code?: string }
        setError(
          e?.code === 'BAD_DATA'
            ? 'Contrat introuvable à cette adresse. Le nœud local a-t-il été redémarré ? Redéployez le contrat.'
            : toWalletError(err).message,
        )
      }
    } catch (err) {
      setSession(null)
      setRoles(null)
      setError(toWalletError(err).message)
    } finally {
      setConnecting(false)
    }
  }, [])

  // Reconnexion silencielle au chargement si le site est déjà autorisé.
  useEffect(() => {
    const eth = window.ethereum
    if (!eth) return
    eth
      .request({ method: 'eth_accounts' })
      .then((accounts) => {
        if (Array.isArray(accounts) && accounts.length > 0) void connect()
      })
      .catch(() => {})
  }, [connect])

  // Changement de compte ou de réseau dans MetaMask.
  useEffect(() => {
    return onWalletChange(async () => {
      const accounts = await window.ethereum?.request({ method: 'eth_accounts' })
      if (Array.isArray(accounts) && accounts.length > 0) {
        void connect()
      } else {
        setSession(null)
        setRoles(null)
        setError('')
      }
    })
  }, [connect])

  const value = useMemo(
    () => ({ session, roles, connecting, error, connect }),
    [session, roles, connecting, error, connect],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}