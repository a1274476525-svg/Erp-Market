import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Scale, FileText, Receipt, RefreshCw } from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'

interface FinancialData {
  period: { from?: string; to?: string }
  revenue: { total: number; vat: number }
  purchases: { total: number; vat: number }
  cogs: number
  grossProfit: number
  expenses: { total: number; byCategory: Record<string, number> }
  netProfit: number
  vat: { collected: number; paid: number; net: number }
  inventory: { value: number }
  banks: { cash: number; bank: number; accounts: any[] }
  trialBalance: { code: string; name: string; type: string; debit: number; credit: number }[]
  ordersCount: number
  invoicesCount: number
}

type ReportTab = 'income' | 'balance' | 'trial' | 'vat'

const TAB_LABELS: Record<ReportTab, string> = {
  income:  'قائمة الدخل',
  balance: 'الميزانية العمومية',
  trial:   'ميزان المراجعة',
  vat:     'تقرير الضرائب',
}

function StatCard({ label, value, currency, sub, color = 'slate' }: {
  label: string; value: number; currency: string; sub?: string; color?: string
}) {
  const colors: Record<string, string> = {
    slate: 'text-slate-800', emerald: 'text-emerald-600', red: 'text-red-600', blue: 'text-blue-600', amber: 'text-amber-600'
  }
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colors[color] ?? colors.slate}`}>
        {value.toFixed(2)} <span className="text-sm font-normal text-slate-400">{currency}</span>
      </div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}

function Row({ label, value, currency, bold, indent, color }: {
  label: string; value: number; currency: string; bold?: boolean; indent?: number; color?: string
}) {
  const colorCls = color === 'emerald' ? 'text-emerald-600' : color === 'red' ? 'text-red-600' : 'text-slate-700'
  return (
    <div className={`flex justify-between py-2 px-4 border-b border-slate-100 ${bold ? 'font-bold bg-slate-50' : ''}`}
         style={{ paddingRight: `${16 + (indent ?? 0) * 16}px` }}>
      <span className="text-slate-600">{label}</span>
      <span className={`${colorCls} ${bold ? 'font-bold' : ''}`}>{value.toFixed(2)} {currency}</span>
    </div>
  )
}

export default function FinancialReports() {
  const [from, setFrom]     = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) })
  const [to, setTo]         = useState(new Date().toISOString().slice(0, 10))
  const [data, setData]     = useState<FinancialData | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab]       = useState<ReportTab>('income')
  const { settings }        = useSettings()
  const cur                 = settings.currency

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await window.api.financialReports.get({ from, to })
      setData(d)
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  if (!data && loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <RefreshCw size={24} className="animate-spin text-slate-400" />
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">التقارير المالية</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 text-sm">
            <span className="text-slate-500">من</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border-none outline-none text-sm" />
            <span className="text-slate-500">إلى</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border-none outline-none text-sm" />
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> تحديث
          </button>
        </div>
      </div>

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="إجمالي الإيرادات" value={data.revenue.total} currency={cur} color="emerald" sub={`${data.ordersCount} فاتورة مبيعات`} />
            <StatCard label="تكلفة البضاعة المباعة" value={data.cogs} currency={cur} color="amber" />
            <StatCard label="مجمل الربح" value={data.grossProfit} currency={cur} color={data.grossProfit >= 0 ? 'emerald' : 'red'} />
            <StatCard label="صافي الربح" value={data.netProfit} currency={cur} color={data.netProfit >= 0 ? 'emerald' : 'red'} sub={`مصاريف: ${data.expenses.total.toFixed(2)} ${cur}`} />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(Object.keys(TAB_LABELS) as ReportTab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {t === 'income'  && <TrendingUp size={15} />}
                {t === 'balance' && <Scale size={15} />}
                {t === 'trial'   && <FileText size={15} />}
                {t === 'vat'     && <Receipt size={15} />}
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Income Statement */}
          {tab === 'income' && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-800 text-white text-sm font-semibold">قائمة الدخل</div>
              <Row label="إيرادات المبيعات (بدون ضريبة)" value={data.revenue.total} currency={cur} />
              <Row label="تكلفة البضاعة المباعة" value={-data.cogs} currency={cur} indent={1} color={data.cogs > 0 ? 'red' : undefined} />
              <Row label="مجمل الربح" value={data.grossProfit} currency={cur} bold color={data.grossProfit >= 0 ? 'emerald' : 'red'} />
              <div className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50 uppercase tracking-wide">المصاريف التشغيلية</div>
              {Object.entries(data.expenses.byCategory).map(([cat, amt]) => (
                <Row key={cat} label={cat} value={-amt} currency={cur} indent={1} color="red" />
              ))}
              {data.expenses.total === 0 && <div className="px-8 py-2 text-slate-400 text-sm">لا توجد مصاريف في هذه الفترة</div>}
              <Row label="إجمالي المصاريف" value={-data.expenses.total} currency={cur} bold color="red" />
              <Row label="صافي الربح / الخسارة" value={data.netProfit} currency={cur} bold color={data.netProfit >= 0 ? 'emerald' : 'red'} />
            </div>
          )}

          {/* Balance Sheet */}
          {tab === 'balance' && (
            <div className="grid grid-cols-2 gap-4">
              {/* Assets */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-blue-700 text-white text-sm font-semibold">الأصول</div>
                <Row label="المخزون (قيمة دفترية)" value={data.inventory.value} currency={cur} indent={1} />
                <Row label="الصناديق النقدية والعهد" value={data.banks.cash} currency={cur} indent={1} />
                <Row label="أرصدة البنوك" value={data.banks.bank} currency={cur} indent={1} />
                <Row label="إجمالي الأصول" value={data.inventory.value + data.banks.cash + data.banks.bank} currency={cur} bold color="blue" />
              </div>
              {/* Liabilities + Equity */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-red-700 text-white text-sm font-semibold">الخصوم وحقوق الملكية</div>
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50">الخصوم</div>
                <Row label="ضريبة القيمة المضافة المستحقة" value={data.vat.net > 0 ? data.vat.net : 0} currency={cur} indent={1} />
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 bg-slate-50">حقوق الملكية</div>
                <Row label="صافي الربح / الخسارة" value={data.netProfit} currency={cur} indent={1} color={data.netProfit >= 0 ? 'emerald' : 'red'} />
                <Row label="إجمالي الخصوم وحقوق الملكية"
                  value={(data.vat.net > 0 ? data.vat.net : 0) + data.netProfit}
                  currency={cur} bold color="red" />
              </div>
              <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                <strong>ملاحظة:</strong> هذه الميزانية تقديرية ومبسطة بناءً على بيانات المبيعات والمشتريات والمصاريف المسجلة. لميزانية كاملة يجب تسجيل كافة الأصول والخصوم في دليل الحسابات.
              </div>
            </div>
          )}

          {/* Trial Balance */}
          {tab === 'trial' && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-800 text-white text-sm font-semibold">ميزان المراجعة (مبسط)</div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-right">كود</th>
                    <th className="px-4 py-3 text-right">الحساب</th>
                    <th className="px-4 py-3 text-center">النوع</th>
                    <th className="px-4 py-3 text-center">مدين</th>
                    <th className="px-4 py-3 text-center">دائن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.trialBalance.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{row.code}</td>
                      <td className="px-4 py-2.5 text-slate-800">{row.name}</td>
                      <td className="px-4 py-2.5 text-center text-xs text-slate-500">{row.type}</td>
                      <td className="px-4 py-2.5 text-center font-medium">{row.debit > 0 ? row.debit.toFixed(2) : '—'}</td>
                      <td className="px-4 py-2.5 text-center font-medium">{row.credit > 0 ? row.credit.toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 font-bold">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right">الإجماليات</td>
                    <td className="px-4 py-3 text-center text-blue-700">
                      {data.trialBalance.reduce((s, r) => s + r.debit, 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center text-emerald-700">
                      {data.trialBalance.reduce((s, r) => s + r.credit, 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <div className="p-4 bg-amber-50 border-t border-amber-200 text-xs text-amber-700">
                هذا ميزان مراجعة مبسط يعتمد على عمليات المبيعات والمشتريات والمصاريف. لميزان مراجعة دقيق يجب استخدام نظام محاسبة قيد مزدوج كامل.
              </div>
            </div>
          )}

          {/* VAT Report */}
          {tab === 'vat' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="ض.ق.م المحصلة (مبيعات)" value={data.vat.collected} currency={cur} color="red" />
                <StatCard label="ض.ق.م المدفوعة (مشتريات)" value={data.vat.paid} currency={cur} color="blue" />
                <StatCard label="صافي ض.ق.م المستحق" value={data.vat.net} currency={cur} color={data.vat.net >= 0 ? 'red' : 'emerald'} />
              </div>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-slate-800 text-white text-sm font-semibold">تفاصيل الضريبة</div>
                <Row label="إجمالي المبيعات (قبل الضريبة)" value={data.revenue.total} currency={cur} />
                <Row label="ضريبة القيمة المضافة المحصلة (14%)" value={data.vat.collected} currency={cur} indent={1} color="red" />
                <Row label="إجمالي المشتريات (قبل الضريبة)" value={data.purchases.total} currency={cur} />
                <Row label="ضريبة القيمة المضافة المدفوعة" value={data.vat.paid} currency={cur} indent={1} color="blue" />
                <Row label={data.vat.net >= 0 ? 'ضريبة مستحقة للضريبة' : 'ضريبة محصلة أقل من المدفوع (رصيد لصالحك)'}
                  value={Math.abs(data.vat.net)} currency={cur} bold color={data.vat.net >= 0 ? 'red' : 'emerald'} />
              </div>
              <div className="bg-white rounded-xl shadow-sm p-5">
                <div className="text-sm font-semibold text-slate-700 mb-3">الإقرار الضريبي الدوري</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500 text-xs mb-1">الفترة الضريبية</div>
                    <div className="font-medium">{from} — {to}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs mb-1">عدد الفواتير</div>
                    <div className="font-medium">{data.ordersCount} مبيعات / {data.invoicesCount} مشتريات</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs mb-1">وعاء ضريبة المبيعات</div>
                    <div className="font-medium text-slate-800">{data.revenue.total.toFixed(2)} {cur}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs mb-1">وعاء ضريبة المشتريات</div>
                    <div className="font-medium text-slate-800">{data.purchases.total.toFixed(2)} {cur}</div>
                  </div>
                  <div className="col-span-2 border-t pt-3">
                    <div className="text-slate-500 text-xs mb-1">صافي الضريبة المستحقة</div>
                    <div className={`text-xl font-bold ${data.vat.net >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {data.vat.net.toFixed(2)} {cur}
                      <span className="text-xs font-normal text-slate-400 mr-2">
                        {data.vat.net >= 0 ? '(مبلغ مستحق الدفع للضرائب)' : '(رصيد دائن لصالح المنشأة)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
