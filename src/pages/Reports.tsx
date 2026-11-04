import { useState, useEffect, Component, ReactNode } from 'react'
import {
  BarChart3, Download, Printer, TrendingUp, ShoppingCart,
  Package, AlertTriangle, CreditCard, RefreshCw, Filter
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { useSettings } from '../contexts/SettingsContext'

class ReportErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle size={40} className="text-red-400 mb-3" />
          <p className="text-red-600 font-semibold mb-1">حدث خطأ أثناء تحميل التقرير</p>
          <p className="text-slate-400 text-sm mb-4">{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
            إعادة المحاولة
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

type Tab = 'sales' | 'purchases' | 'products' | 'stock'
type DatePreset = 'today' | 'week' | 'month' | 'custom'

const PAY_LABELS: Record<string, string> = {
  cash: 'كاش', card: 'كارت', instapay: 'InstaPay', vodafone: 'فودافون كاش'
}
const PAY_COLORS: Record<string, string> = {
  cash: '#10b981', card: '#3b82f6', instapay: '#8b5cf6', vodafone: '#ef4444'
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function dateStr(d: Date | string): string { return d instanceof Date ? d.toISOString() : String(d) }

function dateRange(preset: DatePreset): { from: string; to: string } {
  const t = new Date()
  if (preset === 'today') return { from: todayStr(), to: todayStr() }
  if (preset === 'week') {
    const s = new Date(t); s.setDate(t.getDate() - 6)
    return { from: s.toISOString().slice(0, 10), to: todayStr() }
  }
  if (preset === 'month') {
    const s = new Date(t.getFullYear(), t.getMonth(), 1)
    return { from: s.toISOString().slice(0, 10), to: todayStr() }
  }
  return { from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), to: todayStr() }
}

function exportCSV(rows: any[], cols: { key: string; label: string }[], filename: string) {
  const header = cols.map(c => `"${c.label}"`).join(',')
  const body = rows.map(row =>
    cols.map(c => {
      const val = c.key.split('.').reduce((o: any, k) => o?.[k], row) ?? ''
      return `"${String(val).replace(/"/g, '""')}"`
    }).join(',')
  )
  const csv = '﻿' + header + '\n' + body.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function StatCard({ label, value, sub, color = 'emerald', icon: Icon }:
  { label: string; value: string; sub?: string; color?: string; icon: any }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue:    'bg-blue-50 text-blue-600',
    purple:  'bg-purple-50 text-purple-600',
    amber:   'bg-amber-50 text-amber-600',
    red:     'bg-red-50 text-red-600',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm text-slate-500 mt-0.5">{label}</div>
          {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
        </div>
        <Icon size={20} className="opacity-60 mt-1" />
      </div>
    </div>
  )
}

function DateFilter({ preset, setPreset, from, setFrom, to, setTo, onLoad, loading }:
  { preset: DatePreset; setPreset: (p: DatePreset) => void; from: string; setFrom: (v: string) => void;
    to: string; setTo: (v: string) => void; onLoad: () => void; loading: boolean }) {
  const presets: { key: DatePreset; label: string }[] = [
    { key: 'today', label: 'اليوم' },
    { key: 'week',  label: 'هذا الأسبوع' },
    { key: 'month', label: 'هذا الشهر' },
    { key: 'custom', label: 'مخصص' },
  ]
  function pick(p: DatePreset) {
    setPreset(p)
    if (p !== 'custom') { const r = dateRange(p); setFrom(r.from); setTo(r.to) }
  }
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
      <Filter size={15} className="text-slate-400" />
      <div className="flex gap-1">
        {presets.map(p => (
          <button key={p.key} onClick={() => pick(p.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              preset === p.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>{p.label}</button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">من</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <span className="text-sm text-slate-500">إلى</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      )}
      <button onClick={onLoad} disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        تحديث
      </button>
    </div>
  )
}

// ─── SALES TAB ─────────────────────────────────────────────────────────────
function SalesTab({ cur }: { cur: string }) {
  const [preset, setPreset]           = useState<DatePreset>('month')
  const [from, setFrom]               = useState(dateRange('month').from)
  const [to, setTo]                   = useState(dateRange('month').to)
  const [payFilter, setPayFilter]     = useState('')
  const [catFilter, setCatFilter]     = useState('')
  const [categories, setCategories]   = useState<any[]>([])
  const [orders, setOrders]           = useState<any[]>([])
  const [loading, setLoading]         = useState(false)

  async function load() {
    try {
      setLoading(true)
      const data = await window.api.reports.sales({
        from, to,
        paymentMethod: payFilter || undefined,
        categoryId:    catFilter ? Number(catFilter) : undefined,
      })
      setOrders(data)
    } catch (e) {
      console.error('sales report error:', e)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { window.api.categories.getAll().then(setCategories).catch(console.error) }, [])
  useEffect(() => { load() }, [])

  const total       = orders.reduce((s, o) => s + o.total, 0)
  const totalOrders = orders.length
  const avgOrder    = totalOrders > 0 ? total / totalOrders : 0
  const totalTax    = orders.reduce((s, o) => s + (o.taxAmount ?? 0), 0)
  const totalDisc   = orders.reduce((s, o) => s + (o.discountAmount ?? 0), 0)

  const byPayment = Object.entries(
    orders.reduce((acc, o) => {
      const m = o.paymentMethod ?? 'cash'
      acc[m] = (acc[m] ?? 0) + o.total
      return acc
    }, {} as Record<string, number>)
  ).map(([method, value]) => ({ method, value: value as number, label: PAY_LABELS[method] ?? method }))

  const daily = Object.entries(
    orders.reduce((acc, o) => {
      const day = dateStr(o.createdAt).slice(0, 10)
      acc[day] = (acc[day] ?? 0) + o.total
      return acc
    }, {} as Record<string, number>)
  ).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date))

  function doExport() {
    const rows = orders.map(o => ({
      orderNumber:   o.orderNumber,
      date:          dateStr(o.createdAt).slice(0, 10),
      time:          dateStr(o.createdAt).slice(11, 16),
      customer:      o.customer?.name ?? '—',
      paymentMethod: PAY_LABELS[o.paymentMethod] ?? o.paymentMethod,
      itemCount:     o.items?.length ?? 0,
      subtotal:      o.subtotal?.toFixed(2),
      discount:      o.discountAmount?.toFixed(2) ?? '0.00',
      tax:           o.taxAmount?.toFixed(2) ?? '0.00',
      total:         o.total.toFixed(2),
    }))
    exportCSV(rows, [
      { key: 'orderNumber',   label: 'رقم الفاتورة' },
      { key: 'date',          label: 'التاريخ' },
      { key: 'time',          label: 'الوقت' },
      { key: 'customer',      label: 'العميل' },
      { key: 'paymentMethod', label: 'طريقة الدفع' },
      { key: 'itemCount',     label: 'عدد الأصناف' },
      { key: 'subtotal',      label: 'المجموع الفرعي' },
      { key: 'discount',      label: 'الخصم' },
      { key: 'tax',           label: 'الضريبة' },
      { key: 'total',         label: 'الإجمالي' },
    ], `تقرير-المبيعات-${from}-${to}.csv`)
  }

  function doExportItems() {
    const rows: any[] = []
    orders.forEach(o => {
      o.items?.forEach((item: any) => {
        rows.push({
          orderNumber:  o.orderNumber,
          date:         dateStr(o.createdAt).slice(0, 10),
          product:      item.productName,
          category:     item.product?.category?.name ?? '—',
          quantity:     item.quantity,
          unitPrice:    item.unitPrice.toFixed(2),
          total:        item.total.toFixed(2),
          payMethod:    PAY_LABELS[o.paymentMethod] ?? o.paymentMethod,
        })
      })
    })
    exportCSV(rows, [
      { key: 'orderNumber', label: 'رقم الفاتورة' },
      { key: 'date',        label: 'التاريخ' },
      { key: 'product',     label: 'المنتج' },
      { key: 'category',    label: 'الصنف' },
      { key: 'quantity',    label: 'الكمية' },
      { key: 'unitPrice',   label: 'سعر الوحدة' },
      { key: 'total',       label: 'الإجمالي' },
      { key: 'payMethod',   label: 'طريقة الدفع' },
    ], `تقرير-مبيعات-تفصيلي-${from}-${to}.csv`)
  }

  return (
    <div className="space-y-4">
      <DateFilter {...{ preset, setPreset, from, setFrom, to, setTo, onLoad: load, loading }} />

      {/* Extra filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">الصنف</label>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">الكل</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">طريقة الدفع</label>
          <select value={payFilter} onChange={e => setPayFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">الكل</option>
            <option value="cash">كاش</option>
            <option value="card">كارت</option>
            <option value="instapay">InstaPay</option>
            <option value="vodafone">فودافون كاش</option>
          </select>
        </div>
        <div className="flex gap-2 mr-auto">
          <button onClick={doExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-600 text-emerald-600 rounded-lg text-sm hover:bg-emerald-50">
            <Download size={13} /> تصدير الفواتير
          </button>
          <button onClick={doExportItems}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-600 text-blue-600 rounded-lg text-sm hover:bg-blue-50">
            <Download size={13} /> تصدير تفصيلي
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-400 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <Printer size={13} /> طباعة
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي المبيعات"   value={`${total.toFixed(2)} ${cur}`}     color="emerald" icon={TrendingUp} />
        <StatCard label="عدد الفواتير"       value={totalOrders.toString()}            color="blue"    icon={ShoppingCart} />
        <StatCard label="متوسط الفاتورة"     value={`${avgOrder.toFixed(2)} ${cur}`}  color="purple"  icon={BarChart3} />
        <StatCard label="إجمالي الضريبة"     value={`${totalTax.toFixed(2)} ${cur}`}  color="amber"   icon={CreditCard}
          sub={totalDisc > 0 ? `خصم: ${totalDisc.toFixed(2)} ${cur}` : undefined} />
      </div>

      {/* Payment breakdown */}
      {byPayment.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-slate-700 mb-3 text-sm">توزيع طرق الدفع</h3>
            <div className="space-y-2">
              {byPayment.map(b => (
                <div key={b.method} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PAY_COLORS[b.method] ?? '#94a3b8' }} />
                  <span className="text-sm text-slate-600 flex-1">{b.label}</span>
                  <span className="text-sm font-semibold text-slate-700">{b.value.toFixed(2)} {cur}</span>
                  <span className="text-xs text-slate-400">({total > 0 ? ((b.value / total) * 100).toFixed(0) : 0}%)</span>
                </div>
              ))}
            </div>
          </div>
          {daily.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h3 className="font-semibold text-slate-700 mb-3 text-sm">المبيعات اليومية</h3>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={daily} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 9 }} width={50} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(2)} ${cur}`, 'مبيعات']} labelFormatter={d => d} />
                  <Bar dataKey="total" fill="#10b981" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Orders table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden print:shadow-none">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="font-semibold text-slate-700 text-sm">تفاصيل الفواتير ({totalOrders})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="px-4 py-3 text-right">رقم الفاتورة</th>
                <th className="px-4 py-3 text-right">التاريخ</th>
                <th className="px-4 py-3 text-right">العميل</th>
                <th className="px-4 py-3 text-center">طريقة الدفع</th>
                <th className="px-4 py-3 text-center">الأصناف</th>
                <th className="px-4 py-3 text-center">الخصم</th>
                <th className="px-4 py-3 text-center">الضريبة</th>
                <th className="px-4 py-3 text-left font-bold">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">لا توجد بيانات في هذه الفترة</td></tr>
              ) : orders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-slate-600 text-xs">{o.orderNumber}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">
                    <div>{dateStr(o.createdAt).slice(0, 10)}</div>
                    <div className="text-slate-400">{dateStr(o.createdAt).slice(11, 16)}</div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{o.customer?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: (PAY_COLORS[o.paymentMethod] ?? '#94a3b8') + '20',
                               color: PAY_COLORS[o.paymentMethod] ?? '#64748b' }}>
                      {PAY_LABELS[o.paymentMethod] ?? o.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-600">{o.items?.length ?? 0}</td>
                  <td className="px-4 py-2.5 text-center text-slate-500">{(o.discountAmount ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-center text-slate-500">{(o.taxAmount ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-left font-bold text-emerald-600">{o.total.toFixed(2)} {cur}</td>
                </tr>
              ))}
            </tbody>
            {orders.length > 0 && (
              <tfoot className="bg-emerald-50">
                <tr>
                  <td colSpan={5} className="px-4 py-2.5 text-right font-semibold text-slate-600 text-sm">المجموع</td>
                  <td className="px-4 py-2.5 text-center font-semibold text-slate-600">{totalDisc.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-center font-semibold text-slate-600">{totalTax.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-left font-bold text-emerald-700 text-base">{total.toFixed(2)} {cur}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── PURCHASES TAB ─────────────────────────────────────────────────────────
function PurchasesTab({ cur }: { cur: string }) {
  const [preset, setPreset]         = useState<DatePreset>('month')
  const [from, setFrom]             = useState(dateRange('month').from)
  const [to, setTo]                 = useState(dateRange('month').to)
  const [supFilter, setSupFilter]   = useState('')
  const [suppliers, setSuppliers]   = useState<any[]>([])
  const [invoices, setInvoices]     = useState<any[]>([])
  const [loading, setLoading]       = useState(false)

  async function load() {
    try {
      setLoading(true)
      const data = await window.api.reports.purchases({
        from, to,
        supplierId: supFilter ? Number(supFilter) : undefined,
      })
      setInvoices(data)
    } catch (e) {
      console.error('purchases report error:', e)
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { window.api.suppliers.getAll().then(setSuppliers).catch(console.error) }, [])
  useEffect(() => { load() }, [])

  const total       = invoices.reduce((s, i) => s + i.total, 0)
  const totalTax    = invoices.reduce((s, i) => s + (i.taxAmount ?? 0), 0)
  const totalItems  = invoices.reduce((s, i) => s + (i.items?.length ?? 0), 0)

  const monthly = Object.entries(
    invoices.reduce((acc, inv) => {
      const m = inv.invoiceDate.slice(0, 7)
      acc[m] = (acc[m] ?? 0) + inv.total
      return acc
    }, {} as Record<string, number>)
  ).map(([month, total]) => ({ month, total })).sort((a, b) => a.month.localeCompare(b.month))

  function doExport() {
    const rows = invoices.map(inv => ({
      invoiceNumber: inv.invoiceNumber ?? `INV-${inv.id}`,
      date:          dateStr(inv.invoiceDate).slice(0, 10),
      supplier:      inv.supplier?.name ?? '—',
      itemCount:     inv.items?.length ?? 0,
      subtotal:      inv.subtotal.toFixed(2),
      taxRate:       `${inv.taxRate ?? 0}%`,
      tax:           inv.taxAmount?.toFixed(2) ?? '0.00',
      total:         inv.total.toFixed(2),
      status:        inv.status === 'confirmed' ? 'مؤكدة' : 'مسودة',
    }))
    exportCSV(rows, [
      { key: 'invoiceNumber', label: 'رقم الفاتورة' },
      { key: 'date',          label: 'التاريخ' },
      { key: 'supplier',      label: 'المورد' },
      { key: 'itemCount',     label: 'عدد الأصناف' },
      { key: 'subtotal',      label: 'المجموع الفرعي' },
      { key: 'taxRate',       label: 'نسبة الضريبة' },
      { key: 'tax',           label: 'قيمة الضريبة' },
      { key: 'total',         label: 'الإجمالي' },
      { key: 'status',        label: 'الحالة' },
    ], `تقرير-المشتريات-${from}-${to}.csv`)
  }

  function doExportItems() {
    const rows: any[] = []
    invoices.forEach(inv => {
      inv.items?.forEach((item: any) => {
        rows.push({
          invoiceNumber: inv.invoiceNumber ?? `INV-${inv.id}`,
          date:          dateStr(inv.invoiceDate).slice(0, 10),
          supplier:      inv.supplier?.name ?? '—',
          product:       item.product?.name ?? '—',
          category:      item.product?.category?.name ?? '—',
          quantity:      item.quantity,
          unitPrice:     item.unitPrice.toFixed(2),
          total:         item.totalPrice.toFixed(2),
        })
      })
    })
    exportCSV(rows, [
      { key: 'invoiceNumber', label: 'رقم الفاتورة' },
      { key: 'date',          label: 'التاريخ' },
      { key: 'supplier',      label: 'المورد' },
      { key: 'product',       label: 'المنتج' },
      { key: 'category',      label: 'الصنف' },
      { key: 'quantity',      label: 'الكمية' },
      { key: 'unitPrice',     label: 'سعر الوحدة' },
      { key: 'total',         label: 'الإجمالي' },
    ], `تقرير-مشتريات-تفصيلي-${from}-${to}.csv`)
  }

  return (
    <div className="space-y-4">
      <DateFilter {...{ preset, setPreset, from, setFrom, to, setTo, onLoad: load, loading }} />

      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">المورد</label>
          <select value={supFilter} onChange={e => setSupFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">الكل</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mr-auto">
          <button onClick={doExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-600 text-emerald-600 rounded-lg text-sm hover:bg-emerald-50">
            <Download size={13} /> تصدير الفواتير
          </button>
          <button onClick={doExportItems}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-600 text-blue-600 rounded-lg text-sm hover:bg-blue-50">
            <Download size={13} /> تصدير تفصيلي
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-400 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <Printer size={13} /> طباعة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="إجمالي المشتريات"  value={`${total.toFixed(2)} ${cur}`}   color="red"    icon={Package} />
        <StatCard label="عدد الفواتير"       value={invoices.length.toString()}       color="blue"   icon={ShoppingCart} />
        <StatCard label="إجمالي الأصناف"    value={totalItems.toString()}            color="purple" icon={BarChart3} />
        <StatCard label="إجمالي الضريبة"    value={`${totalTax.toFixed(2)} ${cur}`} color="amber"  icon={CreditCard} />
      </div>

      {monthly.length > 1 && (
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-3 text-sm">المشتريات الشهرية</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthly} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={55} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)} ${cur}`, 'مشتريات']} />
              <Bar dataKey="total" fill="#ef4444" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="px-4 py-3 text-right">رقم الفاتورة</th>
              <th className="px-4 py-3 text-right">التاريخ</th>
              <th className="px-4 py-3 text-right">المورد</th>
              <th className="px-4 py-3 text-center">الأصناف</th>
              <th className="px-4 py-3 text-center">المجموع الفرعي</th>
              <th className="px-4 py-3 text-center">الضريبة</th>
              <th className="px-4 py-3 text-left">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-slate-400">لا توجد بيانات في هذه الفترة</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono text-slate-600 text-xs">{inv.invoiceNumber ?? `INV-${inv.id}`}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{dateStr(inv.invoiceDate).slice(0, 10)}</td>
                <td className="px-4 py-2.5 text-slate-700">{inv.supplier?.name ?? '—'}</td>
                <td className="px-4 py-2.5 text-center text-slate-600">{inv.items?.length ?? 0}</td>
                <td className="px-4 py-2.5 text-center text-slate-600">{(inv.subtotal ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2.5 text-center text-slate-500">{(inv.taxAmount ?? 0).toFixed(2)}</td>
                <td className="px-4 py-2.5 text-left font-bold text-red-600">{(inv.total ?? 0).toFixed(2)} {cur}</td>
              </tr>
            ))}
          </tbody>
          {invoices.length > 0 && (
            <tfoot className="bg-red-50">
              <tr>
                <td colSpan={4} className="px-4 py-2.5 text-right font-semibold text-slate-600 text-sm">المجموع</td>
                <td className="px-4 py-2.5 text-center font-semibold text-slate-600">
                  {invoices.reduce((s, i) => s + (i.subtotal ?? 0), 0).toFixed(2)}
                </td>
                <td className="px-4 py-2.5 text-center font-semibold text-slate-600">{totalTax.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-left font-bold text-red-700 text-base">{total.toFixed(2)} {cur}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ─── PRODUCTS TAB ───────────────────────────────────────────────────────────
function ProductsTab({ cur }: { cur: string }) {
  const [data, setData]           = useState<any[]>([])
  const [loading, setLoading]     = useState(false)
  const [search, setSearch]       = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [sortBy, setSortBy]       = useState<'margin' | 'profit' | 'name'>('margin')

  async function load() {
    try {
      setLoading(true)
      const res = await window.api.reports.products()
      setData(res)
    } catch (e) {
      console.error('products report error:', e)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    window.api.categories.getAll().then(setCategories).catch(console.error)
    load()
  }, [])

  const filtered = data
    .filter(p => (!search || p.name.includes(search)) && (!catFilter || p.categoryId === Number(catFilter)))
    .sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : b[sortBy] - a[sortBy])

  const totalStock   = filtered.reduce((s, p) => s + p.currentStock * p.costPrice, 0)
  const avgMargin    = filtered.length > 0 ? filtered.reduce((s, p) => s + p.margin, 0) / filtered.length : 0

  function doExport() {
    exportCSV(filtered.map(p => ({
      name:         p.name,
      category:     p.category?.name ?? '—',
      unit:         p.unit,
      costPrice:    p.costPrice.toFixed(2),
      sellingPrice: p.sellingPrice.toFixed(2),
      profit:       p.profit.toFixed(2),
      margin:       p.margin.toFixed(1) + '%',
      currentStock: p.currentStock,
      stockValue:   (p.currentStock * p.costPrice).toFixed(2),
    })), [
      { key: 'name',         label: 'اسم المنتج' },
      { key: 'category',     label: 'الصنف' },
      { key: 'unit',         label: 'الوحدة' },
      { key: 'costPrice',    label: 'سعر التكلفة' },
      { key: 'sellingPrice', label: 'سعر البيع' },
      { key: 'profit',       label: 'الربح' },
      { key: 'margin',       label: 'هامش الربح' },
      { key: 'currentStock', label: 'المخزون' },
      { key: 'stockValue',   label: 'قيمة المخزون' },
    ], 'تقرير-المنتجات.csv')
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن منتج..."
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48" />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">كل الأصناف</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="margin">ترتيب: هامش الربح</option>
          <option value="profit">ترتيب: الربح</option>
          <option value="name">ترتيب: الاسم</option>
        </select>
        <div className="flex gap-2 mr-auto">
          <button onClick={doExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-600 text-emerald-600 rounded-lg text-sm hover:bg-emerald-50">
            <Download size={13} /> تصدير CSV
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-400 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <Printer size={13} /> طباعة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="عدد المنتجات"    value={filtered.length.toString()}        color="blue"   icon={Package} />
        <StatCard label="متوسط هامش الربح" value={`${avgMargin.toFixed(1)}%`}        color="emerald" icon={TrendingUp} />
        <StatCard label="قيمة المخزون"    value={`${totalStock.toFixed(2)} ${cur}`} color="purple" icon={BarChart3} />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="px-4 py-3 text-right">المنتج</th>
              <th className="px-4 py-3 text-right">الصنف</th>
              <th className="px-4 py-3 text-center">سعر التكلفة</th>
              <th className="px-4 py-3 text-center">سعر البيع</th>
              <th className="px-4 py-3 text-center">الربح</th>
              <th className="px-4 py-3 text-center">هامش الربح</th>
              <th className="px-4 py-3 text-center">المخزون</th>
              <th className="px-4 py-3 text-center">قيمة المخزون</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(p => {
              const stockVal = p.currentStock * p.costPrice
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{p.category?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center text-slate-600">{p.costPrice.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-center text-emerald-600 font-semibold">{p.sellingPrice.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={p.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}>{p.profit.toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`font-bold ${p.margin >= 20 ? 'text-emerald-600' : p.margin >= 10 ? 'text-amber-500' : 'text-red-500'}`}>
                      {p.margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-600">{p.currentStock} {p.unit}</td>
                  <td className="px-4 py-2.5 text-center text-slate-600">{stockVal.toFixed(2)} {cur}</td>
                </tr>
              )
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={7} className="px-4 py-2.5 text-right font-semibold text-slate-600 text-sm">إجمالي قيمة المخزون</td>
                <td className="px-4 py-2.5 text-center font-bold text-purple-600">{totalStock.toFixed(2)} {cur}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ─── STOCK TAB ──────────────────────────────────────────────────────────────
function StockTab({ cur }: { cur: string }) {
  const [data, setData]         = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'ok'>('all')

  useEffect(() => {
    setLoading(true)
    window.api.reports.stock()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { console.error('stock report error:', e); setLoading(false) })
  }, [])

  const all    = data.filter(p => !search || p.name.includes(search))
  const low    = all.filter(p => p.minStockAlert > 0 && p.currentStock <= p.minStockAlert)
  const shown  = statusFilter === 'low' ? low : statusFilter === 'ok' ? all.filter(p => !low.includes(p)) : all

  const totalValue = all.reduce((s, p) => s + p.currentStock * p.costPrice, 0)

  function doExport() {
    exportCSV(shown.map(p => ({
      name:         p.name,
      category:     p.category?.name ?? '—',
      unit:         p.unit,
      currentStock: p.currentStock,
      minAlert:     p.minStockAlert,
      reorderLevel: p.reorderLevel,
      costPrice:    p.costPrice.toFixed(2),
      stockValue:   (p.currentStock * p.costPrice).toFixed(2),
      status:       (p.minStockAlert > 0 && p.currentStock <= p.minStockAlert) ? 'منخفض' : 'طبيعي',
    })), [
      { key: 'name',         label: 'المنتج' },
      { key: 'category',     label: 'الصنف' },
      { key: 'unit',         label: 'الوحدة' },
      { key: 'currentStock', label: 'المخزون الحالي' },
      { key: 'minAlert',     label: 'الحد الأدنى' },
      { key: 'reorderLevel', label: 'نقطة إعادة الطلب' },
      { key: 'costPrice',    label: 'سعر التكلفة' },
      { key: 'stockValue',   label: 'قيمة المخزون' },
      { key: 'status',       label: 'الحالة' },
    ], 'تقرير-المخزون.csv')
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm flex flex-wrap gap-3 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن منتج..."
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48" />
        <div className="flex gap-1">
          {[['all','الكل'],['low','منخفض'],['ok','طبيعي']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v as any)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === v ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-2 mr-auto">
          <button onClick={doExport}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-600 text-emerald-600 rounded-lg text-sm hover:bg-emerald-50">
            <Download size={13} /> تصدير CSV
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-400 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
            <Printer size={13} /> طباعة
          </button>
        </div>
      </div>

      {low.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-semibold text-amber-700 flex items-center gap-2 mb-2">
            <AlertTriangle size={15} /> {low.length} منتج تحت الحد الأدنى
          </h3>
          <div className="flex flex-wrap gap-2">
            {low.map(p => (
              <span key={p.id} className="text-xs bg-white border border-amber-200 rounded-lg px-2.5 py-1 text-amber-800">
                {p.name} — <span className="font-bold text-red-500">{p.currentStock}</span>/{p.minStockAlert} {p.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="إجمالي المنتجات" value={all.length.toString()}              color="blue"   icon={Package} />
        <StatCard label="منتجات منخفضة"   value={low.length.toString()}              color="red"    icon={AlertTriangle} />
        <StatCard label="قيمة المخزون"    value={`${totalValue.toFixed(2)} ${cur}`}  color="purple" icon={TrendingUp} />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="px-4 py-3 text-right">المنتج</th>
              <th className="px-4 py-3 text-right">الصنف</th>
              <th className="px-4 py-3 text-center">المخزون</th>
              <th className="px-4 py-3 text-center">الحد الأدنى</th>
              <th className="px-4 py-3 text-center">نقطة إعادة الطلب</th>
              <th className="px-4 py-3 text-center">سعر التكلفة</th>
              <th className="px-4 py-3 text-center">قيمة المخزون</th>
              <th className="px-4 py-3 text-center">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map(p => {
              const isLow   = p.minStockAlert > 0 && p.currentStock <= p.minStockAlert
              const stockVal = p.currentStock * p.costPrice
              return (
                <tr key={p.id} className={`hover:bg-slate-50 ${isLow ? 'bg-red-50/50' : ''}`}>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{p.category?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`font-bold ${isLow ? 'text-red-500' : 'text-slate-700'}`}>{p.currentStock}</span>
                    <span className="text-xs text-slate-400 mr-1">{p.unit}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-500">{p.minStockAlert}</td>
                  <td className="px-4 py-2.5 text-center text-slate-500">{p.reorderLevel}</td>
                  <td className="px-4 py-2.5 text-center text-slate-600">{p.costPrice.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-center text-slate-600">{stockVal.toFixed(2)} {cur}</td>
                  <td className="px-4 py-2.5 text-center">
                    {isLow
                      ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">منخفض</span>
                      : <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">طبيعي</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {shown.length > 0 && (
            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={6} className="px-4 py-2.5 text-right font-semibold text-slate-600 text-sm">إجمالي قيمة المخزون</td>
                <td className="px-4 py-2.5 text-center font-bold text-purple-600">
                  {shown.reduce((s, p) => s + p.currentStock * p.costPrice, 0).toFixed(2)} {cur}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
export default function Reports() {
  const [tab, setTab] = useState<Tab>('sales')
  const { settings }  = useSettings()
  const cur           = settings.currency || 'ج.م'

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'sales',     label: 'تقرير المبيعات',   icon: TrendingUp },
    { key: 'purchases', label: 'تقرير المشتريات',  icon: ShoppingCart },
    { key: 'products',  label: 'تقرير المنتجات',   icon: Package },
    { key: 'stock',     label: 'تقرير المخزون',    icon: BarChart3 },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">التقارير</h1>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-50 shadow-sm'
            }`}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <ReportErrorBoundary>
        {tab === 'sales'     && <SalesTab     cur={cur} />}
        {tab === 'purchases' && <PurchasesTab cur={cur} />}
        {tab === 'products'  && <ProductsTab  cur={cur} />}
        {tab === 'stock'     && <StockTab     cur={cur} />}
      </ReportErrorBoundary>
    </div>
  )
}
