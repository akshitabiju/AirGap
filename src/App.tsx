import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Nav from './components/Nav'
import Footer from './components/Footer'
import Landing from './pages/Landing'
import Accuracy from './pages/Accuracy'
import PlacementPage from './pages/Placement'
import Method from './pages/Method'
import { useData } from './lib/store'

export default function App() {
  const load = useData((s) => s.load)
  const { pathname } = useLocation()
  useEffect(() => { void load() }, [load])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [pathname])
  return (
    <div className="grain relative min-h-screen flex flex-col">
      <Nav />
      <main className={`relative z-[1] flex-1 ${pathname === '/' ? '' : 'pt-14'}`}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/accuracy" element={<Accuracy />} />
          <Route path="/placement" element={<PlacementPage />} />
          <Route path="/method" element={<Method />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
