import { createContext, useContext } from 'react'
import type { Roles, WalletSession } from '../lib/contract'

export interface WalletState {
  session: WalletSession | null
  roles: Roles | null
  connecting: boolean
  error: string
  connect: () => Promise<void>
}

export const WalletContext = createContext<WalletState | null>(null)

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet doit être utilisé dans <WalletProvider>.')
  return ctx
}