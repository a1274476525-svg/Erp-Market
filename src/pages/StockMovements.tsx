import { useState, useEffect } from 'react'
import { ArrowUpDown, Search, SlidersHorizontal } from 'lucide-react'
import type { StockMovement, Product } from '../types'
import { Badge, PageHeader, Modal, Field, inputCls, SaveCancelButtons } from '../components/ui'

const TYPE_MAP: Record<string, { label: string; color: string; sign: string }> = {
  purchase: { label: 'شراء',     color: 'green',   sign: '+' },
  sale:     { label: 'بيع',      color: 'blue',    sign: '-' },
  waste:    { label: 'هدر',      color: 'red',     sign: '-' },
  adjust:   { label: 'تسوية',   color: 'amber',   sign: '±' },
  return:   { label: 'مرتجع',   color: 'purple',  sign: '+' },
  transfer: { label: 'تحويل',   color: 'indigo',  sign: '→' },
}

export default function StockMovements() {
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [products, setProducts]   = useState<Product[]>([])
  const [search, setSearch]       = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [showAdjust, setShowAdjust] = useState(false)

  const load = () => Promise.all([
    window.api.stock.getMovements(),
    window.api.products.getAll(true),
  ]).then(([m, p]) => { setMovements(m); setProducts(p) })

  useEffect(() => { load() }, [])

  const filtered = movements.filter(m => {
    const matchSearch = !search || m.product?.name.toLowerCase().includes(search.toLowerCase())
    const matchType   = !typeFilter || m.type === typeFilter
    const matchProduct = !productFilter || m.productId === Number(productFilter)
    return matchSearch && matchType && matchProduct
  })

  return (
    <div className="p-6">
      <PageHeader title="حركات المخزون"
        action={
          <button onClick={() => setShowAdjust(true)}
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 text-sm font-medium">
            <SlidersHorizontal size={16} /> تسوية يدوية
          </button>
        }
      />

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالمنتج..."
            className="w-full border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={productFilter} onChange={e => setProductFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white min-w-[180px]">
          <option value="">كل المنتجات</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">المنتج</th>
              <th className="px-4 py-3 text-center">النوع</th>
              <th className="px-4 py-3 text-center">الكمية</th>
              <th className="px-4 py-3 text-right">ملاحظات</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(m => {
              const t = TYPE_MAP[m.type] ?? { label: m.type, color: 'slate', sign: '' }
              return (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{m.product?.name ?? `#${m.productId}`}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge label={t.label} color={t.color} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${m.quantity >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {t.sign}{Math.abs(m.quantity)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{m.note ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(m.createdAt).toLocaleString('ar-EG')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            <ArrowUpDown size={40} className="mx-auto mb-3 opacity-30" />
            لا توجد حركات مخزون
          </div>
        )}
      </div>

      {showAdjust && (
        <AdjustModal
          products={products}
          onSave={() => { setShowAdjust(false); load() }}
          onClose={() => setShowAdjust(false)}
        />
      )}
    </div>
  )
}

// ─── Manual Stock Adjustment Modal ────────────────────────────
function AdjustModal({ products, onSave, onClose }: {
  products: Product[]; onSave: () => void; onClose: () => void
}) {
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity]   = useState('')
  const [note, setNote]           = useState('')
  const [saving, setSaving]       = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!productId) return alert('اختر منتجاً')
    const qty = Number(quantity)
    if (!qty) return alert('أدخل كمية غير صفرية (موجبة للزيادة، سالبة للنقص)')
    setSaving(true)
    try {
      await window.api.stock.adjust({ productId: Number(productId), quantity: qty, note: note || null })
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  const product = products.find(p => p.id === Number(productId))

  return (
    <Modal title="تسوية مخزون يدوية" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="المنتج *">
          <select value={productId} onChange={e => setProductId(e.target.value)} className={inputCls} autoFocus>
            <option value="">-- اختر منتجاً --</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>

        {product && (
          <div className="bg-slate-50 rounded-lg p-3 text-sm flex justify-between">
            <span className="text-slate-500">المخزون الحالي</span>
            <span className="font-semibold text-slate-800">{product.currentStock ?? 0} وحدة</span>
          </div>
        )}

        <Field label="الكمية (موجبة = زيادة، سالبة = نقص) *">
          <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
            className={inputCls} placeholder="مثال: 10 أو -5" step={0.01} />
        </Field>

        {product && quantity && Number(quantity) !== 0 && (
          <div className={`text-sm rounded-lg p-2 text-center font-medium ${Number(quantity) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            المخزون بعد التسوية: {((product.currentStock ?? 0) + Number(quantity)).toFixed(2)} وحدة
          </div>
        )}

        <Field label="سبب التسوية">
          <input value={note} onChange={e => setNote(e.target.value)} className={inputCls} placeholder="اختياري" />
        </Field>

        <SaveCancelButtons saving={saving} onCancel={onClose} saveLabel="تطبيق التسوية" />
      </form>
    </Modal>
  )
}
