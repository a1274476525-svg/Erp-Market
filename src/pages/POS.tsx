import { useState, useEffect, useRef } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, Barcode, User, X } from 'lucide-react'
import type { Product, Customer, Promotion } from '../types'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'

interface CartItem { product: Product; quantity: number; unitPrice: number; total: number }

const PAYMENT_METHODS = [
  { value: 'cash',      label: 'نقداً' },
  { value: 'card',      label: 'بطاقة' },
  { value: 'instapay',  label: 'إنستاباي' },
  { value: 'vodafone',  label: 'فودافون كاش' },
  { value: 'credit',    label: 'آجل على العميل' },
]

function Receipt({ order, settings, onClose }: { order: any; settings: any; onClose: () => void }) {
  useEffect(() => { window.print() }, [])
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-center flex-1">
            <h2 className="text-xl font-bold">{settings.storeName}</h2>
            <p className="text-sm text-slate-500">#{order.orderNumber}</p>
            <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleString('ar-EG')}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="border-t border-dashed pt-3 mb-3 space-y-1">
          {order.items.map((item: any) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.productName} × {item.quantity}</span>
              <span>{item.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-dashed pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>المجموع الفرعي</span><span>{order.subtotal.toFixed(2)}</span></div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-red-500"><span>الخصم</span><span>-{order.discountAmount.toFixed(2)}</span></div>
          )}
          {order.taxAmount > 0 && (
            <div className="flex justify-between"><span>ضريبة القيمة المضافة</span><span>{order.taxAmount.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <span>الإجمالي</span><span>{order.total.toFixed(2)} {settings.currency}</span>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">شكراً لتسوقكم معنا</p>
        <button onClick={onClose}
          className="w-full mt-4 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
          إغلاق
        </button>
      </div>
    </div>
  )
}

export default function POS() {
  const [products, setProducts]     = useState<Product[]>([])
  const [customers, setCustomers]   = useState<Customer[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [cart, setCart]             = useState<CartItem[]>([])
  const [search, setSearch]         = useState('')
  const [barcode, setBarcode]       = useState('')
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [discountType, setDiscountType]   = useState<'percentage' | 'fixed' | ''>('')
  const [discountValue, setDiscountValue] = useState(0)
  const [note, setNote]             = useState('')
  const [saving, setSaving]         = useState(false)
  const [lastOrder, setLastOrder]   = useState<any>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const barcodeRef = useRef<HTMLInputElement>(null)
  const { settings } = useSettings()
  const { user } = useAuth()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await window.api.warehouses.init()
        const [allProducts, c, pr, warehouses] = await Promise.all([
          window.api.products.getAll(),
          window.api.customers.getAll(),
          window.api.promotions.getAll(),
          window.api.warehouses.getAll(),
        ])
        if (cancelled) return
        const defaultWarehouse =
          warehouses.find(w => w.isDefault && w.branch?.isDefault) ??
          warehouses.find(w => w.isDefault)
        const stockByProduct = new Map<number, number>(
          (defaultWarehouse?.stocks ?? []).map((stock: any) => [stock.productId, stock.quantity])
        )
        setProducts(allProducts.map(product => ({
          ...product,
          // POS availability is the selected default branch's warehouse balance,
          // not the sum of stock held in other branches.
          currentStock: stockByProduct.get(product.id) ?? 0,
        })))
        setCustomers(c)
        setPromotions(pr.filter((promotion: Promotion) => promotion.isActive))
      } catch (error: any) {
        alert(error?.message || 'تعذر تحميل بيانات نقطة البيع')
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  function getActivePromotion(product: Product): Promotion | null {
    const now = new Date()
    return promotions.find(pr => {
      if (new Date(pr.startDate) > now || new Date(pr.endDate) < now) return false
      if (pr.applyToAll) return true
      return pr.products.some(pp => pp.productId === product.id)
    }) ?? null
  }

  function getDiscountedPrice(product: Product): number {
    const promo = getActivePromotion(product)
    if (!promo) return product.sellingPrice
    if (promo.discountType === 'percentage') return product.sellingPrice * (1 - promo.discountValue / 100)
    return Math.max(0, product.sellingPrice - promo.discountValue)
  }

  function addToCart(product: Product) {
    const price = getDiscountedPrice(product)
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        return prev.map(i => i.product.id === product.id
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
          : i)
      }
      return [...prev, { product, quantity: 1, unitPrice: price, total: price }]
    })
  }

  function updateQty(productId: number, qty: number) {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.product.id !== productId))
    } else {
      setCart(prev => prev.map(i => i.product.id === productId
        ? { ...i, quantity: qty, total: qty * i.unitPrice }
        : i))
    }
  }

  async function lookupBarcode() {
    if (!barcode.trim()) return
    const product = await window.api.products.getByBarcode(barcode.trim())
    if (product) {
      addToCart(product)
    } else {
      alert(`لم يتم العثور على منتج بالباركود: ${barcode}`)
    }
    setBarcode('')
    barcodeRef.current?.focus()
  }

  const subtotal = cart.reduce((s, i) => s + i.total, 0)
  const taxRate  = parseFloat(settings.taxRate) || 0
  const discountAmount = discountType === 'percentage'
    ? subtotal * (discountValue / 100)
    : discountType === 'fixed' ? Math.min(discountValue, subtotal) : 0
  const taxable  = subtotal - discountAmount
  const taxAmount = taxRate > 0 ? taxable * (taxRate / 100) : 0
  const total    = taxable + taxAmount

  async function checkout() {
    if (cart.length === 0) return
    if (paymentMethod === 'credit' && !customerId) {
      alert('اختر العميل أولاً لتسجيل الفاتورة على الحساب')
      return
    }
    setSaving(true)
    try {
      const order = await window.api.pos.createOrder({
        customerId,
        cashierId: user?.id ?? null,
        paymentMethod,
        subtotal,
        discountType: discountType || null,
        discountValue,
        discountAmount,
        taxRate,
        taxAmount,
        total,
        note: note || null,
        items: cart.map(i => ({
          productId: i.product.id,
          productName: i.product.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          total: i.total,
        })),
      })
      setLastOrder(order)
      setCart([])
      setCustomerId(null)
      setDiscountType('')
      setDiscountValue(0)
      setNote('')
    } catch (e: any) { alert(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  const categories = [...new Set(products.filter(p => p.category).map(p => p.category!.name))]
  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search)
    const matchCat = !categoryFilter || p.category?.name === categoryFilter
    return matchSearch && matchCat
  })

  return (
    <div className="flex h-full">
      {/* Products panel */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن منتج..."
              className="w-full border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="relative flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <Barcode size={16} className="text-slate-400" />
            <input ref={barcodeRef} value={barcode} onChange={e => setBarcode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookupBarcode()}
              placeholder="باركود..." className="w-36 text-sm outline-none" />
          </div>
        </div>
        <div className="flex gap-2 mb-3 flex-wrap">
          <button onClick={() => setCategoryFilter('')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!categoryFilter ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            الكل
          </button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${categoryFilter === cat ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {cat}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 content-start">
          {filtered.map(product => {
            const price = getDiscountedPrice(product)
            const hasPromo = price < product.sellingPrice
            const inCart = cart.find(i => i.product.id === product.id)
            return (
              <button key={product.id} onClick={() => addToCart(product)}
                className={`bg-white rounded-xl p-3 text-right shadow-sm hover:shadow-md transition-all border-2 ${inCart ? 'border-emerald-400' : 'border-transparent'}`}>
                <div className="text-sm font-medium text-slate-800 mb-1 leading-tight">{product.name}</div>
                {product.category && <div className="text-xs text-slate-400 mb-2">{product.category.name}</div>}
                <div className="flex items-center gap-1">
                  <span className="text-emerald-600 font-bold text-sm">{price.toFixed(2)}</span>
                  {hasPromo && <span className="text-xs text-slate-400 line-through">{product.sellingPrice.toFixed(2)}</span>}
                </div>
                {inCart && (
                  <div className="mt-1 bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 rounded-full w-fit">
                    في السلة: {inCart.quantity}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart size={18} className="text-emerald-600" />
            <h2 className="font-bold text-slate-800">السلة ({cart.length})</h2>
          </div>
          <div className="flex items-center gap-2">
            <User size={14} className="text-slate-400" />
            <select value={customerId ?? ''} onChange={e => setCustomerId(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="">عميل عام</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-8">السلة فارغة</div>
          )}
          {cart.map(item => (
            <div key={item.product.id} className="bg-slate-50 rounded-lg p-2.5">
              <div className="flex justify-between items-start mb-1.5">
                <span className="text-xs font-medium text-slate-700 leading-tight flex-1 ml-2">{item.product.name}</span>
                <button onClick={() => updateQty(item.product.id, 0)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.product.id, item.quantity - 1)}
                    className="w-6 h-6 bg-slate-200 hover:bg-slate-300 rounded-full flex items-center justify-center">
                    <Minus size={10} />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                  <button onClick={() => updateQty(item.product.id, item.quantity + 1)}
                    className="w-6 h-6 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-full flex items-center justify-center">
                    <Plus size={10} />
                  </button>
                </div>
                <span className="text-sm font-bold text-emerald-600">{item.total.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 space-y-3">
          <div className="flex gap-2">
            <select value={discountType} onChange={e => setDiscountType(e.target.value as any)}
              className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="">بدون خصم</option>
              <option value="percentage">خصم %</option>
              <option value="fixed">خصم ثابت</option>
            </select>
            {discountType && (
              <input type="number" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))} min={0}
                className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {PAYMENT_METHODS.map(m => (
              <button key={m.value} onClick={() => setPaymentMethod(m.value)}
                className={`flex-1 min-w-[60px] py-1 rounded-lg text-xs font-medium transition-colors ${paymentMethod === m.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {m.label}
              </button>
            ))}
          </div>

          <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-600"><span>المجموع الفرعي</span><span>{subtotal.toFixed(2)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-red-500"><span>الخصم</span><span>-{discountAmount.toFixed(2)}</span></div>}
            {taxAmount > 0 && <div className="flex justify-between text-slate-600"><span>ض.ق.م ({taxRate}%)</span><span>{taxAmount.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-base text-slate-800 border-t pt-2">
              <span>الإجمالي</span><span>{total.toFixed(2)} {settings.currency}</span>
            </div>
          </div>

          <button onClick={checkout} disabled={saving || cart.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-base transition-colors">
            {saving ? 'جاري...' : `إتمام البيع`}
          </button>
        </div>
      </div>

      {lastOrder && (
        <Receipt order={lastOrder} settings={settings} onClose={() => setLastOrder(null)} />
      )}
    </div>
  )
}
