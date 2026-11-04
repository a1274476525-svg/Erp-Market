import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Users } from 'lucide-react'
import type { User, Role } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, DeleteConfirm, Badge, PageHeader } from '../components/ui'

export default function UsersPage() {
  const [users, setUsers]   = useState<User[]>([])
  const [roles, setRoles]   = useState<Role[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)

  const load = () => Promise.all([
    window.api.auth.getAll(),
    window.api.roles.getAll(),
  ]).then(([u, r]) => { setUsers(u); setRoles(r) })

  useEffect(() => { load() }, [])

  async function handleDelete() {
    if (!deleting) return
    await window.api.auth.delete(deleting.id)
    setDeleting(null)
    load()
  }

  return (
    <div className="p-6">
      <PageHeader title="المستخدمون"
        action={
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16} /> مستخدم جديد
          </button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">المستخدم</th>
              <th className="px-4 py-3 text-right">الوظيفة</th>
              <th className="px-4 py-3 text-center">الحالة</th>
              <th className="px-4 py-3 text-right">تاريخ الإنشاء</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">
                      {u.name[0]}
                    </div>
                    <span className="font-medium text-slate-800">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{u.role || '—'}</td>
                <td className="px-4 py-3 text-center">
                  {u.isActive ? <Badge label="نشط" color="green" /> : <Badge label="معطل" color="red" />}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {new Date(u.createdAt).toLocaleDateString('ar-EG')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => { setEditing(u); setShowForm(true) }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeleting(u)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            لا يوجد مستخدمون
          </div>
        )}
      </div>

      {showForm && (
        <UserForm initial={editing} roles={roles}
          onSave={() => { setShowForm(false); load() }}
          onClose={() => setShowForm(false)} />
      )}
      {deleting && (
        <DeleteConfirm onConfirm={handleDelete} onCancel={() => setDeleting(null)}
          message={`هل تريد حذف المستخدم "${deleting.name}"؟`} />
      )}
    </div>
  )
}

function UserForm({ initial, roles, onSave, onClose }: {
  initial: User | null; roles: Role[]; onSave: () => void; onClose: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    role: initial?.role ?? '',
    pin: '',
    confirmPin: '',
    isActive: initial?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return alert('الاسم مطلوب')
    if (!initial && !form.pin) return alert('رقم الدخول مطلوب')
    if (form.pin && !/^\d{4}$/.test(form.pin)) return alert('رقم الدخول يجب أن يكون 4 أرقام')
    if (form.pin && form.pin !== form.confirmPin) return alert('رقما الدخول غير متطابقين')
    setSaving(true)
    try {
      const data: any = { name: form.name.trim(), role: form.role, isActive: form.isActive }
      if (form.pin) data.pin = form.pin
      if (initial) await window.api.auth.update({ id: initial.id, ...data })
      else await window.api.auth.create(data)
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'تعديل مستخدم' : 'مستخدم جديد'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="الاسم *">
          <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} required autoFocus />
        </Field>
        <Field label="الوظيفة">
          <select value={form.role} onChange={e => set('role', e.target.value)} className={inputCls}>
            <option value="">-- اختر وظيفة --</option>
            {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
        </Field>
        <Field label={initial ? 'رقم الدخول الجديد (اتركه فارغاً للإبقاء)' : 'رقم الدخول (4 أرقام) *'}>
          <input type="password" value={form.pin}
            onChange={e => set('pin', e.target.value.replace(/\D/g,'').slice(0,4))}
            maxLength={4} className={`${inputCls} tracking-widest text-center`} required={!initial} />
        </Field>
        {form.pin && (
          <Field label="تأكيد رقم الدخول">
            <input type="password" value={form.confirmPin}
              onChange={e => set('confirmPin', e.target.value.replace(/\D/g,'').slice(0,4))}
              maxLength={4} className={`${inputCls} tracking-widest text-center`} />
          </Field>
        )}
        {initial && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} className="rounded" />
            <span className="text-slate-700">حساب نشط</span>
          </label>
        )}
        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}
