import { useState, useCallback, useEffect } from 'react'
import { DateFilter, StatCards, ReportTitle, Empty, Tbl, fmt, fmtDate, useCur, thisMonth, today } from './shared'

// ─── كشف الحساب (عملاء/موردين) ────────────────────────────────
export function AccountStatement() {
  const cur = useCur()
  const [from, setFrom]   = useState(thisMonth())
  const [to, setTo]       = useState(today())
  const [type, setType]   = useState<'customer' | 'supplier'>('customer')
  const [customers, setCustomers] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [partyId, setPartyId] = useState<number | ''>('')
  const [data, setData]   = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    window.api.customers.getAll().then(setCustomers)
    window.api.suppliers.getAll().then(setSuppliers)
  }, [])

  const parties = type === 'customer' ? customers : suppliers

  const load = useCallback(async () => {
    if (!partyId) return
    setLoading(true)
    const d = type === 'customer'
      ? await window.api.reports.customerStatement({ customerId: partyId, from, to })
      : await window.api.reports.supplierStatement({ supplierId: partyId, from, to })
    setData(d)
    setLoading(false)
  }, [from, to, type, partyId])

  const extra = (
    <div className="flex items-center gap-2">
      <select value={type} onChange={e => { setType(e.target.value as any); setPartyId(''); setData(null) }}
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500">
        <option value="customer">عميل</option>
        <option value="supplier">مورد</option>
      </select>
      <select value={partyId} onChange={e => setPartyId(Number(e.target.value) || '')}
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 min-w-[160px]">
        <option value="">— اختر —</option>
        {parties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  )

  return (
    <div>
      <ReportTitle title="كشف الحساب" sub="حركات وأرصدة العملاء والموردين" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} extra={extra} />
      {data && (
        <>
          <StatCards cards={[
            { label: 'عدد الحركات',   value: `${data.count ?? 0}`, color: 'blue' },
            { label: 'إجمالي المبلغ', value: `${fmt(data.total ?? 0)} ${cur}`, color: 'slate' },
          ]} />
          {!data.rows?.length ? <Empty /> : (
            <Tbl heads={[{ label: 'التاريخ' }, { label: 'البيان' }, { label: 'المبلغ', left: true }, { label: 'الرصيد', left: true }]}>
              {data.rows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-sm text-slate-500">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2.5 text-sm">{r.description}</td>
                  <td className="px-4 py-2.5 text-sm text-left">{fmt(r.amount)} {cur}</td>
                  <td className="px-4 py-2.5 text-sm text-left font-medium">{fmt(r.balance)} {cur}</td>
                </tr>
              ))}
            </Tbl>
          )}
        </>
      )}
    </div>
  )
}

// ─── ميزان المراجعة مع الحركة ─────────────────────────────────
export function TrialBalanceWithMovement() {
  const cur = useCur()
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.journalEntries.trialBalance({ from, to })
    setData(d)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const rows: any[] = data?.rows ?? []
  const totals = data?.totals ?? {}

  return (
    <div>
      <ReportTitle title="ميزان المراجعة مع الحركة" sub="أرصدة وحركات الحسابات خلال الفترة" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {data && (rows.length === 0 ? <Empty /> : (
        <Tbl heads={[
          { label: 'كود' }, { label: 'اسم الحساب' },
          { label: 'رصيد أول مدة', left: true }, { label: 'حركة مدين', left: true },
          { label: 'حركة دائن', left: true }, { label: 'رصيد نهاية مدة', left: true },
        ]}>
          {rows.map((r: any) => (
            <tr key={r.accountId} className="hover:bg-slate-50">
              <td className="px-4 py-2 text-xs text-slate-400 font-mono">{r.code}</td>
              <td className="px-4 py-2 text-sm">{r.accountName}</td>
              <td className="px-4 py-2 text-sm text-left text-slate-600">{fmt(r.openingBalance ?? 0)}</td>
              <td className="px-4 py-2 text-sm text-left text-blue-700">{fmt(r.totalDebit ?? 0)}</td>
              <td className="px-4 py-2 text-sm text-left text-red-600">{fmt(r.totalCredit ?? 0)}</td>
              <td className="px-4 py-2 text-sm text-left font-medium">{fmt(r.closingBalance ?? 0)}</td>
            </tr>
          ))}
          <tr className="bg-slate-100 font-bold">
            <td colSpan={2} className="px-4 py-2 text-sm text-center">الإجمالي</td>
            <td className="px-4 py-2 text-sm text-left">{fmt(totals.openingDebit ?? 0)}</td>
            <td className="px-4 py-2 text-sm text-left text-blue-700">{fmt(totals.totalDebit ?? 0)}</td>
            <td className="px-4 py-2 text-sm text-left text-red-600">{fmt(totals.totalCredit ?? 0)}</td>
            <td className="px-4 py-2 text-sm text-left">{fmt(totals.closingDebit ?? 0)}</td>
          </tr>
        </Tbl>
      ))}
    </div>
  )
}

// ─── ميزان المراجعة (بسيط) ────────────────────────────────────
export function TrialBalance() {
  const cur = useCur()
  const [to, setTo] = useState(today())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.journalEntries.trialBalance({ to })
    setData(d)
    setLoading(false)
  }, [to])

  useEffect(() => { load() }, [load])

  const rows: any[] = data?.rows ?? []
  const totals = data?.totals ?? {}

  return (
    <div>
      <ReportTitle title="ميزان المراجعة" sub="أرصدة جميع الحسابات حتى تاريخ محدد" />
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 print:hidden">
        <span className="text-sm text-slate-500">حتى تاريخ:</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 mr-auto">
          عرض
        </button>
        <button onClick={() => window.print()} className="border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50">طباعة</button>
      </div>
      {data && (rows.length === 0 ? <Empty /> : (
        <Tbl heads={[
          { label: 'كود' }, { label: 'اسم الحساب' },
          { label: 'مدين', left: true }, { label: 'دائن', left: true },
        ]}>
          {rows.map((r: any) => (
            <tr key={r.accountId} className="hover:bg-slate-50">
              <td className="px-4 py-2 text-xs text-slate-400 font-mono">{r.code}</td>
              <td className="px-4 py-2 text-sm">{r.accountName}</td>
              <td className="px-4 py-2 text-sm text-left text-blue-700">{r.balance >= 0 ? fmt(r.balance) : ''}</td>
              <td className="px-4 py-2 text-sm text-left text-red-600">{r.balance < 0 ? fmt(Math.abs(r.balance)) : ''}</td>
            </tr>
          ))}
          <tr className="bg-slate-100 font-bold">
            <td colSpan={2} className="px-4 py-2 text-sm text-center">الإجمالي</td>
            <td className="px-4 py-2 text-sm text-left text-blue-700">{fmt(totals.totalDebit ?? 0)}</td>
            <td className="px-4 py-2 text-sm text-left text-red-600">{fmt(totals.totalCredit ?? 0)}</td>
          </tr>
        </Tbl>
      ))}
    </div>
  )
}

// ─── تقرير المصروفات ──────────────────────────────────────────
export function ExpensesReport() {
  const cur = useCur()
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.reports.financial({ from, to })
    setData(d)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const byCategory = Object.entries(data?.expenses?.byCategory ?? {})
  const total = data?.expenses?.total ?? 0

  return (
    <div>
      <ReportTitle title="تقرير المصروفات" sub="تفاصيل المصروفات مصنّفة" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {data && (
        <>
          <StatCards cards={[
            { label: 'إجمالي المصروفات', value: `${fmt(total)} ${cur}`, color: 'red' },
            { label: 'عدد الفئات', value: `${byCategory.length}`, color: 'slate' },
          ]} />
          {byCategory.length === 0 ? <Empty /> : (
            <Tbl heads={[{ label: 'فئة المصروف' }, { label: 'المبلغ', left: true }, { label: 'النسبة', left: true }]}>
              {byCategory.sort((a: any, b: any) => b[1] - a[1]).map(([cat, amt]: any) => (
                <tr key={cat} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-sm">{cat}</td>
                  <td className="px-4 py-2.5 text-sm text-left text-red-600">{fmt(amt)} {cur}</td>
                  <td className="px-4 py-2.5 text-sm text-left text-slate-500">
                    {total > 0 ? `${((amt / total) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
              <tr className="bg-red-50 font-bold">
                <td className="px-4 py-2.5 text-sm">الإجمالي</td>
                <td className="px-4 py-2.5 text-sm text-left text-red-700">{fmt(total)} {cur}</td>
                <td className="px-4 py-2.5 text-sm text-left text-slate-500">100%</td>
              </tr>
            </Tbl>
          )}
        </>
      )}
    </div>
  )
}

// ─── تقرير قيود اليومية ───────────────────────────────────────
export function JournalReport() {
  const cur = useCur()
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.journalEntries.getAll({ from, to })
    setData(d ?? [])
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <ReportTitle title="تقرير قيود اليومية" sub="جميع قيود اليومية المرحّلة خلال الفترة" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {data.length === 0 ? <Empty /> : (
        <div className="space-y-2">
          {data.map((je: any) => (
            <div key={je.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-700">قيد رقم #{je.id} — {je.description}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{fmtDate(je.date)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${je.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {je.status === 'POSTED' ? 'مرحّل' : 'مسودة'}
                  </span>
                </div>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {je.lines?.map((l: any, i: number) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-1.5 text-slate-600" style={{ paddingRight: l.debit ? '16px' : '40px' }}>{l.account?.name}</td>
                      <td className="px-4 py-1.5 text-left text-blue-700 w-32">{l.debit > 0 ? fmt(l.debit) : ''}</td>
                      <td className="px-4 py-1.5 text-left text-red-600 w-32">{l.credit > 0 ? fmt(l.credit) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
