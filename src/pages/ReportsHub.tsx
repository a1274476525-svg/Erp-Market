import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, BarChart3, TrendingUp, BookOpen, Users, Package, Landmark, Activity, FileText, Receipt } from 'lucide-react'

// Financial
import { IncomeStatement, BalanceSheet, CashFlow, EquityChanges } from './reports/FinancialGroup'
// Statements
import { AccountStatement, TrialBalanceWithMovement, TrialBalance, ExpensesReport, JournalReport } from './reports/StatementsGroup'
// Tax
import { VatSummary, VatDetails, VatDeclaration } from './reports/TaxGroup'
// Parties
import { SalesReport, SalesOrders, CustomerStatement, ArAging, PurchasesReport, SupplierStatement, ApAging, ContactAttachments } from './reports/PartiesGroup'
import ReturnsReport from './reports/ReturnsReport'
// Inventory
import { InventorySummary } from './reports/InventoryGroup'
// Banks
import { BanksSummary, BankReconciliation } from './reports/BanksGroup'
// Performance
import { ExecutiveSummary } from './reports/PerformanceGroup'
// Users
import { UserMovements, UserActivity } from './reports/UsersGroup'

interface ReportItem {
  id: string
  label: string
}

interface ReportGroup {
  id: string
  label: string
  icon: React.ElementType
  color: string
  reports: ReportItem[]
}

const GROUPS: ReportGroup[] = [
  {
    id: 'financial', label: 'القوائم المالية', icon: TrendingUp, color: 'text-blue-600',
    reports: [
      { id: 'income-statement', label: 'قائمة الدخل' },
      { id: 'balance-sheet',    label: 'قائمة المركز المالي' },
      { id: 'cash-flow',        label: 'قائمة التدفقات النقدية' },
      { id: 'equity-changes',   label: 'قائمة التغيرات في حقوق الملكية' },
    ],
  },
  {
    id: 'statements', label: 'كشوف الحسابات', icon: BookOpen, color: 'text-violet-600',
    reports: [
      { id: 'account-statement',       label: 'كشف الحساب' },
      { id: 'trial-balance-movement',  label: 'ميزان المراجعة مع الحركة' },
      { id: 'trial-balance',           label: 'ميزان المراجعة' },
      { id: 'expenses-report',         label: 'تقرير المصروفات' },
      { id: 'journal-report',          label: 'تقرير قيود اليومية' },
    ],
  },
  {
    id: 'tax', label: 'تقارير الضريبة', icon: Receipt, color: 'text-green-600',
    reports: [
      { id: 'vat-summary',     label: 'ملخص ض.ق.م' },
      { id: 'vat-details',     label: 'تفاصيل ض.ق.م' },
      { id: 'vat-declaration', label: 'إقرار ض.ق.م' },
    ],
  },
  {
    id: 'parties', label: 'العملاء والموردون', icon: Users, color: 'text-emerald-600',
    reports: [
      { id: 'sales-report',        label: 'تقرير المبيعات' },
      { id: 'sales-orders',        label: 'تقرير أوامر البيع' },
      { id: 'customer-statement',  label: 'كشف حساب العملاء' },
      { id: 'ar-aging',            label: 'أعمار الذمم المدينة' },
      { id: 'purchases-report',    label: 'تقرير المشتريات' },
      { id: 'returns-report',      label: 'تقرير المرتجعات' },
      { id: 'supplier-statement',  label: 'كشف حساب الموردين' },
      { id: 'ap-aging',            label: 'أعمار الذمم الدائنة' },
      { id: 'contact-attachments', label: 'مرفقات جهة الاتصال' },
    ],
  },
  {
    id: 'inventory', label: 'تقارير المخزون', icon: Package, color: 'text-amber-600',
    reports: [
      { id: 'inventory-summary', label: 'تقرير ملخص عناصر المخزون' },
    ],
  },
  {
    id: 'banks', label: 'البنوك والنقدية', icon: Landmark, color: 'text-sky-600',
    reports: [
      { id: 'banks-summary',      label: 'ملخص البنوك والنقدية' },
      { id: 'bank-reconciliation', label: 'ملخص التسويات البنكية' },
    ],
  },
  {
    id: 'performance', label: 'تقارير الأداء', icon: BarChart3, color: 'text-indigo-600',
    reports: [
      { id: 'executive-summary', label: 'ملخص تنفيذي' },
    ],
  },
  {
    id: 'users', label: 'تقارير المستخدمين', icon: Activity, color: 'text-rose-600',
    reports: [
      { id: 'user-movements', label: 'سجل حركة المستخدمين' },
      { id: 'user-activity',  label: 'سجل نشاط المستخدمين' },
    ],
  },
]

const REPORT_MAP: Record<string, React.ComponentType> = {
  'income-statement':      IncomeStatement,
  'balance-sheet':         BalanceSheet,
  'cash-flow':             CashFlow,
  'equity-changes':        EquityChanges,
  'account-statement':     AccountStatement,
  'trial-balance-movement': TrialBalanceWithMovement,
  'trial-balance':         TrialBalance,
  'expenses-report':       ExpensesReport,
  'journal-report':        JournalReport,
  'vat-summary':           VatSummary,
  'vat-details':           VatDetails,
  'vat-declaration':       VatDeclaration,
  'sales-report':          SalesReport,
  'sales-orders':          SalesOrders,
  'customer-statement':    CustomerStatement,
  'ar-aging':              ArAging,
  'purchases-report':      PurchasesReport,
  'returns-report':        ReturnsReport,
  'supplier-statement':    SupplierStatement,
  'ap-aging':              ApAging,
  'contact-attachments':   ContactAttachments,
  'inventory-summary':     InventorySummary,
  'banks-summary':         BanksSummary,
  'bank-reconciliation':   BankReconciliation,
  'executive-summary':     ExecutiveSummary,
  'user-movements':        UserMovements,
  'user-activity':         UserActivity,
}

function Sidebar({ activeId }: { activeId: string | undefined }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    GROUPS.forEach(g => {
      init[g.id] = g.reports.some(r => r.id === activeId)
    })
    if (!activeId) init[GROUPS[0].id] = true
    return init
  })

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-l border-slate-200 overflow-y-auto">
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-violet-600" />
          <h2 className="text-sm font-bold text-slate-800">التقارير</h2>
        </div>
      </div>
      <div className="py-2">
        {GROUPS.map(group => {
          const Icon = group.icon
          const isOpen = open[group.id] ?? false
          const hasActive = group.reports.some(r => r.id === activeId)
          return (
            <div key={group.id}>
              <button
                onClick={() => setOpen(o => ({ ...o, [group.id]: !o[group.id] }))}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                  hasActive ? 'text-violet-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={14} className={hasActive ? 'text-violet-600' : group.color} />
                  {group.label}
                </span>
                <ChevronDown size={12} className={`text-slate-400 transition-transform duration-150 ${isOpen ? '' : '-rotate-90'}`} />
              </button>
              {isOpen && (
                <div className="pb-1">
                  {group.reports.map(report => (
                    <button
                      key={report.id}
                      onClick={() => navigate(`/reports/${report.id}`)}
                      className={`w-full text-right px-6 py-2 text-sm transition-colors block ${
                        activeId === report.id
                          ? 'text-violet-700 bg-violet-50 font-medium border-r-2 border-violet-600'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {report.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function WelcomePlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 select-none">
      <BarChart3 size={48} className="text-slate-200 mb-4" />
      <h3 className="text-base font-semibold text-slate-500 mb-1">مركز التقارير</h3>
      <p className="text-sm">اختر تقريراً من القائمة الجانبية للبدء</p>
    </div>
  )
}

export default function ReportsHub() {
  const { reportId } = useParams<{ reportId?: string }>()
  const ReportComponent = reportId ? REPORT_MAP[reportId] : null

  return (
    <div className="flex h-full" dir="rtl">
      <Sidebar activeId={reportId} />
      <main className="flex-1 overflow-y-auto p-6">
        {ReportComponent
          ? <ReportComponent />
          : <WelcomePlaceholder />
        }
      </main>
    </div>
  )
}
