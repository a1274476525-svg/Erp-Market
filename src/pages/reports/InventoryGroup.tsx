import { useState, useCallback, useEffect } from 'react'
import { StatCards, ReportTitle, Empty, Tbl, fmt, useCur } from './shared'

// ─── تقرير ملخص عناصر المخزون ─────────────────────────────────
export function InventorySummary() {
  const cur = useCur()
  const [categories, setCategories] = useState<any[]>([])
  const [catId, setCatId] = useState<number | ''>('')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    window.api.categories.getAll().then(setCategories)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.reports.inventoryExtended({ categoryId: catId || undefined })
    setData(d)
    setLoading(false)
  }, [catId])

  useEffect(() => { load() }, [load])

  const rows: any[] = data?.rows ?? []
  const summary = data?.summary ?? {}

  const statusBadge = (status: string) => {
    if (status === 'out')  return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">نفد</span>
    if (status === 'low')  return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">منخفض</span>
    return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">جيد</span>
  }

  return (
    <div>
      <ReportTitle title="تقرير ملخص عناصر المخزون" sub="قيمة المخزون وهامش الربح لكل منتج" />
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 print:hidden">
        <span className="text-sm text-slate-500">الصنف:</span>
        <select value={catId} onChange={e => setCatId(Number(e.target.value) || '')}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 min-w-[180px]">
          <option value="">جميع الأصناف</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 mr-auto">
          {loading ? 'جارٍ التحميل...' : 'عرض التقرير'}
        </button>
        <button onClick={() => window.print()} className="border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50">طباعة</button>
      </div>
      {data && (
        <>
          <StatCards cards={[
            { label: 'إجمالي المنتجات',     value: `${summary.total ?? rows.length}`, color: 'blue' },
            { label: 'قيمة المخزون الكلية', value: `${fmt(summary.totalValue ?? 0)} ${cur}`, color: 'violet' },
            { label: 'نفد من المخزون',      value: `${summary.outOfStock ?? 0}`, color: 'red' },
            { label: 'مخزون منخفض',         value: `${summary.lowStock ?? 0}`, color: 'amber' },
          ]} />
          {!rows.length ? <Empty /> : (
            <Tbl heads={[
              { label: 'المنتج' }, { label: 'الصنف' },
              { label: 'الكمية', left: true }, { label: 'تكلفة الوحدة', left: true },
              { label: 'قيمة المخزون', left: true }, { label: 'هامش الربح', left: true },
              { label: 'الحالة' },
            ]}>
              {rows.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-sm font-medium">{r.name}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-500">{r.category ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-left">{r.stock ?? 0} {r.unit ?? ''}</td>
                  <td className="px-4 py-2.5 text-sm text-left text-slate-600">{fmt(r.costPrice ?? 0)}</td>
                  <td className="px-4 py-2.5 text-sm text-left font-medium text-violet-700">{fmt(r.stockValue ?? 0)} {cur}</td>
                  <td className={`px-4 py-2.5 text-sm text-left font-medium ${(r.margin ?? 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {(r.margin ?? 0).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5">{statusBadge(r.status)}</td>
                </tr>
              ))}
            </Tbl>
          )}
        </>
      )}
    </div>
  )
}
