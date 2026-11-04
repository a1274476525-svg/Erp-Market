export interface Branch {
  id: number
  name: string
  isDefault: boolean
  createdAt: string
  warehouses?: Warehouse[]
}

export interface Warehouse {
  id: number
  name: string
  branchId: number
  branch?: Branch
  isDefault: boolean
  createdAt: string
  stocks?: WarehouseStock[]
}

export interface WarehouseStock {
  id: number
  warehouseId: number
  productId: number
  product?: Product
  quantity: number
}

export interface Category {
  id: number
  name: string
  description: string | null
  createdAt: string
}

export interface Product {
  id: number
  name: string
  barcode: string | null
  sku: string | null
  categoryId: number | null
  category: Category | null
  unit: string
  costPrice: number
  sellingPrice: number
  wholesalePrice: number | null
  minStockAlert: number
  reorderLevel: number
  currentStock: number
  conversionFactor: number
  isActive: boolean
  imagePath: string | null
  createdAt: string
}

export interface PriceHistory {
  id: number
  productId: number
  costPrice: number
  date: string
  note: string | null
}

export interface Customer {
  id: number
  name: string
  phone: string | null
  address: string | null
  loyaltyPoints: number
  createdAt: string
}

export interface Supplier {
  id: number
  name: string
  phone: string | null
  address: string | null
  taxNumber: string | null
  createdAt: string
}

export interface PurchaseInvoice {
  id: number
  supplierId: number | null
  supplier: Supplier | null
  invoiceNumber: string | null
  invoiceDate: string
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  notes: string | null
  status: 'draft' | 'confirmed'
  createdAt: string
  items: PurchaseItem[]
}

export interface PurchaseItem {
  id: number
  invoiceId: number
  productId: number
  product: Product
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface PurchaseRequest {
  id: number
  supplierId: number | null
  supplier: Supplier | null
  status: 'pending' | 'approved' | 'ordered' | 'completed' | 'cancelled'
  notes: string | null
  requestDate: string
  createdAt: string
  items: PurchaseRequestItem[]
}

export interface PurchaseRequestItem {
  id: number
  requestId: number
  productId: number
  product: Product
  quantity: number
  notes: string | null
}

export interface Promotion {
  id: number
  name: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  startDate: string
  endDate: string
  isActive: boolean
  applyToAll: boolean
  minQuantity: number
  createdAt: string
  products: { id: number; productId: number; product: Product }[]
}

export interface PosOrderItem {
  id: number
  orderId: number
  productId: number
  product?: Product
  productName: string
  quantity: number
  unitPrice: number
  total: number
}

export interface PosOrder {
  id: number
  orderNumber: string
  customerId: number | null
  customer: Customer | null
  cashierId: number | null
  paymentMethod: string
  subtotal: number
  discountType: string | null
  discountValue: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  total: number
  note: string | null
  status: 'completed' | 'voided'
  createdAt: string
  items: PosOrderItem[]
}

export interface SaleReturnItem {
  id: number
  returnId: number
  productId: number
  product?: Product
  productName: string
  quantity: number
  unitPrice: number
  total: number
}

export interface SaleReturn {
  id: number
  orderId: number
  order?: PosOrder
  returnDate: string
  reason: string | null
  total: number
  items: SaleReturnItem[]
}

export interface StockMovement {
  id: number
  productId: number
  product: Product
  quantity: number
  type: 'purchase' | 'sale' | 'waste' | 'adjust' | 'return' | 'transfer'
  referenceId: number | null
  note: string | null
  createdAt: string
}

export interface TransferRequest {
  id: number
  referenceNumber: string
  fromWarehouseId: number
  fromWarehouse?: Warehouse
  toWarehouseId: number
  toWarehouse?: Warehouse
  status: 'pending' | 'approved' | 'rejected' | 'transferred'
  note: string | null
  requestDate: string
  createdAt: string
  items: TransferRequestItem[]
  transfer?: Transfer | null
}

export interface TransferRequestItem {
  id: number
  requestId: number
  productId: number
  product: Product
  quantity: number
  notes: string | null
}

export interface Transfer {
  id: number
  referenceNumber: string
  requestId: number | null
  fromWarehouseId: number
  fromWarehouse?: Warehouse
  toWarehouseId: number
  toWarehouse?: Warehouse
  transferDate: string
  note: string | null
  createdAt: string
  items: TransferItem[]
  request?: TransferRequest | null
}

export interface TransferItem {
  id: number
  transferId: number
  productId: number
  product: Product
  quantity: number
}

export interface InventoryCount {
  id: number
  referenceNumber: string
  status: 'draft' | 'closed'
  workDate: string | null
  closedAt: string | null
  note: string | null
  createdAt: string
  items: InventoryCountItem[]
}

export interface InventoryCountItem {
  id: number
  inventoryCountId: number
  productId: number
  product: Product
  systemQuantity: number
  actualQuantity: number
}

export interface Role {
  id: number
  name: string
  fullAccess: boolean
  permissions: string[]
  isSystem: boolean
}

export interface User {
  id: number
  name: string
  role: string
  roleData: Role | null
  isActive: boolean
  createdAt: string
}

export interface ActivityLog {
  id: number
  userId: number
  user: Pick<User, 'id' | 'name' | 'role'>
  action: string
  entity: string | null
  entityId: number | null
  details: string | null
  createdAt: string
}

export interface DashboardData {
  productCount: number
  lowStockCount: number
  lowStockItems: Product[]
  recentOrders: PosOrder[]
  totalSalesToday: number
  salesTodayCount: number
  customerCount: number
}

export interface AppSettings {
  storeName: string
  currency: string
  taxRate: string
  autoBackupEnabled: string
  autoBackupPath: string
  autoBackupInterval: string
  autoBackupLastRun: string
}

export interface Account {
  id: number
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  normalBalance: 'debit' | 'credit'
  parentId: number | null
  level: number
  isActive: boolean
  description: string | null
  createdAt: string
  children?: Account[]
}

export interface JournalEntry {
  id: number
  number: string
  date: string
  description: string | null
  reference: string | null
  status: 'draft' | 'posted'
  source: string
  sourceId: number | null
  createdAt: string
  lines: JournalEntryLine[]
}

export interface JournalEntryLine {
  id: number
  entryId: number
  accountId: number
  account: Account
  debit: number
  credit: number
  description: string | null
}

export interface BankAccount {
  id: number
  name: string
  type: 'bank' | 'cash' | 'custody'
  bankName: string | null
  accountNumber: string | null
  currentBalance: number
  currency: string
  isActive: boolean
  notes: string | null
  accountId: number | null
  account?: Account
  createdAt: string
  statementBalance?: number | null
  unmatchedStatementLines?: number
  unmatchedTransactions?: number
}

export interface BankTransaction {
  id: number
  bankAccountId: number
  bankAccount?: BankAccount
  type: 'deposit' | 'withdrawal' | 'transfer'
  amount: number
  balanceAfter: number
  description: string | null
  referenceNumber: string | null
  contraAccountId?: number | null
  journalEntryId?: number | null
  date: string
  createdAt: string
}

export interface BankStatementLine {
  id: number
  bankAccountId: number
  date: string
  description: string | null
  reference: string | null
  amount: number
  balance: number | null
  status: 'unmatched' | 'matched' | 'ignored'
  matchedTransactionId: number | null
  importBatch: string | null
  createdAt: string
}

export interface BankRule {
  id: number
  name: string
  type: 'expense' | 'receipt' | 'transfer'
  matchType: 'contains' | 'startsWith' | 'equals'
  matchValue: string
  contraAccountId: number | null
  bankAccountId: number | null
  isActive: boolean
  createdAt: string
}
