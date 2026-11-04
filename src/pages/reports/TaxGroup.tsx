import { useState, useCallback, useEffect } from 'react'
import { DateFilter, StatCards, ReportTitle, Empty, Tbl, fmt, fmtDate, useCur, thisMonth, today } from './shared'

// ─── ملخص ض.ق.م ───────────────────────────────────────────────
export function VatSummary() {
  const cur = useCur()
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.reports.financial({ from, to })
    setData(d)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const vat = data?.vat ?? {}
  const collected = vat.collected ?? 0
  const deductible = vat.deductible ?? 0
  const net = vat.net ?? 0

  return (
    <div>
      <ReportTitle title="ملخص ضريبة القيمة المضافة" sub="ملخص ض.ق.م المحصّلة والمدفوعة" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {data && (
        <>
          <StatCards cards={[
            { label: 'ض.ق.م المحصّلة (مبيعات)',  value: `${fmt(collected)} ${cur}`, color: 'emerald' },
            { label: 'ض.ق.م القابلة للخصم (مشتريات)', value: `${fmt(deductible)} ${cur}`, color: 'amber' },
            { label: 'صافي ض.ق.م المستحق',       value: `${fmt(net)} ${cur}`, color: net >= 0 ? 'red' : 'emerald' },
          ]} />
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-800 text-white text-sm font-semibold">ملخص ض.ق.م — {from} إلى {to}</div>
            {[
              { label: 'الضريبة المحصّلة على المبيعات', value: collected, color: 'text-emerald-700', bold: false },
              { label: 'الضريبة القابلة للخصم من المشتريات', value: deductible, color: 'text-amber-600', bold: false },
              { label: net >= 0 ? 'صافي الضريبة المستحقة للدفع' : 'فائض ضريبة (قابل للاسترداد)', value: Math.abs(net), color: net >= 0 ? 'text-red-700' : 'text-emerald-700', bold: true, final: true },
            ].map((r: any, i) => (
              <div key={i} className={`flex justify-between py-3 px-4 border-b border-slate-100 ${r.bold ? 'bg-slate-50 font-bold' : ''} ${r.final ? 'border-t-2 border-slate-300' : ''}`}>
                <span className="text-slate-600">{r.label}</span>
                <span className={r.color}>{fmt(r.value)} {cur}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── تفاصيل ض.ق.م ─────────────────────────────────────────────
export function VatDetails() {
  const cur = useCur()
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await window.api.reports.vatDetails({ from, to })
    setData(d)
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const totals = data?.totals ?? {}

  return (
    <div>
      <ReportTitle title="تفاصيل ضريبة القيمة المضافة" sub="جميع المعاملات الضريبية خلال الفترة" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      {data && (
        <>
          <StatCards cards={[
            { label: 'إيرادات المبيعات (بدون ضريبة)',  value: `${fmt(totals.salesSubtotal ?? 0)} ${cur}`, color: 'emerald' },
            { label: 'ض.ق.م على المبيعات',             value: `${fmt(totals.salesTax ?? 0)} ${cur}`, color: 'emerald' },
            { label: 'مشتريات (بدون ضريبة)',           value: `${fmt(totals.purchaseSubtotal ?? 0)} ${cur}`, color: 'amber' },
            { label: 'ض.ق.م على المشتريات',           value: `${fmt(totals.purchaseTax ?? 0)} ${cur}`, color: 'amber' },
          ]} />
          <h3 className="text-sm font-semibold text-slate-700 mb-2 mt-4">معاملات المبيعات</h3>
          {!data.salesRows?.length ? <Empty msg="لا توجد مبيعات" /> : (
            <Tbl heads={[{ label: 'التاريخ' }, { label: 'رقم الفاتورة' }, { label: 'الإجمالي بدون ضريبة', left: true }, { label: 'الضريبة', left: true }, { label: 'الإجمالي مع الضريبة', left: true }]}>
              {data.salesRows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-sm text-slate-500">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2 text-sm font-mono">#{r.ref}</td>
                  <td className="px-4 py-2 text-sm text-left">{fmt(r.subtotal)} {cur}</td>
                  <td className="px-4 py-2 text-sm text-left text-emerald-700">{fmt(r.tax)} {cur}</td>
                  <td className="px-4 py-2 text-sm text-left font-medium">{fmt(r.total)} {cur}</td>
                </tr>
              ))}
            </Tbl>
          )}
          <h3 className="text-sm font-semibold text-slate-700 mb-2 mt-6">معاملات المشتريات</h3>
          {!data.purchaseRows?.length ? <Empty msg="لا توجد مشتريات" /> : (
            <Tbl heads={[{ label: 'التاريخ' }, { label: 'رقم الفاتورة' }, { label: 'الإجمالي بدون ضريبة', left: true }, { label: 'الضريبة', left: true }, { label: 'الإجمالي مع الضريبة', left: true }]}>
              {data.purchaseRows.map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-sm text-slate-500">{fmtDate(r.date)}</td>
                  <td className="px-4 py-2 text-sm font-mono">#{r.ref}</td>
                  <td className="px-4 py-2 text-sm text-left">{fmt(r.subtotal)} {cur}</td>
                  <td className="px-4 py-2 text-sm text-left text-amber-600">{fmt(r.tax)} {cur}</td>
                  <td className="px-4 py-2 text-sm text-left font-medium">{fmt(r.total)} {cur}</td>
                </tr>
              ))}
            </Tbl>
          )}
        </>
      )}
    </div>
  )
}

// ─── إقرار ض.ق.م ──────────────────────────────────────────────
export function VatDeclaration() {
  const cur = useCur()
  const [from, setFrom] = useState(thisMonth())
  const [to, setTo]     = useState(today())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [fin, det] = await Promise.all([
      window.api.reports.financial({ from, to }),
      window.api.reports.vatDetails({ from, to }),
    ])
    setData({ fin, det })
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  if (!data) return (
    <div>
      <ReportTitle title="إقرار ضريبة القيمة المضافة" sub="نموذج الإقرار الضريبي الدوري" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
    </div>
  )

  const vat = data.fin?.vat ?? {}
  const det = data.det?.totals ?? {}
  const net = vat.net ?? 0

  return (
    <div>
      <ReportTitle title="إقرار ضريبة القيمة المضافة" sub="نموذج الإقرار الضريبي الدوري" />
      <DateFilter from={from} setFrom={setFrom} to={to} setTo={setTo} onRun={load} loading={loading} />
      <div className="bg-white rounded-xl shadow-sm overflow-hidden max-w-2xl">
        <div className="px-6 py-4 bg-green-700 text-white">
          <h3 className="font-bold text-base">إقرار ضريبة القيمة المضافة</h3>
          <p className="text-green-100 text-sm mt-0.5">الفترة: {from} — {to}</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="border-b pb-4">
            <h4 className="text-sm font-bold text-slate-700 mb-3">أولاً: المبيعات الخاضعة للضريبة</h4>
            <div className="flex justify-between text-sm py-1"><span className="text-slate-600">إجمالي المبيعات بدون ضريبة</span><span>{fmt(det.salesSubtotal ?? 0)} {cur}</span></div>
            <div className="flex justify-between text-sm py-1"><span className="text-slate-600">الضريبة المحصّلة (15%)</span><span className="text-emerald-700 font-medium">{fmt(vat.collected ?? 0)} {cur}</span></div>
          </div>
          <div className="border-b pb-4">
            <h4 className="text-sm font-bold text-slate-700 mb-3">ثانياً: المشتريات الخاضعة للضريبة</h4>
            <div className="flex justify-between text-sm py-1"><span className="text-slate-600">إجمالي المشتريات بدون ضريبة</span><span>{fmt(det.purchaseSubtotal ?? 0)} {cur}</span></div>
            <div className="flex justify-between text-sm py-1"><span className="text-slate-600">ضريبة المدخلات القابلة للخصم</span><span className="text-amber-600 font-medium">{fmt(vat.deductible ?? 0)} {cur}</span></div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <div className={`flex justify-between text-base font-bold py-1 ${net >= 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              <span>{net >= 0 ? 'الضريبة المستحقة للسداد' : 'فائض ضريبة قابل للاسترداد'}</span>
              <span>{fmt(Math.abs(net))} {cur}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">* هذا تقرير إرشادي. يرجى مراجعة المحاسب المعتمد قبل التقديم الرسمي.</p>
        </div>
      </div>
    </div>
  )
}
