import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { RefreshCw, RotateCcw, Package, AlertCircle, CheckCircle2 } from 'lucide-react'

const fmt = (n: number) => (Number(n) || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PurchaseReturnsPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [invoiceId, setInvoiceId] = useState('')
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    setLoading(true)
    try {
      setInvoices(await window.api.invoices.getAll())
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل فواتير الشراء')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  const invoice = invoices.find(i => String(i.id) === invoiceId)
  const products = useMemo(() => {
    if (!invoice) return []
    const grouped = new Map<number, any>()
    for (const item of invoice.items ?? []) {
      const current = grouped.get(item.productId) ?? {
        productId: item.productId,
        name: item.product?.name ?? `صنف #${item.productId}`,
        quantity: 0,
        value: 0,
        returned: 0,
      }
      current.quantity += Number(item.quantity || 0)
      current.value += Number(item.totalPrice ?? item.quantity * item.unitPrice)
      grouped.set(item.productId, current)
    }
    for (const ret of invoice.returns ?? []) {
      for (const item of ret.items ?? []) {
        const current = grouped.get(item.productId)
        if (current) current.returned += Number(item.quantity || 0)
      }
    }
    return [...grouped.values()].map(item => ({
      ...item,
      unitPrice: item.quantity > 0 ? item.value / item.quantity : 0,
      remaining: Math.max(0, item.quantity - item.returned),
    })).filter(item => item.remaining > 0.000001)
  }, [invoice])

  const returnSubtotal = products.reduce((sum, item) => sum + item.unitPrice * Number(quantities[item.productId] || 0), 0)
  const taxShare = invoice && invoice.subtotal > 0 ? invoice.taxAmount * returnSubtotal / invoice.subtotal : 0
  const creditTotal = returnSubtotal + taxShare

  function chooseInvoice(value: string) {
    setInvoiceId(value)
    setQuantities({})
    setReason('')
    setError('')
    setSuccess('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!invoice) return
    const items = products
      .map(item => ({ productId: item.productId, quantity: Number(quantities[item.productId] || 0) }))
      .filter(item => item.quantity > 0)
    if (!items.length) {
      setError('أدخل كمية مرتجعة لصنف واحد على الأقل')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const result = await window.api.invoices.createReturn({ invoiceId: invoice.id, items, reason })
      setSuccess(`تم تسجيل مرتجع المورد بقيمة ${fmt(result.supplierCredit)} ج.م وترحيل إشعار الدائن`)
      setInvoiceId('')
      setQuantities({})
      setReason('')
      await load()
    } catch (e: any) {
      setError(e?.message || 'تعذر تسجيل مرتجع المورد')
    } finally {
      setSaving(false)
    }
  }

  const recent = invoices.flatMap(i => (i.returns ?? []).map((r: any) => ({
    ...r,
    invoiceLabel: i.invoiceNumber || `INV-${i.id}`,
    supplierName: i.supplier?.name || 'مورد غير محدد',
  }))).sort((a, b) => new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime())

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">مرتجعات المشتريات</h1>
          <p className="text-sm text-slate-500 mt-1">إرجاع الأصناف للمورد وإنشاء إشعار دائن وعكس المخزون والضريبة</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <form onSubmit={submit} className="lg:col-span-3 bg-white border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-slate-800"><RotateCcw size={18} /> إنشاء مرتجع مورد</div>
          <label className="block text-sm">
            <span className="block text-slate-600 mb-1">فاتورة الشراء الأصلية</span>
            <select required value={invoiceId} onChange={e => chooseInvoice(e.target.value)} className="w-full border rounded-lg p-2.5 bg-white">
              <option value="">اختر فاتورة مؤكدة</option>
              {invoices.map(i => <option key={i.id} value={i.id}>{i.invoiceNumber || `INV-${i.id}`} — {i.supplier?.name || 'مورد غير محدد'} — {fmt(i.total)} ج.م</option>)}
            </select>
          </label>
          {invoice && <div className="rounded-lg bg-slate-50 p-3 text-sm grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">المورد: </span><b>{invoice.supplier?.name || 'غير محدد'}</b></div>
            <div><span className="text-slate-500">التاريخ: </span><b>{new Date(invoice.invoiceDate).toLocaleDateString('ar-EG')}</b></div>
            <div><span className="text-slate-500">إجمالي الفاتورة: </span><b>{fmt(invoice.total)} ج.م</b></div>
            <div><span className="text-slate-500">مرتجعات سابقة: </span><b>{(invoice.returns ?? []).length}</b></div>
          </div>}
          {invoice && <div className="border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 text-sm font-semibold flex items-center gap-2"><Package size={15} /> الأصناف والكميات المتاحة للإرجاع</div>
            {products.length === 0 ? <div className="p-4 text-sm text-slate-400 text-center">لا توجد كميات متبقية للإرجاع في هذه الفاتورة</div> :
              <div className="divide-y">{products.map(item => (
                <div key={item.productId} className="p-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                  <div className="sm:col-span-2">
                    <div className="text-sm font-medium text-slate-800">{item.name}</div>
                    <div className="text-xs text-slate-500">مشتراة: {item.quantity} · مرتجعة: {item.returned} · متاح: {item.remaining}</div>
                  </div>
                  <div className="text-xs text-slate-500">سعر الوحدة: {fmt(item.unitPrice)}</div>
                  <input type="number" min="0" max={item.remaining} step="0.001" value={quantities[item.productId] ?? ''} onChange={e => setQuantities(prev => ({ ...prev, [item.productId]: e.target.value }))} placeholder="كمية الإرجاع" className="border rounded-lg p-2 text-sm w-full" />
                </div>
              ))}</div>}
          </div>}
          <label className="block text-sm">
            <span className="block text-slate-600 mb-1">سبب الإرجاع</span>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full border rounded-lg p-2.5" placeholder="تالف، خطأ توريد، انتهاء صلاحية..." />
          </label>
          {invoice && <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>قيمة الأصناف المرتجعة</span><b>{fmt(returnSubtotal)} ج.م</b></div>
            <div className="flex justify-between"><span>عكس الضريبة التقديري</span><b>{fmt(taxShare)} ج.م</b></div>
            <div className="flex justify-between border-t border-amber-200 pt-2 font-bold text-amber-900"><span>إشعار دائن للمورد</span><span>{fmt(creditTotal)} ج.م</span></div>
          </div>}
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2"><AlertCircle size={16} />{error}</div>}
          {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2"><CheckCircle2 size={16} />{success}</div>}
          <button disabled={saving || loading || !invoice || products.length === 0 || returnSubtotal <= 0} className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-lg py-3 font-semibold disabled:opacity-50">
            {saving ? 'جارٍ تسجيل المرتجع...' : 'تأكيد المرتجع وترحيل إشعار الدائن'}
          </button>
          <p className="text-xs text-slate-400">يتم التحقق من الكمية المتبقية ومخزون المخزن، ثم حفظ المرتجع وحركة المخزون والقيد في معاملة واحدة.</p>
        </form>

        <div className="lg:col-span-2 bg-white border rounded-xl overflow-hidden">
          <div className="p-4 border-b font-semibold text-slate-800">آخر مرتجعات الموردين</div>
          {loading ? <div className="p-8 text-center text-slate-400">جارٍ التحميل...</div> : recent.length === 0 ? <div className="p-8 text-center text-slate-400">لا توجد مرتجعات مشتريات مسجلة</div> :
            <div className="divide-y max-h-[650px] overflow-y-auto">{recent.map(r => (
              <div key={r.id} className="p-3">
                <div className="flex items-center justify-between gap-2"><b className="text-sm">PR-{r.id}</b><span className="text-xs text-slate-400">{new Date(r.returnDate).toLocaleDateString('ar-EG')}</span></div>
                <div className="text-xs text-slate-500 mt-1">{r.supplierName} · {r.invoiceLabel}</div>
                <div className="font-semibold text-amber-700 mt-1">{fmt(r.total)} ج.م قبل الضريبة</div>
                {r.reason && <div className="text-xs text-slate-400 mt-1">{r.reason}</div>}
              </div>
            ))}</div>}
        </div>
      </div>
    </div>
  )
}
