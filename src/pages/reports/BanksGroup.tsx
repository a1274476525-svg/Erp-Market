import { useState, useCallback, useEffect } from 'react'
import { DateFilter, StatCards, ReportTitle, Empty, Tbl, fmt, fmtDate, useCur, thisMonth, today } from './shared'

// ─── ملخص البنوك والنقدية ─────────────────────────────────────
export function BanksSummary() {
  const cur = useCur()
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.reports.banksSummary({ from, to })
    setData(d)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const accounts: any[] = data?.accounts ?? []
  const totals = data?.totals ?? {}

  return (
    <div>
      <ReportTitle title="ملخص البنوك والنقدية" sub="ملخص حركات جميع الحسابات البنكية" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {data && (
        <>
          <StatCards cards={[
            { label: 'إجمالي الإيداعات',   value: `${fmt(totals.totalDeposits ?? 0)} ${cur}`, color: 'emerald' },
            { label: 'إجمالي السحوبات',    value: `${fmt(totals.totalWithdrawals ?? 0)} ${cur}`, color: 'red' },
            { label: 'الرصيد الإجمالي',    value: `${fmt(totals.totalBalance ?? 0)} ${cur}`, color: 'blue' },
            { label: 'عدد الحسابات',       value: `${accounts.length}`, color: 'slate' },
          ]} />
          {!accounts.length ? <Empty /> : (
            <Tbl heads={[{ label: 'الحساب' }, { label: 'النوع' }, { label: 'الإيداعات', left: true }, { label: 'السحوبات', left: true }, { label: 'الرصيد الحالي', left: true }]}>
              {accounts.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-sm font-medium">{a.name}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-500">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${a.type !== 'bank' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {a.type !== 'bank' ? 'نقدية' : 'بنك'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-left text-emerald-700">{fmt(a.deposits ?? 0)} {cur}</td>
                  <td className="px-4 py-2.5 text-sm text-left text-red-600">{fmt(a.withdrawals ?? 0)} {cur}</td>
                  <td className="px-4 py-2.5 text-sm text-left font-bold text-blue-700">{fmt(a.balance ?? 0)} {cur}</td>
                </tr>
              ))}
            </Tbl>
          )}
        </>
      )}
    </div>
  )
}

// ─── ملخص التسويات البنكية ────────────────────────────────────
export function BankReconciliation() {
  const cur = useCur()
  const [from, setFrom]   = useState(thisMonth())
  const [to, setTo]       = useState(today())
  const [accounts, setAccounts] = useState<any[]>([])
  const [accountId, setAccountId] = useState<number | ''>('')
  const [txs, setTxs]     = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { window.api.bankAccounts.getAll().then(setAccounts) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.bankTransactions.getAll({ bankAccountId: accountId || undefined, from, to })
    setTxs(d ?? [])
    setLoading(false)
  }, [from, to, accountId])

  useEffect(() => { load() }, [load])

  const deposits    = txs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
  const withdrawals = txs.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0)

  const extra = (
    <select value={accountId} onChange={e => setAccountId(Number(e.target.value) || '')}
      className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 min-w-[160px]">
      <option value="">جميع الحسابات</option>
      {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  )

  return (
    <div>
      <ReportTitle title="ملخص التسويات البنكية" sub="مقارنة حركات البنك مع السجلات الداخلية" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} extra={extra} />
      {txs.length > 0 && (
        <>
          <StatCards cards={[
            { label: 'إجمالي الإيداعات',   value: `${fmt(deposits)} ${cur}`, color: 'emerald' },
            { label: 'إجمالي السحوبات',    value: `${fmt(withdrawals)} ${cur}`, color: 'red' },
            { label: 'صافي الحركة',        value: `${fmt(deposits - withdrawals)} ${cur}`, color: (deposits - withdrawals) >= 0 ? 'emerald' : 'red' },
            { label: 'عدد العمليات',       value: `${txs.length}`, color: 'blue' },
          ]} />
          <Tbl heads={[{ label: 'التاريخ' }, { label: 'الحساب' }, { label: 'النوع' }, { label: 'المبلغ', left: true }, { label: 'البيان' }]}>
            {txs.map((t: any) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 text-sm text-slate-500">{fmtDate(t.date)}</td>
                <td className="px-4 py-2 text-sm">{t.bankAccount?.name ?? '—'}</td>
                <td className="px-4 py-2 text-sm">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${t.type === 'deposit' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {t.type === 'deposit' ? 'إيداع' : 'سحب'}
                  </span>
                </td>
                <td className={`px-4 py-2 text-sm text-left font-medium ${t.type === 'deposit' ? 'text-emerald-700' : 'text-red-600'}`}>
                  {fmt(t.amount)} {cur}
                </td>
                <td className="px-4 py-2 text-sm text-slate-500">{t.description ?? '—'}</td>
              </tr>
            ))}
          </Tbl>
        </>
      )}
      {txs.length === 0 && !loading && <Empty />}
    </div>
  )
}
