import { useState, useEffect } from 'react'
import { Download, Printer, RotateCcw, Filter, RefreshCw } from 'lucide-react'
import { useSettings } from '../../contexts/SettingsContext'

function todayStr() { return new Date().toISOString().slice(0, 10) }
function dateStr(d: Date | string): string { return d instanceof Date ? d.toISOString() : String(d) }

function dateRange(preset: string): { from: string; to: string } {
  const t = new Date()
  if (preset === 'today') return { from: todayStr(), to: todayStr() }
  if (preset === 'week') {
    const s = new Date(t); s.setDate(t.getDate() - 6)
    return { from: s.toISOString().slice(0, 10), to: todayStr() }
  }
  if (preset === 'month') {
    const s = new Date(t.getFullYear(), t.getMonth(), 1)
    return { from: s.toISOString().slice(0, 10), to: todayStr() }
  }
  return { from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: todayStr() }
}

function exportCSV(rows: any[], cols: { key: string; label: string }[], filename: string) {
  const header = cols.map(c => `"${c.label}"`).join(',')
  const body = rows.map(row =>
    cols.map(c => {
      const val = c.key.split('.').reduce((o: any, k) => o?.[k], row) ?? ''
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  )
  const csv = '\uFEFF' + header + '\n' + body.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function ReturnsReport() {
  const [preset, setPreset]   = useState<string>('month')
  const [from, setFrom]       = useState(dateRange('month').from)
  const [to, setTo]           = useState(dateRange('month').to)
  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { settings } = useSettings()
  const cur = settings.currency || 'ج.م'

  async function load() {
    try {
      setLoading(true)
      const data = await window.api.pos.getReturns()
      const filtered = data.filter(r => {
        const d = new Date(r.returnDate)
        const f = new Date(from); f.setUTCHours(0, 0, 0, 0)
        const t = new Date(to); t.setUTCHours(23, 59, 59, 999)
        return d >= f && d <= t
      })
      setReturns(filtered)
    } catch (e) {
      console.error('returns report error:', e)
      setReturns([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const total = returns.reduce((s, r) => s + r.total, 0)

  function pick(p: string) {
    setPreset(p)
    if (p !== 'custom') { const r = dateRange(p); setFrom(r.from); setTo(r.to) }
  }

  function doExport() {
    const rows = returns.map(r => ({
      returnNumber:  `RET-${r.id}`,
      date:          dateStr(r.returnDate).slice(0, 10),
      invoice:       r.order?.orderNumber ?? `#${r.orderId}`,
      customer:      r.order?.customer?.name ?? '—',
      reason:        r.reason ?? '—',
      itemCount:     r.items?.length ?? 0,
      total:         r.total.toFixed(2),
    }))
    exportCSV(rows, [
      { key: 'returnNumber', label: 'رقم المرتجع' },
      { key: 'date',         label: 'التاريخ' },
      { key: 'invoice',      label: 'الفاتورة الأصلية' },
      { key: 'customer',     label: 'العميل' },
      { key: 'reason',       label: 'السبب' },
      { key: 'itemCount',    label: 'عدد الأصناف' },
      { key: 'total',        label: 'الإجمالي' },
    ], `تقرير-المرتجعات-${from}-${to}.csv`)
  }

  function doExportItems() {
    const rows: any[] = []
    returns.forEach(r => {
      r.items?.forEach((item: any) => {
        rows.push({
          date:       dateStr(r.returnDate).slice(0, 10),
          invoice:    r.order?.orderNumber ?? `#${r.orderId}`,
          product:    item.productName,
          quantity:   item.quantity,
          unitPrice:  item.unitPrice.toFixed(2),
          total:      item.total.toFixed(2),
          reason:     r.reason ?? '—',
        })
      })
    })
    exportCSV(rows, [
      { key: 'date',       label: 'التاريخ' },
      { key: 'invoice',    label: 'الفاتورة الأصلية' },
      { key: 'product',    label: 'المنتج' },
      { key: 'quantity',   label: 'الكمية' },
      { key: 'unitPrice',  label: 'سعر الوحدة' },
      { key: 'total',      label: 'الإجمالي' },
      { key: 'reason',     label: 'السبب' },
    ], `تقرير-المرتجعات-تفصيلي-${from}-${to}.csv`)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <Filter size={15} className="text-slate-400" />
        <div className="flex gap-1">
          {['today', 'week', 'month', 'custom'].map((p: any) => (
            <button key={p} onClick={() => pick(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                preset === p ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {p === 'today' ? 'اليوم' : p === 'week' ? 'هذا الأسبوع' : p === 'month' ? 'هذا الشهر' : 'مخصص'}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">من</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <span className="text-sm text-slate-500">إلى</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        )}
        <div className="mr-auto"></div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex gap-2 mr-auto">
          <button onClick={doExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-600 text-rose-600 rounded-lg text-sm hover:bg-rose-50">
            <Download size={13} /> تصدير المرتجعات
          </button>
          <button onClick={doExportItems}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-600 text-blue-600 rounded-lg text-sm hover:bg-blue-50">
            <Download size={13} /> تصدير تفصيلي
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-400 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <Printer size={13} /> طباعة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-rose-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-rose-600">{total.toFixed(2)} {cur}</div>
          <div className="text-sm text-slate-500 mt-1">إجمالي المرتجعات</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-slate-600">{returns.length}</div>
          <div className="text-sm text-slate-500 mt-1">عدد المرتجعات</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-600">{returns.reduce((s, r) => s + (r.items?.length ?? 0), 0)}</div>
          <div className="text-sm text-slate-500 mt-1">إجمالي الأصناف المرتجعة</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-600">{returns.length > 0 ? (total / returns.length).toFixed(2) : '0.00'} {cur}</div>
          <div className="text-sm text-slate-500 mt-1">متوسط المرتجع</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="font-semibold text-slate-700 text-sm">تفاصيل المرتجعات ({returns.length})</span>
          <span className="text-xs text-slate-400">{from} إلى {to}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-right">رقم المرتجع</th>
                <th className="px-4 py-3 text-right">التاريخ</th>
                <th className="px-4 py-3 text-right">الفاتورة الأصلية</th>
                <th className="px-4 py-3 text-right">العميل</th>
                <th className="px-4 py-3 text-center">الأصناف</th>
                <th className="px-4 py-3 text-center">السبب</th>
                <th className="px-4 py-3 text-left font-bold">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returns.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400">
                  <RotateCcw size={32} className="mx-auto mb-2 opacity-30" />
                  <div>لا توجد مرتجعات في هذه الفترة</div>
                </td></tr>
              ) : returns.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-slate-600 text-xs">RET-{r.id}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{dateStr(r.returnDate).slice(0, 10)}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-700 text-xs">{r.order?.orderNumber ?? `#${r.orderId}`}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.order?.customer?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center text-slate-600">{r.items?.length ?? 0}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{r.reason ?? '—'}</td>
                  <td className="px-4 py-2.5 text-left font-bold text-rose-600">{r.total.toFixed(2)} {cur}</td>
                </tr>
              ))}
            </tbody>
            {returns.length > 0 && (
              <tfoot className="bg-rose-50">
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-right font-semibold text-slate-600 text-sm">المجموع</td>
                  <td className="px-4 py-2.5 text-center font-semibold text-slate-600"></td>
                  <td className="px-4 py-2.5 text-left font-bold text-rose-700 text-base">{total.toFixed(2)} {cur}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
