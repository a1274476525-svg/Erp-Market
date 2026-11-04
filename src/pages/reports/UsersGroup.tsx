import { useState, useCallback, useEffect } from 'react'
import { DateFilter, ReportTitle, Empty, Tbl, fmtDate, thisMonth, today } from './shared'

// ─── سجل حركة المستخدمين ──────────────────────────────────────
export function UserMovements() {
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.activity.getAll()
    const f = (d ?? []).filter((l: any) => {
      const dt = (l.createdAt ?? l.timestamp)?.slice(0, 10)
      return dt >= from && dt <= to
    })
    setLogs(f)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const actionBadge = (action: string) => {
    const map: Record<string, string> = {
      CREATE: 'bg-emerald-100 text-emerald-700',
      UPDATE: 'bg-blue-100 text-blue-700',
      DELETE: 'bg-red-100 text-red-700',
      LOGIN:  'bg-violet-100 text-violet-700',
    }
    return map[action?.toUpperCase()] ?? 'bg-slate-100 text-slate-600'
  }

  return (
    <div>
      <ReportTitle title="سجل حركة المستخدمين" sub="جميع العمليات التي قام بها المستخدمون" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {logs.length === 0 ? <Empty /> : (
        <Tbl heads={[{ label: 'التاريخ والوقت' }, { label: 'المستخدم' }, { label: 'العملية' }, { label: 'الوحدة' }, { label: 'التفاصيل' }]}>
          {logs.map((l: any, i: number) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="px-4 py-2 text-xs text-slate-400 font-mono">{fmtDate(l.createdAt ?? l.timestamp)}</td>
              <td className="px-4 py-2 text-sm">{l.user?.name ?? l.userName ?? '—'}</td>
              <td className="px-4 py-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionBadge(l.action)}`}>
                  {l.action}
                </span>
              </td>
              <td className="px-4 py-2 text-sm text-slate-500">{l.module ?? l.entity ?? '—'}</td>
              <td className="px-4 py-2 text-sm text-slate-400 max-w-xs truncate">{l.details ?? l.description ?? '—'}</td>
            </tr>
          ))}
        </Tbl>
      )}
    </div>
  )
}

// ─── سجل نشاط المستخدمين ──────────────────────────────────────
export function UserActivity() {
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.activity.getAll()
    const f = (d ?? []).filter((l: any) => {
      const dt = (l.createdAt ?? l.timestamp)?.slice(0, 10)
      return dt >= from && dt <= to
    })
    setLogs(f)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  // group by user
  const byUser = logs.reduce((acc, l) => {
    const name = l.user?.name ?? l.userName ?? 'غير معروف'
    if (!acc[name]) acc[name] = { name, count: 0, actions: {} }
    acc[name].count++
    const a = l.action ?? 'OTHER'
    acc[name].actions[a] = (acc[name].actions[a] ?? 0) + 1
    return acc
  }, {} as Record<string, any>)

  const rows = Object.values(byUser).sort((a: any, b: any) => b.count - a.count)

  return (
    <div>
      <ReportTitle title="سجل نشاط المستخدمين" sub="إحصائيات نشاط كل مستخدم خلال الفترة" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {rows.length === 0 ? <Empty /> : (
        <Tbl heads={[{ label: 'المستخدم' }, { label: 'إجمالي العمليات', left: true }, { label: 'إضافة', left: true }, { label: 'تعديل', left: true }, { label: 'حذف', left: true }]}>
          {rows.map((r: any, i: number) => (
            <tr key={i} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 text-sm font-medium">{r.name}</td>
              <td className="px-4 py-2.5 text-sm text-left font-bold">{r.count}</td>
              <td className="px-4 py-2.5 text-sm text-left text-emerald-700">{r.actions.CREATE ?? 0}</td>
              <td className="px-4 py-2.5 text-sm text-left text-blue-700">{r.actions.UPDATE ?? 0}</td>
              <td className="px-4 py-2.5 text-sm text-left text-red-600">{r.actions.DELETE ?? 0}</td>
            </tr>
          ))}
        </Tbl>
      )}
    </div>
  )
}
