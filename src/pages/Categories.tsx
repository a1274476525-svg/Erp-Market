import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Layers } from 'lucide-react'
import type { Category } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, DeleteConfirm, PageHeader } from '../components/ui'

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Category | null>(null)
  const [deleting, setDeleting]     = useState<Category | null>(null)

  const load = () => window.api.categories.getAll().then(setCategories)
  useEffect(() => { load() }, [])

  async function handleDelete() {
    if (!deleting) return
    try {
      await window.api.categories.delete(deleting.id)
      setDeleting(null)
      load()
    } catch (e: any) { alert(e.message || 'لا يمكن حذف الصنف لوجود منتجات مرتبطة به') }
  }

  return (
    <div className="p-6">
      <PageHeader title="الأصناف"
        action={
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16} /> صنف جديد
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map(cat => (
          <div key={cat.id} className="bg-white rounded-xl p-5 shadow-sm flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Layers size={18} className="text-emerald-500" />
                <h3 className="font-semibold text-slate-800">{cat.name}</h3>
              </div>
              {cat.description && <p className="text-xs text-slate-400">{cat.description}</p>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(cat); setShowForm(true) }}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                <Edit2 size={14} />
              </button>
              <button onClick={() => setDeleting(cat)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400 text-sm">
            <Layers size={40} className="mx-auto mb-3 opacity-30" />
            لا توجد أصناف بعد
          </div>
        )}
      </div>

      {showForm && (
        <CategoryForm
          initial={editing}
          onSave={() => { setShowForm(false); load() }}
          onClose={() => setShowForm(false)}
        />
      )}
      {deleting && (
        <DeleteConfirm
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          message={`هل تريد حذف صنف "${deleting.name}"؟`}
        />
      )}
    </div>
  )
}

function CategoryForm({ initial, onSave, onClose }: {
  initial: Category | null; onSave: () => void; onClose: () => void
}) {
  const [name, setName]         = useState(initial?.name ?? '')
  const [description, setDesc]  = useState(initial?.description ?? '')
  const [saving, setSaving]     = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      if (initial) await window.api.categories.update({ id: initial.id, name: name.trim(), description: description || null })
      else await window.api.categories.create({ name: name.trim(), description: description || null })
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'تعديل صنف' : 'صنف جديد'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="اسم الصنف *">
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} required autoFocus />
        </Field>
        <Field label="الوصف">
          <textarea value={description} onChange={e => setDesc(e.target.value)} rows={2} className={inputCls} />
        </Field>
        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}
