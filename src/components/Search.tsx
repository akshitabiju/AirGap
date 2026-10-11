import { useEffect, useMemo, useRef, useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { useData } from '../lib/store'
import { fmt } from '../lib/scale'
import type { City } from '../lib/types'

/** Finds a city, selects the district containing it and flies the map there. */
export default function Search({ onPick }: { onPick: (c: City) => void }) {
  const cities = useData((s) => s.cities)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  const hits = useMemo(() => {
    if (!cities || q.trim().length < 2) return []
    const s = q.trim().toLowerCase()
    const starts = cities.filter((c) => c.name.toLowerCase().startsWith(s))
    const contains = cities.filter((c) => !c.name.toLowerCase().startsWith(s) && c.name.toLowerCase().includes(s))
    return [...starts, ...contains].slice(0, 8)
  }, [q, cities])

  useEffect(() => { setActive(0) }, [hits.length])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function pick(c: City) { onPick(c); setQ(c.name); setOpen(false) }

  return (
    <div ref={box} className="relative">
      <SearchIcon size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        className="input pl-9"
        placeholder={cities ? 'Find a town or city…' : 'Loading places…'}
        value={q}
        disabled={!cities}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && hits[active]) pick(hits[active])
          if (e.key === 'Escape') setOpen(false)
        }}
        aria-label="Search places"
      />
      {open && q.trim().length >= 2 && (
        <ul className="card absolute z-20 mt-1.5 w-full overflow-hidden bg-cream py-1 text-sm shadow-lg">
          {hits.length === 0 && <li className="px-4 py-2 text-ink-3">No place found for "{q}"</li>}
          {hits.map((c, i) => (
            <li key={`${c.name}-${c.lat}`}>
              <button onMouseEnter={() => setActive(i)} onClick={() => pick(c)}
                className={`flex w-full items-center justify-between px-4 py-1.5 text-left ${i === active ? 'bg-cream-2' : ''}`}>
                <span>{c.name}</span><span className="num text-xs text-ink-3">{fmt(c.pop)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
