import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/institution', label: 'Institution' },
  { to: '/admin', label: 'Admin' },
  { to: '/history', label: 'Historique' },
]

export default function Layout() {
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
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}