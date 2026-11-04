import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, ShoppingCart, Users, Truck,
  FileText, BarChart3, ArrowUpDown, ChevronDown,
  ClipboardList, ClipboardCheck, ArrowLeftRight, GitBranch,
  Send, Trash2, Settings, Activity, LogOut, ShieldCheck,
  AlertTriangle, X, Tag, MonitorSmartphone, UserCheck,
  RotateCcw, Layers, Wallet, Landmark, BookOpen, TrendingUp,
} from 'lucide-react'
import type { Product } from './types'

import { AuthProvider, useAuth }         from './contexts/AuthContext'
import { SettingsProvider, useSettings } from './contexts/SettingsContext'

import Dashboard        from './pages/Dashboard'
import Login            from './pages/Login'
import POSPage          from './pages/POS'
import SalesPage        from './pages/Sales'
import ReturnsPage      from './pages/SaleReturns'
import ProductsPage     from './pages/Products'
import CategoriesPage   from './pages/Categories'
import CustomersPage    from './pages/Customers'
import PromotionsPage   from './pages/Promotions'
import SuppliersPage    from './pages/Suppliers'
import PurchaseRequestsPage from './pages/PurchaseRequests'
import PurchaseInvoicesPage from './pages/PurchaseInvoices'
import StockMovementsPage   from './pages/StockMovements'
import WasteTrackingPage    from './pages/WasteTracking'
import InventoryCountPage   from './pages/InventoryCount'
import BranchesPage         from './pages/Branches'
import TransferRequestsPage from './pages/TransferRequests'
import TransfersPage        from './pages/Transfers'
import ReportsPage          from './pages/Reports'
import ReportsHub           from './pages/ReportsHub'
import SettingsPage         from './pages/Settings'
import UsersPage            from './pages/Users'
import RolesPage            from './pages/Roles'
import ActivityLogPage      from './pages/ActivityLog'
import ExpensesPage         from './pages/Expenses'
import ChartOfAccountsPage  from './pages/ChartOfAccounts'
import BanksPage            from './pages/Banks'
import FinancialReportsPage from './pages/FinancialReports'
import JournalEntriesPage   from './pages/JournalEntries'

interface NavItem { to: string; label: string; icon: React.ElementType; exact?: boolean }

function NavGroup({ label, icon: Icon, items, defaultOpen = true }: {
  label: string; icon: React.ElementType
  items: NavItem[]; defaultOpen?: boolean
}) {
  const { canAccess } = useAuth()
  const location = useLocation()
  const visible = items.filter(i => canAccess(i.to))
  const hasActive = visible.some(i => i.exact ? location.pathname === i.to : location.pathname.startsWith(i.to))
  const [open, setOpen] = useState(defaultOpen || hasActive)
  if (visible.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors rounded-lg mx-1 ${
          hasActive ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <span className="flex items-center gap-2"><Icon size={13} />{label}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="mt-0.5 mb-1">
          {visible.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                  isActive ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon size={15} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function StandaloneLink({ to, label, icon: Icon, exact }: NavItem) {
  const { canAccess } = useAuth()
  if (!canAccess(to)) return null
  return (
    <NavLink to={to} end={exact}
      className={({ isActive }) =>
        `flex items-center gap-3 mx-2 px-4 py-2 text-sm rounded-lg transition-colors ${
          isActive ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      <Icon size={15} />
      <span>{label}</span>
    </NavLink>
  )
}

function Sidebar() {
  const { user, logout } = useAuth()
  const { settings }     = useSettings()

  return (
    <aside className="no-print w-60 bg-slate-900 text-white flex flex-col flex-shrink-0">
      <div className="p-5 border-b border-slate-700">
        <h1 className="text-lg font-bold text-white">{settings.storeName}</h1>
        <p className="text-slate-400 text-xs mt-1">نظام إدارة السوبرماركت</p>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto space-y-1">
        <StandaloneLink to="/" label="لوحة التحكم" icon={LayoutDashboard} exact />

        <div className="border-t border-slate-800 pt-1" />

        <NavGroup label="المبيعات" icon={ShoppingCart} items={[
          { to: '/pos',       label: 'نقطة البيع',  icon: MonitorSmartphone },
          { to: '/sales',     label: 'المبيعات',    icon: ShoppingCart },
          { to: '/returns',   label: 'المرتجعات',   icon: RotateCcw },
          { to: '/customers', label: 'العملاء',     icon: UserCheck },
        ]} />

        <div className="border-t border-slate-800 pt-1" />

        <NavGroup label="المخزون" icon={Package} items={[
          { to: '/products',          label: 'المنتجات',        icon: Package },
          { to: '/categories',        label: 'الأصناف',         icon: Layers },
          { to: '/promotions',        label: 'العروض',          icon: Tag },
          { to: '/stock',             label: 'حركات المخزون',   icon: ArrowUpDown },
          { to: '/waste',             label: 'الهدر',           icon: Trash2 },
          { to: '/inventory',         label: 'جرد المخزون',     icon: ClipboardCheck },
          { to: '/branches',          label: 'الفروع والمخازن', icon: GitBranch },
          { to: '/transfer-requests', label: 'طلبات التحويل',   icon: Send },
          { to: '/transfers',         label: 'التحويلات',       icon: ArrowLeftRight },
        ]} />

        <div className="border-t border-slate-800 pt-1" />

        <NavGroup label="المشتريات" icon={Truck} defaultOpen={false} items={[
          { to: '/suppliers',         label: 'الموردون',       icon: Truck },
          { to: '/purchase-requests', label: 'طلبات الشراء',  icon: ClipboardList },
          { to: '/invoices',          label: 'فواتير الشراء', icon: FileText },
        ]} />

        <div className="border-t border-slate-800 pt-1" />

        <NavGroup label="محاسبة" icon={BookOpen} defaultOpen={false} items={[
          { to: '/expenses',          label: 'المصاريف',        icon: Wallet },
          { to: '/chart-of-accounts', label: 'دليل الحسابات',  icon: BookOpen },
          { to: '/banks',             label: 'البنوك والصناديق', icon: Landmark },
          { to: '/journal-entries',   label: 'قيود اليومية',    icon: BookOpen },
        ]} />

        <div className="border-t border-slate-800 pt-1" />

        <StandaloneLink to="/reports" label="التقارير" icon={BarChart3} />

        <div className="border-t border-slate-800 pt-1" />

        <StandaloneLink to="/settings"  label="الإعدادات"   icon={Settings} />
        <StandaloneLink to="/roles"     label="الوظائف"     icon={ShieldCheck} />
        <StandaloneLink to="/users"     label="المستخدمون"  icon={Users} />
        <StandaloneLink to="/activity"  label="سجل النشاط"  icon={Activity} />
      </nav>

      <div className="p-4 border-t border-slate-700">
        {user && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-sm font-bold">
                {user.name[0]}
              </div>
              <div>
                <div className="text-white text-xs font-medium">{user.name}</div>
              </div>
            </div>
            <button onClick={logout} title="تسجيل الخروج"
              className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

function LowStockBanner() {
  const [items, setItems] = useState<Product[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    window.api.products.getAll().then((all: Product[]) => {
      setItems(all.filter(p => p.minStockAlert > 0 && p.currentStock <= p.minStockAlert))
    })
  }, [])

  if (dismissed || items.length === 0) return null

  return (
    <div className="no-print bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center gap-3 flex-shrink-0">
      <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
      <p className="text-amber-700 text-xs flex-1 leading-5">
        <span className="font-semibold">{items.length} منتج وصل للحد الأدنى: </span>
        {items.slice(0, 5).map(i => `${i.name} (${i.currentStock} ${i.unit})`).join(' • ')}
        {items.length > 5 && ` و${items.length - 5} أخرى`}
      </p>
      <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 flex-shrink-0">
        <X size={13} />
      </button>
    </div>
  )
}

function ProtectedRoute({ path, element }: { path: string; element: React.ReactElement }) {
  const { canAccess } = useAuth()
  return canAccess(path) ? element : <Navigate to="/" replace />
}

function AppContent() {
  const { user } = useAuth()
  if (!user) return <Login />

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <LowStockBanner />
        <main className="flex-1 overflow-y-auto print-page">
          <Routes>
            <Route path="/"                   element={<Dashboard />} />
            <Route path="/pos"                element={<ProtectedRoute path="/pos"                element={<POSPage />} />} />
            <Route path="/sales"              element={<ProtectedRoute path="/sales"              element={<SalesPage />} />} />
            <Route path="/returns"            element={<ProtectedRoute path="/returns"            element={<ReturnsPage />} />} />
            <Route path="/products"           element={<ProtectedRoute path="/products"           element={<ProductsPage />} />} />
            <Route path="/categories"         element={<ProtectedRoute path="/categories"         element={<CategoriesPage />} />} />
            <Route path="/customers"          element={<ProtectedRoute path="/customers"          element={<CustomersPage />} />} />
            <Route path="/promotions"         element={<ProtectedRoute path="/promotions"         element={<PromotionsPage />} />} />
            <Route path="/suppliers"          element={<ProtectedRoute path="/suppliers"          element={<SuppliersPage />} />} />
            <Route path="/purchase-requests"  element={<ProtectedRoute path="/purchase-requests"  element={<PurchaseRequestsPage />} />} />
            <Route path="/invoices"           element={<ProtectedRoute path="/invoices"           element={<PurchaseInvoicesPage />} />} />
            <Route path="/stock"              element={<ProtectedRoute path="/stock"              element={<StockMovementsPage />} />} />
            <Route path="/waste"              element={<ProtectedRoute path="/waste"              element={<WasteTrackingPage />} />} />
            <Route path="/inventory"          element={<ProtectedRoute path="/inventory"          element={<InventoryCountPage />} />} />
            <Route path="/branches"           element={<ProtectedRoute path="/branches"           element={<BranchesPage />} />} />
            <Route path="/transfer-requests"  element={<ProtectedRoute path="/transfer-requests"  element={<TransferRequestsPage />} />} />
            <Route path="/transfers"          element={<ProtectedRoute path="/transfers"          element={<TransfersPage />} />} />
            <Route path="/expenses"           element={<ProtectedRoute path="/expenses"           element={<ExpensesPage />} />} />
            <Route path="/chart-of-accounts"  element={<ProtectedRoute path="/chart-of-accounts"  element={<ChartOfAccountsPage />} />} />
            <Route path="/banks"              element={<ProtectedRoute path="/banks"              element={<BanksPage />} />} />
            <Route path="/journal-entries"  element={<ProtectedRoute path="/journal-entries"  element={<JournalEntriesPage />} />} />
            <Route path="/financial-reports"  element={<ProtectedRoute path="/financial-reports"  element={<FinancialReportsPage />} />} />
            <Route path="/reports"            element={<ProtectedRoute path="/reports"            element={<ReportsHub />} />} />
            <Route path="/reports/:reportId"  element={<ProtectedRoute path="/reports"            element={<ReportsHub />} />} />
            <Route path="/settings"           element={<ProtectedRoute path="/settings"           element={<SettingsPage />} />} />
            <Route path="/roles"              element={<ProtectedRoute path="/roles"              element={<RolesPage />} />} />
            <Route path="/users"              element={<ProtectedRoute path="/users"              element={<UsersPage />} />} />
            <Route path="/activity"           element={<ProtectedRoute path="/activity"           element={<ActivityLogPage />} />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <HashRouter>
          <AppContent />
        </HashRouter>
      </AuthProvider>
    </SettingsProvider>
  )
}
