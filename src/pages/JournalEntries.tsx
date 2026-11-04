import { useState, useEffect, useCallback } from 'react'
import { Plus, Eye, Trash2, CheckCircle, RotateCcw, BookOpen, AlertTriangle, Search, List, RefreshCw } from 'lucide-react'
import type { JournalEntry, Account } from '../types'
import { Modal, Field, inputCls, DeleteConfirm, Badge, PageHeader } from '../components/ui'
import { useSettings } from '../contexts/SettingsContext'

function dateStr(d: any): string { return d instanceof Date ? d.toISOString() : String(d) }

export default function JournalEntries() {
  const [entries, setEntries]   = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showForm, setShowForm] = useState(false)
  const [viewing, setViewing]   = useState<JournalEntry | null>(null)
  const [deleting, setDeleting] = useState<JournalEntry | null>(null)
  const [statusFilter, setStatus] = useState<'all'|'draft'|'posted'>('all')
  const [from, setFrom]         = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })
  const [to, setTo]             = useState(new Date().toISOString().slice(0, 10))
  const [showLedger, setShowLedger] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const { settings } = useSettings()

  const load = useCallback(() => Promise.all([
    window.api.journalEntries.getAll({ from, to, status: statusFilter === 'all' ? undefined : statusFilter }),
    window.api.accounts.getAll(),
  ]).then(([e, a]) => { setEntries(e); setAccounts(a) }), [from, to, statusFilter])

  useEffect(() => { load() }, [load])

  async function handlePost(id: number) {
    try { await window.api.journalEntries.post(id); load() }
    catch (e: any) { alert(e.message) }
  }

  async function handleReverse(id: number) {
    if (!confirm('سيتم إنشاء قيد عكسي مرحل. هل تريد المتابعة؟')) return
    try { await window.api.journalEntries.reverse(id); load() }
    catch (e: any) { alert(e.message) }
  }

  async function handleDelete() {
    if (!deleting) return
    try { await window.api.journalEntries.delete(deleting.id); setDeleting(null); load() }
    catch (e: any) { alert(e.message) }
  }

  async function handleBackfill() {
    setBackfilling(true)
    try {
      const res = await window.api.journalEntries.backfillMissing()
      const parts = [
        res.purchases ? `${res.purchases} فاتورة شراء` : null,
        res.sales ? `${res.sales} عملية بيع` : null,
        res.expenses ? `${res.expenses} مصروف` : null,
      ].filter(Boolean)
      const msg = parts.length ? `تم ترحيل قيود: ${parts.join('، ')}` : 'كل العمليات المؤكدة لديها قيود بالفعل — لا يوجد نقص'
      alert(msg + (res.errors.length ? `\n\nتعذر ترحيل ${res.errors.length}:\n${res.errors.join('\n')}` : ''))
      load()
    } catch (e: any) { alert(e.message) }
    setBackfilling(false)
  }

  const totalDebit  = entries.filter(e => e.status === 'posted').reduce((s, e) => s + e.lines.reduce((ls, l) => ls + l.debit, 0), 0)
  const totalCredit = entries.filter(e => e.status === 'posted').reduce((s, e) => s + e.lines.reduce((ls, l) => ls + l.credit, 0), 0)

  return (
    <div className="p-6">
      <PageHeader title="قيود اليومية"
        action={
          <div className="flex gap-2">
            <button onClick={handleBackfill} disabled={backfilling} title="ترحيل قيود يومية لأي عملية بيع/شراء/مصروف مؤكدة لا تملك قيداً بعد"
              className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium">
              <RefreshCw size={16} className={backfilling ? 'animate-spin' : ''} /> ترحيل القيود الناقصة
            </button>
            <button onClick={() => setShowLedger(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium">
              <List size={16} /> دفتر الأستاذ
            </button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
              <Plus size={16} /> قيد جديد
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 text-sm">
          <span className="text-slate-500 text-xs">من</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border-none outline-none text-sm" />
          <span className="text-slate-500 text-xs">إلى</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border-none outline-none text-sm" />
        </div>
        <div className="flex gap-1">
          {(['all', 'draft', 'posted'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {s === 'all' ? 'الكل' : s === 'draft' ? 'مسودات' : 'مرحلة'}
            </button>
          ))}
        </div>
        {entries.length > 0 && (
          <div className="mr-auto flex gap-4 text-xs bg-white rounded-lg px-3 py-2 shadow-sm">
            <span className="text-blue-600">إجمالي مدين: <strong>{totalDebit.toFixed(2)}</strong></span>
            <span className="text-emerald-600">إجمالي دائن: <strong>{totalCredit.toFixed(2)}</strong></span>
            {Math.abs(totalDebit - totalCredit) < 0.01
              ? <span className="text-emerald-600 font-semibold">✓ متوازن</span>
              : <span className="text-red-600 font-semibold">⚠ فرق: {Math.abs(totalDebit - totalCredit).toFixed(2)}</span>}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">رقم القيد</th>
              <th className="px-4 py-3 text-center">التاريخ</th>
              <th className="px-4 py-3 text-right">البيان</th>
              <th className="px-4 py-3 text-center">مدين</th>
              <th className="px-4 py-3 text-center">دائن</th>
              <th className="px-4 py-3 text-center">الحالة</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map(entry => {
              const td = entry.lines.reduce((s, l) => s + l.debit, 0)
              const tc = entry.lines.reduce((s, l) => s + l.credit, 0)
              return (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{entry.number}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-500">
                    {new Date(dateStr(entry.date)).toLocaleDateString('ar-EG')}
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                    {entry.description ?? '—'}
                    {entry.source !== 'manual' && (
                      <span className="mr-2 text-xs text-blue-500 bg-blue-50 px-1.5 rounded">{entry.source}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-medium text-blue-700">{td.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center font-medium text-emerald-700">{tc.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    {entry.status === 'posted'
                      ? <Badge label="مرحل" color="emerald" />
                      : <Badge label="مسودة" color="amber" />}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => setViewing(entry)} title="عرض"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Eye size={13} />
                      </button>
                      {entry.status === 'draft' && (
                        <>
                          <button onClick={() => handlePost(entry.id)} title="ترحيل القيد"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                            <CheckCircle size={13} />
                          </button>
                          <button onClick={() => setDeleting(entry)} title="حذف"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                      {entry.status === 'posted' && entry.source === 'manual' && (
                        <button onClick={() => handleReverse(entry.id)} title="عكس القيد"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg">
                          <RotateCcw size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {entries.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            لا توجد قيود في هذه الفترة
          </div>
        )}
      </div>

      {showForm && (
        <EntryForm accounts={accounts} currency={settings.currency}
          onSave={() => { setShowForm(false); load() }}
          onClose={() => setShowForm(false)} />
      )}

      {viewing && (
        <EntryDetailsModal entry={viewing} onClose={() => setViewing(null)} />
      )}

      {showLedger && (
        <LedgerModal accounts={accounts} currency={settings.currency} onClose={() => setShowLedger(false)} />
      )}

      {deleting && (
        <DeleteConfirm onConfirm={handleDelete} onCancel={() => setDeleting(null)}
          message={`حذف القيد "${deleting.number}"؟`} />
      )}
    </div>
  )
}

// ─── Entry Form ────────────────────────────────────────────────
interface DraftLine { accountId: string; debit: string; credit: string; description: string }

function EntryForm({ accounts, currency, onSave, onClose }: {
  accounts: Account[]
  currency: string
  onSave: () => void
  onClose: () => void
}) {
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10))
  const [description, setDesc]  = useState('')
  const [reference, setRef]     = useState('')
  const [lines, setLines]       = useState<DraftLine[]>([
    { accountId: '', debit: '', credit: '', description: '' },
    { accountId: '', debit: '', credit: '', description: '' },
  ])
  const [saving, setSaving]     = useState(false)
  const [postNow, setPostNow]   = useState(false)

  const setLine = (i: number, k: keyof DraftLine, v: string) =>
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l))

  const addLine  = () => setLines(ls => [...ls, { accountId: '', debit: '', credit: '', description: '' }])
  const removeLine = (i: number) => { if (lines.length > 2) setLines(ls => ls.filter((_, idx) => idx !== i)) }

  // Clear the other field when one is filled
  const handleDebit = (i: number, v: string) => {
    setLine(i, 'debit', v)
    if (v && Number(v) > 0) setLine(i, 'credit', '')
  }
  const handleCredit = (i: number, v: string) => {
    setLine(i, 'credit', v)
    if (v && Number(v) > 0) setLine(i, 'debit', '')
  }

  const totalDebit  = lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0

  const sortedAccounts = [...accounts]
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!balanced) return alert(`القيد غير متوازن — مدين: ${totalDebit.toFixed(2)} | دائن: ${totalCredit.toFixed(2)}`)
    const filled = lines.filter(l => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0))
    if (filled.length < 2) return alert('يجب تعبئة سطرين على الأقل')
    setSaving(true)
    try {
      await window.api.journalEntries.create({
        date, description: description || null, reference: reference || null,
        post: postNow,
        lines: filled.map(l => ({
          accountId:   Number(l.accountId),
          debit:       Number(l.debit)  || 0,
          credit:      Number(l.credit) || 0,
          description: l.description || null,
        })),
      })
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title="قيد يومية جديد" onClose={onClose} maxWidth="max-w-4xl">
      <form onSubmit={submit} className="space-y-4">
        {/* Header */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="التاريخ *">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
          </Field>
          <Field label="البيان">
            <input value={description} onChange={e => setDesc(e.target.value)} className={inputCls} placeholder="وصف القيد" />
          </Field>
          <Field label="رقم المرجع">
            <input value={reference} onChange={e => setRef(e.target.value)} className={inputCls} placeholder="فاتورة / إشعار..." />
          </Field>
        </div>

        {/* Lines */}
        <div className="border rounded-xl overflow-hidden">
          <div className="bg-slate-700 text-white px-4 py-2 text-xs font-medium flex justify-between">
            <span>سطور القيد</span>
            <span className={balanced ? 'text-emerald-300' : 'text-amber-300'}>
              مدين: {totalDebit.toFixed(2)} | دائن: {totalCredit.toFixed(2)}
              {balanced ? ' ✓ متوازن' : ' ⚠ غير متوازن'}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-right w-8">#</th>
                <th className="px-3 py-2 text-right">الحساب *</th>
                <th className="px-3 py-2 text-center w-32">مدين</th>
                <th className="px-3 py-2 text-center w-32">دائن</th>
                <th className="px-3 py-2 text-right">بيان</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 text-xs text-slate-400 text-center">{i + 1}</td>
                  <td className="px-3 py-1.5">
                    <select value={line.accountId} onChange={e => setLine(i, 'accountId', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500">
                      <option value="">— اختر حساباً —</option>
                      {sortedAccounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {'·'.repeat(a.level - 1)}{a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" step="0.01" min="0" value={line.debit}
                      onChange={e => handleDebit(i, e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="0.00" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" step="0.01" min="0" value={line.credit}
                      onChange={e => handleCredit(i, e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      placeholder="0.00" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={line.description} onChange={e => setLine(i, 'description', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300"
                      placeholder="اختياري" />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <button type="button" onClick={() => removeLine(i)} disabled={lines.length <= 2}
                      className="text-slate-300 hover:text-red-500 disabled:opacity-0">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={2} className="px-3 py-2">
                  <button type="button" onClick={addLine}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700">
                    <Plus size={13} /> إضافة سطر
                  </button>
                </td>
                <td className="px-3 py-2 text-center font-bold text-blue-700 text-xs">{totalDebit.toFixed(2)}</td>
                <td className="px-3 py-2 text-center font-bold text-emerald-700 text-xs">{totalCredit.toFixed(2)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>

        {!balanced && totalDebit > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-700">
            <AlertTriangle size={14} />
            القيد غير متوازن — الفرق: {Math.abs(totalDebit - totalCredit).toFixed(2)} {currency}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={postNow} onChange={e => setPostNow(e.target.checked)} className="rounded" />
            ترحيل فوري (لا يمكن حذف القيد بعد الترحيل)
          </label>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm">
              إلغاء
            </button>
            <button type="submit" disabled={saving || !balanced}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium">
              {saving ? 'جاري الحفظ...' : postNow ? 'حفظ وترحيل' : 'حفظ كمسودة'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ─── Ledger Modal ──────────────────────────────────────────────
function LedgerModal({ accounts, currency, onClose }: { accounts: Account[]; currency: string; onClose: () => void }) {
  const [accountId, setAccountId] = useState('')
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(0, 1); return d.toISOString().slice(0, 10) })
  const [to, setTo]     = useState(new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!accountId) return
    setLoading(true)
    window.api.journalEntries.ledger({ accountId: Number(accountId), from, to })
      .then(data => setLines(data))
      .catch((e: any) => alert(e.message))
      .finally(() => setLoading(false))
  }, [accountId, from, to])

  const account   = accounts.find(a => a.id === Number(accountId))
  const sortedAcc = [...accounts].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

  let runningBalance = 0
  const rows = lines.map(l => {
    runningBalance += (l.debit || 0) - (l.credit || 0)
    return { ...l, balance: runningBalance }
  })

  const totalDebit  = lines.reduce((s: number, l: any) => s + (l.debit  || 0), 0)
  const totalCredit = lines.reduce((s: number, l: any) => s + (l.credit || 0), 0)

  return (
    <Modal title="دفتر الأستاذ" onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="الحساب *">
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inputCls} autoFocus>
              <option value="">-- اختر حساباً --</option>
              {sortedAcc.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </Field>
          <Field label="من تاريخ">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
          </Field>
          <Field label="إلى تاريخ">
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} />
          </Field>
        </div>

        {account && (
          <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-4 py-2 text-sm">
            <span className="font-semibold text-indigo-800">{account.code} — {account.name}</span>
            <span className="text-indigo-500 text-xs">{account.type}</span>
          </div>
        )}

        {loading && <div className="text-center py-8 text-slate-400 text-sm">جاري التحميل...</div>}

        {!loading && accountId && (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-700 text-white text-xs">
                <tr>
                  <th className="px-3 py-2 text-right">التاريخ</th>
                  <th className="px-3 py-2 text-right">رقم القيد</th>
                  <th className="px-3 py-2 text-right">البيان</th>
                  <th className="px-3 py-2 text-center">مدين</th>
                  <th className="px-3 py-2 text-center">دائن</th>
                  <th className="px-3 py-2 text-center">الرصيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {new Date(dateStr(row.journalEntry?.date ?? row.date)).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.journalEntry?.number ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs max-w-xs truncate">
                      {row.description ?? row.journalEntry?.description ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-center font-medium text-blue-700">
                      {row.debit > 0 ? row.debit.toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center font-medium text-emerald-700">
                      {row.credit > 0 ? row.credit.toFixed(2) : '—'}
                    </td>
                    <td className={`px-3 py-2 text-center font-semibold text-xs ${row.balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                      {row.balance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="bg-slate-50 font-bold text-sm border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right text-slate-600">الإجمالي</td>
                    <td className="px-3 py-2 text-center text-blue-700">{totalDebit.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center text-emerald-700">{totalCredit.toFixed(2)}</td>
                    <td className="px-3 py-2 text-center text-slate-800">
                      {(totalDebit - totalCredit).toFixed(2)} {currency}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            {rows.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">
                <Search size={32} className="mx-auto mb-2 opacity-30" />
                لا توجد حركات لهذا الحساب في الفترة المحددة
              </div>
            )}
          </div>
        )}

        {!accountId && (
          <div className="text-center py-10 text-slate-400 text-sm">
            <BookOpen size={36} className="mx-auto mb-2 opacity-30" />
            اختر حساباً لعرض دفتر الأستاذ
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Entry Details Modal ───────────────────────────────────────
function EntryDetailsModal({ entry, onClose }: { entry: JournalEntry; onClose: () => void }) {
  const td = entry.lines.reduce((s, l) => s + l.debit, 0)
  const tc = entry.lines.reduce((s, l) => s + l.credit, 0)

  return (
    <Modal title={`قيد: ${entry.number}`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><span className="text-slate-500">التاريخ: </span>{new Date(dateStr(entry.date)).toLocaleDateString('ar-EG')}</div>
          <div><span className="text-slate-500">الحالة: </span>
            <span className={entry.status === 'posted' ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>
              {entry.status === 'posted' ? 'مرحل' : 'مسودة'}
            </span>
          </div>
          <div><span className="text-slate-500">المرجع: </span>{entry.reference ?? '—'}</div>
          {entry.description && <div className="col-span-3"><span className="text-slate-500">البيان: </span>{entry.description}</div>}
        </div>

        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 text-right">الحساب</th>
                <th className="px-4 py-2 text-right">البيان</th>
                <th className="px-4 py-2 text-center">مدين</th>
                <th className="px-4 py-2 text-center">دائن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entry.lines.map((line, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs text-slate-400 ml-2">{line.account?.code}</span>
                    {line.account?.name}
                  </td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{line.description ?? '—'}</td>
                  <td className="px-4 py-2 text-center font-medium text-blue-700">
                    {line.debit > 0 ? line.debit.toFixed(2) : '—'}
                  </td>
                  <td className="px-4 py-2 text-center font-medium text-emerald-700">
                    {line.credit > 0 ? line.credit.toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-bold text-sm">
              <tr>
                <td colSpan={2} className="px-4 py-2 text-right">الإجمالي</td>
                <td className="px-4 py-2 text-center text-blue-700">{td.toFixed(2)}</td>
                <td className="px-4 py-2 text-center text-emerald-700">{tc.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {Math.abs(td - tc) < 0.01
          ? <div className="text-xs text-center text-emerald-600 font-medium">✓ القيد متوازن</div>
          : <div className="text-xs text-center text-red-600">⚠ القيد غير متوازن (فرق: {Math.abs(td - tc).toFixed(2)})</div>}
      </div>
    </Modal>
  )
}
