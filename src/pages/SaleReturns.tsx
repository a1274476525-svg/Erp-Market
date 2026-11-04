import { useState, useEffect } from 'react'
import { Plus, RotateCcw, Eye, X, RefreshCw } from 'lucide-react'
import type { SaleReturn, PosOrder, Product } from '../types'
import { Modal, Field, inputCls, SaveCancelButtons, PageHeader } from '../components/ui'
import { useSettings } from '../contexts/SettingsContext'

export default function SaleReturns() {
  const [returns, setReturns]   = useState<SaleReturn[]>([])
  const [orders, setOrders]     = useState<PosOrder[]>([])
  const [viewing, setViewing]   = useState<SaleReturn | null>(null)
  const [viewingOrder, setViewingOrder] = useState<PosOrder | null>(null)
  const [showForm, setShowForm] = useState(false)
  const { settings } = useSettings()

  const load = () => Promise.all([
    window.api.pos.getReturns(),
    window.api.pos.getOrders(500),
  ]).then(([r, o]) => { setReturns(r); setOrders(o) })

  useEffect(() => { load() }, [])

  const totalReturns = returns.reduce((s, r) => s + r.total, 0)

  return (
    <div className="p-6">
      <PageHeader title="المرتجعات"
        action={
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 text-sm font-medium">
            <Plus size={16} /> مرتجع جديد
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-rose-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-rose-600">{totalReturns.toFixed(2)} {settings.currency}</div>
          <div className="text-sm text-slate-500 mt-1">إجمالي المرتجعات</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-amber-600">{returns.length}</div>
          <div className="text-sm text-slate-500 mt-1">عدد المرتجعات</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">الفاتورة الأصلية</th>
              <th className="px-4 py-3 text-right">سبب المرتجع</th>
              <th className="px-4 py-3 text-center">الأصناف</th>
              <th className="px-4 py-3 text-center">الإجمالي</th>
              <th className="px-4 py-3 text-right">تاريخ المرتجع</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {returns.map(ret => (
              <tr key={ret.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-slate-700">
                  {ret.order?.orderNumber ?? `#${ret.orderId}`}
                   {ret.order && (
                     <button onClick={() => { const full = orders.find(o => o.id === ret.orderId); setViewingOrder(full ?? ret.order ?? null); setViewing(null) }}
                      className="ml-2 text-xs text-blue-600 hover:underline border-b border-blue-600/30">
                      عرض
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{ret.reason ?? '—'}</td>
                <td className="px-4 py-3 text-center text-slate-600">{ret.items.length}</td>
                <td className="px-4 py-3 text-center font-semibold text-rose-600">
                  {ret.total.toFixed(2)} {settings.currency}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {new Date(ret.returnDate).toLocaleString('ar-EG')}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => setViewing(ret)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {returns.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            <RotateCcw size={40} className="mx-auto mb-3 opacity-30" />
            لا توجد مرتجعات
          </div>
        )}
      </div>

      {viewing && (
        <Modal title="تفاصيل المرتجع" onClose={() => setViewing(null)}>
          <div className="space-y-3">
            <div className="text-sm text-slate-500">الفاتورة: <span className="font-mono font-medium text-slate-700">{viewing.order?.orderNumber}</span></div>
            {viewing.reason && <div className="text-sm text-slate-500">السبب: {viewing.reason}</div>}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-right">المنتج</th>
                    <th className="px-3 py-2 text-center">الكمية</th>
                    <th className="px-3 py-2 text-center">السعر</th>
                    <th className="px-3 py-2 text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewing.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.productName}</td>
                      <td className="px-3 py-2 text-center">{item.quantity}</td>
                      <td className="px-3 py-2 text-center">{item.unitPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center font-semibold text-rose-600">{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-left font-bold text-rose-600">الإجمالي: {viewing.total.toFixed(2)} {settings.currency}</div>
          </div>
        </Modal>
      )}

      {viewingOrder && (
        <Modal title={`الفاتورة الأصلية ${viewingOrder.orderNumber}`} onClose={() => setViewingOrder(null)} maxWidth="max-w-lg">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-slate-500 text-xs mb-1">العميل</div>
                <div className="font-medium">{viewingOrder.customer?.name ?? 'عميل عام'}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-slate-500 text-xs mb-1">طريقة الدفع</div>
                <div className="font-medium">{viewingOrder.paymentMethod}</div>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-right">المنتج</th>
                    <th className="px-3 py-2 text-center">الكمية</th>
                    <th className="px-3 py-2 text-center">السعر</th>
                    <th className="px-3 py-2 text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingOrder.items?.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">{item.productName}</td>
                      <td className="px-3 py-2 text-center">{item.quantity}</td>
                      <td className="px-3 py-2 text-center">{item.unitPrice.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center font-semibold">{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">الإجمالي</span><span className="font-bold text-emerald-600">{viewingOrder.total.toFixed(2)} {settings.currency}</span></div>
            </div>
          </div>
        </Modal>
      )}

      {showForm && (
        <ReturnForm
          orders={orders}
          onSave={() => { setShowForm(false); load() }}
          onClose={() => setShowForm(false)}
          onViewOrder={(o) => { setViewingOrder(o); setShowForm(false) }}
        />
      )}
    </div>
  )
}

function ReturnForm({ orders, onSave, onClose, onViewOrder }: {
  orders: PosOrder[]; onSave: () => void; onClose: () => void; onViewOrder?: (order: PosOrder) => void
}) {
  const [orderId, setOrderId]   = useState('')
  const [reason, setReason]     = useState('')
  const [items, setItems]       = useState<{ productId: number; productName: string; quantity: number; unitPrice: number; total: number }[]>([])
  const [alternateItem, setAlternateItem] = useState<{ productId: number; productName: string; quantity: number; unitPrice: number; total: number } | null>(null)
  const [saving, setSaving]     = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const { settings } = useSettings()

  useEffect(() => {
    window.api.products.getAll().then(setProducts).catch(console.error)
  }, [])

  const selectedOrder = orders.find(o => o.id === Number(orderId))

  function addItem(productId: number, productName: string, unitPrice: number) {
    setItems(prev => {
      if (prev.find(i => i.productId === productId)) return prev
      return [...prev, { productId, productName, quantity: 1, unitPrice, total: unitPrice }]
    })
  }

  function updateQty(productId: number, qty: number) {
    setItems(prev => prev.map(i => i.productId === productId
      ? { ...i, quantity: qty, total: qty * i.unitPrice }
      : i).filter(i => i.quantity > 0))
  }

  function addAlternate(productId: number, productName: string, unitPrice: number) {
    setAlternateItem({ productId, productName, quantity: 1, unitPrice, total: unitPrice })
  }

  function updateAlternateQty(qty: number) {
    if (!alternateItem) return
    setAlternateItem({ ...alternateItem, quantity: qty, total: qty * alternateItem.unitPrice })
  }

  function removeAlternate() { setAlternateItem(null) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!orderId || items.length === 0) return alert('اختر فاتورة وأضف منتجات للمرتجع')
    setSaving(true)
    try {
      if (alternateItem) {
        await window.api.pos.createOrder({
          customerId: null,
          cashierId: null,
          paymentMethod: 'cash',
          subtotal: alternateItem.total,
          discountType: null,
          discountValue: 0,
          discountAmount: 0,
          taxRate: 0,
          taxAmount: 0,
          total: alternateItem.total,
          note: `بديل عن مرتجع فاتورة #${orderId}`,
          items: [{ productId: alternateItem.productId, productName: alternateItem.productName, quantity: alternateItem.quantity, unitPrice: alternateItem.unitPrice, total: alternateItem.total }],
        })
      }
      await window.api.pos.createReturn({ orderId: Number(orderId), reason: reason || null, items })
      onSave()
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title="مرتجع جديد" onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <Field label="اختر الفاتورة">
          <select value={orderId} onChange={e => { setOrderId(e.target.value); setItems([]) }} className={inputCls} required>
            <option value="">-- اختر فاتورة --</option>
            {orders.filter(o => o.status === 'completed').map(o => (
              <option key={o.id} value={o.id}>{o.orderNumber} — {o.total.toFixed(2)} {settings.currency}</option>
            ))}
          </select>
        </Field>
        <Field label="سبب المرتجع">
          <input value={reason} onChange={e => setReason(e.target.value)} className={inputCls} placeholder="اختياري" />
        </Field>

        {selectedOrder && (
          <div>
            <button type="button" onClick={() => onViewOrder?.(selectedOrder)}
              className="text-xs text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1">
              <Eye size={14} /> عرض الفاتورة الأصلية للمقارنة
            </button>
            <label className="block text-sm font-medium text-slate-600 mb-2">أصناف المرتجع</label>
            <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
              {selectedOrder.items.map(item => {
                const inReturn = items.find(i => i.productId === item.productId)
                return (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                    <button type="button" onClick={() => addItem(item.productId, item.productName, item.unitPrice)}
                      className="text-right flex-1 hover:text-emerald-600">
                      {item.productName}
                    </button>
                    {inReturn && (
                      <div className="flex items-center gap-2">
                        <input type="number" value={inReturn.quantity} min={1} max={item.quantity}
                          onChange={e => updateQty(item.productId, Number(e.target.value))}
                          className="w-16 border rounded px-2 py-1 text-xs text-center" />
                        <button type="button" onClick={() => setItems(prev => prev.filter(i => i.productId !== item.productId))}
                          className="text-red-400 hover:text-red-600 text-xs">حذف</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
          <label className="block text-sm font-medium text-amber-800 mb-2 flex items-center gap-1">
            <RefreshCw size={14} /> منتج بديل (استبدال)
          </label>
          <div className="flex gap-2 flex-wrap items-end">
            <select value={alternateItem?.productId ?? ''} onChange={e => {
              const pid = Number(e.target.value)
              const p = products.find(p => p.id === pid)
              if (p) addAlternate(p.id, p.name, p.sellingPrice)
            }}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">-- اختر منتج بديل --</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sellingPrice.toFixed(2)} {settings.currency})</option>)}
            </select>
            {alternateItem && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-700">الكمية</span>
                <input type="number" value={alternateItem.quantity} min={1}
                  onChange={e => updateAlternateQty(Number(e.target.value) || 1)}
                  className="w-16 border rounded px-2 py-1 text-xs text-center" />
                <button type="button" onClick={removeAlternate} className="text-xs text-red-500 hover:text-red-700">إلغاء البديل</button>
              </div>
            )}
          </div>
          {alternateItem && (
            <div className="mt-2 pt-2 border-t border-amber-200/50 flex items-center justify-between text-sm">
              <span className="text-amber-700">إجمالي البديل</span>
              <span className="font-bold text-amber-800">{alternateItem.total.toFixed(2)} {settings.currency}</span>
            </div>
          )}
          <div className="mt-2 text-xs font-medium">
            الفارق: {((alternateItem?.total ?? 0) - items.reduce((s, i) => s + i.total, 0)).toFixed(2)} {settings.currency}
            {' '}
            {alternateItem ? ((alternateItem.total > items.reduce((s, i) => s + i.total, 0)) ? 'يطلب من العميل' : 'يُسترد للعميل') : ''}
          </div>
        </div>

        {items.length > 0 && (
          <div className="bg-rose-50 rounded-lg p-3 text-sm text-rose-700">
            إجمالي المرتجع: {items.reduce((s, i) => s + i.total, 0).toFixed(2)} {settings.currency}
          </div>
        )}

        <SaveCancelButtons saving={saving} onCancel={onClose} saveLabel="تسجيل المرتجع" />
      </form>
    </Modal>
  )
}
