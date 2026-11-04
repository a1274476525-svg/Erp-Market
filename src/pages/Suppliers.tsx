import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, Truck } from 'lucide-react'
import type { Supplier } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, DeleteConfirm, PageHeader } from '../components/ui'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch]       = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [editing, setEditing]     = useState<Supplier | null>(null)
  const [deleting, setDeleting]   = useState<Supplier | null>(null)

  const load = () => window.api.suppliers.getAll().then(setSuppliers)
  useEffect(() => { load() }, [])

  const filtered = suppliers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search)
  )

  async function handleDelete() {
    if (!deleting) return
    try {
      await window.api.suppliers.delete(deleting.id)
      setDeleting(null)
      load()
    } catch (e: any) { alert(e.message || 'لا يمكن حذف المورد لوجود فواتير مرتبطة') }
  }

  return (
    <div className="p-6">
      <PageHeader title="الموردون"
        action={
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16} /> مورد جديد
          </button>
        }
      />

      <div className="relative mb-4">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهاتف..."
          className="w-full max-w-xs border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">المورد</th>
              <th className="px-4 py-3 text-right">رقم الهاتف</th>
              <th className="px-4 py-3 text-right">العنوان</th>
              <th className="px-4 py-3 text-right">الرقم الضريبي</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                <td className="px-4 py-3 text-slate-600 font-mono">{s.phone ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500">{s.address ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{s.taxNumber ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => { setEditing(s); setShowForm(true) }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeleting(s)}
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
            <Truck size={40} className="mx-auto mb-3 opacity-30" />
            لا يوجد موردون
          </div>
        )}
      </div>

      {showForm && (
        <SupplierForm initial={editing} onSave={() => { setShowForm(false); load() }} onClose={() => setShowForm(false)} />
      )}
      {deleting && (
        <DeleteConfirm onConfirm={handleDelete} onCancel={() => setDeleting(null)} message={`هل تريد حذف "${deleting.name}"؟`} />
      )}
    </div>
  )
}

function SupplierForm({ initial, onSave, onClose }: {
  initial: Supplier | null; onSave: () => void; onClose: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    address: initial?.address ?? '',
    taxNumber: initial?.taxNumber ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const data = { name: form.name.trim(), phone: form.phone || null, address: form.address || null, taxNumber: form.taxNumber || null }
      if (initial) await window.api.suppliers.update({ id: initial.id, ...data })
      else await window.api.suppliers.create(data)
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'تعديل مورد' : 'مورد جديد'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="اسم المورد *">
          <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} required autoFocus />
        </Field>
        <Field label="رقم الهاتف">
          <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} dir="ltr" />
        </Field>
        <Field label="العنوان">
          <textarea value={form.address} onChange={e => set('address', e.target.value)} rows={2} className={inputCls} />
        </Field>
        <Field label="الرقم الضريبي">
          <input value={form.taxNumber} onChange={e => set('taxNumber', e.target.value)} className={inputCls} dir="ltr" />
        </Field>
        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}
