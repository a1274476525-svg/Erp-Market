import { useState, useEffect } from 'react'
import { Plus, Eye, Trash2, CheckCircle, ClipboardCheck, X } from 'lucide-react'
import type { InventoryCount, Product } from '../types'
import { Modal, DeleteConfirm, Badge, PageHeader } from '../components/ui'

export default function InventoryCountPage() {
  const [counts, setCounts]     = useState<InventoryCount[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [viewing, setViewing]   = useState<InventoryCount | null>(null)
  const [deleting, setDeleting] = useState<InventoryCount | null>(null)

  const load = () => Promise.all([
    window.api.inventory.getAll(),
    window.api.products.getAll(),
  ]).then(([c, p]) => { setCounts(c); setProducts(p) })

  useEffect(() => { load() }, [])

  async function createCount() {
    const count = await window.api.inventory.create()
    await window.api.inventory.addItems({ inventoryCountId: count.id, productIds: products.map(p => p.id) })
    load()
  }

  async function closeCount(id: number) {
    await window.api.inventory.close(id)
    load()
  }

  async function handleDelete() {
    if (!deleting) return
    await window.api.inventory.delete(deleting.id)
    setDeleting(null)
    load()
  }

  return (
    <div className="p-6">
      <PageHeader title="جرد المخزون"
        action={
          <button onClick={createCount}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16} /> جرد جديد
          </button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">رقم المرجع</th>
              <th className="px-4 py-3 text-center">عدد الأصناف</th>
              <th className="px-4 py-3 text-center">الحالة</th>
              <th className="px-4 py-3 text-right">تاريخ الإنشاء</th>
              <th className="px-4 py-3 text-right">تاريخ الإغلاق</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {counts.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-medium text-slate-700">{c.referenceNumber}</td>
                <td className="px-4 py-3 text-center text-slate-600">{c.items.length}</td>
                <td className="px-4 py-3 text-center">
                  {c.status === 'closed' ? <Badge label="مغلق" color="green" /> : <Badge label="مسودة" color="amber" />}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{new Date(c.createdAt).toLocaleDateString('ar-EG')}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {c.closedAt ? new Date(c.closedAt).toLocaleDateString('ar-EG') : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => setViewing(c)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Eye size={14} />
                    </button>
                    {c.status === 'draft' && (
                      <button onClick={() => closeCount(c.id)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button onClick={() => setDeleting(c)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {counts.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            <ClipboardCheck size={40} className="mx-auto mb-3 opacity-30" />
            لم يتم إجراء أي جرد بعد
          </div>
        )}
      </div>

      {viewing && (
        <InventoryCountDetail
          count={viewing}
          onUpdate={load}
          onClose={() => setViewing(null)}
        />
      )}
      {deleting && (
        <DeleteConfirm onConfirm={handleDelete} onCancel={() => setDeleting(null)}
          message={`هل تريد حذف جرد ${deleting.referenceNumber}؟`} />
      )}
    </div>
  )
}

function InventoryCountDetail({ count, onUpdate, onClose }: {
  count: InventoryCount; onUpdate: () => void; onClose: () => void
}) {
  const [items, setItems] = useState(count.items)

  async function updateQty(id: number, actualQuantity: number) {
    await window.api.inventory.updateItem({ id, actualQuantity })
    setItems(prev => prev.map(i => i.id === id ? { ...i, actualQuantity } : i))
    onUpdate()
  }

  async function removeItem(id: number) {
    await window.api.inventory.removeItem(id)
    setItems(prev => prev.filter(i => i.id !== id))
    onUpdate()
  }

  const totalDiff = items.reduce((s, i) => s + (i.actualQuantity - i.systemQuantity), 0)

  return (
    <Modal title={`جرد ${count.referenceNumber}`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-3">
        <div className={`text-sm rounded-lg p-3 ${totalDiff > 0 ? 'bg-emerald-50 text-emerald-700' : totalDiff < 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'}`}>
          الفرق الإجمالي: {totalDiff > 0 ? '+' : ''}{totalDiff.toFixed(2)}
          <span className="text-xs mr-2 opacity-70">({items.length} صنف)</span>
        </div>
        <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-right">المنتج</th>
                <th className="px-3 py-2 text-center">الكمية في النظام</th>
                <th className="px-3 py-2 text-center">الكمية الفعلية</th>
                <th className="px-3 py-2 text-center">الفرق</th>
                {count.status === 'draft' && <th className="px-3 py-2 w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => {
                const diff = item.actualQuantity - item.systemQuantity
                return (
                  <tr key={item.id} className={diff !== 0 ? 'bg-amber-50' : ''}>
                    <td className="px-3 py-2 font-medium">{item.product?.name ?? `#${item.productId}`}</td>
                    <td className="px-3 py-2 text-center text-slate-500">{item.systemQuantity}</td>
                    <td className="px-3 py-2 text-center">
                      {count.status === 'draft' ? (
                        <input type="number" value={item.actualQuantity} min={0} step={0.01}
                          onChange={e => updateQty(item.id, Number(e.target.value))}
                          className="w-20 border rounded px-1.5 py-1 text-center" />
                      ) : (
                        <span>{item.actualQuantity}</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-center font-semibold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                    </td>
                    {count.status === 'draft' && (
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => removeItem(item.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors">
                          <X size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}
