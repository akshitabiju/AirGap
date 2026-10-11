import { useEffect, useMemo, useState } from 'react'
import { Baby, Bike, Cigarette, Crosshair, HeartPulse, Languages, Loader2, LocateFixed, ShieldAlert, User } from 'lucide-react'
import { useData } from '../lib/store'
import { band, colorFor, fmt, WHO_GUIDELINE_24H } from '../lib/scale'
import { districtAt, inIndia } from '../lib/geo'
import { STRINGS, type BandKey, type Lang, type Profile } from '../lib/i18n'
import Search from './Search'
import BestHours from './BestHours'
import type { City, DistrictProps } from '../lib/types'

const PROFILE_ICONS: Record<Profile, React.ReactNode> = { general: <User size={14} />, sensitive: <HeartPulse size={14} />, child: <Baby size={14} />, active: <Bike size={14} /> }
const PROFILE_ORDER: Profile[] = ['general', 'sensitive', 'child', 'active']
const LEVEL_STYLE = ['bg-emerald-500/10 border-emerald-500/30', 'bg-lime-500/10 border-lime-500/30', 'bg-amber-500/10 border-amber-500/40', 'bg-rose-500/10 border-rose-500/40']

function load<T>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback } }
function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* private mode */ } }

export default function MyAir({ onLocate }: { onLocate: (p: DistrictProps) => void }) {
  const districts = useData((s) => s.districts)
  const forecast = useData((s) => s.forecast)
  const [lang, setLang] = useState<Lang>(() => load<Lang>('airgap.lang', 'en'))
  const [profile, setProfile] = useState<Profile>(() => load<Profile>('airgap.profile', 'general'))
  const [place, setPlace] = useState<{ label: string; lat: number; lon: number; via: 'gps' | 'search' } | null>(() => load('airgap.place', null))
  const [geo, setGeo] = useState<'idle' | 'asking' | 'error' | 'outside'>('idle')
  useEffect(() => save('airgap.lang', lang), [lang])
  useEffect(() => save('airgap.profile', profile), [profile])
  useEffect(() => { if (place) save('airgap.place', place) }, [place])

  const T = STRINGS[lang]
  const district = useMemo(() => (place && districts ? districtAt(districts, place.lat, place.lon) : null), [place, districts])

  function locate() {
    if (!navigator.geolocation) { setGeo('error'); return }
    setGeo('asking')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords
        if (!inIndia(lat, lon)) { setGeo('outside'); return }
        setGeo('idle'); setPlace({ label: lang === 'hi' ? 'आपकी लोकेशन' : 'Your location', lat, lon, via: 'gps' })
      },
      () => setGeo('error'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  }
  function pick(c: City) { setGeo('idle'); setPlace({ label: c.name, lat: c.lat, lon: c.lon, via: 'search' }) }

  const pm = district?.pred ?? null
  const bandKey = (pm != null ? band(pm).label : 'No data') as BandKey
  const adv = pm != null ? T.advice(bandKey, profile) : null
  const fc = district && forecast ? forecast.series[String(district.id)] ?? null : null
  const trend = fc && pm != null ? fc[0][1] - pm : null
  const hiCls = lang === 'hi' ? 'hi' : ''

  return (
    <section className={`mx-auto max-w-7xl px-5 pt-20 sm:px-8 ${hiCls}`} id="my-air" lang={lang}>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5" data-reveal>
          <div className="flex items-center justify-between">
            <p className="eyebrow">{T.ui.eyebrow}</p>
            <button onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} className="btn !py-1 text-xs" aria-label="Switch language"><Languages size={13} />{T.ui.lang}</button>
          </div>
          <h2 className="mt-1 text-3xl sm:text-4xl">{T.ui.heading_a}<em className="italic text-forest">{T.ui.heading_you}</em>{T.ui.heading_b}</h2>
          <p className="mt-3 text-sm text-ink-2">{T.ui.intro}</p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button onClick={locate} className="btn btn-solid justify-center sm:w-auto" disabled={geo === 'asking'}>
              {geo === 'asking' ? <Loader2 size={15} className="animate-spin" /> : <LocateFixed size={15} />}{T.ui.locate}
            </button>
            <div className="flex-1"><Search onPick={pick} placeholder={T.ui.search} /></div>
          </div>
          {geo === 'error' && <p className="mt-2 text-xs text-rust">{T.ui.geo_error}</p>}
          {geo === 'outside' && <p className="mt-2 text-xs text-rust">{T.ui.geo_outside}</p>}

          <div className="mt-5">
            <div className="eyebrow mb-2">{T.ui.who}</div>
            <div className="grid grid-cols-2 gap-2">
              {PROFILE_ORDER.map((id) => (
                <button key={id} onClick={() => setProfile(id)} title={T.profiles[id].hint}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${profile === id ? 'border-forest bg-forest text-cream' : 'border-line hover:bg-cream-2'}`}>
                  {PROFILE_ICONS[id]}{T.profiles[id].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7" data-reveal="scale">
          {!district || pm == null ? (
            <div className="card grid h-full min-h-[260px] place-items-center p-8 text-center text-sm text-ink-3">
              <div><Crosshair size={28} className="mx-auto mb-3 text-ink-3" />{T.ui.empty}</div>
            </div>
          ) : (
            <div className="card relative overflow-hidden p-6">
              <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: colorFor(pm) }} />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="eyebrow">{place?.label}{place?.via === 'gps' ? ` · ${T.ui.detected}` : ''}</div>
                  <h3 className="mt-0.5 text-2xl">{district.name}</h3>
                  <p className="text-xs text-ink-3">{T.ui.nearest} {fmt(district.nearest_km)} {T.ui.km_away} · {(district.nearest_km ?? 0) > 25 ? T.ui.unmonitored : T.ui.monitored}</p>
                </div>
                <div className="text-right">
                  <div className="num text-5xl leading-none" style={{ color: colorFor(pm) }}>{fmt(pm)}</div>
                  <div className="num text-xs text-ink-3">± {fmt(district.unc)} µg/m³ · {T.band[bandKey]}</div>
                </div>
              </div>

              {adv && (
                <div className={`mt-5 rounded-2xl border p-4 ${LEVEL_STYLE[adv.level]}`}>
                  <div className="flex items-center gap-2 font-medium"><ShieldAlert size={16} />{adv.title}</div>
                  <p className="mt-1 text-sm text-ink-2">{adv.text}</p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl bg-cream-2/70 p-3"><div className="text-ink-3">{T.ui.vs_who}</div><div className="num mt-1 text-lg">{(pm / WHO_GUIDELINE_24H).toFixed(1)}×</div></div>
                <div className="rounded-xl bg-cream-2/70 p-3"><div className="flex items-center gap-1 text-ink-3"><Cigarette size={11} />{T.ui.cigs}</div><div className="num mt-1 text-lg">{(pm / 22).toFixed(1)}</div></div>
                <div className="rounded-xl bg-cream-2/70 p-3"><div className="text-ink-3">{T.ui.vs_yesterday}</div><div className="num mt-1 text-lg">{district.pred_prev != null ? `${pm - district.pred_prev > 0 ? '+' : ''}${fmt(pm - district.pred_prev)}` : '—'}</div></div>
              </div>

              {fc && (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-ink-3"><span>{T.ui.next3}</span>{trend != null && <span className={trend > 3 ? 'text-rust' : trend < -3 ? 'text-forest-3' : ''}>{trend > 3 ? T.ui.worse : trend < -3 ? T.ui.better : T.ui.same}</span>}</div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="rounded-xl border border-line p-2.5"><div className="text-ink-3">{T.ui.today}</div><div className="num mt-0.5 text-lg" style={{ color: colorFor(pm) }}>{fmt(pm)}</div><div className="text-[10px] text-ink-3">{T.band[bandKey]}</div></div>
                    {fc.map(([d, p, lo, hi]) => (
                      <div key={d} className="rounded-xl border border-dashed border-line p-2.5"><div className="text-ink-3">{d}</div><div className="num mt-0.5 text-lg" style={{ color: colorFor(p) }}>{fmt(p)}</div><div className="num text-[10px] text-ink-3">{fmt(lo)}–{fmt(hi)}</div></div>
                    ))}
                  </div>
                </div>
              )}
              <BestHours district={district} lang={lang} bandLabel={T.band[bandKey]} />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-ink-3">{T.ui.disclaimer}</p>
                <button className="btn !py-1.5 text-xs" onClick={() => onLocate(district)}>{T.ui.show_map}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
