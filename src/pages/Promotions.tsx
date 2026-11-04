import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Tag, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Promotion, Product } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, DeleteConfirm, Badge, PageHeader } from '../components/ui'

export default function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [products, setProducts]     = useState<Product[]>([])
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Promotion | null>(null)
  const [deleting, setDeleting]     = useState<Promotion | null>(null)

  const load = () => Promise.all([
    window.api.promotions.getAll(),
    window.api.products.getAll(),
  ]).then(([pr, p]) => { setPromotions(pr); setProducts(p) })

  useEffect(() => { load() }, [])

  async function handleDelete() {
    if (!deleting) return
    await window.api.promotions.delete(deleting.id)
    setDeleting(null)
    load()
  }

  const now = new Date()

  return (
    <div className="p-6">
      <PageHeader title="العروض والخصومات"
        action={
          <button onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16} /> عرض جديد
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {promotions.map(promo => {
          const isExpired = new Date(promo.endDate) < now
          const isScheduled = new Date(promo.startDate) > now
          return (
            <div key={promo.id} className={`bg-white rounded-xl p-5 shadow-sm border-2 ${promo.isActive && !isExpired ? 'border-emerald-200' : 'border-slate-100'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">{promo.name}</h3>
                  <div className="flex gap-2 mt-1">
                    {promo.isActive && !isExpired ? <Badge label="نشط" color="emerald" /> :
                     isExpired ? <Badge label="منتهي" color="red" /> :
                     isScheduled ? <Badge label="مجدول" color="blue" /> :
                     <Badge label="معطل" color="slate" />}
                    <Badge
                      label={promo.discountType === 'percentage' ? `${promo.discountValue}%` : `${promo.discountValue} ج.م`}
                      color="purple"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => window.api.promotions.toggle(promo.id).then(load)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                    {promo.isActive ? <ToggleRight size={16} className="text-emerald-600" /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => { setEditing(promo); setShowForm(true) }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleting(promo)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div>من {new Date(promo.startDate).toLocaleDateString('ar-EG')} إلى {new Date(promo.endDate).toLocaleDateString('ar-EG')}</div>
                {promo.applyToAll ? (
                  <div className="text-emerald-600">يطبق على جميع المنتجات</div>
                ) : (
                  <div>{promo.products.length} منتج</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {promotions.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          <Tag size={40} className="mx-auto mb-3 opacity-30" />
          لا توجد عروض بعد
        </div>
      )}

      {showForm && (
        <PromotionForm
          initial={editing}
          products={products}
          onSave={() => { setShowForm(false); load() }}
          onClose={() => setShowForm(false)}
        />
      )}
      {deleting && (
        <DeleteConfirm onConfirm={handleDelete} onCancel={() => setDeleting(null)}
          message={`هل تريد حذف عرض "${deleting.name}"؟`} />
      )}
    </div>
  )
}

function PromotionForm({ initial, products, onSave, onClose }: {
  initial: Promotion | null; products: Product[]; onSave: () => void; onClose: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    discountType: initial?.discountType ?? 'percentage',
    discountValue: initial?.discountValue.toString() ?? '10',
    startDate: initial?.startDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    endDate: initial?.endDate?.slice(0, 10) ?? '',
    applyToAll: initial?.applyToAll ?? false,
  })
  const [selectedProducts, setSelectedProducts] = useState<number[]>(
    initial?.products.map(p => p.productId) ?? []
  )
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function toggleProduct(id: number) {
    setSelectedProducts(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.endDate) return alert('الاسم وتاريخ الانتهاء مطلوبان')
    setSaving(true)
    const data = {
      name: form.name.trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      applyToAll: form.applyToAll,
      productIds: form.applyToAll ? [] : selectedProducts,
    }
    try {
      if (initial) await window.api.promotions.update({ id: initial.id, ...data })
      else await window.api.promotions.create(data)
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'تعديل عرض' : 'عرض جديد'} onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        <Field label="اسم العرض *">
          <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="نوع الخصم">
            <select value={form.discountType} onChange={e => set('discountType', e.target.value)} className={inputCls}>
              <option value="percentage">نسبة مئوية %</option>
              <option value="fixed">مبلغ ثابت</option>
            </select>
          </Field>
          <Field label={`قيمة الخصم ${form.discountType === 'percentage' ? '(%)' : '(ج.م)'}`}>
            <input type="number" value={form.discountValue} onChange={e => set('discountValue', e.target.value)} min={0} className={inputCls} />
          </Field>
          <Field label="تاريخ البداية">
            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls} />
          </Field>
          <Field label="تاريخ الانتهاء *">
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className={inputCls} required />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={form.applyToAll} onChange={e => set('applyToAll', e.target.checked)} className="rounded" />
          يطبق على جميع المنتجات
        </label>
        {!form.applyToAll && (
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">اختر المنتجات</label>
            <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
              {products.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded p-1">
                  <input type="checkbox" checked={selectedProducts.includes(p.id)} onChange={() => toggleProduct(p.id)} className="rounded" />
                  {p.name}
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
