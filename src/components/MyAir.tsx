import { useEffect, useMemo, useState } from 'react'
import { Baby, Bike, Cigarette, Crosshair, HeartPulse, Loader2, LocateFixed, ShieldAlert, User } from 'lucide-react'
import { useData } from '../lib/store'
import { band, colorFor, fmt, WHO_GUIDELINE_24H } from '../lib/scale'
import { districtAt, inIndia } from '../lib/geo'
import Search from './Search'
import type { City, DistrictProps } from '../lib/types'

type Profile = 'general' | 'sensitive' | 'child' | 'active'
const PROFILES: { id: Profile; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'general', label: 'Healthy adult', icon: <User size={14} />, hint: 'No known respiratory or heart condition' },
  { id: 'sensitive', label: 'Asthma / heart / 60+', icon: <HeartPulse size={14} />, hint: 'Respiratory or cardiac condition, pregnancy, or older adult' },
  { id: 'child', label: 'Child at home', icon: <Baby size={14} />, hint: 'Children breathe faster and are more affected' },
  { id: 'active', label: 'Outdoor work / sport', icon: <Bike size={14} />, hint: 'Heavy breathing outdoors multiplies the dose' },
]

/** Plain-language guidance by CPCB band and profile. General guidance based on CPCB AQI health advisories; not medical advice. */
function advice(pm: number, profile: Profile): { level: 0 | 1 | 2 | 3; title: string; text: string } {
  const b = band(pm).label
  const sens = profile !== 'general'
  switch (b) {
    case 'Good': return { level: 0, title: 'Clear to go outside', text: 'Air is within India’s safe band. Open the windows, exercise outdoors.' }
    case 'Satisfactory': return sens
      ? { level: 1, title: 'Fine, with a small caveat', text: 'Most people are unaffected. If you notice breathing discomfort, shorten intense outdoor activity.' }
      : { level: 0, title: 'Fine for you', text: 'Minor effects possible only for very sensitive people. No change needed.' }
    case 'Moderate': return sens
      ? { level: 2, title: 'Limit heavy exertion outdoors', text: profile === 'child' ? 'Keep playtime calm and shorter; watch for coughing or wheezing.' : 'Avoid long runs or heavy work outside; keep a reliever inhaler at hand if prescribed.' }
      : { level: 1, title: 'Ease off hard workouts outside', text: 'Light activity is fine. Prolonged, intense exertion may cause discomfort.' }
    case 'Poor': return sens
      ? { level: 3, title: 'Stay in, or mask up', text: 'Avoid outdoor exertion. If you must go out, wear a well-fitted N95. Keep windows closed in the hours of worst air.' }
      : { level: 2, title: 'Cut outdoor exertion', text: 'Reduce prolonged outdoor activity; an N95 helps for commutes. Close windows during peaks.' }
    case 'Very poor': return { level: 3, title: 'Avoid outdoor exposure', text: sens ? 'Stay indoors, run a purifier if you have one, and seek care if breathing worsens.' : 'Avoid outdoor exertion, wear an N95 outside, keep windows closed, use a purifier if available.' }
    default: return { level: 3, title: 'Stay indoors', text: 'Health emergency band. Avoid going out; seal rooms; use a purifier; seek care for any breathing difficulty.' }
  }
}
const LEVEL_STYLE = ['bg-emerald-500/10 border-emerald-500/30', 'bg-lime-500/10 border-lime-500/30', 'bg-amber-500/10 border-amber-500/40', 'bg-rose-500/10 border-rose-500/40']

export default function MyAir({ onLocate }: { onLocate: (p: DistrictProps) => void }) {
  const districts = useData((s) => s.districts)
  const [profile, setProfile] = useState<Profile>(() => { try { return (localStorage.getItem('airgap.profile') as Profile) || 'general' } catch { return 'general' } })
  const [place, setPlace] = useState<{ label: string; lat: number; lon: number; via: 'gps' | 'search' } | null>(() => { try { const s = localStorage.getItem('airgap.place'); return s ? JSON.parse(s) : null } catch { return null } })
  const [geo, setGeo] = useState<'idle' | 'asking' | 'error' | 'outside'>('idle')
  useEffect(() => { try { localStorage.setItem('airgap.profile', profile) } catch { /* private mode */ } }, [profile])
  useEffect(() => { try { if (place) localStorage.setItem('airgap.place', JSON.stringify(place)) } catch { /* private mode */ } }, [place])

  const district = useMemo(() => (place && districts ? districtAt(districts, place.lat, place.lon) : null), [place, districts])

  function locate() {
    if (!navigator.geolocation) { setGeo('error'); return }
    setGeo('asking')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords
        if (!inIndia(lat, lon)) { setGeo('outside'); return }
        setGeo('idle'); setPlace({ label: 'Your location', lat, lon, via: 'gps' })
      },
      () => setGeo('error'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  }
  function pick(c: City) { setGeo('idle'); setPlace({ label: c.name, lat: c.lat, lon: c.lon, via: 'search' }) }

  const pm = district?.pred ?? null
  const adv = pm != null ? advice(pm, profile) : null

  return (
    <section className="mx-auto max-w-7xl px-5 pt-20 sm:px-8" id="my-air">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5" data-reveal>
          <p className="eyebrow">Your air</p>
          <h2 className="mt-1 text-3xl sm:text-4xl">What should <em className="italic text-forest">you</em> do today?</h2>
          <p className="mt-3 text-sm text-ink-2">Tell us where you are and who you are. We keep this on your device only; nothing is sent anywhere.</p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button onClick={locate} className="btn btn-solid justify-center sm:w-auto" disabled={geo === 'asking'}>
              {geo === 'asking' ? <Loader2 size={15} className="animate-spin" /> : <LocateFixed size={15} />}Use my location
            </button>
            <div className="flex-1"><Search onPick={pick} /></div>
          </div>
          {geo === 'error' && <p className="mt-2 text-xs text-rust">Couldn't get your location (permission denied or unavailable). Search for your town instead.</p>}
          {geo === 'outside' && <p className="mt-2 text-xs text-rust">You seem to be outside India; the model only covers Indian districts. Search a town to explore.</p>}

          <div className="mt-5">
            <div className="eyebrow mb-2">Who is this for?</div>
            <div className="grid grid-cols-2 gap-2">
              {PROFILES.map((p) => (
                <button key={p.id} onClick={() => setProfile(p.id)} title={p.hint}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${profile === p.id ? 'border-forest bg-forest text-cream' : 'border-line hover:bg-cream-2'}`}>
                  {p.icon}{p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7" data-reveal="scale">
          {!district || pm == null ? (
            <div className="card grid h-full min-h-[260px] place-items-center p-8 text-center text-sm text-ink-3">
              <div><Crosshair size={28} className="mx-auto mb-3 text-ink-3" />Pick a location to see today's estimate, what it means for you, and the district on the map.</div>
            </div>
          ) : (
            <div className="card relative overflow-hidden p-6">
              <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: colorFor(pm) }} />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">{place?.label}{place?.via === 'gps' ? ' · detected' : ''}</div>
                  <h3 className="mt-0.5 text-2xl">{district.name}</h3>
                  <p className="text-xs text-ink-3">nearest monitor {fmt(district.nearest_km)} km away · {(district.nearest_km ?? 0) > 25 ? 'this is a model estimate for an unmonitored district' : 'close to a monitor'}</p>
                </div>
                <div className="text-right">
                  <div className="num text-5xl leading-none" style={{ color: colorFor(pm) }}>{fmt(pm)}</div>
                  <div className="num text-xs text-ink-3">± {fmt(district.unc)} µg/m³ · {band(pm).label}</div>
                </div>
              </div>

              {adv && (
                <div className={`mt-5 rounded-2xl border p-4 ${LEVEL_STYLE[adv.level]}`}>
                  <div className="flex items-center gap-2 font-medium"><ShieldAlert size={16} />{adv.title}</div>
                  <p className="mt-1 text-sm text-ink-2">{adv.text}</p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl bg-cream-2/70 p-3"><div className="text-ink-3">vs WHO guideline</div><div className="num mt-1 text-lg">{(pm / WHO_GUIDELINE_24H).toFixed(1)}×</div></div>
                <div className="rounded-xl bg-cream-2/70 p-3"><div className="flex items-center gap-1 text-ink-3"><Cigarette size={11} />cigarettes / day</div><div className="num mt-1 text-lg">{(pm / 22).toFixed(1)}</div></div>
                <div className="rounded-xl bg-cream-2/70 p-3"><div className="text-ink-3">vs yesterday</div><div className="num mt-1 text-lg">{district.pred_prev != null ? `${pm - district.pred_prev > 0 ? '+' : ''}${fmt(pm - district.pred_prev)}` : '—'}</div></div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-ink-3">General guidance adapted from CPCB AQI health advisories. Not medical advice.</p>
                <button className="btn !py-1.5 text-xs" onClick={() => onLocate(district)}>Show on the map</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
