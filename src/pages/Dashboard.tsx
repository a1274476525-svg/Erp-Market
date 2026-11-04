import { useEffect, useState } from 'react'
import { Package, AlertTriangle, TrendingUp, ShoppingBag, Users, RotateCcw, FileText, ClipboardList } from 'lucide-react'
import type { DashboardData } from '../types'
import { useSettings } from '../contexts/SettingsContext'

export default function Dashboard() {
  const [data, setData]     = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { settings } = useSettings()

  useEffect(() => {
    window.api.reports.dashboard().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-full text-slate-400">جاري التحميل...</div>
  }

  const cur = settings.currency

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">لوحة التحكم</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <StatCard icon={<Package className="text-emerald-500" size={22} />}
          label="المنتجات" value={data?.productCount ?? 0} bg="bg-emerald-50" />
        <StatCard icon={<AlertTriangle className="text-amber-500" size={22} />}
          label="مخزون منخفض" value={data?.lowStockCount ?? 0} bg="bg-amber-50"
          alert={(data?.lowStockCount ?? 0) > 0} />
        <StatCard icon={<TrendingUp className="text-blue-500" size={22} />}
          label="مبيعات اليوم" value={`${(data?.totalSalesToday ?? 0).toFixed(2)} ${cur}`} bg="bg-blue-50" />
        <StatCard icon={<ShoppingBag className="text-purple-500" size={22} />}
          label="فواتير اليوم" value={data?.salesTodayCount ?? 0} bg="bg-purple-50" />
        <StatCard icon={<Users className="text-indigo-500" size={22} />}
          label="العملاء" value={data?.customerCount ?? 0} bg="bg-indigo-50" />
        <StatCard icon={<RotateCcw className="text-rose-500" size={22} />}
          label="متوسط الفاتورة"
          value={data?.salesTodayCount ? `${((data?.totalSalesToday ?? 0) / data.salesTodayCount).toFixed(2)} ${cur}` : '0'}
          bg="bg-rose-50" />
        <StatCard icon={<ClipboardList className="text-orange-500" size={22} />}
          label="طلبات شراء معلقة" value={(data as any)?.pendingPurchaseReqs ?? 0} bg="bg-orange-50"
          alert={((data as any)?.pendingPurchaseReqs ?? 0) > 0} />
        <StatCard icon={<FileText className="text-slate-500" size={22} />}
          label="مسودات فواتير" value={(data as any)?.draftInvoices ?? 0} bg="bg-slate-50"
          alert={((data as any)?.draftInvoices ?? 0) > 0} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Top products today */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" />
            الأكثر مبيعاً اليوم
          </h2>
          {((data as any)?.topProducts?.length ?? 0) === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">لا توجد مبيعات اليوم</p>
          ) : (
            <div className="space-y-2">
              {(data as any)?.topProducts?.map((p: any, i: number) => (
                <div key={p.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                    <span className="text-sm font-medium text-slate-700 truncate max-w-[120px]">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold text-emerald-600">{p.revenue.toFixed(2)} {cur}</div>
                    <div className="text-xs text-slate-400">{p.qty} وحدة</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            تنبيهات المخزون المنخفض
          </h2>
          {(data?.lowStockItems?.length ?? 0) === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">لا توجد تنبيهات ✓</p>
          ) : (
            <div className="space-y-2">
              {data?.lowStockItems.map(item => (
                <div key={item.id} className="flex justify-between items-center p-2.5 bg-amber-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                    {item.category && <span className="text-xs text-slate-400 mr-2">{item.category.name}</span>}
                  </div>
                  <span className="text-xs text-amber-600">
                    متبقي: {item.currentStock} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm col-span-1">
          <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <ShoppingBag size={16} className="text-emerald-500" />
            آخر المبيعات
          </h2>
          {(data?.recentOrders?.length ?? 0) === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">لا توجد مبيعات بعد</p>
          ) : (
            <div className="space-y-1">
              {data?.recentOrders.map(order => (
                <div key={order.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-slate-700">{order.orderNumber}</span>
                    {order.customer && <span className="text-xs text-slate-400 mr-2">{order.customer.name}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{order.items.length} صنف</span>
                    <span className="text-sm font-semibold text-emerald-600">{order.total.toFixed(2)} {cur}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, bg, alert }: {
  icon: React.ReactNode; label: string; value: string | number; bg: string; alert?: boolean
}) {
  return (
    <div className={`${bg} rounded-xl p-5 ${alert ? 'ring-2 ring-amber-400' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        {icon}
        {alert && <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  )
}
