import { NavLink } from 'react-router-dom'
import { Wind } from 'lucide-react'

const links = [
  { to: '/', label: 'Map' },
  { to: '/accuracy', label: 'Accuracy' },
  { to: '/placement', label: 'Next 20 monitors' },
  { to: '/method', label: 'Method & data' },
]

export default function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-cream/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
        <NavLink to="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-forest text-cream"><Wind size={16} strokeWidth={2.2} /></span>
          <span className="display text-xl leading-none">AirGap</span>
          <span className="hidden text-xs text-ink-3 sm:inline">· PM2.5 where India has no monitor</span>
        </NavLink>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}
              className={({ isActive }) => `rounded-full px-3 py-1.5 transition-colors ${isActive ? 'bg-ink text-cream' : 'text-ink-2 hover:bg-cream-2'}`}>
              <span className="hidden sm:inline">{l.label}</span>
              <span className="sm:hidden">{l.label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
