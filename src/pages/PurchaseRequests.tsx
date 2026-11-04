import { useState, useEffect } from 'react'
import { Plus, Eye, Trash2, ClipboardList } from 'lucide-react'
import type { PurchaseRequest, Supplier, Product } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, DeleteConfirm, Badge, PageHeader } from '../components/ui'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: 'معلق',     color: 'amber' },
  approved:  { label: 'موافق عليه', color: 'blue' },
  ordered:   { label: 'تم الطلب', color: 'purple' },
  completed: { label: 'مكتمل',   color: 'green' },
  cancelled: { label: 'ملغي',    color: 'red' },
}

export default function PurchaseRequests() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [viewing, setViewing]   = useState<PurchaseRequest | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState<PurchaseRequest | null>(null)

  const load = () => Promise.all([
    window.api.purchaseRequests.getAll(),
    window.api.suppliers.getAll(),
    window.api.products.getAll(),
  ]).then(([r, s, p]) => { setRequests(r); setSuppliers(s); setProducts(p) })

  useEffect(() => { load() }, [])

  async function updateStatus(id: number, status: string) {
    await window.api.purchaseRequests.updateStatus({ id, status })
    load()
  }

  async function handleDelete() {
    if (!deleting) return
    await window.api.purchaseRequests.delete(deleting.id)
    setDeleting(null)
    load()
  }

  return (
    <div className="p-6">
      <PageHeader title="طلبات الشراء"
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16} /> طلب شراء جديد
          </button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">المورد</th>
              <th className="px-4 py-3 text-center">الأصناف</th>
              <th className="px-4 py-3 text-center">الحالة</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map(req => {
              const st = STATUS_MAP[req.status] ?? { label: req.status, color: 'slate' }
              return (
                <tr key={req.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{req.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{req.items.length}</td>
                  <td className="px-4 py-3 text-center"><Badge label={st.label} color={st.color} /></td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(req.requestDate).toLocaleDateString('ar-EG')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => setViewing(req)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Eye size={14} />
                      </button>
                      {req.status === 'pending' && (
                        <>
                          <button onClick={() => updateStatus(req.id, 'approved')}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">موافقة</button>
                          <button onClick={() => updateStatus(req.id, 'cancelled')}
                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">إلغاء</button>
                        </>
                      )}
                      {req.status === 'approved' && (
                        <button onClick={() => updateStatus(req.id, 'ordered')}
                          className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">تم الطلب</button>
                      )}
                      {req.status === 'ordered' && (
                        <button onClick={() => updateStatus(req.id, 'completed')}
                          className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200">مكتمل</button>
                      )}
                      <button onClick={() => setDeleting(req)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {requests.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
            لا توجد طلبات شراء
          </div>
        )}
      </div>

      {viewing && (
        <Modal title="تفاصيل طلب الشراء" onClose={() => setViewing(null)}>
          <div className="space-y-3 text-sm">
            <div><span className="text-slate-500">المورد: </span><span>{viewing.supplier?.name ?? '—'}</span></div>
            <div><span className="text-slate-500">الحالة: </span><Badge label={STATUS_MAP[viewing.status]?.label ?? viewing.status} color={STATUS_MAP[viewing.status]?.color} /></div>
            {viewing.notes && <p className="text-slate-500">{viewing.notes}</p>}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-right">المنتج</th>
                    <th className="px-3 py-2 text-center">الكمية المطلوبة</th>
                    <th className="px-3 py-2 text-right">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewing.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.product?.name ?? `#${item.productId}`}</td>
                      <td className="px-3 py-2 text-center">{item.quantity}</td>
                      <td className="px-3 py-2 text-slate-400">{item.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {showForm && (
        <RequestForm suppliers={suppliers} products={products}
          onSave={() => { setShowForm(false); load() }} onClose={() => setShowForm(false)} />
      )}

      {deleting && (
        <DeleteConfirm onConfirm={handleDelete} onCancel={() => setDeleting(null)} message="هل تريد حذف طلب الشراء؟" />
      )}
    </div>
  )
}

function RequestForm({ suppliers, products, onSave, onClose }: {
  suppliers: Supplier[]; products: Product[]; onSave: () => void; onClose: () => void
}) {
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes]           = useState('')
  const [items, setItems]           = useState<{ productId: number; productName: string; quantity: number; notes: string }[]>([])
  const [addProductId, setAddProductId] = useState('')
  const [saving, setSaving]         = useState(false)

  function addItem() {
    const product = products.find(p => p.id === Number(addProductId))
    if (!product || items.find(i => i.productId === product.id)) return
    setItems(prev => [...prev, { productId: product.id, productName: product.name, quantity: 1, notes: '' }])
    setAddProductId('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) return alert('أضف منتجاً واحداً على الأقل')
    setSaving(true)
    try {
      await window.api.purchaseRequests.create({
        supplierId: supplierId ? Number(supplierId) : null,
        notes: notes || null,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity, notes: i.notes || null })),
      })
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title="طلب شراء جديد" onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <Field label="المورد">
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inputCls}>
            <option value="">بدون مورد محدد</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>

        <div className="flex gap-2">
          <select value={addProductId} onChange={e => setAddProductId(e.target.value)} className={`${inputCls} flex-1`}>
            <option value="">-- اختر منتجاً --</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} (مخزون: {p.currentStock} {p.unit})</option>)}
          </select>
          <button type="button" onClick={addItem}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"><Plus size={16} /></button>
        </div>

        {items.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-right">المنتج</th>
                  <th className="px-3 py-2 text-center">الكمية</th>
                  <th className="px-3 py-2 text-right">ملاحظات</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">{item.productName}</td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.quantity} min={1}
                        onChange={e => setItems(prev => prev.map((i, n) => n === idx ? { ...i, quantity: Number(e.target.value) } : i))}
                        className="w-16 border rounded px-1.5 py-1 text-center text-xs" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={item.notes}
                        onChange={e => setItems(prev => prev.map((i, n) => n === idx ? { ...i, notes: e.target.value } : i))}
                        className="w-full border rounded px-1.5 py-1 text-xs" />
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setItems(prev => prev.filter((_, n) => n !== idx))}
                        className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Field label="ملاحظات عامة">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} />
        </Field>
        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}
