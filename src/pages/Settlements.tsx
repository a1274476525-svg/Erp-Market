import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { RefreshCw, Wallet, Receipt, Truck, CheckCircle2 } from 'lucide-react'

type Mode = 'customers' | 'suppliers'
const METHODS = [
  { value: 'cash', label: 'نقدي' },
  { value: 'card', label: 'بطاقة' },
  { value: 'instapay', label: 'إنستاباي' },
  { value: 'vodafone', label: 'فودافون كاش' },
]

const money = (value: number) => (Number(value) || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function SettlementsPage() {
  const [mode, setMode] = useState<Mode>('customers')
  const [orders, setOrders] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [customerPayments, setCustomerPayments] = useState<any[]>([])
  const [supplierPayments, setSupplierPayments] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [allOrders, allInvoices, cp, sp] = await Promise.all([
        window.api.pos.getOrders(1000),
        window.api.invoices.getAll(),
        window.api.customers.getPayments(),
        window.api.suppliers.getPayments(),
      ])
      setOrders(allOrders)
      setInvoices(allInvoices)
      setCustomerPayments(cp)
      setSupplierPayments(sp)
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل أرصدة العملاء والموردين')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const openItems = useMemo(() => {
    if (mode === 'customers') {
      return orders.filter(o => o.status === 'completed' && o.paymentMethod === 'credit' && o.customerId)
        .map(o => {
          const paid = (o.payments ?? []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
          return { id: o.id, label: o.orderNumber, party: o.customer?.name || 'عميل', date: o.createdAt, total: o.total, paid, due: Math.max(0, o.total - paid) }
        }).filter(o => o.due > 0.005)
    }
    return invoices.filter(i => i.status === 'confirmed' && i.supplierId)
      .map(i => {
        const paid = (i.payments ?? []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
        return { id: i.id, label: i.invoiceNumber || `INV-${i.id}`, party: i.supplier?.name || 'مورد', date: i.invoiceDate, total: i.total, paid, due: Math.max(0, i.total - paid) }
      }).filter(i => i.due > 0.005)
  }, [mode, orders, invoices])

  const selected = openItems.find(item => String(item.id) === selectedId)
  const totalDue = openItems.reduce((sum, item) => sum + item.due, 0)
  const totalPaid = mode === 'customers'
    ? customerPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    : supplierPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)

  function chooseDocument(value: string) {
    setSelectedId(value)
    const item = openItems.find(row => String(row.id) === value)
    setAmount(item ? item.due.toFixed(2) : '')
    setError('')
    setSuccess('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0 || value > selected.due + 0.005) {
      setError(`أدخل مبلغًا أكبر من صفر ولا يتجاوز المتبقي ${money(selected.due)}`)
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (mode === 'customers') {
        await window.api.customers.receivePayment({ orderId: selected.id, amount: value, paymentMethod: method, date, reference, notes })
      } else {
        await window.api.suppliers.payInvoice({ invoiceId: selected.id, amount: value, paymentMethod: method, date, reference, notes })
      }
      setSuccess(mode === 'customers' ? 'تم تسجيل التحصيل وترحيل القيد المحاسبي بنجاح' : 'تم تسجيل سداد المورد وترحيل القيد المحاسبي بنجاح')
      setSelectedId('')
      setAmount('')
      setReference('')
      setNotes('')
      await load()
    } catch (e: any) {
      setError(e?.message || 'تعذر تسجيل العملية')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">التحصيلات وسداد الموردين</h1>
          <p className="text-sm text-slate-500 mt-1">إدارة المديونيات والدفعات الجزئية مع ترحيل محاسبي تلقائي</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-slate-500">إجمالي المستحق في القائمة</div>
          <div className="text-2xl font-bold text-slate-800 mt-2">{money(totalDue)} ج.م</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-slate-500">إجمالي الدفعات المسجلة</div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">{money(totalPaid)} ج.م</div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <div className="text-xs text-slate-500">عدد المستندات غير المسددة بالكامل</div>
          <div className="text-2xl font-bold text-amber-700 mt-2">{openItems.length}</div>
        </div>
      </div>

      <div className="flex gap-2 bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => { setMode('customers'); setSelectedId(''); setAmount(''); setError(''); setSuccess('') }}
          className={`px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${mode === 'customers' ? 'bg-white shadow text-emerald-700' : 'text-slate-600'}`}>
          <Wallet size={16} /> تحصيل من عميل
        </button>
        <button onClick={() => { setMode('suppliers'); setSelectedId(''); setAmount(''); setError(''); setSuccess('') }}
          className={`px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${mode === 'suppliers' ? 'bg-white shadow text-emerald-700' : 'text-slate-600'}`}>
          <Truck size={16} /> سداد مورد
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <form onSubmit={submit} className="lg:col-span-2 bg-white border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            {mode === 'customers' ? <Wallet size={18} /> : <Truck size={18} />}
            {mode === 'customers' ? 'تسجيل تحصيل عميل' : 'تسجيل دفعة مورد'}
          </div>
          <label className="block text-sm">
            <span className="block text-slate-600 mb-1">الفاتورة المستحقة</span>
            <select required value={selectedId} onChange={e => chooseDocument(e.target.value)} className="w-full border rounded-lg p-2.5 bg-white">
              <option value="">اختر المستند</option>
              {openItems.map(item => <option key={item.id} value={item.id}>{item.label} — {item.party} — متبقي {money(item.due)}</option>)}
            </select>
          </label>
          {selected && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">الطرف</span><b>{selected.party}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">إجمالي المستند</span><b>{money(selected.total)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">المدفوع</span><b>{money(selected.paid)}</b></div>
              <div className="flex justify-between text-amber-700"><span>المتبقي</span><b>{money(selected.due)} ج.م</b></div>
            </div>
          )}
          <label className="block text-sm">
            <span className="block text-slate-600 mb-1">مبلغ الدفعة</span>
            <input required type="number" min="0.01" max={selected?.due ?? undefined} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border rounded-lg p-2.5" placeholder="0.00" />
          </label>
          <label className="block text-sm">
            <span className="block text-slate-600 mb-1">طريقة الدفع</span>
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full border rounded-lg p-2.5 bg-white">
              {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block text-slate-600 mb-1">التاريخ</span>
            <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border rounded-lg p-2.5" />
          </label>
          <label className="block text-sm">
            <span className="block text-slate-600 mb-1">رقم مرجعي (اختياري)</span>
            <input value={reference} onChange={e => setReference(e.target.value)} className="w-full border rounded-lg p-2.5" placeholder="رقم إيصال أو تحويل" />
          </label>
          <label className="block text-sm">
            <span className="block text-slate-600 mb-1">ملاحظات</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full border rounded-lg p-2.5" />
          </label>
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
          {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2"><CheckCircle2 size={16} />{success}</div>}
          <button disabled={saving || loading || !selected} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-3 font-semibold disabled:opacity-50">
            {saving ? 'جارٍ التسجيل...' : mode === 'customers' ? 'تسجيل التحصيل وترحيل القيد' : 'تسجيل السداد وترحيل القيد'}
          </button>
          <p className="text-xs text-slate-400">يتم حفظ الدفعة والقيد المحاسبي في معاملة واحدة. لا يمكن تجاوز الرصيد المستحق.</p>
        </form>

        <div className="lg:col-span-3 bg-white border rounded-xl overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="font-semibold text-slate-800">{mode === 'customers' ? 'الفواتير الآجلة المفتوحة' : 'فواتير الموردين المفتوحة'}</div>
            <span className="text-xs text-slate-500">{openItems.length} مستند</span>
          </div>
          {loading ? <div className="p-8 text-center text-slate-400">جارٍ تحميل الأرصدة...</div> :
            openItems.length === 0 ? <div className="p-8 text-center text-slate-400"><Receipt size={28} className="mx-auto mb-2 opacity-40" />لا توجد أرصدة مستحقة في هذا القسم</div> :
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">المستند</th><th className="p-3">الطرف</th><th className="p-3">الإجمالي</th><th className="p-3">المدفوع</th><th className="p-3">المتبقي</th></tr></thead>
                <tbody>{openItems.map(item => <tr key={item.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-medium">{item.label}<div className="text-xs text-slate-400">{new Date(item.date).toLocaleDateString('ar-EG')}</div></td>
                  <td className="p-3">{item.party}</td>
                  <td className="p-3">{money(item.total)}</td>
                  <td className="p-3 text-emerald-700">{money(item.paid)}</td>
                  <td className="p-3 font-semibold text-amber-700">{money(item.due)}</td>
                </tr>)}</tbody>
              </table>
            </div>}
        </div>
      </div>
    </div>
  )
}
