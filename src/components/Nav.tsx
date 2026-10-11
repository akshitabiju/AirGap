import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Wind } from 'lucide-react'

const links = [
  { to: '/', label: 'Map' },
  { to: '/accuracy', label: 'Accuracy' },
  { to: '/placement', label: 'Next 20 monitors' },
  { to: '/method', label: 'Method & data' },
]

export default function Nav() {
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40)
    on(); window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const dark = pathname === '/' && !scrolled
  return (
    <header className={`fixed inset-x-0 top-0 z-30 border-b backdrop-blur-md transition-colors duration-500 ${dark ? 'nav-dark' : 'nav-solid'}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
        <NavLink to="/" className="flex items-center gap-2.5">
          <span className={`grid h-8 w-8 place-items-center rounded-lg ${dark ? 'bg-cream text-night' : 'bg-forest text-cream'}`}><Wind size={16} strokeWidth={2.2} /></span>
          <span className="display text-xl leading-none">AirGap</span>
          <span className={`hidden text-xs sm:inline ${dark ? 'text-cream/60' : 'text-ink-3'}`}>· PM2.5 where India has no monitor</span>
        </NavLink>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}
              className={({ isActive }) => `rounded-full px-3 py-1.5 transition-colors ${
                isActive ? (dark ? 'bg-cream text-night' : 'bg-ink text-cream') : dark ? 'text-cream/80 hover:bg-white/10' : 'text-ink-2 hover:bg-cream-2'}`}>
              <span className="hidden sm:inline">{l.label}</span>
              <span className="sm:hidden">{l.label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
