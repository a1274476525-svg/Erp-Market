import { useState, useCallback, useEffect } from 'react'
import { DateFilter, StatCards, ReportTitle, Empty, Tbl, fmt, fmtDate, useCur, thisMonth, today } from './shared'

// ─── تقرير المبيعات ───────────────────────────────────────────
export function SalesReport() {
  const cur = useCur()
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.reports.sales({ from, to })
    setData(d)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const rows = data?.byDay ?? data?.orders ?? []

  return (
    <div>
      <ReportTitle title="تقرير المبيعات" sub="ملخص المبيعات خلال الفترة" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {data && (
        <>
          <StatCards cards={[
            { label: 'إجمالي المبيعات',    value: `${fmt(data.total ?? data.revenue ?? 0)} ${cur}`, color: 'emerald' },
            { label: 'عدد الطلبات',        value: `${data.count ?? data.ordersCount ?? 0}`, color: 'blue' },
            { label: 'متوسط قيمة الطلب',  value: `${fmt(data.avgOrderValue ?? 0)} ${cur}`, color: 'violet' },
            { label: 'إجمالي الضريبة',    value: `${fmt(data.totalTax ?? 0)} ${cur}`, color: 'amber' },
          ]} />
          {!rows.length ? <Empty /> : (
            <Tbl heads={[{ label: 'التاريخ' }, { label: 'عدد الطلبات', left: true }, { label: 'إجمالي المبيعات', left: true }, { label: 'الضريبة', left: true }]}>
              {rows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-sm text-slate-600">{r.date ?? fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-2.5 text-sm text-left">{r.count ?? 1}</td>
                  <td className="px-4 py-2.5 text-sm text-left text-emerald-700 font-medium">{fmt(r.total ?? r.subtotal ?? 0)} {cur}</td>
                  <td className="px-4 py-2.5 text-sm text-left text-amber-600">{fmt(r.tax ?? r.taxAmount ?? 0)} {cur}</td>
                </tr>
              ))}
            </Tbl>
          )}
        </>
      )}
    </div>
  )
}

// ─── تقرير أوامر البيع ────────────────────────────────────────
export function SalesOrders() {
  const cur = useCur()
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.pos.getOrders()
    const f = (d ?? []).filter((o: any) => {
      const dt = o.createdAt?.slice(0, 10)
      return dt >= from && dt <= to
    })
    setOrders(f)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <ReportTitle title="تقرير أوامر البيع" sub="قائمة فواتير نقطة البيع" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {orders.length === 0 ? <Empty /> : (
        <>
          <StatCards cards={[
            { label: 'عدد الفواتير', value: `${orders.length}`, color: 'blue' },
            { label: 'إجمالي المبيعات', value: `${fmt(orders.reduce((s: number, o: any) => s + (o.total ?? 0), 0))} ${cur}`, color: 'emerald' },
          ]} />
          <Tbl heads={[{ label: 'رقم الفاتورة' }, { label: 'التاريخ' }, { label: 'العميل' }, { label: 'المبلغ', left: true }, { label: 'الحالة' }]}>
            {orders.map((o: any) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-sm font-mono text-slate-500">#{o.id}</td>
                <td className="px-4 py-2.5 text-sm text-slate-500">{fmtDate(o.createdAt)}</td>
                <td className="px-4 py-2.5 text-sm">{o.customer?.name ?? '—'}</td>
                <td className="px-4 py-2.5 text-sm text-left text-emerald-700 font-medium">{fmt(o.total ?? 0)} {cur}</td>
                <td className="px-4 py-2.5 text-sm">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === 'VOID' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {o.status === 'VOID' ? 'ملغية' : 'مكتملة'}
                  </span>
                </td>
              </tr>
            ))}
          </Tbl>
        </>
      )}
    </div>
  )
}

// ─── كشف حساب العملاء ────────────────────────────────────────
export function CustomerStatement() {
  const cur = useCur()
  const [from, setFrom]     = useState(thisMonth())
  const [to, setTo]         = useState(today())
  const [customers, setCustomers] = useState<any[]>([])
  const [customerId, setCustomerId] = useState<number | ''>('')
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { window.api.customers.getAll().then(setCustomers) }, [])

  const load = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    const d = await window.api.reports.customerStatement({ customerId, from, to })
    setData(d)
    setLoading(false)
  }, [from, to, customerId])

  const extra = (
    <select value={customerId} onChange={e => setCustomerId(Number(e.target.value) || '')}
      className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 min-w-[160px]">
      <option value="">— اختر العميل —</option>
      {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )

  return (
    <div>
      <ReportTitle title="كشف حساب العملاء" sub="حركات الشراء والرصيد لعميل محدد" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} extra={extra} />
      {data && (
        <>
          <StatCards cards={[
            { label: 'عدد الحركات',   value: `${data.count ?? 0}`, color: 'blue' },
            { label: 'إجمالي المشتريات', value: `${fmt(data.total ?? 0)} ${cur}`, color: 'emerald' },
          ]} />
          {!data.rows?.length ? <Empty /> : (
            <Tbl heads={[{ label: 'التاريخ' }, { label: 'رقم الفاتورة' }, { label: 'المبلغ', left: true }, { label: 'الرصيد التراكمي', left: true }]}>
              {data.rows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-sm text-slate-500">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2 text-sm font-mono text-slate-400">#{r.ref}</td>
                  <td className="px-4 py-2 text-sm text-left text-emerald-700">{fmt(r.amount)} {cur}</td>
                  <td className="px-4 py-2 text-sm text-left font-medium">{fmt(r.balance)} {cur}</td>
                </tr>
              ))}
            </Tbl>
          )}
        </>
      )}
    </div>
  )
}

// ─── أعمار الذمم المدينة (AR Aging) ──────────────────────────
export function ArAging() {
  const cur = useCur()
  const [asOf, setAsOf] = useState(today())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.reports.arAging({ asOf })
    setData(d)
    setLoading(false)
  }, [asOf])

  useEffect(() => { load() }, [load])

  const rows: any[] = data?.rows ?? data ?? []

  return (
    <div>
      <ReportTitle title="أعمار الذمم المدينة" sub="تصنيف مديونيات العملاء حسب التقادم" />
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 print:hidden">
        <span className="text-sm text-slate-500">حتى تاريخ:</span>
        <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 mr-auto">
          عرض
        </button>
      </div>
      {data && (rows.length === 0 ? <Empty /> : (
        <Tbl heads={[{ label: 'العميل' }, { label: 'آخر معاملة' }, { label: 'إجمالي', left: true }, { label: '0-30 يوم', left: true }, { label: '31-60 يوم', left: true }, { label: '61-90 يوم', left: true }, { label: '+90 يوم', left: true }]}>
          {rows.map((r: any, i: number) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 text-sm font-medium">{r.name}</td>
              <td className="px-4 py-2.5 text-sm text-slate-500">{r.lastDate ? fmtDate(r.lastDate) : '—'}</td>
              <td className="px-4 py-2.5 text-sm text-left font-medium">{fmt(r.total ?? 0)}</td>
              <td className="px-4 py-2.5 text-sm text-left text-emerald-700">{fmt(r.c0 ?? 0)}</td>
              <td className="px-4 py-2.5 text-sm text-left text-amber-600">{fmt(r.c30 ?? 0)}</td>
              <td className="px-4 py-2.5 text-sm text-left text-orange-600">{fmt(r.c60 ?? 0)}</td>
              <td className="px-4 py-2.5 text-sm text-left text-red-700">{fmt(r.c90 ?? 0)}</td>
            </tr>
          ))}
        </Tbl>
      ))}
    </div>
  )
}

// ─── تقرير المشتريات ──────────────────────────────────────────
export function PurchasesReport() {
  const cur = useCur()
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.reports.purchases({ from, to })
    setData(d)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const rows = data?.invoices ?? data?.rows ?? []

  return (
    <div>
      <ReportTitle title="تقرير المشتريات" sub="ملخص فواتير المشتريات خلال الفترة" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {data && (
        <>
          <StatCards cards={[
            { label: 'إجمالي المشتريات', value: `${fmt(data.total ?? 0)} ${cur}`, color: 'amber' },
            { label: 'عدد الفواتير',    value: `${data.count ?? rows.length}`, color: 'blue' },
            { label: 'إجمالي الضريبة', value: `${fmt(data.totalTax ?? 0)} ${cur}`, color: 'slate' },
          ]} />
          {!rows.length ? <Empty /> : (
            <Tbl heads={[{ label: 'التاريخ' }, { label: 'المورد' }, { label: 'رقم الفاتورة' }, { label: 'المبلغ', left: true }, { label: 'الضريبة', left: true }]}>
              {rows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-sm text-slate-500">{fmtDate(r.date ?? r.createdAt)}</td>
                  <td className="px-4 py-2.5 text-sm">{r.supplier?.name ?? r.supplierName ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-slate-400">{r.invoiceNumber ?? r.ref ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-left text-amber-700 font-medium">{fmt(r.total ?? r.subtotal ?? 0)} {cur}</td>
                  <td className="px-4 py-2.5 text-sm text-left text-slate-500">{fmt(r.tax ?? r.taxAmount ?? 0)} {cur}</td>
                </tr>
              ))}
            </Tbl>
          )}
        </>
      )}
    </div>
  )
}

// ─── كشف حساب الموردين ───────────────────────────────────────
export function SupplierStatement() {
  const cur = useCur()
  const [from, setFrom]     = useState(thisMonth())
  const [to, setTo]         = useState(today())
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [supplierId, setSupplierId] = useState<number | ''>('')
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { window.api.suppliers.getAll().then(setSuppliers) }, [])

  const load = useCallback(async () => {
    if (!supplierId) return
    setLoading(true)
    const d = await window.api.reports.supplierStatement({ supplierId, from, to })
    setData(d)
    setLoading(false)
  }, [from, to, supplierId])

  const extra = (
    <select value={supplierId} onChange={e => setSupplierId(Number(e.target.value) || '')}
      className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 min-w-[160px]">
      <option value="">— اختر المورد —</option>
      {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  )

  return (
    <div>
      <ReportTitle title="كشف حساب الموردين" sub="حركات المشتريات والرصيد لمورد محدد" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} extra={extra} />
      {data && (
        <>
          <StatCards cards={[
            { label: 'عدد الفواتير',   value: `${data.count ?? 0}`, color: 'blue' },
            { label: 'إجمالي المشتريات', value: `${fmt(data.total ?? 0)} ${cur}`, color: 'amber' },
          ]} />
          {!data.rows?.length ? <Empty /> : (
            <Tbl heads={[{ label: 'التاريخ' }, { label: 'رقم الفاتورة' }, { label: 'المبلغ', left: true }, { label: 'الرصيد التراكمي', left: true }]}>
              {data.rows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-sm text-slate-500">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2 text-sm font-mono text-slate-400">{r.ref}</td>
                  <td className="px-4 py-2 text-sm text-left text-amber-700">{fmt(r.amount)} {cur}</td>
                  <td className="px-4 py-2 text-sm text-left font-medium">{fmt(r.balance)} {cur}</td>
                </tr>
              ))}
            </Tbl>
          )}
        </>
      )}
    </div>
  )
}

// ─── أعمار الذمم الدائنة (AP Aging) ──────────────────────────
export function ApAging() {
  const cur = useCur()
  const [asOf, setAsOf] = useState(today())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.reports.apAging({ asOf })
    setData(d)
    setLoading(false)
  }, [asOf])

  useEffect(() => { load() }, [load])

  const rows: any[] = data?.rows ?? data ?? []

  return (
    <div>
      <ReportTitle title="أعمار الذمم الدائنة" sub="تصنيف مستحقات الموردين حسب التقادم" />
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 print:hidden">
        <span className="text-sm text-slate-500">حتى تاريخ:</span>
        <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 mr-auto">
          عرض
        </button>
      </div>
      {data && (rows.length === 0 ? <Empty /> : (
        <Tbl heads={[{ label: 'المورد' }, { label: 'آخر معاملة' }, { label: 'إجمالي', left: true }, { label: '0-30 يوم', left: true }, { label: '31-60 يوم', left: true }, { label: '61-90 يوم', left: true }, { label: '+90 يوم', left: true }]}>
          {rows.map((r: any, i: number) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 text-sm font-medium">{r.name}</td>
              <td className="px-4 py-2.5 text-sm text-slate-500">{r.lastDate ? fmtDate(r.lastDate) : '—'}</td>
              <td className="px-4 py-2.5 text-sm text-left font-medium">{fmt(r.total ?? 0)}</td>
              <td className="px-4 py-2.5 text-sm text-left text-emerald-700">{fmt(r.c0 ?? 0)}</td>
              <td className="px-4 py-2.5 text-sm text-left text-amber-600">{fmt(r.c30 ?? 0)}</td>
              <td className="px-4 py-2.5 text-sm text-left text-orange-600">{fmt(r.c60 ?? 0)}</td>
              <td className="px-4 py-2.5 text-sm text-left text-red-700">{fmt(r.c90 ?? 0)}</td>
            </tr>
          ))}
        </Tbl>
      ))}
    </div>
  )
}

// ─── مرفقات جهة الاتصال (Placeholder) ────────────────────────
export function ContactAttachments() {
  return (
    <div>
      <ReportTitle title="مرفقات جهة الاتصال" sub="مرفقات العملاء والموردين" />
      <div className="bg-white rounded-xl p-12 text-center text-slate-400 shadow-sm">
        <div className="text-4xl mb-3">📎</div>
        <p className="text-sm">هذا التقرير قيد التطوير</p>
        <p className="text-xs mt-1">سيتضمن مرفقات العقود والمستندات لكل جهة اتصال</p>
      </div>
    </div>
  )
}
