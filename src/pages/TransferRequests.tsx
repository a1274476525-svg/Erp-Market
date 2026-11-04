import { useState, useEffect } from 'react'
import { Plus, Eye, Trash2, Send } from 'lucide-react'
import type { TransferRequest, Warehouse, Product } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, DeleteConfirm, Badge, PageHeader } from '../components/ui'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:    { label: 'معلق',       color: 'amber' },
  approved:   { label: 'موافق عليه', color: 'blue' },
  rejected:   { label: 'مرفوض',     color: 'red' },
  transferred:{ label: 'منفذ',      color: 'green' },
}

export default function TransferRequests() {
  const [requests, setRequests]   = useState<TransferRequest[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts]   = useState<Product[]>([])
  const [viewing, setViewing]     = useState<TransferRequest | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [deleting, setDeleting]   = useState<TransferRequest | null>(null)

  const load = () => Promise.all([
    window.api.transferRequests.getAll(),
    window.api.warehouses.getAll(),
    window.api.products.getAll(),
  ]).then(([r, w, p]) => { setRequests(r); setWarehouses(w); setProducts(p) })

  useEffect(() => { load() }, [])

  async function updateStatus(id: number, status: string) {
    await window.api.transferRequests.updateStatus({ id, status })
    load()
  }

  async function executeTransfer(req: TransferRequest) {
    await window.api.transfers.execute(req.id)
    load()
  }

  return (
    <div className="p-6">
      <PageHeader title="طلبات التحويل"
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16} /> طلب تحويل جديد
          </button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">المرجع</th>
              <th className="px-4 py-3 text-right">من</th>
              <th className="px-4 py-3 text-right">إلى</th>
              <th className="px-4 py-3 text-center">الأصناف</th>
              <th className="px-4 py-3 text-center">الحالة</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map(req => {
              const st = STATUS_MAP[req.status] ?? { label: req.status, color: 'slate' }
              return (
                <tr key={req.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-medium text-slate-700">{req.referenceNumber}</td>
                  <td className="px-4 py-3 text-slate-600">{req.fromWarehouse?.name}</td>
                  <td className="px-4 py-3 text-slate-600">{req.toWarehouse?.name}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{req.items.length}</td>
                  <td className="px-4 py-3 text-center"><Badge label={st.label} color={st.color} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1 flex-wrap">
                      <button onClick={() => setViewing(req)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Eye size={14} />
                      </button>
                      {req.status === 'pending' && (
                        <>
                          <button onClick={() => updateStatus(req.id, 'approved')}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">موافقة</button>
                          <button onClick={() => updateStatus(req.id, 'rejected')}
                            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">رفض</button>
                        </>
                      )}
                      {req.status === 'approved' && !req.transfer && (
                        <button onClick={() => executeTransfer(req)}
                          className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">تنفيذ</button>
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
            <Send size={40} className="mx-auto mb-3 opacity-30" />
            لا توجد طلبات تحويل
          </div>
        )}
      </div>

      {viewing && (
        <Modal title={`طلب تحويل ${viewing.referenceNumber}`} onClose={() => setViewing(null)}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-slate-500">من: </span><span>{viewing.fromWarehouse?.name}</span></div>
              <div><span className="text-slate-500">إلى: </span><span>{viewing.toWarehouse?.name}</span></div>
            </div>
            {viewing.note && <p className="text-slate-500">{viewing.note}</p>}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-right">المنتج</th>
                    <th className="px-3 py-2 text-center">الكمية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewing.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.product?.name ?? `#${item.productId}`}</td>
                      <td className="px-3 py-2 text-center">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {showForm && (
        <TransferRequestForm warehouses={warehouses} products={products}
          onSave={() => { setShowForm(false); load() }} onClose={() => setShowForm(false)} />
      )}

      {deleting && (
        <DeleteConfirm
          onConfirm={async () => { await window.api.transferRequests.delete(deleting.id); setDeleting(null); load() }}
          onCancel={() => setDeleting(null)} message="هل تريد حذف طلب التحويل؟" />
      )}
    </div>
  )
}

function TransferRequestForm({ warehouses, products, onSave, onClose }: {
  warehouses: Warehouse[]; products: Product[]; onSave: () => void; onClose: () => void
}) {
  const [fromWarehouseId, setFrom] = useState('')
  const [toWarehouseId, setTo]     = useState('')
  const [note, setNote]            = useState('')
  const [items, setItems]          = useState<{ productId: number; productName: string; quantity: number }[]>([])
  const [addProductId, setAddProductId] = useState('')
  const [saving, setSaving]        = useState(false)

  function addItem() {
    const product = products.find(p => p.id === Number(addProductId))
    if (!product || items.find(i => i.productId === product.id)) return
    setItems(prev => [...prev, { productId: product.id, productName: product.name, quantity: 1 }])
    setAddProductId('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!fromWarehouseId || !toWarehouseId || items.length === 0) return alert('اكمل البيانات المطلوبة')
    if (fromWarehouseId === toWarehouseId) return alert('لا يمكن التحويل من وإلى نفس المخزن')
    setSaving(true)
    try {
      await window.api.transferRequests.create({
        fromWarehouseId: Number(fromWarehouseId),
        toWarehouseId: Number(toWarehouseId),
        note: note || null,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      })
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title="طلب تحويل جديد" onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="من مخزن *">
            <select value={fromWarehouseId} onChange={e => setFrom(e.target.value)} className={inputCls} required>
              <option value="">-- اختر --</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label="إلى مخزن *">
            <select value={toWarehouseId} onChange={e => setTo(e.target.value)} className={inputCls} required>
              <option value="">-- اختر --</option>
              {warehouses.filter(w => w.id !== Number(fromWarehouseId)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="flex gap-2">
          <select value={addProductId} onChange={e => setAddProductId(e.target.value)} className={`${inputCls} flex-1`}>
            <option value="">-- اختر منتجاً --</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="button" onClick={addItem}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"><Plus size={16} /></button>
        </div>

        {items.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-right">المنتج</th>
                  <th className="px-3 py-2 text-center">الكمية</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">{item.productName}</td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.quantity} min={0.01} step={0.01}
                        onChange={e => setItems(prev => prev.map((i, n) => n === idx ? { ...i, quantity: Number(e.target.value) } : i))}
                        className="w-20 border rounded px-1.5 py-1 text-center text-xs" />
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

        <Field label="ملاحظات">
          <input value={note} onChange={e => setNote(e.target.value)} className={inputCls} />
        </Field>
        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}
