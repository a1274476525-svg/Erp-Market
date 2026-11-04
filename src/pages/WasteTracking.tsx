import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { StockMovement, Product } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, PageHeader } from '../components/ui'
import { useSettings } from '../contexts/SettingsContext'

export default function WasteTracking() {
  const [waste, setWaste]       = useState<StockMovement[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [showForm, setShowForm] = useState(false)
  const { settings } = useSettings()

  const load = () => Promise.all([
    window.api.stock.getWaste(),
    window.api.products.getAll(),
  ]).then(([w, p]) => { setWaste(w); setProducts(p) })

  useEffect(() => { load() }, [])

  const totalWasteValue = waste.reduce((s, w) => {
    const product = products.find(p => p.id === w.productId)
    return s + Math.abs(w.quantity) * (product?.costPrice ?? 0)
  }, 0)

  return (
    <div className="p-6">
      <PageHeader title="تسجيل الهدر"
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium">
            <Plus size={16} /> تسجيل هدر
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-red-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-red-600">{waste.length}</div>
          <div className="text-sm text-slate-500 mt-1">إجمالي حالات الهدر</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-600">{totalWasteValue.toFixed(2)} {settings.currency}</div>
          <div className="text-sm text-slate-500 mt-1">قيمة الهدر (بسعر التكلفة)</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">المنتج</th>
              <th className="px-4 py-3 text-center">الكمية</th>
              <th className="px-4 py-3 text-center">قيمة الهدر</th>
              <th className="px-4 py-3 text-right">ملاحظات</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {waste.map(w => {
              const product = products.find(p => p.id === w.productId) ?? w.product
              const value = Math.abs(w.quantity) * (product?.costPrice ?? 0)
              return (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{product?.name ?? `#${w.productId}`}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-red-500 font-semibold">{Math.abs(w.quantity)}</span>
                    <span className="text-xs text-slate-400 mr-1">{product?.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-amber-600 font-medium">{value.toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{w.note ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(w.createdAt).toLocaleString('ar-EG')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {waste.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            <Trash2 size={40} className="mx-auto mb-3 opacity-30" />
            لم يتم تسجيل أي هدر
          </div>
        )}
      </div>

      {showForm && (
        <WasteForm products={products} onSave={() => { setShowForm(false); load() }} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

function WasteForm({ products, onSave, onClose }: {
  products: Product[]; onSave: () => void; onClose: () => void
}) {
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity]   = useState('1')
  const [note, setNote]           = useState('')
  const [saving, setSaving]       = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId || !quantity) return
    setSaving(true)
    try {
      await window.api.stock.waste({ productId: Number(productId), quantity: Number(quantity), note: note || undefined })
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  const selected = products.find(p => p.id === Number(productId))

  return (
    <Modal title="تسجيل هدر" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="المنتج *">
          <select value={productId} onChange={e => setProductId(e.target.value)} className={inputCls} required>
            <option value="">-- اختر منتجاً --</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} (مخزون: {p.currentStock} {p.unit})</option>)}
          </select>
        </Field>
        <Field label="الكمية *">
          <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min={0.01} step={0.01} className={inputCls} required />
        </Field>
        {selected && (
          <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700">
            قيمة الهدر المقدرة: {(Number(quantity) * selected.costPrice).toFixed(2)} ج.م
          </div>
        )}
        <Field label="سبب الهدر">
          <input value={note} onChange={e => setNote(e.target.value)} className={inputCls} placeholder="مثال: انتهاء الصلاحية، تلف..." />
        </Field>
        <SaveCancelButtons saving={saving} onCancel={onClose} saveLabel="تسجيل الهدر" />
      </form>
    </Modal>
  )
}
