import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, ArrowDownCircle, ArrowUpCircle, Landmark, Eye, Link2, AlertCircle, Upload, Settings2 } from 'lucide-react'
import type { BankAccount, BankTransaction, BankStatementLine, BankRule, Account } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, DeleteConfirm, Badge, PageHeader } from '../components/ui'
import { useSettings } from '../contexts/SettingsContext'

const TYPE_LABELS: Record<string, string> = { bank: 'بنك', cash: 'صندوق نقدي', custody: 'عهدة' }
const TYPE_COLORS: Record<string, string> = { bank: 'blue', cash: 'emerald', custody: 'amber' }
const TX_LABELS: Record<string, string>   = { deposit: 'إيداع', withdrawal: 'سحب', transfer: 'تحويل' }
const STMT_STATUS_LABELS: Record<string, string> = { unmatched: 'غير مُسوّى', matched: 'مُسوّى', ignored: 'متجاهَل' }
const STMT_STATUS_COLORS: Record<string, string> = { unmatched: 'amber', matched: 'emerald', ignored: 'slate' }
const RULE_TYPE_LABELS: Record<string, string>  = { expense: 'مصروفات', receipt: 'مقبوضات', transfer: 'تحويل بين البنوك' }
const MATCH_TYPE_LABELS: Record<string, string> = { contains: 'يحتوي على', startsWith: 'يبدأ بـ', equals: 'يساوي' }

function dateStr(d: any): string { return d instanceof Date ? d.toISOString() : String(d) }

export default function Banks() {
  const [accounts, setAccounts]     = useState<BankAccount[]>([])
  const [chartAccounts, setChart]   = useState<Account[]>([])
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<BankAccount | null>(null)
  const [deleting, setDeleting]     = useState<BankAccount | null>(null)
  const [viewing, setViewing]       = useState<BankAccount | null>(null)
  const [showRules, setShowRules]   = useState(false)
  const { settings } = useSettings()

  const load = () => Promise.all([
    window.api.bankAccounts.getAll(),
    window.api.accounts.getAll(),
  ]).then(([ba, ca]) => { setAccounts(ba); setChart(ca) })

  useEffect(() => { load() }, [])

  async function handleDelete() {
    if (!deleting) return
    try {
      await window.api.bankAccounts.delete(deleting.id)
      setDeleting(null)
      load()
    } catch (e: any) { alert(e.message) }
  }

  const totalBalance = accounts.filter(a => a.isActive).reduce((s, a) => s + a.currentBalance, 0)
  const bankTotal    = accounts.filter(a => a.type === 'bank' && a.isActive).reduce((s, a) => s + a.currentBalance, 0)
  const cashTotal    = accounts.filter(a => a.type !== 'bank' && a.isActive).reduce((s, a) => s + a.currentBalance, 0)

  return (
    <div className="p-6">
      <PageHeader title="البنوك والصناديق"
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowRules(true)}
              className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium">
              <Settings2 size={16} /> القواعد البنكية
            </button>
            <button onClick={() => { setEditing(null); setShowForm(true) }}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
              <Plus size={16} /> حساب جديد
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">إجمالي الأرصدة</div>
          <div className="text-2xl font-bold text-slate-800">{totalBalance.toFixed(2)} <span className="text-sm font-normal text-slate-400">{settings.currency}</span></div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">حسابات بنكية</div>
          <div className="text-2xl font-bold text-blue-600">{bankTotal.toFixed(2)} <span className="text-sm font-normal text-slate-400">{settings.currency}</span></div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 mb-1">صناديق نقدية وعهد</div>
          <div className="text-2xl font-bold text-emerald-600">{cashTotal.toFixed(2)} <span className="text-sm font-normal text-slate-400">{settings.currency}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {accounts.map(acc => (
          <div key={acc.id} className={`bg-white rounded-xl shadow-sm p-5 border-r-4 ${acc.type === 'bank' ? 'border-blue-400' : acc.type === 'cash' ? 'border-emerald-400' : 'border-amber-400'}`}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-semibold text-slate-800">{acc.name}</div>
                {acc.bankName && <div className="text-xs text-slate-500">{acc.bankName}</div>}
                {acc.accountNumber && <div className="text-xs font-mono text-slate-400 mt-0.5">{acc.accountNumber}</div>}
              </div>
              <Badge label={TYPE_LABELS[acc.type] ?? acc.type} color={TYPE_COLORS[acc.type] as any} />
            </div>

            {/* Chart of accounts link indicator */}
            {(acc as any).account ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-2 py-1 mb-3">
                <Link2 size={11} />
                <span>مرتبط بـ {(acc as any).account.code} — {(acc as any).account.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1 mb-3">
                <AlertCircle size={11} />
                <span>غير مرتبط بدليل الحسابات</span>
              </div>
            )}

            <div className="text-3xl font-bold text-slate-800 mb-2">
              {acc.currentBalance.toFixed(2)}
              <span className="text-base font-normal text-slate-400 mr-1">{settings.currency}</span>
            </div>
            {typeof acc.statementBalance === 'number' && (
              <div className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2 py-1.5 mb-3">
                <span className="text-slate-500">كشف البنك: {acc.statementBalance.toFixed(2)}</span>
                {((acc.unmatchedStatementLines ?? 0) + (acc.unmatchedTransactions ?? 0)) > 0 && (
                  <span className="text-amber-600 font-medium">
                    {(acc.unmatchedStatementLines ?? 0) + (acc.unmatchedTransactions ?? 0)} غير مُسوّى
                  </span>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setViewing(acc)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">
                <Eye size={13} /> الحركات
              </button>
              <button onClick={() => { setEditing(acc); setShowForm(true) }}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                <Edit2 size={14} />
              </button>
              <button onClick={() => setDeleting(acc)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="col-span-3 text-center py-16 text-slate-400 text-sm">
            <Landmark size={40} className="mx-auto mb-3 opacity-30" />
            لا توجد حسابات — أضف بنكاً أو صندوقاً أو عهدة
          </div>
        )}
      </div>

      {showForm && (
        <AccountForm initial={editing} chartAccounts={chartAccounts}
          onSave={() => { setShowForm(false); load() }}
          onClose={() => setShowForm(false)} />
      )}

      {deleting && (
        <DeleteConfirm onConfirm={handleDelete} onCancel={() => setDeleting(null)}
          message={`هل تريد حذف "${deleting.name}"؟`} />
      )}

      {viewing && (
        <TransactionsModal account={viewing} chartAccounts={chartAccounts} currency={settings.currency}
          onClose={() => { setViewing(null); load() }} />
      )}

      {showRules && (
        <BankRulesModal accounts={accounts} chartAccounts={chartAccounts} onClose={() => setShowRules(false)} />
      )}
    </div>
  )
}

// ─── Account Form ──────────────────────────────────────────────
function AccountForm({ initial, chartAccounts, onSave, onClose }: {
  initial: BankAccount | null
  chartAccounts: Account[]
  onSave: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name:           initial?.name ?? '',
    type:           initial?.type ?? 'bank',
    bankName:       initial?.bankName ?? '',
    accountNumber:  initial?.accountNumber ?? '',
    currentBalance: initial?.currentBalance.toString() ?? '0',
    currency:       initial?.currency ?? 'EGP',
    notes:          initial?.notes ?? '',
    isActive:       initial?.isActive ?? true,
    accountId:      (initial as any)?.accountId?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  // Filter chart accounts: only asset type, leaf-friendly
  const assetAccounts = chartAccounts
    .filter(a => a.type === 'asset' && a.isActive)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return alert('اسم الحساب مطلوب')
    setSaving(true)
    const data: any = {
      name: form.name.trim(), type: form.type,
      bankName: form.bankName || null, accountNumber: form.accountNumber || null,
      currentBalance: Number(form.currentBalance), currency: form.currency,
      notes: form.notes || null, isActive: form.isActive,
      accountId: form.accountId ? Number(form.accountId) : null,
    }
    try {
      if (initial) await window.api.bankAccounts.update({ id: initial.id, ...data })
      else await window.api.bankAccounts.create(data)
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'تعديل حساب' : 'حساب جديد'} onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="اسم الحساب *">
            <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} required />
          </Field>
          <Field label="النوع">
            <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          {form.type === 'bank' && <>
            <Field label="اسم البنك">
              <input value={form.bankName} onChange={e => set('bankName', e.target.value)} className={inputCls} placeholder="البنك الأهلي المصري..." />
            </Field>
            <Field label="رقم الحساب">
              <input value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} className={inputCls} />
            </Field>
          </>}
          <Field label="الرصيد الافتتاحي">
            <input type="number" step="0.01" value={form.currentBalance} onChange={e => set('currentBalance', e.target.value)} className={inputCls} />
          </Field>
          <Field label="العملة">
            <input value={form.currency} onChange={e => set('currency', e.target.value)} className={inputCls} />
          </Field>
        </div>

        {/* Chart of Accounts linkage */}
        <Field label="الربط بدليل الحسابات">
          <select value={form.accountId} onChange={e => set('accountId', e.target.value)} className={inputCls}>
            <option value="">— غير مرتبط —</option>
            {assetAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            ربط الحساب يتيح إنشاء قيود يومية تلقائية عند كل حركة إيداع أو سحب
          </p>
        </Field>

        <Field label="ملاحظات">
          <input value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} placeholder="اختياري" />
        </Field>

        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}

// ─── Tab bar (shared inline) ────────────────────────────────────
function TabBar({ tabs, active, onChange }: {
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex gap-1 border-b border-slate-200">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === t.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─── Transactions Modal (tabbed: عمليات / كشف حساب / تسوية) ────
function TransactionsModal({ account, chartAccounts, currency, onClose }: {
  account: BankAccount
  chartAccounts: Account[]
  currency: string
  onClose: () => void
}) {
  const [acc, setAcc] = useState(account)
  const [tab, setTab] = useState<'tx' | 'statement' | 'reconcile'>('tx')
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [showTxForm, setShowTxForm]     = useState(false)
  const [defaultType, setDefaultType]   = useState<'deposit' | 'withdrawal'>('deposit')

  const load = () => window.api.bankTransactions.getAll({ bankAccountId: account.id }).then(setTransactions)
  useEffect(() => { load() }, [])

  const refreshAccount = () => window.api.bankAccounts.getAll().then((list: BankAccount[]) => {
    const found = list.find(a => a.id === account.id)
    if (found) setAcc(found)
  })

  async function deleteTransaction(id: number) {
    if (!confirm('حذف هذه الحركة سيعكس تأثيرها على الرصيد والقيود اليومية. هل تريد المتابعة؟')) return
    await window.api.bankTransactions.delete(id)
    load()
    refreshAccount()
  }

  const hasChartLink = !!acc.accountId

  return (
    <Modal title={`حساب: ${account.name}`} onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-600">
            الرصيد الدفتري: <span className="font-bold text-slate-800">{acc.currentBalance.toFixed(2)} {currency}</span>
          </div>
          {typeof acc.statementBalance === 'number' && (
            <div className="text-sm text-slate-500">
              رصيد كشف البنك: <span className="font-bold text-slate-700">{acc.statementBalance.toFixed(2)} {currency}</span>
            </div>
          )}
          {!hasChartLink && (
            <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg flex items-center gap-1">
              <AlertCircle size={11} /> غير مرتبط — لن تُنشأ قيود يومية تلقائية
            </div>
          )}
        </div>

        <TabBar
          tabs={[{ id: 'tx', label: 'عمليات بنكية' }, { id: 'statement', label: 'كشف حساب البنك' }, { id: 'reconcile', label: 'التسوية' }]}
          active={tab} onChange={(id) => setTab(id as any)}
        />

        {tab === 'tx' && (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <button onClick={() => { setDefaultType('deposit'); setShowTxForm(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700">
                <ArrowDownCircle size={14} /> إيداع
              </button>
              <button onClick={() => { setDefaultType('withdrawal'); setShowTxForm(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs hover:bg-red-600">
                <ArrowUpCircle size={14} /> سحب
              </button>
            </div>

            {showTxForm && (
              <TxForm
                accountId={account.id}
                hasChartLink={hasChartLink}
                defaultType={defaultType}
                chartAccounts={chartAccounts}
                onSave={() => { setShowTxForm(false); load(); refreshAccount() }}
                onClose={() => setShowTxForm(false)}
              />
            )}

            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0 shadow-sm">
                    <tr>
                      <th className="px-3 py-2 text-right">التاريخ</th>
                      <th className="px-3 py-2 text-right">البيان</th>
                      <th className="px-3 py-2 text-center">النوع</th>
                      <th className="px-3 py-2 text-center">المبلغ</th>
                      <th className="px-3 py-2 text-center">الرصيد بعد</th>
                      <th className="px-3 py-2 text-center">قيد</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500">{new Date(dateStr(tx.date)).toLocaleDateString('ar-EG')}</td>
                        <td className="px-3 py-2 text-slate-700">{tx.description ?? '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tx.type === 'deposit' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {TX_LABELS[tx.type] ?? tx.type}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-center font-semibold ${tx.type === 'deposit' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {tx.type === 'deposit' ? '+' : '-'}{tx.amount.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600">{tx.balanceAfter.toFixed(2)}</td>
                        <td className="px-3 py-2 text-center">
                          {tx.journalEntryId
                            ? <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">✓ قيد</span>
                            : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => deleteTransaction(tx.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {transactions.length === 0 && (
                  <div className="text-center py-8 text-slate-400">لا توجد حركات</div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'statement' && (
          <StatementTab account={acc} hasChartLink={hasChartLink} chartAccounts={chartAccounts}
            onChanged={() => { refreshAccount(); load() }} />
        )}

        {tab === 'reconcile' && (
          <ReconcileTab account={acc} onChanged={() => { refreshAccount(); load() }} />
        )}
      </div>
    </Modal>
  )
}

// ─── Statement Tab: upload & manage imported statement lines ──
function StatementTab({ account, hasChartLink, chartAccounts, onChanged }: {
  account: BankAccount
  hasChartLink: boolean
  chartAccounts: Account[]
  onChanged: () => void
}) {
  const [lines, setLines]       = useState<BankStatementLine[]>([])
  const [preview, setPreview]   = useState<{ rows: any[]; fileName: string } | null>(null)
  const [creatingFor, setCreatingFor] = useState<BankStatementLine | null>(null)
  const [importing, setImporting]     = useState(false)

  const load = () => window.api.bankStatements.getAll({ bankAccountId: account.id }).then(setLines)
  useEffect(() => { load() }, [])

  async function handleUpload() {
    const result = await window.api.bankStatements.parseFile()
    if (!result) return
    if (result.rows.length === 0) return alert('لم يتم العثور على بيانات صالحة في الملف')
    setPreview(result)
  }

  async function confirmImport() {
    if (!preview) return
    setImporting(true)
    try {
      const res = await window.api.bankStatements.import({ bankAccountId: account.id, rows: preview.rows })
      alert(`تم استيراد ${res.imported} حركة${res.skipped ? ` (تم تجاوز ${res.skipped} حركة مكررة أو غير صالحة)` : ''}`)
      setPreview(null)
      load()
      onChanged()
    } catch (e: any) { alert(e.message || 'حدث خطأ أثناء الاستيراد') }
    setImporting(false)
  }

  async function ignoreLine(id: number) { await window.api.bankStatements.ignore(id); load() }
  async function unmatchLine(id: number) { await window.api.bankStatements.unmatch(id); load(); onChanged() }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">{lines.length} حركة مستوردة</div>
        <button onClick={handleUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs hover:bg-violet-700">
          <Upload size={14} /> رفع كشف حساب (Excel)
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0 shadow-sm">
              <tr>
                <th className="px-3 py-2 text-right">التاريخ</th>
                <th className="px-3 py-2 text-right">البيان</th>
                <th className="px-3 py-2 text-center">المبلغ</th>
                <th className="px-3 py-2 text-center">الحالة</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map(line => (
                <tr key={line.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500">{new Date(line.date).toLocaleDateString('ar-EG')}</td>
                  <td className="px-3 py-2 text-slate-700">{line.description ?? '—'}</td>
                  <td className={`px-3 py-2 text-center font-semibold ${line.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {line.amount >= 0 ? '+' : ''}{line.amount.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge label={STMT_STATUS_LABELS[line.status]} color={STMT_STATUS_COLORS[line.status] as any} />
                  </td>
                  <td className="px-3 py-2">
                    {line.status === 'unmatched' && (
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setCreatingFor(line)} className="text-emerald-600 hover:text-emerald-800 text-xs">إنشاء حركة</button>
                        <button onClick={() => ignoreLine(line.id)} className="text-slate-400 hover:text-slate-600 text-xs">تجاهل</button>
                      </div>
                    )}
                    {line.status === 'matched' && (
                      <button onClick={() => unmatchLine(line.id)} className="text-amber-600 hover:text-amber-800 text-xs">إلغاء المطابقة</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lines.length === 0 && (
            <div className="text-center py-8 text-slate-400">لا توجد أسطر كشف — ابدأ برفع ملف Excel</div>
          )}
        </div>
      </div>

      {preview && (
        <Modal title={`معاينة الاستيراد — ${preview.fileName}`} onClose={() => setPreview(null)} maxWidth="max-w-2xl">
          <div className="space-y-3">
            <p className="text-sm text-slate-500">تم العثور على {preview.rows.length} حركة. راجع أول 10 حركات ثم أكّد الاستيراد.</p>
            <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr><th className="px-2 py-1.5 text-right">التاريخ</th><th className="px-2 py-1.5 text-right">البيان</th><th className="px-2 py-1.5 text-center">المبلغ</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">{r.date}</td>
                      <td className="px-2 py-1.5">{r.description}</td>
                      <td className="px-2 py-1.5 text-center">{r.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmImport} disabled={importing}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
                {importing ? 'جاري الاستيراد...' : `استيراد ${preview.rows.length} حركة`}
              </button>
              <button onClick={() => setPreview(null)} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-300">إلغاء</button>
            </div>
          </div>
        </Modal>
      )}

      {creatingFor && (
        <CreateFromLineModal line={creatingFor} hasChartLink={hasChartLink} chartAccounts={chartAccounts}
          onSave={() => { setCreatingFor(null); load(); onChanged() }}
          onClose={() => setCreatingFor(null)} />
      )}
    </div>
  )
}

// ─── Create a bank transaction directly from a statement line ─
function CreateFromLineModal({ line, hasChartLink, chartAccounts, onSave, onClose }: {
  line: BankStatementLine
  hasChartLink: boolean
  chartAccounts: Account[]
  onSave: () => void
  onClose: () => void
}) {
  const [contraAccountId, setContraAccountId] = useState('')
  const [description, setDescription] = useState(line.description ?? '')
  const [saving, setSaving] = useState(false)
  const options = chartAccounts.filter(a => a.isActive).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (hasChartLink && !contraAccountId) return alert('اختر الحساب المقابل')
    setSaving(true)
    try {
      await window.api.bankStatements.createFromLine({
        lineId: line.id,
        contraAccountId: contraAccountId ? Number(contraAccountId) : null,
        description,
      })
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title="إنشاء حركة من سطر الكشف" onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
          <div>{new Date(line.date).toLocaleDateString('ar-EG')} — {line.description ?? '—'}</div>
          <div className={`font-bold mt-1 ${line.amount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {line.amount >= 0 ? '+' : ''}{line.amount.toFixed(2)}
          </div>
        </div>
        <Field label="البيان">
          <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} />
        </Field>
        {hasChartLink && (
          <Field label="الحساب المقابل *">
            <select value={contraAccountId} onChange={e => setContraAccountId(e.target.value)} className={inputCls} required>
              <option value="">— اختر —</option>
              {options.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </Field>
        )}
        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}

// ─── Reconciliation Tab ─────────────────────────────────────────
function ReconcileTab({ account, onChanged }: { account: BankAccount; onChanged: () => void }) {
  const [lines, setLines] = useState<BankStatementLine[]>([])
  const [txs, setTxs]     = useState<BankTransaction[]>([])
  const [selectedLine, setSelectedLine] = useState<number | null>(null)
  const [selectedTx, setSelectedTx]     = useState<number | null>(null)
  const [applying, setApplying]         = useState(false)

  const load = () => Promise.all([
    window.api.bankStatements.getAll({ bankAccountId: account.id }),
    window.api.bankTransactions.getAll({ bankAccountId: account.id }),
  ]).then(([allLines, allTxs]: [BankStatementLine[], BankTransaction[]]) => {
    setLines(allLines.filter(l => l.status === 'unmatched'))
    const matchedIds = new Set(allLines.filter(l => l.matchedTransactionId).map(l => l.matchedTransactionId))
    setTxs(allTxs.filter(t => !matchedIds.has(t.id)))
  })
  useEffect(() => { load() }, [])

  async function confirmMatch() {
    if (!selectedLine || !selectedTx) return
    await window.api.bankStatements.match({ lineId: selectedLine, transactionId: selectedTx })
    setSelectedLine(null); setSelectedTx(null)
    load(); onChanged()
  }

  async function applyRules() {
    setApplying(true)
    const res = await window.api.bankStatements.applyRules({ bankAccountId: account.id })
    setApplying(false)
    if (res.matched > 0) { load(); onChanged() }
    alert(`تمت مطابقة ${res.matched} حركة تلقائياً عبر القواعد البنكية`)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">اختر سطراً من الكشف وحركة من الدفاتر ثم اضغط "ربط" لتسويتهما</p>
        <div className="flex gap-2">
          {selectedLine && selectedTx && (
            <button onClick={confirmMatch}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700">
              <Link2 size={12} /> ربط
            </button>
          )}
          <button onClick={applyRules} disabled={applying}
            className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs hover:bg-violet-700 disabled:opacity-50">
            {applying ? 'جارٍ التطبيق...' : 'تطبيق القواعد البنكية'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">غير مُسوّى في كشف البنك ({lines.length})</div>
          <div className="border rounded-lg max-h-80 overflow-y-auto divide-y divide-slate-100">
            {lines.map(l => (
              <button key={l.id} onClick={() => setSelectedLine(l.id)}
                className={`w-full text-right px-3 py-2 text-xs hover:bg-slate-50 ${selectedLine === l.id ? 'bg-emerald-50 ring-1 ring-emerald-300' : ''}`}>
                <div className="flex justify-between">
                  <span className="text-slate-600">{new Date(l.date).toLocaleDateString('ar-EG')}</span>
                  <span className={l.amount >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>{l.amount.toFixed(2)}</span>
                </div>
                <div className="text-slate-500 truncate">{l.description ?? '—'}</div>
              </button>
            ))}
            {lines.length === 0 && <div className="text-center py-6 text-slate-400 text-xs">لا توجد أسطر غير مُسوّاة</div>}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1.5">غير مُسوّى في الدفاتر ({txs.length})</div>
          <div className="border rounded-lg max-h-80 overflow-y-auto divide-y divide-slate-100">
            {txs.map(t => (
              <button key={t.id} onClick={() => setSelectedTx(t.id)}
                className={`w-full text-right px-3 py-2 text-xs hover:bg-slate-50 ${selectedTx === t.id ? 'bg-emerald-50 ring-1 ring-emerald-300' : ''}`}>
                <div className="flex justify-between">
                  <span className="text-slate-600">{new Date(dateStr(t.date)).toLocaleDateString('ar-EG')}</span>
                  <span className={t.type === 'deposit' ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {t.type === 'deposit' ? '+' : '-'}{t.amount.toFixed(2)}
                  </span>
                </div>
                <div className="text-slate-500 truncate">{t.description ?? '—'}</div>
              </button>
            ))}
            {txs.length === 0 && <div className="text-center py-6 text-slate-400 text-xs">لا توجد حركات غير مُسوّاة</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Bank Rules ─────────────────────────────────────────────────
function BankRulesModal({ accounts, chartAccounts, onClose }: {
  accounts: BankAccount[]
  chartAccounts: Account[]
  onClose: () => void
}) {
  const [rules, setRules]     = useState<BankRule[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<BankRule | null>(null)
  const [deleting, setDeleting] = useState<BankRule | null>(null)

  const load = () => window.api.bankRules.getAll().then(setRules)
  useEffect(() => { load() }, [])

  async function handleDelete() {
    if (!deleting) return
    await window.api.bankRules.delete(deleting.id)
    setDeleting(null)
    load()
  }

  return (
    <Modal title="القواعد البنكية" onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-500">قواعد لتصنيف حركات كشف البنك المستوردة تلقائياً حسب البيان</p>
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700">
            <Plus size={13} /> قاعدة جديدة
          </button>
        </div>
        <div className="border rounded-lg divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {rules.map(r => (
            <div key={r.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
              <div>
                <div className="font-medium text-slate-700 flex items-center gap-2">
                  {r.name}
                  <Badge label={RULE_TYPE_LABELS[r.type] ?? r.type} color={r.type === 'expense' ? 'red' : r.type === 'receipt' ? 'emerald' : 'blue'} />
                  {!r.isActive && <Badge label="معطّلة" color="slate" />}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  إذا كان البيان {MATCH_TYPE_LABELS[r.matchType]} "{r.matchValue}"
                  {r.bankAccountId && <> — لحساب: {accounts.find(a => a.id === r.bankAccountId)?.name ?? '—'}</>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(r); setShowForm(true) }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                  <Edit2 size={13} />
                </button>
                <button onClick={() => setDeleting(r)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {rules.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">لا توجد قواعد بنكية بعد</div>}
        </div>
      </div>

      {showForm && (
        <BankRuleForm initial={editing} accounts={accounts} chartAccounts={chartAccounts}
          onSave={() => { setShowForm(false); load() }}
          onClose={() => setShowForm(false)} />
      )}
      {deleting && (
        <DeleteConfirm onConfirm={handleDelete} onCancel={() => setDeleting(null)} message={`هل تريد حذف قاعدة "${deleting.name}"؟`} />
      )}
    </Modal>
  )
}

function BankRuleForm({ initial, accounts, chartAccounts, onSave, onClose }: {
  initial: BankRule | null
  accounts: BankAccount[]
  chartAccounts: Account[]
  onSave: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    type: initial?.type ?? 'expense',
    matchType: initial?.matchType ?? 'contains',
    matchValue: initial?.matchValue ?? '',
    contraAccountId: initial?.contraAccountId?.toString() ?? '',
    bankAccountId: initial?.bankAccountId?.toString() ?? '',
    isActive: initial?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const options = chartAccounts.filter(a => a.isActive).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.matchValue.trim()) return alert('الاسم وشرط المطابقة مطلوبان')
    setSaving(true)
    const data: any = {
      name: form.name.trim(), type: form.type, matchType: form.matchType, matchValue: form.matchValue.trim(),
      contraAccountId: form.contraAccountId ? Number(form.contraAccountId) : null,
      bankAccountId: form.bankAccountId ? Number(form.bankAccountId) : null,
      isActive: form.isActive,
    }
    try {
      if (initial) await window.api.bankRules.update({ id: initial.id, ...data })
      else await window.api.bankRules.create(data)
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'تعديل قاعدة' : 'قاعدة جديدة'} onClose={onClose} maxWidth="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <Field label="اسم القاعدة *">
          <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} required />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="النوع">
            <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls}>
              {Object.entries(RULE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="الحساب البنكي">
            <select value={form.bankAccountId} onChange={e => set('bankAccountId', e.target.value)} className={inputCls}>
              <option value="">— كل الحسابات —</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="شرط البيان">
            <select value={form.matchType} onChange={e => set('matchType', e.target.value)} className={inputCls}>
              {Object.entries(MATCH_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="القيمة *">
            <input value={form.matchValue} onChange={e => set('matchValue', e.target.value)} className={inputCls} required placeholder="مثال: كهرباء" />
          </Field>
        </div>
        <Field label="الحساب المقابل (للتصنيف التلقائي)">
          <select value={form.contraAccountId} onChange={e => set('contraAccountId', e.target.value)} className={inputCls}>
            <option value="">— بدون —</option>
            {options.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} /> مفعّلة
        </label>
        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}

// ─── Transaction Form ──────────────────────────────────────────
function TxForm({ accountId, hasChartLink, defaultType, chartAccounts, onSave, onClose }: {
  accountId: number
  hasChartLink: boolean
  defaultType: 'deposit' | 'withdrawal'
  chartAccounts: Account[]
  onSave: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    type:            defaultType as string,
    amount:          '',
    description:     '',
    referenceNumber: '',
    date:            new Date().toISOString().slice(0, 10),
    contraAccountId: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // For deposit: contra is usually revenue/equity (credit accounts)
  // For withdrawal: contra is usually expense/liability (debit accounts)
  const contraOptions = chartAccounts
    .filter(a => a.isActive)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!amount || amount <= 0) return alert('أدخل مبلغاً صحيحاً')
    if (hasChartLink && !form.contraAccountId) return alert('اختر الحساب المقابل لإنشاء القيد اليومي')
    setSaving(true)
    try {
      await window.api.bankTransactions.create({
        bankAccountId: accountId, ...form, amount,
        contraAccountId: form.contraAccountId ? Number(form.contraAccountId) : null,
      })
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <div className="bg-slate-50 rounded-xl p-4 border">
      <div className="text-sm font-medium text-slate-700 mb-3">إضافة حركة جديدة</div>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="النوع">
          <select value={form.type} onChange={e => set('type', e.target.value)} className={inputCls}>
            <option value="deposit">إيداع</option>
            <option value="withdrawal">سحب</option>
          </select>
        </Field>
        <Field label="المبلغ *">
          <input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} className={inputCls} required />
        </Field>
        <Field label="التاريخ">
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
        </Field>
        <Field label="رقم المرجع">
          <input value={form.referenceNumber} onChange={e => set('referenceNumber', e.target.value)} className={inputCls} placeholder="اختياري" />
        </Field>
        <Field label="البيان" >
          <input value={form.description} onChange={e => set('description', e.target.value)} className={inputCls} placeholder="وصف الحركة" />
        </Field>

        {/* Contra account — only shown when bank account is linked to chart */}
        {hasChartLink && (
          <Field label={`الحساب المقابل * ${form.type === 'deposit' ? '(الجهة المُودِعة)' : '(وجهة الصرف)'}`}>
            <select value={form.contraAccountId} onChange={e => set('contraAccountId', e.target.value)} className={inputCls} required>
              <option value="">— اختر الحساب المقابل —</option>
              {contraOptions.map(a => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </Field>
        )}

        {hasChartLink && form.contraAccountId && (
          <div className="col-span-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
            <strong>القيد الذي سيُنشأ تلقائياً:</strong>
            {form.type === 'deposit'
              ? <div className="mt-1">مدين: حساب البنك/الصندوق &nbsp;|&nbsp; دائن: {contraOptions.find(a => a.id === Number(form.contraAccountId))?.name}</div>
              : <div className="mt-1">مدين: {contraOptions.find(a => a.id === Number(form.contraAccountId))?.name} &nbsp;|&nbsp; دائن: حساب البنك/الصندوق</div>}
          </div>
        )}

        <div className="col-span-2 flex gap-2">
          <button type="submit" disabled={saving}
            className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button type="button" onClick={onClose}
            className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-300">
            إلغاء
          </button>
        </div>
      </form>
    </div>
  )
}
