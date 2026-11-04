import { useState, useCallback, useEffect } from 'react'
import { DateFilter, StatCards, ReportTitle, Empty, Tbl, fmt, fmtDate, useCur, thisMonth, today } from './shared'
import type { Account } from '../../types'

// ─── قائمة الدخل ───────────────────────────────────────────────
export function IncomeStatement() {
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

  const R = data ?? {}
  const rev = R.revenue?.total ?? 0
  const cogs = R.cogs ?? 0
  const gross = R.grossProfit ?? 0
  const expTotal = R.expenses?.total ?? 0
  const net = R.netProfit ?? 0

  return (
    <div>
      <ReportTitle title="قائمة الدخل" sub="الإيرادات والمصاريف خلال الفترة" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {data && (
        <>
          <StatCards cards={[
            { label: 'إجمالي الإيرادات', value: `${fmt(rev)} ${cur}`, color: 'emerald' },
            { label: 'تكلفة البضاعة',    value: `${fmt(cogs)} ${cur}`, color: 'amber' },
            { label: 'مجمل الربح',        value: `${fmt(gross)} ${cur}`, color: gross >= 0 ? 'emerald' : 'red' },
            { label: 'صافي الربح',        value: `${fmt(net)} ${cur}`, color: net >= 0 ? 'emerald' : 'red' },
          ]} />
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-800 text-white text-sm font-semibold print-header">قائمة الدخل — {from} إلى {to}</div>
            {[
              { label: 'إيرادات المبيعات (بدون ضريبة)', value: rev, indent: 0, bold: false, color: 'text-emerald-700' },
              { label: 'تكلفة البضاعة المباعة', value: -cogs, indent: 1, bold: false, color: cogs > 0 ? 'text-red-600' : '' },
              { label: 'مجمل الربح', value: gross, indent: 0, bold: true, color: gross >= 0 ? 'text-emerald-700' : 'text-red-600' },
              { label: '─── المصاريف التشغيلية ───', value: null, indent: 0, bold: false, color: 'text-slate-400', section: true },
              ...Object.entries(R.expenses?.byCategory ?? {}).map(([cat, amt]: any) => ({
                label: cat, value: -amt, indent: 1, bold: false, color: 'text-red-600',
              })),
              { label: 'إجمالي المصاريف', value: -expTotal, indent: 0, bold: true, color: 'text-red-600' },
              { label: net >= 0 ? 'صافي الربح' : 'صافي الخسارة', value: net, indent: 0, bold: true, color: net >= 0 ? 'text-emerald-700' : 'text-red-600', final: true },
            ].map((row: any, i) => (
              <div key={i}
                className={`flex justify-between py-2 border-b border-slate-100 ${row.bold ? 'font-bold bg-slate-50' : ''} ${row.final ? 'border-t-2 border-slate-300' : ''}`}
                style={{ paddingRight: `${16 + (row.indent ?? 0) * 20}px`, paddingLeft: '16px' }}>
                {row.section
                  ? <span className="text-xs text-slate-400 w-full text-center">{row.label}</span>
                  : <>
                    <span className="text-slate-600">{row.label}</span>
                    {row.value !== null && (
                      <span className={row.color}>{fmt(row.value)} {cur}</span>
                    )}
                  </>
                }
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── قائمة المركز المالي ───────────────────────────────────────
interface BalNode { id: number; code: string; name: string; own: number; total: number; children: BalNode[] }

function buildBalanceTree(accounts: Account[], balMap: Map<number, number>, rootType: string): BalNode[] {
  const inType = new Set(accounts.filter(a => a.type === rootType).map(a => a.id))
  const byId = new Map<number, BalNode>()
  accounts.forEach(a => {
    if (inType.has(a.id)) byId.set(a.id, { id: a.id, code: a.code, name: a.name, own: balMap.get(a.id) ?? 0, total: 0, children: [] })
  })
  const roots: BalNode[] = []
  accounts.forEach(a => {
    if (!inType.has(a.id)) return
    const node = byId.get(a.id)!
    if (a.parentId && byId.has(a.parentId)) byId.get(a.parentId)!.children.push(node)
    else roots.push(node)
  })
  const sortRec = (list: BalNode[]) => {
    list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    list.forEach(n => sortRec(n.children))
  }
  sortRec(roots)
  const rollup = (n: BalNode): number => { n.total = n.own + n.children.reduce((s, c) => s + rollup(c), 0); return n.total }
  roots.forEach(rollup)
  return roots
}

function BalanceRows({ nodes, depth, cur, hideZero, sign }: {
  nodes: BalNode[]; depth: number; cur: string; hideZero: boolean; sign: 'blue' | 'red'
}) {
  const colorClass = sign === 'blue' ? 'text-blue-700' : 'text-red-700'
  return (
    <>
      {nodes.filter(n => !hideZero || Math.abs(n.total) > 0.005).map(n => (
        <div key={n.id}>
          <div className={`flex justify-between py-2 px-4 border-b border-slate-100 ${n.children.length ? 'font-semibold bg-slate-50/60' : ''}`}
            style={{ paddingRight: `${16 + depth * 20}px` }}>
            <span className={n.children.length ? 'text-slate-800' : 'text-slate-600'}>{n.name}</span>
            <span className={n.children.length ? colorClass : 'text-slate-600'}>{fmt(n.total)} {cur}</span>
          </div>
          {n.children.length > 0 && <BalanceRows nodes={n.children} depth={depth + 1} cur={cur} hideZero={hideZero} sign={sign} />}
        </div>
      ))}
    </>
  )
}

export function BalanceSheet() {
  const cur = useCur()
  const [asOf, setAsOf] = useState(today())
  const [accounts, setAccounts] = useState<Account[]>([])
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [hideZero, setHideZero] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [accs, rep] = await Promise.all([
      window.api.accounts.getAll(),
      window.api.reports.financial({ to: asOf }),
    ])
    setAccounts(accs)
    setData(rep)
    setLoading(false)
  }, [asOf])

  useEffect(() => { load() }, [load])

  const balMap = new Map<number, number>()
  for (const row of (data?.trialBalance ?? [])) {
    const bal = row.account.normalBalance === 'debit' ? row.debit - row.credit : row.credit - row.debit
    balMap.set(row.account.id, bal)
  }

  // أرباح العام الحالي تُحسب من دفتر الأستاذ نفسه (إيرادات - مصاريف/تكلفة)
  // لضمان تطابق إجمالي الأصول مع إجمالي الخصوم وحقوق الملكية دائماً
  const net = (data?.trialBalance ?? []).reduce((sum: number, row: any) => {
    if (row.account.type !== 'revenue' && row.account.type !== 'expense') return sum
    const bal = row.account.normalBalance === 'credit' ? row.credit - row.debit : row.debit - row.credit
    return sum + (row.account.type === 'revenue' ? bal : -bal)
  }, 0)

  const assetTree     = data ? buildBalanceTree(accounts, balMap, 'asset') : []
  const liabilityTree = data ? buildBalanceTree(accounts, balMap, 'liability') : []
  const equityTree    = data ? buildBalanceTree(accounts, balMap, 'equity') : []

  const totalAssets = assetTree.reduce((s, n) => s + n.total, 0)
  const totalLiab   = liabilityTree.reduce((s, n) => s + n.total, 0)
  const equityBase  = equityTree.reduce((s, n) => s + n.total, 0)
  const totalEquity = equityBase + net

  return (
    <div>
      <ReportTitle title="قائمة المركز المالي" sub="الميزانية العمومية في تاريخ محدد" />
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 print:hidden">
        <span className="text-sm text-slate-500">حتى تاريخ:</span>
        <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
        <label className="flex items-center gap-1.5 text-sm text-slate-500 cursor-pointer select-none">
          <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} />
          إخفاء الأرصدة الصفرية
        </label>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 mr-auto">
          عرض التقرير
        </button>
      </div>
      {data && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-blue-700 text-white text-sm font-semibold">الأصول</div>
            <BalanceRows nodes={assetTree} depth={0} cur={cur} hideZero={hideZero} sign="blue" />
            <div className="flex justify-between py-2.5 px-4 bg-blue-50 font-bold border-t-2 border-blue-300">
              <span className="text-slate-800">إجمالي الأصول</span>
              <span className="text-blue-700">{fmt(totalAssets)} {cur}</span>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-red-700 text-white text-sm font-semibold">الخصوم وحقوق الملكية</div>
            <div className="px-4 py-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wide bg-slate-50">الخصوم</div>
            <BalanceRows nodes={liabilityTree} depth={0} cur={cur} hideZero={hideZero} sign="red" />
            <div className="flex justify-between py-2 px-4 bg-red-50 font-bold">
              <span className="text-slate-800">إجمالي الخصوم</span>
              <span className="text-red-700">{fmt(totalLiab)} {cur}</span>
            </div>
            <div className="px-4 py-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wide bg-slate-50">حقوق الملكية</div>
            <BalanceRows nodes={equityTree} depth={0} cur={cur} hideZero={hideZero} sign="red" />
            {(!hideZero || Math.abs(net) > 0.005) && (
              <div className="flex justify-between py-2 px-4 border-b border-slate-100"
                style={{ paddingRight: '16px' }}>
                <span className="text-slate-600">{net >= 0 ? 'أرباح العام الحالي' : 'خسائر العام الحالي'}</span>
                <span className={net >= 0 ? 'text-emerald-700' : 'text-red-600'}>{fmt(Math.abs(net))} {cur}</span>
              </div>
            )}
            <div className="flex justify-between py-2 px-4 bg-red-50 font-bold">
              <span className="text-slate-800">إجمالي حقوق الملكية</span>
              <span className="text-red-700">{fmt(totalEquity)} {cur}</span>
            </div>
            <div className="flex justify-between py-2.5 px-4 bg-red-100 font-bold border-t-2 border-red-300">
              <span className="text-slate-800">إجمالي الخصوم وحقوق الملكية</span>
              <span className="text-red-700">{fmt(totalLiab + totalEquity)} {cur}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── قائمة التدفقات النقدية ────────────────────────────────────
export function CashFlow() {
  const cur = useCur()
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.reports.cashFlow({ from, to })
    setData(d)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  if (!data && !loading) return <div onClick={load}><ReportTitle title="قائمة التدفقات النقدية" /><DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={false} /></div>

  const months = data ? Object.entries(data.byMonth ?? {}).sort(([a], [b]) => a.localeCompare(b)) : []

  return (
    <div>
      <ReportTitle title="قائمة التدفقات النقدية" sub="حركات النقدية والبنوك خلال الفترة" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {data && (
        <>
          <StatCards cards={[
            { label: 'إجمالي الإيداعات',   value: `${fmt(data.totals?.in ?? 0)} ${cur}`, color: 'emerald' },
            { label: 'إجمالي السحوبات',    value: `${fmt(data.totals?.out ?? 0)} ${cur}`, color: 'red' },
            { label: 'صافي التدفق النقدي', value: `${fmt(data.totals?.net ?? 0)} ${cur}`, color: (data.totals?.net ?? 0) >= 0 ? 'emerald' : 'red' },
            { label: 'عدد العمليات', value: `${data.transactions?.length ?? 0}`, color: 'blue' },
          ]} />
          {months.length === 0 ? <Empty /> : (
            <Tbl heads={[{ label: 'الشهر' }, { label: 'الإيداعات', left: true }, { label: 'السحوبات', left: true }, { label: 'صافي الشهر', left: true }]}>
              {months.map(([month, row]: any) => (
                <tr key={month} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-sm font-medium">{month}</td>
                  <td className="px-4 py-2.5 text-sm text-left text-emerald-700">{fmt(row.deposits)} {cur}</td>
                  <td className="px-4 py-2.5 text-sm text-left text-red-600">{fmt(row.withdrawals)} {cur}</td>
                  <td className={`px-4 py-2.5 text-sm text-left font-medium ${row.deposits - row.withdrawals >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {fmt(row.deposits - row.withdrawals)} {cur}
                  </td>
                </tr>
              ))}
            </Tbl>
          )}
        </>
      )}
    </div>
  )
}

// ─── قائمة التغيرات في حقوق الملكية ───────────────────────────
export function EquityChanges() {
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

  const net = data?.netProfit ?? 0

  return (
    <div>
      <ReportTitle title="قائمة التغيرات في حقوق الملكية" sub="حركة حقوق الملكية خلال الفترة" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {data && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-800 text-white text-sm font-semibold">التغيرات في حقوق الملكية</div>
          {[
            { label: 'رأس المال المستثمر', value: 0, note: 'يُدخل يدوياً في دليل الحسابات' },
            { label: 'أرباح مرحّلة (أول الفترة)', value: 0, note: 'من قيود اليومية' },
            { label: net >= 0 ? 'صافي ربح الفترة' : 'صافي خسارة الفترة', value: net, color: net >= 0 ? 'text-emerald-700' : 'text-red-600' },
            { label: 'توزيعات أرباح', value: 0 },
            { label: 'إجمالي حقوق الملكية (نهاية الفترة)', value: net, bold: true },
          ].map((r: any, i) => (
            <div key={i} className={`flex justify-between items-start py-3 px-4 border-b border-slate-100 ${r.bold ? 'bg-slate-50 font-bold' : ''}`}>
              <div>
                <div className="text-sm text-slate-700">{r.label}</div>
                {r.note && <div className="text-xs text-slate-400 mt-0.5">{r.note}</div>}
              </div>
              <span className={`text-sm ${r.color ?? ''}`}>{fmt(r.value ?? 0)} {cur}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
