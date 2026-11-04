import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, GitBranch, Package } from 'lucide-react'
import type { Branch, Warehouse } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, DeleteConfirm, Badge, PageHeader } from '../components/ui'

export default function Branches() {
  const [branches, setBranches]     = useState<Branch[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [showWarehouseForm, setShowWarehouseForm] = useState(false)
  const [editingBranch, setEditingBranch]   = useState<Branch | null>(null)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [deletingBranch, setDeletingBranch]   = useState<Branch | null>(null)
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null)

  const load = async () => {
    await window.api.warehouses.init()
    const [b, w] = await Promise.all([window.api.branches.getAll(), window.api.warehouses.getAll()])
    setBranches(b)
    setWarehouses(w)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6">
      <PageHeader title="الفروع والمخازن"
        action={
          <div className="flex gap-2">
            <button onClick={() => { setEditingWarehouse(null); setShowWarehouseForm(true) }}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
              <Plus size={16} /> مخزن جديد
            </button>
            <button onClick={() => { setEditingBranch(null); setShowBranchForm(true) }}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
              <Plus size={16} /> فرع جديد
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-6">
        {/* Branches */}
        <div>
          <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <GitBranch size={16} className="text-emerald-500" /> الفروع
          </h2>
          <div className="space-y-3">
            {branches.map(b => (
              <div key={b.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-slate-800">{b.name}</div>
                    <div className="text-xs text-slate-400 mt-1">{b.warehouses?.length ?? 0} مخزن</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.isDefault && <Badge label="رئيسي" color="emerald" />}
                    {!b.isDefault && (
                      <button onClick={() => window.api.branches.setDefault(b.id).then(load).catch((error: any) => alert(error.message || 'تعذر تغيير الفرع الرئيسي'))}
                        className="text-xs px-2 py-1 text-emerald-600 hover:bg-emerald-50 rounded">
                        تعيين كفرع رئيسي
                      </button>
                    )}
                    <button onClick={() => { setEditingBranch(b); setShowBranchForm(true) }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeletingBranch(b)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Warehouses */}
        <div>
          <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Package size={16} className="text-blue-500" /> المخازن
          </h2>
          <div className="space-y-3">
            {warehouses.map(w => (
              <div key={w.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-slate-800">{w.name}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {w.branch?.name} · {(w.stocks ?? []).reduce((sum: number, stock: any) => sum + stock.quantity, 0).toLocaleString('ar-EG')} وحدة مخزنية
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {w.isDefault && <Badge label="افتراضي" color="blue" />}
                    <button onClick={() => window.api.warehouses.setDefault(w.id).then(load).catch((error: any) => alert(error.message || 'تعذر تغيير المخزن الافتراضي'))}
                      className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded">
                      {!w.isDefault && 'تعيين افتراضي'}
                    </button>
                    <button onClick={() => window.api.warehouses.syncStock(w.id).then(load)}
                      className="text-xs px-2 py-1 text-emerald-600 hover:bg-emerald-50 rounded">
                      مزامنة
                    </button>
                    <button onClick={() => { setEditingWarehouse(w); setShowWarehouseForm(true) }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeletingWarehouse(w)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showBranchForm && (
        <BranchForm initial={editingBranch}
          onSave={() => { setShowBranchForm(false); load() }}
          onClose={() => setShowBranchForm(false)} />
      )}
      {showWarehouseForm && (
        <WarehouseForm initial={editingWarehouse} branches={branches}
          onSave={() => { setShowWarehouseForm(false); load() }}
          onClose={() => setShowWarehouseForm(false)} />
      )}
      {deletingBranch && (
        <DeleteConfirm
          onConfirm={async () => { await window.api.branches.delete(deletingBranch.id); setDeletingBranch(null); load() }}
          onCancel={() => setDeletingBranch(null)}
          message={`هل تريد حذف فرع "${deletingBranch.name}"؟`}
        />
      )}
      {deletingWarehouse && (
        <DeleteConfirm
          onConfirm={async () => { await window.api.warehouses.delete(deletingWarehouse.id); setDeletingWarehouse(null); load() }}
          onCancel={() => setDeletingWarehouse(null)}
          message={`هل تريد حذف مخزن "${deletingWarehouse.name}"؟`}
        />
      )}
    </div>
  )
}

function BranchForm({ initial, onSave, onClose }: {
  initial: Branch | null; onSave: () => void; onClose: () => void
}) {
  const [name, setName]     = useState(initial?.name ?? '')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      if (initial) await window.api.branches.update({ id: initial.id, name: name.trim() })
      else await window.api.branches.create({ name: name.trim() })
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'تعديل فرع' : 'فرع جديد'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="اسم الفرع *">
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} required autoFocus />
        </Field>
        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}

function WarehouseForm({ initial, branches, onSave, onClose }: {
  initial: Warehouse | null; branches: Branch[]; onSave: () => void; onClose: () => void
}) {
  const [name, setName]         = useState(initial?.name ?? '')
  const [branchId, setBranchId] = useState(initial?.branchId.toString() ?? '')
  const [saving, setSaving]     = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !branchId) return
    setSaving(true)
    try {
      if (initial) await window.api.warehouses.update({ id: initial.id, name: name.trim(), branchId: Number(branchId) })
      else await window.api.warehouses.create({ name: name.trim(), branchId: Number(branchId) })
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'تعديل مخزن' : 'مخزن جديد'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="اسم المخزن *">
          <input value={name} onChange={e => setName(e.target.value)} className={inputCls} required autoFocus />
        </Field>
        <Field label="الفرع *">
          <select value={branchId} onChange={e => setBranchId(e.target.value)} className={inputCls} required>
            <option value="">-- اختر فرعاً --</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}
