import { useMemo, useState } from 'react'
import { Clock, Share2, Check } from 'lucide-react'
import { useData } from '../lib/store'
import { band, colorFor, fmt } from '../lib/scale'
import type { Lang } from '../lib/i18n'
import type { DistrictProps } from '../lib/types'

const T = {
  en: {
    title: 'Best hours to step out', today: 'Today', tomorrow: 'Tomorrow', best: 'Cleanest', worst: 'Worst', now: 'now',
    tip: (b: string, w: string) => `Plan outdoor time for ${b}. Avoid ${w} if you can.`,
    method: 'Hourly shape from the Copernicus CAMS forecast, scaled to the AirGap daily estimate. Treat as a pattern, not a measurement.',
    share: 'Share on WhatsApp', copied: 'Copied', unavailable: 'Hourly profile not available for this district today.',
    msg: (name: string, pm: number, bandLabel: string, b: string, w: string, url: string) =>
      `Air today in ${name}: ${pm} µg/m³ PM2.5 (${bandLabel}).\nCleanest hours: ${b}. Worst: ${w}.\nCheck your district: ${url}`,
  },
  hi: {
    title: 'बाहर निकलने के सबसे अच्छे घंटे', today: 'आज', tomorrow: 'कल', best: 'सबसे साफ़', worst: 'सबसे खराब', now: 'अभी',
    tip: (b: string, w: string) => `बाहर का समय ${b} रखें। हो सके तो ${w} से बचें।`,
    method: 'घंटे-दर-घंटे का पैटर्न कॉपरनिकस CAMS पूर्वानुमान से, स्तर AirGap के दैनिक अनुमान से। इसे पैटर्न मानें, माप नहीं।',
    share: 'WhatsApp पर शेयर करें', copied: 'कॉपी हो गया', unavailable: 'इस ज़िले के लिए आज का घंटेवार पैटर्न उपलब्ध नहीं है।',
    msg: (name: string, pm: number, bandLabel: string, b: string, w: string, url: string) =>
      `आज ${name} की हवा: ${pm} µg/m³ PM2.5 (${bandLabel})।\nसबसे साफ़ घंटे: ${b}। सबसे खराब: ${w}।\nअपना ज़िला देखें: ${url}`,
  },
}

const hhmm = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`
const span = (s: number) => `${hhmm(s)}–${hhmm(s + 3)}`

/** Lowest / highest mean 3-hour window between 6:00 and 21:00 (when people actually go out). */
function windows(hours: number[]) {
  let best = 6, worst = 6, bv = Infinity, wv = -Infinity
  for (let s = 6; s <= 18; s++) {
    const m = (hours[s] + hours[s + 1] + hours[s + 2]) / 3
    if (m < bv) { bv = m; best = s }
    if (m > wv) { wv = m; worst = s }
  }
  return { best, worst, bv, wv }
}

export default function BestHours({ district, lang, bandLabel }: { district: DistrictProps; lang: Lang; bandLabel: string }) {
  const hourly = useData((s) => s.hourly)
  const t = T[lang]
  const [dayIdx, setDayIdx] = useState(0)
  const [copied, setCopied] = useState(false)
  const series = hourly?.series[String(district.id)]
  const hours = series?.[dayIdx] ?? null
  const nowH = new Date().getHours()
  const w = useMemo(() => (hours ? windows(hours) : null), [hours])
  const siteUrl = typeof window !== 'undefined' ? `${location.origin}/?d=${district.id}` : ''

  async function share() {
    if (!w || district.pred == null) return
    const text = t.msg(district.name, Math.round(district.pred), bandLabel, span(w.best), span(w.worst), siteUrl)
    if (navigator.share) { try { await navigator.share({ text }); return } catch { /* cancelled */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  if (!hourly) return null
  return (
    <div className="mt-4 rounded-2xl border border-line bg-cream-2/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium"><Clock size={15} className="text-forest" />{t.title}</div>
        <div className="flex rounded-full bg-cream-2 p-0.5 text-xs">
          {[t.today, t.tomorrow].map((l, i) => (
            <button key={l} onClick={() => setDayIdx(i)} className={`rounded-full px-3 py-1 transition ${dayIdx === i ? 'bg-ink text-cream' : 'text-ink-2'}`}>{l}</button>
          ))}
        </div>
      </div>

      {!hours || !w ? (
        <p className="mt-3 text-xs text-ink-3">{t.unavailable}</p>
      ) : (
        <>
          <div className="mt-3 flex h-14 items-end gap-[2px]" role="img" aria-label="Hourly PM2.5 profile">
            {hours.map((v, h) => {
              const isBest = h >= w.best && h < w.best + 3, isWorst = h >= w.worst && h < w.worst + 3
              const max = Math.max(...hours, 1)
              return (
                <div key={h} className="group relative flex-1" title={`${hhmm(h)}: ${v} µg/m³ · ${band(v).label}`}>
                  <div className={`w-full rounded-t-[3px] transition ${isBest ? 'ring-2 ring-forest' : isWorst ? 'ring-2 ring-rust' : ''}`}
                    style={{ height: `${Math.max(8, (v / max) * 100)}%`, background: colorFor(v), opacity: dayIdx === 0 && h < nowH ? 0.45 : 1 }} />
                  {dayIdx === 0 && h === nowH && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] uppercase text-ink-3">{t.now}</span>}
                </div>
              )
            })}
          </div>
          <div className="num mt-1 flex justify-between text-[10px] text-ink-3"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-forest/30 bg-forest/5 p-2.5"><div className="text-ink-3">{t.best}</div><div className="num text-base text-forest">{span(w.best)}</div><div className="num text-[10px] text-ink-3">~{fmt(w.bv)} µg/m³</div></div>
            <div className="rounded-xl border border-rust/30 bg-rust/5 p-2.5"><div className="text-ink-3">{t.worst}</div><div className="num text-base text-rust">{span(w.worst)}</div><div className="num text-[10px] text-ink-3">~{fmt(w.wv)} µg/m³</div></div>
          </div>
          <p className="mt-2 text-sm text-ink-2">{t.tip(span(w.best), span(w.worst))}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-ink-3">{t.method}</p>
            <button onClick={share} className="btn btn-solid !py-1.5 text-xs">{copied ? <Check size={13} /> : <Share2 size={13} />}{copied ? t.copied : t.share}</button>
          </div>
        </>
      )}
    </div>
  )
}
