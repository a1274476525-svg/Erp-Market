import { useState, useEffect } from 'react'
import { Activity, Search } from 'lucide-react'
import type { ActivityLog } from '../types'
import { PageHeader } from '../components/ui'

export default function ActivityLogPage() {
  const [logs, setLogs]     = useState<ActivityLog[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    window.api.activity.getAll().then(setLogs)
  }, [])

  const filtered = logs.filter(l =>
    !search ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.user?.name.toLowerCase().includes(search.toLowerCase()) ||
    l.entity?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <PageHeader title="سجل النشاط" />

      <div className="relative mb-4">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في السجل..."
          className="w-full max-w-xs border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">المستخدم</th>
              <th className="px-4 py-3 text-right">الإجراء</th>
              <th className="px-4 py-3 text-right">الكيان</th>
              <th className="px-4 py-3 text-right">التفاصيل</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(log => (
              <tr key={log.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs font-bold">
                      {log.user?.name?.[0] ?? '?'}
                    </div>
                    <span className="text-slate-700">{log.user?.name ?? `#${log.userId}`}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{log.action}</td>
                <td className="px-4 py-3 text-slate-500">{log.entity ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{log.details ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString('ar-EG')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            <Activity size={40} className="mx-auto mb-3 opacity-30" />
            لا يوجد سجل نشاط
          </div>
        )}
      </div>
    </div>
  )
}
