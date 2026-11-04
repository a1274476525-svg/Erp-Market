import { useState, useEffect } from 'react'
import { Search, ShoppingCart, Eye, XCircle } from 'lucide-react'
import type { PosOrder } from '../types'
import { Modal, Badge, PageHeader } from '../components/ui'
import { useSettings } from '../contexts/SettingsContext'

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقداً', card: 'بطاقة', instapay: 'إنستاباي', vodafone: 'فودافون كاش',
}

export default function Sales() {
  const [orders, setOrders]   = useState<PosOrder[]>([])
  const [search, setSearch]   = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]   = useState('')
  const [viewing, setViewing] = useState<PosOrder | null>(null)
  const [voiding, setVoiding] = useState<PosOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const { settings } = useSettings()

  const load = () => window.api.pos.getOrders(500).then(setOrders).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const filtered = orders.filter(o => {
    const matchSearch = !search || o.orderNumber.includes(search) || o.customer?.name.toLowerCase().includes(search.toLowerCase())
    const matchFrom = !fromDate || new Date(o.createdAt) >= new Date(fromDate)
    const matchTo   = !toDate   || new Date(o.createdAt) <= new Date(new Date(toDate).setHours(23, 59, 59))
    return matchSearch && matchFrom && matchTo
  })

  async function voidOrder(order: PosOrder) {
    await window.api.pos.voidOrder(order.id)
    setVoiding(null)
    load()
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayOrders = orders.filter(o => new Date(o.createdAt) >= today && o.status === 'completed')
  const todayTotal = todayOrders.reduce((s, o) => s + o.total, 0)

  return (
    <div className="p-6">
      <PageHeader title="المبيعات" />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-emerald-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-600">{todayTotal.toFixed(2)} {settings.currency}</div>
          <div className="text-sm text-slate-500 mt-1">إجمالي مبيعات اليوم</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-blue-600">{todayOrders.length}</div>
          <div className="text-sm text-slate-500 mt-1">فواتير اليوم</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4">
          <div className="text-2xl font-bold text-purple-600">{filtered.length}</div>
          <div className="text-sm text-slate-500 mt-1">{fromDate || toDate ? 'فواتير الفترة' : 'إجمالي الفواتير'}</div>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث برقم الفاتورة أو اسم العميل..."
            className="border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-56" />
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <span className="text-slate-500 text-xs">من</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border-none outline-none text-sm" />
          <span className="text-slate-500 text-xs">إلى</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border-none outline-none text-sm" />
        </div>
        {(fromDate || toDate) && (
          <button onClick={() => { setFromDate(''); setToDate('') }} className="text-xs text-slate-500 hover:text-red-500 border border-slate-200 rounded-lg px-3 py-2">
            مسح التواريخ
          </button>
        )}
        {(fromDate || toDate) && (
          <div className="mr-auto text-xs bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2 font-medium">
            إجمالي الفترة: {filtered.filter(o => o.status === 'completed').reduce((s, o) => s + o.total, 0).toFixed(2)} {settings.currency}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-right">رقم الفاتورة</th>
              <th className="px-4 py-3 text-right">العميل</th>
              <th className="px-4 py-3 text-center">طريقة الدفع</th>
              <th className="px-4 py-3 text-center">الأصناف</th>
              <th className="px-4 py-3 text-center">الإجمالي</th>
              <th className="px-4 py-3 text-center">الحالة</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(order => (
              <tr key={order.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-medium text-slate-700">{order.orderNumber}</td>
                <td className="px-4 py-3 text-slate-600">{order.customer?.name ?? 'عميل عام'}</td>
                <td className="px-4 py-3 text-center">
                  <Badge label={PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod} color="blue" />
                </td>
                <td className="px-4 py-3 text-center text-slate-600">{order.items.length}</td>
                <td className="px-4 py-3 text-center font-semibold text-emerald-600">
                  {order.total.toFixed(2)} {settings.currency}
                </td>
                <td className="px-4 py-3 text-center">
                  {order.status === 'completed'
                    ? <Badge label="مكتمل" color="green" />
                    : <Badge label="ملغي" color="red" />}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {new Date(order.createdAt).toLocaleString('ar-EG')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => setViewing(order)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Eye size={14} />
                    </button>
                    {order.status === 'completed' && (
                      <button onClick={() => setVoiding(order)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <XCircle size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
            لا توجد مبيعات
          </div>
        )}
      </div>

      {viewing && (
        <Modal title={`تفاصيل الفاتورة ${viewing.orderNumber}`} onClose={() => setViewing(null)} maxWidth="max-w-lg">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-slate-500 text-xs mb-1">العميل</div>
                <div className="font-medium">{viewing.customer?.name ?? 'عميل عام'}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-slate-500 text-xs mb-1">طريقة الدفع</div>
                <div className="font-medium">{PAYMENT_LABELS[viewing.paymentMethod] ?? viewing.paymentMethod}</div>
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
                  {viewing.items.map(item => (
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
              <div className="flex justify-between"><span className="text-slate-500">المجموع الفرعي</span><span>{viewing.subtotal.toFixed(2)}</span></div>
              {viewing.discountAmount > 0 && <div className="flex justify-between text-red-500"><span>الخصم</span><span>-{viewing.discountAmount.toFixed(2)}</span></div>}
              {viewing.taxAmount > 0 && <div className="flex justify-between"><span className="text-slate-500">الضريبة</span><span>{viewing.taxAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold border-t pt-2"><span>الإجمالي</span><span className="text-emerald-600">{viewing.total.toFixed(2)} {settings.currency}</span></div>
            </div>
          </div>
        </Modal>
      )}

      {voiding && (
        <Modal title="إلغاء الفاتورة" onClose={() => setVoiding(null)}>
          <p className="text-slate-500 text-sm mb-6">
            هل تريد إلغاء الفاتورة {voiding.orderNumber}؟ سيتم إرجاع المخزون تلقائياً.
          </p>
          <div className="flex gap-3">
            <button onClick={() => voidOrder(voiding)}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 text-sm font-medium">
              إلغاء الفاتورة
            </button>
            <button onClick={() => setVoiding(null)}
              className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium">
              تراجع
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
