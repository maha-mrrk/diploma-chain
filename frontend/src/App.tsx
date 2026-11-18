import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Institution from './pages/Institution'
import Admin from './pages/Admin'
import History from './pages/History'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/institution" element={<Institution />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/history" element={<History />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}