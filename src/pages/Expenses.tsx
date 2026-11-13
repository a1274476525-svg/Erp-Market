import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Wallet, Tag, ChevronDown, Download, Upload } from 'lucide-react'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { useSettings } from '../contexts/SettingsContext'

interface ExpenseCategory { id: number; name: string; description?: string; accountId?: number | null; account?: { id: number; code: string; name: string } | null }
interface Expense {
  id: number
  categoryId: number
  category: ExpenseCategory
  amount: number
  description?: string
  date: string
  paymentMethod: string
}

const PAYMENT_METHODS = [
  { value: 'cash',     label: 'نقداً' },
  { value: 'card',     label: 'بطاقة' },
  { value: 'instapay', label: 'إنستاباي' },
  { value: 'vodafone', label: 'فودافون كاش' },
]

function CategoryModal({ cat, accounts, onSave, onClose }: {
  cat: ExpenseCategory | null
  accounts: { id: number; code: string; name: string }[]
  onSave: (data: { name: string; description: string; accountId: number | null }) => void
  onClose: () => void
}) {
  const [name, setName]         = useState(cat?.name ?? '')
  const [desc, setDesc]         = useState(cat?.description ?? '')
  const [accountId, setAccountId] = useState<number | ''>(cat?.accountId ?? '')
  const [saving, setSaving]     = useState(false)

  async function handleSubmit() {
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), description: desc.trim(), accountId: accountId === '' ? null : accountId })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800">{cat ? 'تعديل نوع المصروف' : 'نوع مصروف جديد'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الاسم <span className="text-red-500">*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="مثال: إيجار، مرتبات، كهرباء..." autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">وصف (اختياري)</label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="وصف مختصر..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">حساب المصروف في دليل الحسابات</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">الحساب الافتراضي (مصروفات عامة 61)</option>
              {accounts.map(account => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}
            </select>
            <p className="text-xs text-slate-400 mt-1">سيتم ترحيل المصروفات الجديدة لهذا الحساب بدل الحساب العام.</p>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">إلغاء</button>
          <button onClick={handleSubmit} disabled={saving || !name.trim()}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold">
            {saving ? 'جاري...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ExpenseModal({ expense, categories, onSave, onClose }: {
  expense: Expense | null
  categories: ExpenseCategory[]
  onSave: (data: any) => void
  onClose: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [categoryId,     setCategoryId]     = useState(expense?.categoryId ?? (categories[0]?.id ?? 0))
  const [amount,         setAmount]         = useState(expense?.amount?.toString() ?? '')
  const [description,    setDescription]    = useState(expense?.description ?? '')
  const [date,           setDate]           = useState(expense ? expense.date.slice(0, 10) : today)
  const [paymentMethod,  setPaymentMethod]  = useState(expense?.paymentMethod ?? 'cash')
  const [saving,         setSaving]         = useState(false)

  async function handleSubmit() {
    const amt = parseFloat(amount)
    if (!categoryId || isNaN(amt) || amt <= 0) return
    setSaving(true)
    await onSave({ categoryId, amount: amt, description: description.trim() || null, date: new Date(date).toISOString(), paymentMethod })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-[440px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-800">{expense ? 'تعديل مصروف' : 'إضافة مصروف'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">نوع المصروف <span className="text-red-500">*</span></label>
              <select value={categoryId} onChange={e => setCategoryId(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value={0} disabled>اختر النوع...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">المبلغ <span className="text-red-500">*</span></label>
              <input type="number" min={0} step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00" autoFocus />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">طريقة الدفع</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">البيان / الوصف</label>
            <input value={description} onChange={e => setDescription(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="تفاصيل إضافية (اختياري)..." />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">إلغاء</button>
          <button onClick={handleSubmit} disabled={saving || !categoryId || !amount}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold">
            {saving ? 'جاري...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Expenses() {
  const { settings } = useSettings()
  const [tab, setTab]                   = useState<'expenses' | 'categories'>('expenses')
  const [categories, setCategories]     = useState<ExpenseCategory[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<{ id: number; code: string; name: string }[]>([])
  const [expenses, setExpenses]         = useState<Expense[]>([])
  const [catModal, setCatModal]         = useState<ExpenseCategory | null | false>(false)
  const [expModal, setExpModal]         = useState<Expense | null | false>(false)
  const [filterFrom, setFilterFrom]     = useState('')
  const [filterTo, setFilterTo]         = useState('')
  const [filterCat, setFilterCat]       = useState(0)
  const [importingCategories, setImportingCategories] = useState(false)

  async function loadCategories() {
    setCategories(await window.api.expenseCategories.getAll())
  }

  async function loadExpenseAccounts() {
    setExpenseAccounts(await window.api.expenseCategories.getAccounts())
  }

  async function loadExpenses() {
    const params: any = {}
    if (filterFrom) params.from = filterFrom
    if (filterTo)   params.to   = filterTo
    if (filterCat)  params.categoryId = filterCat
    setExpenses(await window.api.expenses.getAll(params))
  }

  useEffect(() => { loadCategories(); loadExpenseAccounts() }, [])
  useEffect(() => { loadExpenses() }, [filterFrom, filterTo, filterCat])

  async function saveCategory(data: any) {
    if (catModal && (catModal as ExpenseCategory).id) {
      await window.api.expenseCategories.update({ id: (catModal as ExpenseCategory).id, ...data })
    } else {
      await window.api.expenseCategories.create(data)
    }
    await loadCategories()
    setCatModal(false)
  }

  function downloadCategoryTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['الاسم', 'الوصف'],
      ['إيجار', 'مصروف إيجار المحل'],
      ['كهرباء', 'فاتورة الكهرباء'],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'أنواع المصاريف')
    XLSX.writeFile(workbook, 'قالب_استيراد_أنواع_المصاريف.xlsx')
  }

  async function importCategoryFile(file?: File) {
    if (!file) return
    setImportingCategories(true)
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      if (!firstSheet) throw new Error('الملف لا يحتوي على ورقة بيانات')
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' })
      if (!rows.length) throw new Error('لا توجد صفوف بيانات في الملف')

      const existing = new Set(categories.map(c => c.name.trim().toLocaleLowerCase()))
      const seen = new Set<string>()
      const valid: { name: string; description: string }[] = []
      const errors: string[] = []
      rows.forEach((row, index) => {
        const nameValue = row['الاسم'] ?? row['name'] ?? row['Name']
        const descriptionValue = row['الوصف'] ?? row['description'] ?? row['Description'] ?? ''
        const name = String(nameValue ?? '').trim()
        const description = String(descriptionValue ?? '').trim()
        if (!name) {
          errors.push(`صف ${index + 2}: الاسم مطلوب`)
          return
        }
        const key = name.toLocaleLowerCase()
        if (existing.has(key) || seen.has(key)) return
        seen.add(key)
        valid.push({ name, description })
      })

      let imported = 0
      for (const category of valid) {
        await window.api.expenseCategories.create(category)
        imported += 1
      }
      await loadCategories()
      const skipped = rows.length - imported
      window.alert(`تم استيراد ${imported} نوع مصروف. تم تخطي ${skipped} صف (مكرر أو غير صالح).${errors.length ? '\\n' + errors.slice(0, 8).join('\\n') : ''}`)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'تعذر قراءة ملف Excel')
    } finally {
      setImportingCategories(false)
    }
  }

  async function deleteCategory(id: number) {
    if (!confirm('هل تريد حذف هذا النوع؟ سيتم حذف كل المصاريف المرتبطة به.')) return
    await window.api.expenseCategories.delete(id)
    await loadCategories()
  }

  async function saveExpense(data: any) {
    if (expModal && (expModal as Expense).id) {
      await window.api.expenses.update({ id: (expModal as Expense).id, ...data })
    } else {
      await window.api.expenses.create(data)
    }
    await loadExpenses()
    setExpModal(false)
  }

  async function deleteExpense(id: number) {
    if (!confirm('هل تريد حذف هذا المصروف؟')) return
    await window.api.expenses.delete(id)
    await loadExpenses()
  }

  const totalFiltered = expenses.reduce((s, e) => s + e.amount, 0)

  const summaryByCategory = categories.map(cat => ({
    ...cat,
    total: expenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0),
    count: expenses.filter(e => e.categoryId === cat.id).length,
  })).filter(c => c.count > 0).sort((a, b) => b.total - a.total)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">المصاريف</h1>
          <p className="text-sm text-slate-500 mt-0.5">إدارة وتتبع مصاريف المتجر</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCatModal(null)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50 font-medium">
            <Tag size={15} /> إدارة الأنواع
          </button>
          <button onClick={() => setExpModal(null)} disabled={categories.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold">
            <Plus size={15} /> مصروف جديد
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([['expenses', 'المصاريف'], ['categories', 'الأنواع']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'expenses' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex gap-3 flex-wrap items-end">
              <div>
                <label className="block text-xs text-slate-500 mb-1">من تاريخ</label>
                <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">إلى تاريخ</label>
                <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">النوع</label>
                <select value={filterCat} onChange={e => setFilterCat(Number(e.target.value))}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value={0}>كل الأنواع</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {(filterFrom || filterTo || filterCat > 0) && (
                <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterCat(0) }}
                  className="px-3 py-2 text-sm text-slate-500 hover:text-red-500 border border-slate-200 rounded-lg">
                  مسح الفلتر
                </button>
              )}
              <div className="mr-auto bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-center">
                <p className="text-xs text-amber-600">إجمالي المصاريف</p>
                <p className="font-bold text-amber-700 text-base">{totalFiltered.toFixed(2)} {settings.currency}</p>
              </div>
            </div>
          </div>

          {/* Summary chips */}
          {summaryByCategory.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {summaryByCategory.map(c => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm">
                  <span className="text-slate-500">{c.name}: </span>
                  <span className="font-bold text-slate-700">{c.total.toFixed(2)}</span>
                  <span className="text-slate-400 text-xs mr-1">({c.count})</span>
                </div>
              ))}
            </div>
          )}

          {/* Expenses table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {expenses.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Wallet size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">لا توجد مصاريف</p>
                {categories.length === 0 && <p className="text-xs mt-1 text-amber-500">أضف نوع مصروف أولاً</p>}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">التاريخ</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">النوع</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">البيان</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">طريقة الدفع</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">المبلغ</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {format(new Date(exp.date), 'dd MMM yyyy', { locale: ar })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">
                          {exp.category.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{exp.description || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {PAYMENT_METHODS.find(m => m.value === exp.paymentMethod)?.label ?? exp.paymentMethod}
                      </td>
                      <td className="px-4 py-3 text-left">
                        <span className="font-bold text-slate-800">{exp.amount.toFixed(2)}</span>
                        <span className="text-xs text-slate-400 mr-1">{settings.currency}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setExpModal(exp)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteExpense(exp.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700 text-sm">أنواع المصاريف ({categories.length})</h2>
            <div className="flex items-center gap-2">
              <button onClick={downloadCategoryTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold">
                <Download size={13} /> تحميل القالب
              </button>
              <input id="expense-category-import" type="file" accept=".xlsx,.xls,.csv"
                className="hidden" disabled={importingCategories}
                onChange={e => { const file = e.target.files?.[0]; void importCategoryFile(file); e.currentTarget.value = '' }} />
              <button onClick={() => document.getElementById('expense-category-import')?.click()} disabled={importingCategories}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-semibold disabled:opacity-50">
                <Upload size={13} /> {importingCategories ? 'جارٍ الاستيراد...' : 'استيراد Excel'}
              </button>
              <button onClick={() => setCatModal(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold">
                <Plus size={13} /> إضافة
              </button>
            </div>
          </div>
          {categories.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Tag size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد أنواع مصاريف بعد</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{cat.name}</p>
                    {cat.description && <p className="text-xs text-slate-400 mt-0.5">{cat.description}</p>}
                    <p className="text-xs text-emerald-700 mt-0.5">{cat.account ? `${cat.account.code} — ${cat.account.name}` : 'الحساب الافتراضي: 61'}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setCatModal(cat)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteCategory(cat.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {catModal !== false && (
        <CategoryModal
          cat={catModal as ExpenseCategory | null}
          accounts={expenseAccounts}
          onSave={saveCategory}
          onClose={() => setCatModal(false)}
        />
      )}

      {expModal !== false && (
        <ExpenseModal
          expense={expModal as Expense | null}
          categories={categories}
          onSave={saveExpense}
          onClose={() => setExpModal(false)}
        />
      )}
    </div>
  )
}
