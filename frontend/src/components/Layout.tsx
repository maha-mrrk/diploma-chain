import { NavLink, Outlet } from 'react-router-dom'
import WalletButton from './WalletButton'
import { useWallet } from '../context/useWallet'

const links = [
  { to: '/institution', label: 'Institution' },
  { to: '/admin', label: 'Admin' },
  { to: '/history', label: 'Historique' },
]

export default function Layout() {
  const { error } = useWallet()
  return (
    <>
      <header className="navbar">
        <NavLink to="/" className="brand">🎓 Diploma Chain</NavLink>
        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <WalletButton />
      </header>
      <main className="container">
        {error && <div className="alert alert-danger">{error}</div>}
        <Outlet />
      </main>
    </>
  )
}