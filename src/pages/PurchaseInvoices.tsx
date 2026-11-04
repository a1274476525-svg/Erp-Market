import { useState, useEffect } from 'react'
import { Plus, Eye, Trash2, CheckCircle, FileText, Edit2 } from 'lucide-react'
import type { PurchaseInvoice, Supplier, Product } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, DeleteConfirm, Badge, PageHeader } from '../components/ui'
import { useSettings } from '../contexts/SettingsContext'

export default function PurchaseInvoices() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [drafts, setDrafts]     = useState<PurchaseInvoice[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [viewing, setViewing]   = useState<PurchaseInvoice | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingDraft, setEditingDraft] = useState<PurchaseInvoice | null>(null)
  const [deleting, setDeleting] = useState<PurchaseInvoice | null>(null)
  const [tab, setTab]           = useState<'confirmed' | 'draft'>('confirmed')
  const { settings } = useSettings()

  const load = () => Promise.all([
    window.api.invoices.getAll(),
    window.api.invoices.getDrafts(),
    window.api.suppliers.getAll(),
    window.api.products.getAll(),
  ]).then(([i, d, s, p]) => { setInvoices(i); setDrafts(d); setSuppliers(s); setProducts(p) })

  useEffect(() => { load() }, [])

  async function handleDelete() {
    if (!deleting) return
    await window.api.invoices.deleteDraft(deleting.id)
    setDeleting(null)
    load()
  }

  async function confirmDraft(id: number) {
    await window.api.invoices.confirmDraft(id)
    load()
  }

  const displayed = tab === 'confirmed' ? invoices : drafts

  return (
    <div className="p-6">
      <PageHeader title="فواتير الشراء"
        action={
          <button onClick={() => { setEditingDraft(null); setShowForm(true) }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium">
            <Plus size={16} /> فاتورة جديدة
          </button>
        }
      />

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('confirmed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'confirmed' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
          مؤكدة ({invoices.length})
        </button>
        <button onClick={() => setTab('draft')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'draft' ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
          مسودات ({drafts.length})
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">رقم الفاتورة</th>
              <th className="px-4 py-3 text-right">المورد</th>
              <th className="px-4 py-3 text-center">تاريخ الفاتورة</th>
              <th className="px-4 py-3 text-center">الأصناف</th>
              <th className="px-4 py-3 text-center">الإجمالي</th>
              <th className="px-4 py-3 text-center">الحالة</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayed.map(inv => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-slate-700">{inv.invoiceNumber ?? `#${inv.id}`}</td>
                <td className="px-4 py-3 text-slate-600">{inv.supplier?.name ?? '—'}</td>
                <td className="px-4 py-3 text-center text-slate-500 text-xs">
                  {new Date(inv.invoiceDate).toLocaleDateString('ar-EG')}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">{inv.items.length}</td>
                <td className="px-4 py-3 text-center font-semibold text-slate-800">
                  {inv.total.toFixed(2)} {settings.currency}
                </td>
                <td className="px-4 py-3 text-center">
                  {inv.status === 'confirmed' ? <Badge label="مؤكدة" color="green" /> : <Badge label="مسودة" color="amber" />}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => setViewing(inv)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Eye size={14} />
                    </button>
                    {inv.status === 'draft' && (
                      <>
                        <button onClick={() => { setEditingDraft(inv); setShowForm(true) }} title="تعديل المسودة"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => confirmDraft(inv.id)} title="تأكيد الفاتورة"
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                          <CheckCircle size={14} />
                        </button>
                        <button onClick={() => setDeleting(inv)} title="حذف"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {displayed.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            لا توجد فواتير
          </div>
        )}
      </div>

      {viewing && (
        <Modal title={`فاتورة ${viewing.invoiceNumber ?? `#${viewing.id}`}`} onClose={() => setViewing(null)} maxWidth="max-w-xl">
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-slate-500">المورد: </span><span className="font-medium">{viewing.supplier?.name ?? '—'}</span></div>
              <div><span className="text-slate-500">التاريخ: </span><span>{new Date(viewing.invoiceDate).toLocaleDateString('ar-EG')}</span></div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-right">المنتج</th>
                    <th className="px-3 py-2 text-center">الكمية</th>
                    <th className="px-3 py-2 text-center">سعر الوحدة</th>
                    <th className="px-3 py-2 text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewing.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.product?.name ?? `#${item.productId}`}</td>
                      <td className="px-3 py-2 text-center">{item.quantity}</td>
                      <td className="px-3 py-2 text-center">{item.unitPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center font-semibold">{item.totalPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">المجموع الفرعي</span><span>{viewing.subtotal.toFixed(2)}</span></div>
              {viewing.taxAmount > 0 && <div className="flex justify-between"><span className="text-slate-500">ض.ق.م ({viewing.taxRate}%)</span><span>{viewing.taxAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold border-t pt-2"><span>الإجمالي</span><span>{viewing.total.toFixed(2)} {settings.currency}</span></div>
            </div>
            {viewing.notes && <p className="text-slate-500 text-xs">{viewing.notes}</p>}
          </div>
        </Modal>
      )}

      {showForm && (
        <InvoiceForm
          initial={editingDraft}
          suppliers={suppliers}
          products={products}
          settings={settings}
          onSave={() => { setShowForm(false); load() }}
          onClose={() => setShowForm(false)}
        />
      )}

      {deleting && (
        <DeleteConfirm onConfirm={handleDelete} onCancel={() => setDeleting(null)}
          message="هل تريد حذف هذه المسودة؟" />
      )}
    </div>
  )
}

function InvoiceForm({ initial, suppliers, products, settings, onSave, onClose }: {
  initial: PurchaseInvoice | null
  suppliers: Supplier[]
  products: Product[]
  settings: any
  onSave: () => void
  onClose: () => void
}) {
  const [supplierId, setSupplierId] = useState(initial?.supplierId?.toString() ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? '')
  const [invoiceDate, setInvoiceDate] = useState(
    initial?.invoiceDate
      ? String(typeof (initial.invoiceDate as any).toISOString === 'function'
          ? (initial.invoiceDate as any).toISOString()
          : initial.invoiceDate).slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  )
  const [taxRate, setTaxRate]   = useState(initial?.taxRate.toString() ?? settings.taxRate ?? '14')
  const [notes, setNotes]       = useState(initial?.notes ?? '')
  const [items, setItems]       = useState<{ productId: number; productName: string; quantity: number; unitPrice: number; totalPrice: number }[]>(
    initial?.items.map(i => ({ productId: i.productId, productName: i.product?.name ?? '', quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice })) ?? []
  )
  const [addProductId, setAddProductId] = useState('')
  const [addQty, setAddQty]         = useState('1')
  const [addUnitPrice, setAddUnitPrice] = useState('')
  const [saving, setSaving]     = useState(false)

  function handleProductSelect(pid: string) {
    setAddProductId(pid)
    const p = products.find(x => x.id === Number(pid))
    if (p) setAddUnitPrice(p.costPrice.toString())
    else setAddUnitPrice('')
  }

  function addItem() {
    const product = products.find(p => p.id === Number(addProductId))
    if (!product) return
    if (items.find(i => i.productId === product.id)) return
    const qty = Number(addQty) || 1
    const price = Number(addUnitPrice) || 0
    setItems(prev => [...prev, { productId: product.id, productName: product.name, quantity: qty, unitPrice: price, totalPrice: qty * price }])
    setAddProductId('')
    setAddQty('1')
    setAddUnitPrice('')
  }

  function updateItem(idx: number, field: string, value: number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      updated.totalPrice = updated.quantity * updated.unitPrice
      return updated
    }))
  }

  const subtotal = items.reduce((s, i) => s + i.totalPrice, 0)
  const taxAmount = subtotal * (Number(taxRate) / 100)
  const total     = subtotal + taxAmount

  async function submit(e: React.FormEvent, asDraft = false) {
    e.preventDefault()
    if (items.length === 0) return alert('أضف منتجاً واحداً على الأقل')
    setSaving(true)
    const data = {
      supplierId: supplierId ? Number(supplierId) : null,
      invoiceNumber: invoiceNumber || null,
      invoiceDate: new Date(invoiceDate).toISOString(),
      subtotal,
      taxRate: Number(taxRate),
      taxAmount,
      total,
      notes: notes || null,
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice })),
    }
    try {
      if (asDraft) {
        if (initial) await window.api.invoices.updateDraft({ id: initial.id, ...data })
        else await window.api.invoices.saveDraft(data)
      } else {
        await window.api.invoices.create(data)
      }
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'تعديل مسودة فاتورة' : 'فاتورة شراء جديدة'} onClose={onClose} maxWidth="max-w-3xl">
      <form onSubmit={e => submit(e)} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="المورد">
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">بدون مورد</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="رقم الفاتورة">
            <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={inputCls} />
          </Field>
          <Field label="تاريخ الفاتورة">
            <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="border rounded-lg p-3">
          <div className="flex gap-2 mb-3 items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-slate-500 mb-1">المنتج</label>
              <select value={addProductId} onChange={e => handleProductSelect(e.target.value)} className={inputCls}>
                <option value="">-- اختر منتجاً --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-xs text-slate-500 mb-1">الكمية</label>
              <input type="number" value={addQty} onChange={e => setAddQty(e.target.value)} min={0.01} step={0.01}
                className={inputCls} placeholder="1" />
            </div>
            <div className="w-28">
              <label className="block text-xs text-slate-500 mb-1">سعر الوحدة</label>
              <input type="number" value={addUnitPrice} onChange={e => setAddUnitPrice(e.target.value)} min={0} step={0.01}
                className={inputCls} placeholder="0.00" />
            </div>
            <button type="button" onClick={addItem}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 flex-shrink-0 flex items-center gap-1">
              <Plus size={16} /> إضافة
            </button>
          </div>
          {items.length > 0 && (
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-1.5 text-right">المنتج</th>
                  <th className="px-2 py-1.5 text-center">الكمية</th>
                  <th className="px-2 py-1.5 text-center">سعر الوحدة</th>
                  <th className="px-2 py-1.5 text-center">الإجمالي</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1.5">{item.productName}</td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={item.quantity} min={0.01} step={0.01}
                        onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                        className="w-16 border rounded px-1.5 py-1 text-center text-xs" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" value={item.unitPrice} min={0} step={0.01}
                        onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))}
                        className="w-20 border rounded px-1.5 py-1 text-center text-xs" />
                    </td>
                    <td className="px-2 py-1.5 text-center font-semibold">{item.totalPrice.toFixed(2)}</td>
                    <td className="px-2 py-1.5">
                      <button type="button" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={`نسبة الضريبة (%) [مصر: 14%]`}>
            <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} min={0} max={100} className={inputCls} />
          </Field>
          <Field label="ملاحظات">
            <input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-slate-500">المجموع الفرعي</span><span>{subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">ض.ق.م ({taxRate}%)</span><span>{taxAmount.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold border-t pt-2"><span>الإجمالي</span><span className="text-emerald-600">{total.toFixed(2)} {settings.currency}</span></div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="flex-1 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium">
            {saving ? 'جاري الحفظ...' : 'تأكيد الفاتورة'}
          </button>
          <button type="button" onClick={e => submit(e as any, true)} disabled={saving}
            className="flex-1 bg-amber-500 text-white py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm font-medium">
            حفظ كمسودة
          </button>
          <button type="button" onClick={onClose}
            className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium">
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  )
}
