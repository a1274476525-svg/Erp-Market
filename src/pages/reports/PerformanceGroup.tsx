import { useState, useCallback, useEffect } from 'react'
import { DateFilter, StatCards, ReportTitle, Empty, Tbl, fmt, fmtDate, useCur, thisMonth, today } from './shared'

// ─── ملخص تنفيذي ──────────────────────────────────────────────
export function ExecutiveSummary() {
  const cur = useCur()
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.reports.executiveSummary({ from, to })
    setData(d)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  if (!data && loading) return (
    <div>
      <ReportTitle title="الملخص التنفيذي" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      <div className="text-center py-16 text-slate-400 text-sm">جارٍ التحميل...</div>
    </div>
  )

  const byDay: any[] = data?.byDay ?? []
  const net = (data?.revenue ?? 0) - (data?.purchases ?? 0) - (data?.expenses ?? 0)

  return (
    <div>
      <ReportTitle title="الملخص التنفيذي" sub="نظرة شاملة على أداء المنشأة خلال الفترة" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'إجمالي المبيعات',   value: fmt(data.revenue ?? 0), sub: `${data.ordersCount ?? 0} طلب`, color: 'bg-emerald-500' },
              { label: 'إجمالي المشتريات',  value: fmt(data.purchases ?? 0), sub: `متوسط ${fmt(data.avgOrderValue ?? 0)}`, color: 'bg-amber-500' },
              { label: 'إجمالي المصاريف',   value: fmt(data.expenses ?? 0), sub: '', color: 'bg-red-500' },
              { label: net >= 0 ? 'صافي الربح' : 'صافي الخسارة', value: fmt(Math.abs(net)), sub: '', color: net >= 0 ? 'bg-blue-600' : 'bg-red-600' },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm overflow-hidden relative">
                <div className={`absolute top-0 right-0 w-1.5 h-full ${c.color} rounded-r-xl`} />
                <div className="text-xs text-slate-500 mb-1 pr-2">{c.label}</div>
                <div className="text-xl font-bold text-slate-800 pr-2">{c.value}</div>
                {c.sub && <div className="text-xs text-slate-400 pr-2">{c.sub}</div>}
                <div className="text-xs text-slate-300 pr-2">{cur}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'قيمة المخزون',    value: fmt(data.inventoryValue ?? 0), color: 'violet' },
              { label: 'منتجات نفدت',     value: `${data.outOfStockCount ?? 0}`, color: 'red' },
              { label: 'مخزون منخفض',     value: `${data.lowStockCount ?? 0}`, color: 'amber' },
              { label: 'إجمالي النقدية',  value: fmt(data.totalCash ?? 0), color: 'blue' },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-xs text-slate-500 mb-1">{c.label}</div>
                <div className="text-lg font-bold text-slate-700">{c.value}</div>
              </div>
            ))}
          </div>

          {byDay.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">حركة المبيعات اليومية</h3>
              <Tbl heads={[{ label: 'التاريخ' }, { label: 'المبيعات', left: true }, { label: 'عدد الطلبات', left: true }]}>
                {byDay.map((d: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm text-slate-600">{d.date}</td>
                    <td className="px-4 py-2 text-sm text-left text-emerald-700 font-medium">{fmt(d.revenue ?? 0)} {cur}</td>
                    <td className="px-4 py-2 text-sm text-left">{d.count ?? 0}</td>
                  </tr>
                ))}
              </Tbl>
            </>
          )}
          {byDay.length === 0 && <Empty msg="لا توجد بيانات كافية للعرض" />}
        </>
      )}
    </div>
  )
}
