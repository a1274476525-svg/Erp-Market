import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, BookOpen, Sparkles, RefreshCw, Search } from 'lucide-react'
import type { Account } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, DeleteConfirm, Badge, PageHeader } from '../components/ui'

const TYPE_LABELS: Record<string, string> = {
  asset:     'أصول',
  liability: 'خصوم',
  equity:    'حقوق ملكية',
  revenue:   'إيرادات',
  expense:   'مصاريف',
}
const TYPE_COLORS: Record<string, string> = {
  asset: 'blue', liability: 'red', equity: 'purple', revenue: 'emerald', expense: 'amber',
}
const NB_DEFAULT: Record<string, 'debit' | 'credit'> = {
  asset: 'debit', liability: 'credit', equity: 'credit', revenue: 'credit', expense: 'debit',
}

function buildTree(accounts: Account[]): Account[] {
  const map = new Map<number, Account>()
  accounts.forEach(a => map.set(a.id, { ...a, children: [] }))
  const roots: Account[] = []
  map.forEach(a => {
    if (a.parentId) map.get(a.parentId)?.children?.push(a)
    else roots.push(a)
  })
  const sort = (list: Account[]) => {
    list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    list.forEach(a => sort(a.children ?? []))
    return list
  }
  return sort(roots)
}

function AccountRow({ account, onEdit, onAdd, onDelete, depth = 0 }: {
  account: Account
  onEdit: (a: Account) => void
  onAdd: (parent: Account) => void
  onDelete: (a: Account) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = (account.children?.length ?? 0) > 0
  const isLeaf = !hasChildren

  return (
    <>
      <tr className={`hover:bg-slate-50 border-b border-slate-100 ${depth === 0 ? 'bg-slate-50/80 font-semibold' : ''}`}>
        <td className="py-2" style={{ paddingRight: `${16 + depth * 20}px`, paddingLeft: '8px' }}>
          <div className="flex items-center gap-1.5">
            {hasChildren
              ? <button onClick={() => setExpanded(e => !e)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 p-0.5">
                  {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              : <span className="w-5 flex-shrink-0" />}
            <span className="font-mono text-xs text-slate-400 w-14 flex-shrink-0">{account.code}</span>
            <span className={`${isLeaf ? 'text-slate-700' : 'text-slate-900'} truncate`}>{account.name}</span>
            {isLeaf && (
              <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${account.normalBalance === 'debit' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {account.normalBalance === 'debit' ? 'م' : 'د'}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-center">
          <Badge label={TYPE_LABELS[account.type] ?? account.type} color={TYPE_COLORS[account.type] as any} />
        </td>
        <td className="px-3 py-2 text-center text-xs text-slate-400">{account.level}</td>
        <td className="px-3 py-2">
          <div className="flex justify-center gap-1">
            {account.level < 5 && (
              <button onClick={() => onAdd(account)} title="إضافة حساب فرعي"
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                <Plus size={12} />
              </button>
            )}
            <button onClick={() => onEdit(account)}
              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
              <Edit2 size={12} />
            </button>
            <button onClick={() => onDelete(account)}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
              <Trash2 size={12} />
            </button>
          </div>
        </td>
      </tr>
      {expanded && account.children?.map(child => (
        <AccountRow key={child.id} account={child} onEdit={onEdit} onAdd={onAdd} onDelete={onDelete} depth={depth + 1} />
      ))}
    </>
  )
}

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tree, setTree]         = useState<Account[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Account | null>(null)
  const [formParent, setFormParent] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [seeding, setSeeding]   = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch]     = useState('')

  const load = useCallback(() =>
    window.api.accounts.getAll().then((data: Account[]) => {
      setAccounts(data)
      setTree(buildTree(data))
    }), [])

  useEffect(() => { load() }, [load])

  function openAddRoot() { setEditing(null); setFormParent(null); setShowForm(true) }
  function openAddChild(parent: Account) { setEditing(null); setFormParent(parent); setShowForm(true) }

  async function handleSeed(force = false) {
    if (force && !confirm('سيتم حذف كل الحسابات والقيود المرتبطة. هل أنت متأكد؟')) return
    setSeeding(true)
    try {
      const res = await window.api.accounts.seedDefault(force)
      if (res.skipped) alert('دليل الحسابات موجود مسبقاً — استخدم "إعادة بناء" لإعادة الإنشاء')
      else { await load(); alert(`تم إنشاء ${res.seeded} حساباً وفق المعايير المحاسبية`) }
    } catch (e: any) { alert(e.message) }
    setSeeding(false)
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await window.api.accounts.delete(deleting.id)
      setDeleting(null)
      load()
    } catch (e: any) { alert(e.message) }
  }

  const searchLower = search.toLowerCase()
  const filterTree = (nodes: Account[]): Account[] =>
    nodes.reduce<Account[]>((acc, n) => {
      const matchSelf = !searchLower || n.name.toLowerCase().includes(searchLower) || n.code.includes(search)
      const filteredChildren = filterTree(n.children ?? [])
      if (matchSelf || filteredChildren.length > 0) {
        acc.push({ ...n, children: filteredChildren })
      }
      return acc
    }, [])

  const displayTree = (typeFilter ? tree.filter(a => a.type === typeFilter) : tree)
  const filteredTree = search ? filterTree(displayTree) : displayTree

  const stats = {
    total: accounts.length,
    byType: Object.keys(TYPE_LABELS).reduce<Record<string, number>>((acc, t) => {
      acc[t] = accounts.filter(a => a.type === t).length
      return acc
    }, {}),
  }

  return (
    <div className="p-6">
      <PageHeader title="دليل الحسابات"
        action={
          <div className="flex gap-2">
            {accounts.length === 0 ? (
              <button onClick={() => handleSeed(false)} disabled={seeding}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50">
                <Sparkles size={15} /> {seeding ? 'جاري الإنشاء...' : 'إنشاء الدليل الافتراضي'}
              </button>
            ) : (
              <button onClick={() => handleSeed(true)} disabled={seeding}
                className="flex items-center gap-2 bg-slate-600 text-white px-3 py-2 rounded-lg hover:bg-slate-700 text-sm disabled:opacity-50" title="إعادة بناء من الصفر">
                <RefreshCw size={14} className={seeding ? 'animate-spin' : ''} /> إعادة بناء
              </button>
            )}
            <button onClick={openAddRoot}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
              <Plus size={15} /> حساب جديد
            </button>
          </div>
        }
      />

      {/* Stats */}
      {accounts.length > 0 && (
        <div className="flex gap-3 mb-4 flex-wrap">
          {Object.entries(TYPE_LABELS).map(([t, l]) => (
            <div key={t} className="bg-white rounded-lg px-3 py-1.5 shadow-sm text-xs">
              <span className="text-slate-500">{l}: </span>
              <span className="font-semibold text-slate-700">{stats.byType[t] ?? 0}</span>
            </div>
          ))}
          <div className="bg-white rounded-lg px-3 py-1.5 shadow-sm text-xs">
            <span className="text-slate-500">الإجمالي: </span>
            <span className="font-semibold text-slate-700">{stats.total}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
            className="border border-slate-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white w-48" />
        </div>
        <div className="flex gap-1">
          {(['', 'asset', 'liability', 'equity', 'revenue', 'expense'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === t ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {t === '' ? 'الكل' : TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-2 bg-slate-700 text-white text-xs flex items-center gap-2">
          <span className="font-medium">م = مدين (debit normal) &nbsp; | &nbsp; د = دائن (credit normal)</span>
          <span className="text-slate-400 mr-auto">5 مستويات حسابية وفق المعايير الدولية IFRS</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">الحساب</th>
              <th className="px-3 py-3 text-center">النوع</th>
              <th className="px-3 py-3 text-center">المستوى</th>
              <th className="px-3 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredTree.map(a => (
              <AccountRow key={a.id} account={a}
                onEdit={acc => { setEditing(acc); setFormParent(null); setShowForm(true) }}
                onAdd={openAddChild}
                onDelete={setDeleting}
              />
            ))}
          </tbody>
        </table>
        {filteredTree.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            {accounts.length === 0
              ? 'لا يوجد دليل حسابات — اضغط "إنشاء الدليل الافتراضي" لإنشاء 80+ حساباً وفق IFRS'
              : 'لا توجد نتائج'}
          </div>
        )}
      </div>

      {showForm && (
        <AccountForm
          initial={editing}
          parent={formParent}
          accounts={accounts}
          onSave={() => { setShowForm(false); load() }}
          onClose={() => setShowForm(false)}
        />
      )}

      {deleting && (
        <DeleteConfirm
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          message={`حذف الحساب "${deleting.name}" — لا يمكن حذف حساب له فروع أو قيود.`}
        />
      )}
    </div>
  )
}

// ─── Account Form ──────────────────────────────────────────────
function AccountForm({ initial, parent, accounts, onSave, onClose }: {
  initial: Account | null
  parent: Account | null
  accounts: Account[]
  onSave: () => void
  onClose: () => void
}) {
  const [autoCode, setAutoCode] = useState(!initial)
  const [code, setCode]         = useState(initial?.code ?? '')
  const [name, setName]         = useState(initial?.name ?? '')
  const [type, setType]         = useState<Account['type']>(initial?.type ?? parent?.type ?? 'asset')
  const [normalBalance, setNB]  = useState<'debit'|'credit'>(initial?.normalBalance ?? NB_DEFAULT[initial?.type ?? parent?.type ?? 'asset'])
  const [parentId, setParentId] = useState<string>((initial?.parentId ?? parent?.id)?.toString() ?? '')
  const [description, setDesc]  = useState(initial?.description ?? '')
  const [isActive, setActive]   = useState(initial?.isActive ?? true)
  const [loadingCode, setLC]    = useState(false)
  const [saving, setSaving]     = useState(false)

  // When type changes, update normalBalance default (unless user already changed it)
  const handleTypeChange = (t: Account['type']) => {
    setType(t)
    setNB(NB_DEFAULT[t])
  }

  // Auto-generate code when autoCode is enabled or parentId changes
  useEffect(() => {
    if (!autoCode || initial) return
    setLC(true)
    const pid = parentId ? Number(parentId) : undefined
    window.api.accounts.getNextCode(pid)
      .then(c => setCode(c))
      .finally(() => setLC(false))
  }, [autoCode, parentId, initial])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return alert('الكود والاسم مطلوبان')
    const pid = parentId ? Number(parentId) : null
    const parentAcc = pid ? accounts.find(a => a.id === pid) : null
    const level = parentAcc ? parentAcc.level + 1 : 1
    if (level > 5) return alert('الحد الأقصى 5 مستويات')
    setSaving(true)
    const data = {
      code: code.trim(), name: name.trim(), type, normalBalance,
      parentId: pid, description: description || null, isActive, level,
    }
    try {
      if (initial) await window.api.accounts.update({ id: initial.id, ...data })
      else await window.api.accounts.create(data)
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  const parentOptions = accounts.filter(a => !initial || a.id !== initial.id)
  const selectedParent = parentId ? accounts.find(a => a.id === Number(parentId)) : null
  const newLevel = selectedParent ? selectedParent.level + 1 : 1

  return (
    <Modal title={initial ? `تعديل: ${initial.name}` : parent ? `حساب فرعي تحت: ${parent.name}` : 'حساب جديد'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">

        {/* Parent */}
        <Field label="الحساب الرئيسي">
          <select value={parentId} onChange={e => setParentId(e.target.value)} className={inputCls} disabled={!!initial && !!initial.parentId}>
            <option value="">— حساب رئيسي (مستوى 1) —</option>
            {parentOptions
              .filter(a => a.level < 5)
              .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
              .map(a => (
                <option key={a.id} value={a.id}>{'·'.repeat(a.level - 1)} {a.code} — {a.name}</option>
              ))}
          </select>
          {newLevel > 1 && <p className="text-xs text-slate-400 mt-1">المستوى: {newLevel}</p>}
        </Field>

        {/* Code */}
        <Field label="كود الحساب *">
          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap cursor-pointer">
              <input type="checkbox" checked={autoCode} onChange={e => setAutoCode(e.target.checked)}
                className="rounded" disabled={!!initial} />
              توليد تلقائي
            </label>
            <input
              value={loadingCode ? '...' : code}
              onChange={e => setCode(e.target.value)}
              disabled={autoCode && !initial}
              className={`${inputCls} ${autoCode && !initial ? 'bg-slate-50 text-slate-500' : ''} flex-1`}
              placeholder="مثال: 1112"
              required
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          {/* Name */}
          <Field label="اسم الحساب *">
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} required />
          </Field>

          {/* Type */}
          <Field label="نوع الحساب">
            <select value={type} onChange={e => handleTypeChange(e.target.value as Account['type'])} className={inputCls}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>

          {/* Normal Balance */}
          <Field label="الرصيد الطبيعي">
            <div className="flex gap-2">
              {(['debit', 'credit'] as const).map(nb => (
                <label key={nb} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${normalBalance === nb ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <input type="radio" name="nb" value={nb} checked={normalBalance === nb} onChange={() => setNB(nb)} className="hidden" />
                  {nb === 'debit' ? 'مدين (Debit)' : 'دائن (Credit)'}
                </label>
              ))}
            </div>
          </Field>

          {/* Description */}
          <Field label="وصف (اختياري)">
            <input value={description} onChange={e => setDesc(e.target.value)} className={inputCls} />
          </Field>

          {/* Active */}
          <Field label="الحالة">
            <select value={isActive ? '1' : '0'} onChange={e => setActive(e.target.value === '1')} className={inputCls}>
              <option value="1">نشط</option>
              <option value="0">موقوف</option>
            </select>
          </Field>
        </div>

        {/* IFRS hint */}
        <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
          <strong>وفق IFRS:</strong> الرصيد الطبيعي — الأصول والمصاريف: مدين | الخصوم وحقوق الملكية والإيرادات: دائن
        </div>

        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}
