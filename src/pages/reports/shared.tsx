import { Printer, RefreshCw } from 'lucide-react'
import { useSettings } from '../../contexts/SettingsContext'

export function useCur() {
  const { settings } = useSettings()
  return settings.currency ?? 'ج.م'
}

export const thisMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
export const today     = () => new Date().toISOString().slice(0, 10)

export const fmt = (n: number) =>
  n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })

export function DateFilter({
  from, setFrom, to, setTo, onRun, loading, extra,
}: {
  from: string; setFrom: (v: string) => void
  to: string; setTo: (v: string) => void
  onRun: () => void; loading: boolean
  extra?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 print:hidden">
      <span className="text-sm text-slate-500 font-medium shrink-0">الفترة:</span>
      <input type="date" value={from} onChange={e => setFrom(e.target.value)}
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
      <span className="text-slate-400">—</span>
      <input type="date" value={to} onChange={e => setTo(e.target.value)}
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
      {extra}
      <div className="flex gap-2 mr-auto">
        <button onClick={onRun} disabled={loading}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'جارٍ التحميل...' : 'عرض التقرير'}
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50 transition-colors print:hidden">
          <Printer size={13} /> طباعة
        </button>
      </div>
    </div>
  )
}

export function StatCards({ cards }: { cards: { label: string; value: string; sub?: string; color?: string }[] }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-600', red: 'text-red-600', blue: 'text-blue-600',
    amber: 'text-amber-600', violet: 'text-violet-600', slate: 'text-slate-800',
  }
  return (
    <div className={`grid gap-3 mb-4 grid-cols-2 md:grid-cols-${Math.min(cards.length, 4)}`}>
      {cards.map((c, i) => (
        <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">{c.label}</div>
          <div className={`text-xl font-bold ${colors[c.color ?? 'slate']}`}>{c.value}</div>
          {c.sub && <div className="text-xs text-slate-400 mt-0.5">{c.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export function ReportTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export function Empty({ msg = 'لا توجد بيانات في هذه الفترة' }: { msg?: string }) {
  return <div className="text-center py-16 text-slate-400 bg-white rounded-xl text-sm">{msg}</div>
}

export function Tbl({ heads, children }: { heads: { label: string; left?: boolean }[]; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              {heads.map((h, i) => (
                <th key={i} className={`px-4 py-2.5 font-medium text-xs ${h.left ? 'text-left' : 'text-right'}`}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
    </div>
  )
}

export function TR({ cells, highlight }: { cells: React.ReactNode[]; highlight?: boolean }) {
  return (
    <tr className={`${highlight ? 'bg-emerald-50 font-semibold' : 'hover:bg-slate-50'}`}>
      {cells.map((c, i) => <td key={i} className="px-4 py-2.5 text-sm text-slate-700">{c}</td>)}
    </tr>
  )
}
