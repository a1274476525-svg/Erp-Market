import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, UserCheck, Star, Gift } from 'lucide-react'
import type { Customer } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, DeleteConfirm, PageHeader } from '../components/ui'

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch]       = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<Customer | null>(null)
  const [deleting, setDeleting]   = useState<Customer | null>(null)
  const [pointsCustomer, setPointsCustomer] = useState<Customer | null>(null)

  const load = () => window.api.customers.getAll().then(setCustomers)
  useEffect(() => { load() }, [])

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  )

  async function handleDelete() {
    if (!deleting) return
    await window.api.customers.delete(deleting.id)
    setDeleting(null)
    load()
  }

  return (
    <div className="p-6">
      <PageHeader title="العملاء"
        action={
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16} /> عميل جديد
          </button>
        }
      />

      <div className="relative mb-4">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو رقم الهاتف..."
          className={`${inputCls} max-w-xs pr-9`} />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">العميل</th>
              <th className="px-4 py-3 text-right">رقم الهاتف</th>
              <th className="px-4 py-3 text-right">العنوان</th>
              <th className="px-4 py-3 text-center">نقاط الولاء</th>
              <th className="px-4 py-3 text-right">تاريخ التسجيل</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold">
                      {c.name[0]}
                    </div>
                    <span className="font-medium text-slate-800">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 font-mono">{c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{c.address ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => setPointsCustomer(c)}
                    className="flex items-center justify-center gap-1 text-amber-500 font-semibold hover:text-amber-600 transition-colors mx-auto">
                    <Star size={14} fill="currentColor" />
                    {c.loyaltyPoints}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {new Date(c.createdAt).toLocaleDateString('ar-EG')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => setPointsCustomer(c)} title="نقاط الولاء"
                      className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors">
                      <Gift size={14} />
                    </button>
                    <button onClick={() => { setEditing(c); setShowForm(true) }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeleting(c)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            <UserCheck size={40} className="mx-auto mb-3 opacity-30" />
            لا يوجد عملاء
          </div>
        )}
      </div>

      {showForm && (
        <CustomerForm
          initial={editing}
          onSave={() => { setShowForm(false); load() }}
          onClose={() => setShowForm(false)}
        />
      )}
      {deleting && (
        <DeleteConfirm
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          message={`هل تريد حذف عميل "${deleting.name}"؟`}
        />
      )}
      {pointsCustomer && (
        <LoyaltyPointsModal
          customer={pointsCustomer}
          onSave={() => { setPointsCustomer(null); load() }}
          onClose={() => setPointsCustomer(null)}
        />
      )}
    </div>
  )
}

// ─── Loyalty Points Modal ──────────────────────────────────────
function LoyaltyPointsModal({ customer, onSave, onClose }: {
  customer: Customer; onSave: () => void; onClose: () => void
}) {
  const [mode, setMode]     = useState<'add' | 'redeem'>('add')
  const [points, setPoints] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const val = parseInt(points)
    if (!val || val <= 0) return alert('أدخل عدداً صحيحاً أكبر من صفر')
    if (mode === 'redeem' && val > customer.loyaltyPoints)
      return alert(`لا يمكن خصم أكثر من الرصيد الحالي (${customer.loyaltyPoints} نقطة)`)
    setSaving(true)
    try {
      await window.api.customers.addPoints({ id: customer.id, points: mode === 'add' ? val : -val })
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={`نقاط الولاء — ${customer.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-amber-50 rounded-xl p-4 flex items-center gap-3">
          <Star size={28} className="text-amber-500" fill="currentColor" />
          <div>
            <div className="text-xs text-amber-600">الرصيد الحالي</div>
            <div className="text-2xl font-bold text-amber-700">{customer.loyaltyPoints} نقطة</div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setMode('add')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'add' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            إضافة نقاط
          </button>
          <button onClick={() => setMode('redeem')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'redeem' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            خصم نقاط
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label={mode === 'add' ? 'عدد النقاط المضافة' : 'عدد النقاط المخصومة'}>
            <input type="number" value={points} onChange={e => setPoints(e.target.value)}
              className={inputCls} min={1} max={mode === 'redeem' ? customer.loyaltyPoints : undefined}
              placeholder="0" autoFocus />
          </Field>
          {points && Number(points) > 0 && (
            <div className={`text-sm rounded-lg p-2 text-center font-medium ${mode === 'add' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              الرصيد بعد العملية: {mode === 'add'
                ? customer.loyaltyPoints + Number(points)
                : customer.loyaltyPoints - Number(points)
              } نقطة
            </div>
          )}
          <SaveCancelButtons
            saving={saving}
            onCancel={onClose}
            saveLabel={mode === 'add' ? 'إضافة نقاط' : 'خصم نقاط'}
          />
        </form>
      </div>
    </Modal>
  )
}

// ─── Customer Form ─────────────────────────────────────────────
function CustomerForm({ initial, onSave, onClose }: {
  initial: Customer | null; onSave: () => void; onClose: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    address: initial?.address ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const data = { name: form.name.trim(), phone: form.phone || null, address: form.address || null }
      if (initial) await window.api.customers.update({ id: initial.id, ...data })
      else await window.api.customers.create(data)
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'تعديل عميل' : 'عميل جديد'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="الاسم *">
          <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} required autoFocus />
        </Field>
        <Field label="رقم الهاتف">
          <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} dir="ltr" placeholder="01xxxxxxxxx" />
        </Field>
        <Field label="العنوان">
          <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} className={inputCls} />
        </Field>
        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}
