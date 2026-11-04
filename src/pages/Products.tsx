import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight, Package, Image, Clock, X } from 'lucide-react'
import type { Product, Category, PriceHistory } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, DeleteConfirm, Badge, PageHeader } from '../components/ui'
import { useSettings } from '../contexts/SettingsContext'

const UNITS = ['قطعة', 'كيلو', 'جرام', 'لتر', 'مل', 'علبة', 'كرتون', 'دزينة', 'متر']

export default function Products() {
  const [products, setProducts]     = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Product | null>(null)
  const [deleting, setDeleting]     = useState<Product | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [priceHistoryProduct, setPriceHistoryProduct] = useState<Product | null>(null)
  const { settings } = useSettings()

  const load = async () => {
    await window.api.warehouses.init()
    const [p, c] = await Promise.all([
      window.api.products.getAll(showInactive),
      window.api.categories.getAll(),
    ])
    setProducts(p)
    setCategories(c)
  }

  useEffect(() => { load() }, [showInactive])

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search) || p.sku?.includes(search)
    const matchCat = !catFilter || p.categoryId === Number(catFilter)
    return matchSearch && matchCat
  })

  async function handleDelete() {
    if (!deleting) return
    await window.api.products.delete(deleting.id)
    setDeleting(null)
    load()
  }

  async function toggleActive(product: Product) {
    await window.api.products.update({ id: product.id, isActive: !product.isActive })
    load()
  }

  return (
    <div className="p-6">
      <PageHeader title="المنتجات"
        action={
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16} /> منتج جديد
          </button>
        }
      />

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الباركود أو SKU..."
            className={`${inputCls} pr-9`} />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
          <option value="">كل الأصناف</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
          عرض غير النشطة
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">المنتج</th>
              <th className="px-4 py-3 text-right">الصنف</th>
              <th className="px-4 py-3 text-right">الباركود</th>
              <th className="px-4 py-3 text-center">المخزون</th>
              <th className="px-4 py-3 text-center">سعر التكلفة</th>
              <th className="px-4 py-3 text-center">سعر البيع</th>
              <th className="px-4 py-3 text-center">الحالة</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(product => (
              <tr key={product.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {product.imagePath ? (
                      <ProductThumb imagePath={product.imagePath} />
                    ) : (
                      <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-300">
                        <Package size={14} />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-slate-800">{product.name}</div>
                      <div className="text-xs text-slate-400">{product.sku}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{product.category?.name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{product.barcode ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-semibold ${product.currentStock <= product.minStockAlert && product.minStockAlert > 0 ? 'text-red-500' : 'text-slate-700'}`}>
                    {product.currentStock}
                  </span>
                  <span className="text-xs text-slate-400 mr-1">{product.unit}</span>
                </td>
                <td className="px-4 py-3 text-center text-slate-600">{product.costPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-center font-semibold text-emerald-600">{product.sellingPrice.toFixed(2)} {settings.currency}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActive(product)}>
                    {product.isActive
                      ? <Badge label="نشط" color="emerald" />
                      : <Badge label="غير نشط" color="slate" />}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    <button onClick={() => setPriceHistoryProduct(product)} title="تاريخ الأسعار"
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                      <Clock size={14} />
                    </button>
                    <button onClick={() => { setEditing(product); setShowForm(true) }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => setDeleting(product)}
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
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            لا توجد منتجات
          </div>
        )}
      </div>

      {showForm && (
        <ProductForm
          initial={editing}
          categories={categories}
          onSave={() => { setShowForm(false); load() }}
          onClose={() => setShowForm(false)}
        />
      )}

      {deleting && (
        <DeleteConfirm
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          message={`هل تريد حذف "${deleting.name}"؟`}
        />
      )}

      {priceHistoryProduct && (
        <PriceHistoryModal
          product={priceHistoryProduct}
          currency={settings.currency}
          onClose={() => setPriceHistoryProduct(null)}
        />
      )}
    </div>
  )
}

// ─── Thumbnail: loads image data via IPC ──────────────────────
function ProductThumb({ imagePath }: { imagePath: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    window.api.products.getImageData(imagePath).then(setSrc)
  }, [imagePath])
  if (!src) return <div className="w-8 h-8 bg-slate-100 rounded animate-pulse" />
  return <img src={src} alt="" className="w-8 h-8 rounded object-cover border border-slate-200" />
}

// ─── Price History Modal ───────────────────────────────────────
function PriceHistoryModal({ product, currency, onClose }: {
  product: Product; currency: string; onClose: () => void
}) {
  const [history, setHistory] = useState<PriceHistory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.products.getPriceHistory(product.id)
      .then(h => { setHistory(h); setLoading(false) })
  }, [product.id])

  return (
    <Modal title={`تاريخ أسعار التكلفة — ${product.name}`} onClose={onClose} maxWidth="max-w-md">
      {loading ? (
        <div className="text-center py-8 text-slate-400 text-sm">جاري التحميل...</div>
      ) : history.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          <Clock size={32} className="mx-auto mb-2 opacity-30" />
          لا يوجد تاريخ أسعار — السعر الحالي: <strong>{product.costPrice.toFixed(2)} {currency}</strong>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="bg-emerald-50 rounded-lg px-4 py-2 text-sm text-emerald-700 font-medium">
            السعر الحالي: {product.costPrice.toFixed(2)} {currency}
          </div>
          <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-right text-xs text-slate-500">التاريخ</th>
                  <th className="px-4 py-2 text-center text-xs text-slate-500">سعر التكلفة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h, i) => (
                  <tr key={h.id} className={i === 0 ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {new Date(h.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-2 text-center font-semibold text-slate-700">
                      {h.costPrice.toFixed(2)} {currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 text-center">يُسجَّل تلقائياً عند تغيير سعر التكلفة</p>
        </div>
      )}
    </Modal>
  )
}

// ─── Product Form ──────────────────────────────────────────────
function ProductForm({ initial, categories, onSave, onClose }: {
  initial: Product | null
  categories: Category[]
  onSave: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    barcode: initial?.barcode ?? '',
    sku: initial?.sku ?? '',
    categoryId: initial?.categoryId?.toString() ?? '',
    unit: initial?.unit ?? 'قطعة',
    costPrice: initial?.costPrice.toString() ?? '0',
    sellingPrice: initial?.sellingPrice.toString() ?? '0',
    wholesalePrice: initial?.wholesalePrice?.toString() ?? '',
    minStockAlert: initial?.minStockAlert.toString() ?? '0',
    reorderLevel: initial?.reorderLevel.toString() ?? '0',
    currentStock: initial?.currentStock.toString() ?? '0',
    conversionFactor: initial?.conversionFactor?.toString() ?? '1',
  })
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (initial?.imagePath) {
      window.api.products.getImageData(initial.imagePath).then(setImageSrc)
    }
  }, [initial?.imagePath])

  async function selectImage() {
    if (!initial) return alert('احفظ المنتج أولاً ثم أضف الصورة')
    const path = await window.api.products.selectImage(initial.id)
    if (path) {
      const data = await window.api.products.getImageData(path)
      setImageSrc(data)
    }
  }

  async function removeImage() {
    if (!initial) return
    await window.api.products.removeImage(initial.id)
    setImageSrc(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return alert('اسم المنتج مطلوب')
    setSaving(true)
    const data = {
      name: form.name.trim(),
      barcode: form.barcode || null,
      sku: form.sku || null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      unit: form.unit,
      costPrice: Number(form.costPrice),
      sellingPrice: Number(form.sellingPrice),
      wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : null,
      minStockAlert: Number(form.minStockAlert),
      reorderLevel: Number(form.reorderLevel),
      conversionFactor: Number(form.conversionFactor) || 1,
      ...(initial ? {} : { currentStock: Number(form.currentStock) }),
    }
    try {
      if (initial) await window.api.products.update({ id: initial.id, ...data })
      else await window.api.products.create(data)
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'تعديل منتج' : 'منتج جديد'} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        {/* Image */}
        {initial && (
          <div className="flex items-center gap-4">
            {imageSrc ? (
              <div className="relative">
                <img src={imageSrc} alt="" className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
                <button type="button" onClick={removeImage}
                  className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                  <X size={10} />
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300 border-2 border-dashed border-slate-200">
                <Image size={24} />
              </div>
            )}
            <button type="button" onClick={selectImage}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              <Image size={14} /> {imageSrc ? 'تغيير الصورة' : 'رفع صورة'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="اسم المنتج *">
            <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} required />
          </Field>
          <Field label="الصنف">
            <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)} className={inputCls}>
              <option value="">بدون صنف</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="الباركود">
            <input value={form.barcode} onChange={e => set('barcode', e.target.value)} className={inputCls} placeholder="اختياري" />
          </Field>
          <Field label="وحدة القياس">
            <select value={form.unit} onChange={e => set('unit', e.target.value)} className={inputCls}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="سعر التكلفة">
            <input type="number" step="0.01" value={form.costPrice} onChange={e => set('costPrice', e.target.value)} className={inputCls} min={0} />
          </Field>
          <Field label="سعر البيع *">
            <input type="number" step="0.01" value={form.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} className={inputCls} min={0} required />
          </Field>
          <Field label="سعر الجملة">
            <input type="number" step="0.01" value={form.wholesalePrice} onChange={e => set('wholesalePrice', e.target.value)} className={inputCls} min={0} placeholder="اختياري" />
          </Field>
          {!initial && (
            <Field label="المخزون الحالي">
              <input type="number" step="0.01" value={form.currentStock} onChange={e => set('currentStock', e.target.value)} className={inputCls} min={0} />
            </Field>
          )}
          <Field label="تنبيه الحد الأدنى">
            <input type="number" step="0.01" value={form.minStockAlert} onChange={e => set('minStockAlert', e.target.value)} className={inputCls} min={0} />
          </Field>
          <Field label="مستوى إعادة الطلب">
            <input type="number" step="0.01" value={form.reorderLevel} onChange={e => set('reorderLevel', e.target.value)} className={inputCls} min={0} />
          </Field>
          <Field label="معامل التحويل">
            <input type="number" step="0.001" value={form.conversionFactor} onChange={e => set('conversionFactor', e.target.value)} className={inputCls} min={0.001} />
          </Field>
        </div>
        {initial && form.sellingPrice && form.costPrice && Number(form.sellingPrice) > 0 && (
          <div className="bg-emerald-50 rounded-lg p-3 text-sm text-emerald-700">
            هامش الربح: {(((Number(form.sellingPrice) - Number(form.costPrice)) / Number(form.sellingPrice)) * 100).toFixed(1)}%
            &nbsp;|&nbsp; الربح: {(Number(form.sellingPrice) - Number(form.costPrice)).toFixed(2)}
          </div>
        )}
        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}
