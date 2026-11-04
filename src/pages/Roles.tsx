import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, ShieldCheck } from 'lucide-react'
import type { Role } from '../types'
import { PAGES } from '../constants/permissions'
import { Modal, Field, inputCls, SaveCancelButtons, DeleteConfirm, Badge, PageHeader } from '../components/ui'

export default function RolesPage() {
  const [roles, setRoles]       = useState<Role[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Role | null>(null)
  const [deleting, setDeleting] = useState<Role | null>(null)

  const load = () => window.api.roles.getAll().then(setRoles)
  useEffect(() => { load() }, [])

  async function handleDelete() {
    if (!deleting) return
    try {
      await window.api.roles.delete(deleting.id)
      setDeleting(null)
      load()
    } catch (e: any) { alert(e.message || 'لا يمكن حذف هذا الدور') }
  }

  return (
    <div className="p-6">
      <PageHeader title="الوظائف والصلاحيات"
        action={
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16} /> وظيفة جديدة
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map(role => (
          <div key={role.id} className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-emerald-500" />
                  <h3 className="font-semibold text-slate-800">{role.name}</h3>
                </div>
                <div className="flex gap-2 mt-1">
                  {role.isSystem && <Badge label="دور النظام" color="purple" />}
                  {role.fullAccess && <Badge label="وصول كامل" color="emerald" />}
                </div>
              </div>
              {!role.isSystem && (
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(role); setShowForm(true) }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleting(role)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
            {!role.fullAccess && role.permissions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 8).map(p => {
                  const page = PAGES.find(pg => pg.path === p)
                  return page ? (
                    <span key={p} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{page.label}</span>
                  ) : null
                })}
                {role.permissions.length > 8 && (
                  <span className="text-xs text-slate-400">+{role.permissions.length - 8} أخرى</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {roles.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
          لا توجد وظائف
        </div>
      )}

      {showForm && (
        <RoleForm initial={editing}
          onSave={() => { setShowForm(false); load() }}
          onClose={() => setShowForm(false)} />
      )}
      {deleting && (
        <DeleteConfirm onConfirm={handleDelete} onCancel={() => setDeleting(null)}
          message={`هل تريد حذف وظيفة "${deleting.name}"؟`} />
      )}
    </div>
  )
}

function RoleForm({ initial, onSave, onClose }: {
  initial: Role | null; onSave: () => void; onClose: () => void
}) {
  const [name, setName]           = useState(initial?.name ?? '')
  const [fullAccess, setFull]     = useState(initial?.fullAccess ?? false)
  const [permissions, setPerms]   = useState<string[]>(initial?.permissions ?? [])
  const [saving, setSaving]       = useState(false)

  function togglePerm(path: string) {
    setPerms(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const data = { name: name.trim(), fullAccess, permissions: fullAccess ? [] : permissions }
      if (initial) await window.api.roles.update({ id: initial.id, ...data })
      else await window.api.roles.create(data)
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'تعديل وظيفة' : 'وظيفة جديدة'} onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        <Field label="اسم الوظيفة *">
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} required autoFocus />
        </Field>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={fullAccess} onChange={e => setFull(e.target.checked)} className="rounded" />
          <span className="text-slate-700 font-medium">وصول كامل (جميع الصفحات)</span>
        </label>
        {!fullAccess && (
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">الصفحات المسموح بها</label>
            <div className="grid grid-cols-2 gap-1 border rounded-lg p-3 max-h-64 overflow-y-auto">
              {PAGES.map(page => (
                <label key={page.path} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 hover:bg-slate-50 rounded">
                  <input type="checkbox" checked={permissions.includes(page.path)}
                    onChange={() => togglePerm(page.path)} className="rounded" />
                  <span className="text-slate-700">{page.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}
