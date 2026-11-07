import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Prisma, PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const isDev = !app.isPackaged

const dbPath = isDev
  ? path.join(process.cwd(), 'prisma', 'umarket.db')
  : path.join(app.getPath('userData'), 'umarket.db')

const dbUrl = 'file:' + dbPath.replace(/\\/g, '/')
process.env.DATABASE_URL = dbUrl
console.log('[DB]', dbUrl)

const prisma = new PrismaClient()

async function ensureDatabaseFile() {
  const { access, copyFile, mkdir } = await import('node:fs/promises')
  try {
    await access(dbPath)
    return
  } catch {
    // A fresh installation receives an empty, schema-initialized SQLite database.
  }
  if (isDev) return
  const seedPath = path.join(process.resourcesPath, 'prisma', 'umarket.db')
  await mkdir(path.dirname(dbPath), { recursive: true })
  await copyFile(seedPath, dbPath)
  console.log('[DB] Initialized user database from packaged schema')
}

let mainWindow: BrowserWindow | null = null
const clearPinFailures = new Map<number, { count: number; lockedUntil: number }>()
const loginPinFailures = new Map<number, { count: number; lockedUntil: number }>()
const authenticatedSessions = new Map<number, number>()

function hashPin(pin: string) {
  const salt = randomBytes(16).toString('hex')
  const digest = scryptSync(pin, salt, 64).toString('hex')
  return 'scrypt$' + salt + '$' + digest
}

function verifyPin(pin: string, stored: string) {
  if (stored.startsWith('scrypt$')) {
    const [, salt, digest] = stored.split('$')
    if (!salt || !digest || !/^[a-f0-9]{128}$/i.test(digest)) return false
    const expected = Buffer.from(digest, 'hex')
    const actual = scryptSync(pin, salt, expected.length)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }
  return pin === stored
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#f1f5f9',
    title: 'يو ماركت',
  })

  if (isDev) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL'] || 'http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  const windowId = mainWindow.webContents.id
  mainWindow.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) authenticatedSessions.delete(windowId)
  })
  mainWindow.webContents.on('destroyed', () => authenticatedSessions.delete(windowId))
  mainWindow.once('ready-to-show', () => mainWindow?.show())
}

async function upgradeLegacyPins() {
  await prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany({ select: { id: true, pin: true } })
    for (const user of users) {
      if (!user.pin.startsWith('scrypt$')) {
        await tx.user.update({ where: { id: user.id }, data: { pin: hashPin(user.pin) } })
      }
    }
  })
}

async function ensureSystemRole() {
  let sysRole = await prisma.role.findFirst({ where: { isSystem: true } })
  if (!sysRole) {
    sysRole = await prisma.role.create({
      data: { name: 'مدير النظام', fullAccess: true, permissions: '[]', isSystem: true },
    })
  }
  const knownNames = (await prisma.role.findMany({ select: { name: true } })).map(r => r.name)
  await prisma.user.updateMany({
    where: { role: { notIn: knownNames } },
    data:  { role: sysRole.name },
  })
}

async function resolveRole(roleName: string) {
  const r = await prisma.role.findUnique({ where: { name: roleName } })
  if (!r) return null
  return { ...r, permissions: JSON.parse(r.permissions || '[]') as string[] }
}

async function checkAutoBackup() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['autoBackupEnabled', 'autoBackupPath', 'autoBackupInterval', 'autoBackupLastRun'] } },
  })
  const cfg: Record<string, string> = {}
  rows.forEach(r => { cfg[r.key] = r.value })
  if (cfg.autoBackupEnabled !== 'true' || !cfg.autoBackupPath) return

  const now = new Date()
  const lastRun = cfg.autoBackupLastRun ? new Date(cfg.autoBackupLastRun) : null
  if (lastRun) {
    const hoursSince = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60)
    const needed = cfg.autoBackupInterval === 'weekly' ? 168 : 24
    if (hoursSince < needed) return
  }

  try {
    const { copyFile, mkdir } = await import('node:fs/promises')
    const { existsSync } = await import('node:fs')
    if (!existsSync(cfg.autoBackupPath)) await mkdir(cfg.autoBackupPath, { recursive: true })
    const stamp = now.toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
    const dest  = path.join(cfg.autoBackupPath, `umarket-backup-${stamp}.db`)
    await copyFile(dbPath, dest)
    await prisma.setting.upsert({
      where:  { key: 'autoBackupLastRun' },
      update: { value: now.toISOString() },
      create: { key: 'autoBackupLastRun', value: now.toISOString() },
    })
    console.log('[AutoBackup] Created:', dest)
  } catch (err) {
    console.error('[AutoBackup] Failed:', err)
  }
}

app.whenReady().then(async () => {
  await ensureDatabaseFile()
  await upgradeLegacyPins()
  await ensureSystemRole()
  await checkAutoBackup()
  createWindow()
  setupIpcHandlers()
  setInterval(checkAutoBackup, 60 * 60 * 1000)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    prisma.$disconnect()
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// nb = normalBalance, p = parent code
const STANDARD_ACCOUNTS: { code: string; name: string; type: string; nb: string; level: number; p: string | null }[] = [
  // ════ 1 - الأصول ════════════════════════════════════════════
  { code:'1',     name:'الأصول',                          type:'asset',     nb:'debit',  level:1, p:null  },
  { code:'11',    name:'الأصول المتداولة',                type:'asset',     nb:'debit',  level:2, p:'1'   },
  { code:'111',   name:'النقدية والبنوك',                 type:'asset',     nb:'debit',  level:3, p:'11'  },
  { code:'1111',  name:'الصندوق الرئيسي',                 type:'asset',     nb:'debit',  level:4, p:'111' },
  { code:'1112',  name:'البنوك',                          type:'asset',     nb:'debit',  level:4, p:'111' },
  { code:'11121', name:'بنك (أهلي/مصر/...)',              type:'asset',     nb:'debit',  level:5, p:'1112'},
  { code:'112',   name:'المدينون والذمم المدينة',         type:'asset',     nb:'debit',  level:3, p:'11'  },
  { code:'1121',  name:'مدينون تجاريون',                  type:'asset',     nb:'debit',  level:4, p:'112' },
  { code:'1122',  name:'أوراق قبض',                       type:'asset',     nb:'debit',  level:4, p:'112' },
  { code:'113',   name:'المخزون',                         type:'asset',     nb:'debit',  level:3, p:'11'  },
  { code:'1131',  name:'مخزون البضاعة',                   type:'asset',     nb:'debit',  level:4, p:'113' },
  { code:'1132',  name:'بضاعة في الطريق',                 type:'asset',     nb:'debit',  level:4, p:'113' },
  { code:'114',   name:'مصاريف مدفوعة مقدماً',            type:'asset',     nb:'debit',  level:3, p:'11'  },
  { code:'1141',  name:'إيجار مدفوع مقدماً',              type:'asset',     nb:'debit',  level:4, p:'114' },
  { code:'1142',  name:'تأمينات مدفوعة مقدماً',           type:'asset',     nb:'debit',  level:4, p:'114' },
  { code:'12',    name:'الأصول غير المتداولة',             type:'asset',     nb:'debit',  level:2, p:'1'   },
  { code:'121',   name:'الأصول الثابتة الملموسة',         type:'asset',     nb:'debit',  level:3, p:'12'  },
  { code:'1211',  name:'أثاث ومعدات',                     type:'asset',     nb:'debit',  level:4, p:'121' },
  { code:'1212',  name:'أجهزة ومعدات تقنية',              type:'asset',     nb:'debit',  level:4, p:'121' },
  { code:'1213',  name:'سيارات ووسائل نقل',               type:'asset',     nb:'debit',  level:4, p:'121' },
  { code:'122',   name:'مجمع إهلاك الأصول الثابتة',       type:'asset',     nb:'credit', level:3, p:'12'  },
  { code:'1221',  name:'مجمع إهلاك أثاث ومعدات',          type:'asset',     nb:'credit', level:4, p:'122' },
  { code:'1222',  name:'مجمع إهلاك أجهزة تقنية',          type:'asset',     nb:'credit', level:4, p:'122' },
  { code:'123',   name:'الأصول غير الملموسة',              type:'asset',     nb:'debit',  level:3, p:'12'  },
  { code:'1231',  name:'تراخيص وبرامج',                   type:'asset',     nb:'debit',  level:4, p:'123' },

  // ════ 2 - الخصوم ════════════════════════════════════════════
  { code:'2',     name:'الخصوم',                          type:'liability', nb:'credit', level:1, p:null  },
  { code:'21',    name:'الخصوم المتداولة',                type:'liability', nb:'credit', level:2, p:'2'   },
  { code:'211',   name:'الدائنون والذمم الدائنة',         type:'liability', nb:'credit', level:3, p:'21'  },
  { code:'2111',  name:'دائنون تجاريون (موردون)',          type:'liability', nb:'credit', level:4, p:'211' },
  { code:'2112',  name:'أوراق دفع',                       type:'liability', nb:'credit', level:4, p:'211' },
  { code:'212',   name:'الضرائب والرسوم المستحقة',        type:'liability', nb:'credit', level:3, p:'21'  },
  { code:'2121',  name:'ضريبة القيمة المضافة مستحقة',     type:'liability', nb:'credit', level:4, p:'212' },
  { code:'2122',  name:'ضريبة الدخل المستحقة',            type:'liability', nb:'credit', level:4, p:'212' },
  { code:'213',   name:'مصاريف مستحقة الدفع',             type:'liability', nb:'credit', level:3, p:'21'  },
  { code:'2131',  name:'رواتب وأجور مستحقة',              type:'liability', nb:'credit', level:4, p:'213' },
  { code:'2132',  name:'مصاريف أخرى مستحقة',              type:'liability', nb:'credit', level:4, p:'213' },
  { code:'214',   name:'قروض قصيرة الأجل',                type:'liability', nb:'credit', level:3, p:'21'  },
  { code:'2141',  name:'قروض بنكية قصيرة',                type:'liability', nb:'credit', level:4, p:'214' },
  { code:'22',    name:'الخصوم طويلة الأجل',              type:'liability', nb:'credit', level:2, p:'2'   },
  { code:'221',   name:'قروض طويلة الأجل',                type:'liability', nb:'credit', level:3, p:'22'  },
  { code:'2211',  name:'قروض بنكية طويلة',                type:'liability', nb:'credit', level:4, p:'221' },

  // ════ 3 - حقوق الملكية ════════════════════════════════════
  { code:'3',     name:'حقوق الملكية',                    type:'equity',    nb:'credit', level:1, p:null  },
  { code:'31',    name:'رأس المال',                        type:'equity',    nb:'credit', level:2, p:'3'   },
  { code:'311',   name:'رأس المال المدفوع',                type:'equity',    nb:'credit', level:3, p:'31'  },
  { code:'3111',  name:'رأس المال الأساسي',                type:'equity',    nb:'credit', level:4, p:'311' },
  { code:'3112',  name:'رصيد افتتاحي',                    type:'equity',    nb:'credit', level:4, p:'311' },
  { code:'32',    name:'الأرباح والاحتياطيات',             type:'equity',    nb:'credit', level:2, p:'3'   },
  { code:'321',   name:'الأرباح المحتجزة',                 type:'equity',    nb:'credit', level:3, p:'32'  },
  { code:'3211',  name:'أرباح سنوات سابقة',               type:'equity',    nb:'credit', level:4, p:'321' },
  { code:'322',   name:'الاحتياطيات',                     type:'equity',    nb:'credit', level:3, p:'32'  },
  { code:'3221',  name:'احتياطي قانوني',                   type:'equity',    nb:'credit', level:4, p:'322' },

  // ════ 4 - الإيرادات ══════════════════════════════════════
  { code:'4',     name:'الإيرادات',                        type:'revenue',   nb:'credit', level:1, p:null  },
  { code:'41',    name:'إيرادات المبيعات',                 type:'revenue',   nb:'credit', level:2, p:'4'   },
  { code:'411',   name:'مبيعات البضاعة',                   type:'revenue',   nb:'credit', level:3, p:'41'  },
  { code:'4111',  name:'مبيعات محلية - تجزئة',             type:'revenue',   nb:'credit', level:4, p:'411' },
  { code:'4112',  name:'مبيعات محلية - جملة',              type:'revenue',   nb:'credit', level:4, p:'411' },
  { code:'412',   name:'مردودات ومسموحات مبيعات',           type:'revenue',   nb:'debit',  level:3, p:'41'  },
  { code:'42',    name:'إيرادات أخرى',                     type:'revenue',   nb:'credit', level:2, p:'4'   },
  { code:'421',   name:'إيرادات متنوعة',                   type:'revenue',   nb:'credit', level:3, p:'42'  },
  { code:'4211',  name:'أرباح بيع أصول',                   type:'revenue',   nb:'credit', level:4, p:'421' },
  { code:'4212',  name:'إيرادات تمويلية',                  type:'revenue',   nb:'credit', level:4, p:'421' },

  // ════ 5 - تكلفة المبيعات ════════════════════════════════
  { code:'5',     name:'تكلفة المبيعات',                   type:'expense',   nb:'debit',  level:1, p:null  },
  { code:'51',    name:'المشتريات',                         type:'expense',   nb:'debit',  level:2, p:'5'   },
  { code:'511',   name:'مشتريات البضاعة',                  type:'expense',   nb:'debit',  level:3, p:'51'  },
  { code:'5111',  name:'مشتريات محلية',                    type:'expense',   nb:'debit',  level:4, p:'511' },
  { code:'5112',  name:'مشتريات مستوردة',                  type:'expense',   nb:'debit',  level:4, p:'511' },
  { code:'512',   name:'مردودات ومسموحات مشتريات',          type:'expense',   nb:'credit', level:3, p:'51'  },
  { code:'52',    name:'تكلفة البضاعة المباعة',             type:'expense',   nb:'debit',  level:2, p:'5'   },
  { code:'521',   name:'تكلفة البضاعة المنصرفة',            type:'expense',   nb:'debit',  level:3, p:'52'  },

  // ════ 6 - المصاريف التشغيلية ════════════════════════════
  { code:'6',     name:'المصاريف التشغيلية',               type:'expense',   nb:'debit',  level:1, p:null  },
  { code:'61',    name:'مصاريف إدارية وعمومية',            type:'expense',   nb:'debit',  level:2, p:'6'   },
  { code:'611',   name:'مصاريف العمالة',                   type:'expense',   nb:'debit',  level:3, p:'61'  },
  { code:'6111',  name:'رواتب وأجور',                      type:'expense',   nb:'debit',  level:4, p:'611' },
  { code:'6112',  name:'مكافآت وحوافز',                    type:'expense',   nb:'debit',  level:4, p:'611' },
  { code:'6113',  name:'تأمينات اجتماعية',                 type:'expense',   nb:'debit',  level:4, p:'611' },
  { code:'612',   name:'مصاريف المنشأة',                   type:'expense',   nb:'debit',  level:3, p:'61'  },
  { code:'6121',  name:'إيجارات',                          type:'expense',   nb:'debit',  level:4, p:'612' },
  { code:'6122',  name:'كهرباء وماء',                      type:'expense',   nb:'debit',  level:4, p:'612' },
  { code:'6123',  name:'اتصالات وإنترنت',                  type:'expense',   nb:'debit',  level:4, p:'612' },
  { code:'6124',  name:'قرطاسية ومستلزمات مكتب',           type:'expense',   nb:'debit',  level:4, p:'612' },
  { code:'613',   name:'مصاريف الصيانة',                   type:'expense',   nb:'debit',  level:3, p:'61'  },
  { code:'6131',  name:'صيانة أجهزة ومعدات',               type:'expense',   nb:'debit',  level:4, p:'613' },
  { code:'62',    name:'مصاريف البيع والتوزيع',             type:'expense',   nb:'debit',  level:2, p:'6'   },
  { code:'621',   name:'مصاريف شحن ونقل',                  type:'expense',   nb:'debit',  level:3, p:'62'  },
  { code:'6211',  name:'شحن ونقل داخلي',                   type:'expense',   nb:'debit',  level:4, p:'621' },
  { code:'622',   name:'مصاريف تسويق وإعلان',              type:'expense',   nb:'debit',  level:3, p:'62'  },
  { code:'6221',  name:'إعلانات وترويج مبيعات',             type:'expense',   nb:'debit',  level:4, p:'622' },
  { code:'63',    name:'المصاريف التمويلية',                type:'expense',   nb:'debit',  level:2, p:'6'   },
  { code:'631',   name:'فوائد وعمولات بنكية',               type:'expense',   nb:'debit',  level:3, p:'63'  },
  { code:'6311',  name:'فوائد قروض بنكية',                  type:'expense',   nb:'debit',  level:4, p:'631' },
  { code:'6312',  name:'عمولات بنكية',                     type:'expense',   nb:'debit',  level:4, p:'631' },
]

function setupIpcHandlers() {
  const publicChannels = new Set(['auth:listUsers', 'auth:login', 'auth:logout', 'settings:getAll'])
  const mutatingActions = new Set([
    'create', 'update', 'delete', 'addPoints', 'toggle', 'adjust', 'waste', 'convertUnit',
    'voidOrder', 'createReturn', 'saveDraft', 'updateDraft', 'deleteDraft', 'confirmDraft',
    'updateStatus', 'execute', 'close', 'removeItem', 'updateItem', 'post', 'reverse',
    'backfillMissing', 'seedDefault', 'setDefault', 'syncStock', 'set', 'log', 'ignore',
    'receivePayment', 'payInvoice',
    'unmatch', 'import', 'match', 'createFromLine', 'applyRules', 'selectImage', 'removeImage',
    'selectFolder', 'clearAllData', 'parseFile',
  ])
  const permissionPaths = (channel: string): string[] => {
    const [group, action] = channel.split(':')
    if (group === 'pos' && action === 'voidOrder') return ['/sales', '/pos']
    if (group === 'pos' && action === 'createReturn') return ['/returns', '/pos']
    if (group === 'invoices' && action === 'createReturn') return ['/purchase-returns', '/invoices']
    if (group === 'customers' && ['getPayments', 'receivePayment'].includes(action)) return ['/settlements', '/customers']
    if (group === 'suppliers' && ['getPayments', 'payInvoice'].includes(action)) return ['/settlements', '/suppliers']
    if (group === 'stock' && action === 'waste') return ['/waste', '/stock']
    const paths: Record<string, string[]> = {
      products: ['/products'], productBarcodes: ['/products'], productUnits: ['/products'],
      categories: ['/categories'], customers: ['/customers'], suppliers: ['/suppliers'],
      invoices: ['/invoices'], purchaseRequests: ['/purchase-requests'], promotions: ['/promotions'],
      pos: ['/pos'], stock: ['/stock'], branches: ['/branches'], warehouses: ['/branches'],
      transferRequests: ['/transfer-requests'], transfers: ['/transfers'], inventory: ['/inventory'],
      auth: ['/users'], roles: ['/roles'], settings: ['/settings'], backup: ['/settings'],
      system: ['/settings'], expenses: ['/expenses'], expenseCategories: ['/expenses'],
      accounts: ['/chart-of-accounts'], journalEntries: ['/journal-entries'],
      bankAccounts: ['/banks'], bankTransactions: ['/banks'], bankStatements: ['/banks'],
      bankRules: ['/banks'], reports: ['/reports', '/financial-reports'],
    }
    if (group === 'activity' && action === 'log') return []
    if (group === 'warehouses' && action === 'init') return []
    if (group === 'reports' && action === 'financial') return ['/financial-reports']
    return paths[group] ?? []
  }
  const ipcHandle = (channel: string, handler: (...args: any[]) => any) => {
    ipcMain.handle(channel, async (event, ...args) => {
      if (channel === 'auth:logout') {
        authenticatedSessions.delete(event.sender.id)
        return handler(event, ...args)
      }
      if (publicChannels.has(channel)) return handler(event, ...args)
      if (channel === 'auth:create' && await prisma.user.count() === 0) {
        return handler(event, ...args)
      }

      const userId = authenticatedSessions.get(event.sender.id)
      if (!userId) throw new Error('انتهت جلسة الدخول. سجل الدخول مرة أخرى')
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, isActive: true },
      })
      if (!user?.isActive) {
        authenticatedSessions.delete(event.sender.id)
        throw new Error('الحساب غير نشط. سجل الدخول بحساب آخر')
      }
      const role = await resolveRole(user.role)
      if (!role) throw new Error('دور المستخدم غير موجود')

      const action = channel.split(':')[1] ?? ''
      if (mutatingActions.has(action) && !role.fullAccess) {
        const allowedPaths = permissionPaths(channel)
        if (allowedPaths.length > 0 && !allowedPaths.some(path =>
          role.permissions.some(permission => path === permission || path.startsWith(permission + '/'))
        )) {
          throw new Error('ليس لديك صلاحية لتنفيذ هذه العملية')
        }
      }
      return handler(event, ...args)
    })
  }

  async function getDefaultWarehouse(tx: Prisma.TransactionClient) {
    let branch = await tx.branch.findFirst({ where: { isDefault: true } })
    if (!branch) {
      branch = await tx.branch.findFirst({ orderBy: { id: 'asc' } })
      if (branch) {
        await tx.branch.updateMany({ data: { isDefault: false } })
        branch = await tx.branch.update({ where: { id: branch.id }, data: { isDefault: true } })
      }
    }
    if (!branch) branch = await tx.branch.create({ data: { name: 'الفرع الرئيسي', isDefault: true } })

    let warehouse = await tx.warehouse.findFirst({
      where: { branchId: branch.id, isDefault: true },
    })
    if (!warehouse) {
      warehouse = await tx.warehouse.create({
        data: { name: 'المخزن الرئيسي', branchId: branch.id, isDefault: true },
      })
    }

    const migration = await tx.setting.findUnique({ where: { key: 'warehouseStockMigrationV1' } })
    if (!migration) {
      const products = await tx.product.findMany({ select: { id: true, currentStock: true } })
      for (const product of products) {
        const total = await tx.warehouseStock.aggregate({
          where: { productId: product.id },
          _sum: { quantity: true },
        })
        // Preserve legacy balances exactly once when upgrading from global-only stock.
        if ((total._sum.quantity ?? 0) === 0 && product.currentStock > 0) {
          await tx.warehouseStock.upsert({
            where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
            update: { quantity: product.currentStock },
            create: { warehouseId: warehouse.id, productId: product.id, quantity: product.currentStock },
          })
        }
        await refreshProductStock(tx, product.id)
      }
      await tx.setting.create({
        data: { key: 'warehouseStockMigrationV1', value: new Date().toISOString() },
      })
    }
    return warehouse
  }

  async function refreshProductStock(tx: Prisma.TransactionClient, productId: number) {
    const total = await tx.warehouseStock.aggregate({
      where: { productId },
      _sum: { quantity: true },
    })
    const currentStock = total._sum.quantity ?? 0
    await tx.product.update({ where: { id: productId }, data: { currentStock } })
    return currentStock
  }

  async function changeWarehouseStock(
    tx: Prisma.TransactionClient,
    warehouseId: number,
    productId: number,
    delta: number,
  ) {
    if (!Number.isFinite(delta) || delta === 0) throw new Error('تغير المخزون غير صالح')
    if (delta < 0) {
      const changed = await tx.warehouseStock.updateMany({
        where: { warehouseId, productId, quantity: { gte: -delta } },
        data: { quantity: { decrement: -delta } },
      })
      if (changed.count !== 1) throw new Error('المخزون غير كافٍ في المخزن المحدد')
    } else {
      await tx.warehouseStock.upsert({
        where: { warehouseId_productId: { warehouseId, productId } },
        update: { quantity: { increment: delta } },
        create: { warehouseId, productId, quantity: delta },
      })
    }
    return refreshProductStock(tx, productId)
  }

  // ─── PRODUCTS ──────────────────────────────────────────────────
  ipcHandle('products:getAll', (_, includeInactive = false) =>
    prisma.product.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    })
  )

  ipcHandle('products:getByBarcode', async (_, barcode: string) => {
    const pb = await prisma.productBarcode.findUnique({ where: { barcode }, include: { product: { include: { category: true } } } })
    if (pb) return { ...pb.product, _barcodeUnit: pb.unit, _conversionFactor: pb.conversionFactor }
    return prisma.product.findUnique({ where: { barcode }, include: { category: true } })
  })

  ipcHandle('productBarcodes:getByProduct', (_, productId: number) =>
    prisma.productBarcode.findMany({ where: { productId }, orderBy: { createdAt: 'asc' } })
  )
  ipcHandle('productBarcodes:create', (_, data) =>
    prisma.productBarcode.create({ data })
  )
  ipcHandle('productBarcodes:update', (_, { id, ...data }) =>
    prisma.productBarcode.update({ where: { id }, data })
  )
  ipcHandle('productBarcodes:delete', (_, id: number) =>
    prisma.productBarcode.delete({ where: { id } })
  )

  ipcHandle('productUnits:getByProduct', (_, productId: number) =>
    prisma.productUnit.findMany({ where: { productId }, orderBy: { level: 'asc' } })
  )
  ipcHandle('productUnits:create', (_, data) =>
    prisma.productUnit.create({ data })
  )
  ipcHandle('productUnits:update', (_, { id, ...data }) =>
    prisma.productUnit.update({ where: { id }, data })
  )
  ipcHandle('productUnits:delete', (_, id: number) =>
    prisma.productUnit.delete({ where: { id } })
  )

  async function nextSku() {
    const last = await prisma.product.findFirst({
      where: { sku: { not: null } },
      orderBy: { sku: 'desc' },
    })
    if (!last?.sku) return 'PRD-0001'
    const num = parseInt(last.sku.replace('PRD-', '')) + 1
    return `PRD-${String(num).padStart(4, '0')}`
  }

  ipcHandle('products:create', async (_, data) =>
    prisma.$transaction(async (tx) => {
      const sku = data.sku || await nextSku()
      const initialStock = Number(data.currentStock ?? 0)
      if (!Number.isFinite(initialStock) || initialStock < 0) throw new Error('الرصيد الافتتاحي غير صالح')
      const product = await tx.product.create({ data: { ...data, sku, currentStock: 0 } })
      const defaultWarehouse = await getDefaultWarehouse(tx)
      const warehouses = await tx.warehouse.findMany({ select: { id: true } })
      for (const wh of warehouses) {
        await tx.warehouseStock.create({
          data: {
            warehouseId: wh.id,
            productId: product.id,
            quantity: wh.id === defaultWarehouse.id ? initialStock : 0,
          },
        })
      }
      await tx.product.update({ where: { id: product.id }, data: { currentStock: initialStock } })
      if (initialStock > 0) {
        await tx.stockMovement.create({
          data: { productId: product.id, quantity: initialStock, type: 'adjust', note: 'رصيد افتتاحي' },
        })
      }
      return { ...product, currentStock: initialStock }
    })
  )

  ipcHandle('products:update', async (_, { id, ...data }) => {
    const old = await prisma.product.findUnique({ where: { id } })
    if (old && data.costPrice !== undefined && data.costPrice !== old.costPrice) {
      await prisma.priceHistory.create({
        data: { productId: id, costPrice: data.costPrice },
      })
    }
    return prisma.product.update({ where: { id }, data })
  })

  ipcHandle('products:delete', (_, id: number) =>
    prisma.product.delete({ where: { id } })
  )

  ipcHandle('products:getPriceHistory', (_, productId: number) =>
    prisma.priceHistory.findMany({
      where: { productId },
      orderBy: { date: 'desc' },
      take: 50,
    })
  )

  ipcHandle('products:selectImage', async (_, id: number) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const imgPath = result.filePaths[0]
    await prisma.product.update({ where: { id }, data: { imagePath: imgPath } })
    return imgPath
  })

  ipcHandle('products:removeImage', async (_, id: number) => {
    await prisma.product.update({ where: { id }, data: { imagePath: null } })
  })

  ipcHandle('products:getImageData', async (_, imgPath: string) => {
    try {
      const { readFile } = await import('node:fs/promises')
      const buf  = await readFile(imgPath)
      const ext  = imgPath.split('.').pop()?.toLowerCase() ?? 'jpg'
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch { return null }
  })

  // ─── CATEGORIES ────────────────────────────────────────────────
  ipcHandle('categories:getAll', () =>
    prisma.category.findMany({ orderBy: { name: 'asc' } })
  )

  ipcHandle('categories:create', (_, data) =>
    prisma.category.create({ data })
  )

  ipcHandle('categories:update', (_, { id, ...data }) =>
    prisma.category.update({ where: { id }, data })
  )

  ipcHandle('categories:delete', (_, id: number) =>
    prisma.category.delete({ where: { id } })
  )

  // ─── CUSTOMERS ─────────────────────────────────────────────────
  ipcHandle('customers:getAll', () =>
    prisma.customer.findMany({ orderBy: { name: 'asc' } })
  )

  ipcHandle('customers:create', (_, data) =>
    prisma.customer.create({ data })
  )

  ipcHandle('customers:update', (_, { id, ...data }) =>
    prisma.customer.update({ where: { id }, data })
  )

  ipcHandle('customers:delete', (_, id: number) =>
    prisma.customer.delete({ where: { id } })
  )

  ipcHandle('customers:addPoints', (_, { id, points }: { id: number; points: number }) =>
    prisma.customer.update({
      where: { id },
      data: { loyaltyPoints: { increment: points } },
    })
  )

  ipcHandle('customers:getPayments', (_, customerId?: number) =>
    prisma.customerPayment.findMany({
      where: customerId ? { customerId } : undefined,
      include: { customer: true, order: true },
      orderBy: { date: 'desc' },
    })
  )

  ipcHandle('customers:receivePayment', async (_, data: { orderId: number; amount: number; paymentMethod: string; date?: string | Date; reference?: string; notes?: string }) => {
    const amount = Number(data.amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('أدخل مبلغ تحصيل صحيحًا أكبر من صفر')
    if (!['cash', 'card', 'instapay', 'vodafone'].includes(data.paymentMethod)) throw new Error('طريقة التحصيل غير مدعومة')
    const paymentDate = data.date ? new Date(data.date) : new Date()
    if (Number.isNaN(paymentDate.getTime())) throw new Error('تاريخ التحصيل غير صحيح')

    return prisma.$transaction(async (tx) => {
      const order = await tx.posOrder.findUnique({ where: { id: data.orderId } })
      if (!order || order.status !== 'completed' || !order.customerId) throw new Error('الفاتورة الآجلة أو العميل غير موجود')
      if (order.paymentMethod !== 'credit') throw new Error('هذه الفاتورة ليست مسجلة على الحساب')
      const paid = await tx.customerPayment.aggregate({ where: { orderId: order.id }, _sum: { amount: true } })
      const outstanding = Math.max(0, order.total - (paid._sum.amount ?? 0))
      if (amount > outstanding + 0.005) throw new Error(`مبلغ التحصيل أكبر من المتبقي: ${outstanding.toFixed(2)}`)

      await ensureStandardAccounts(tx)
      const cashAcc = await findAccByCode('1111', tx)
      const bankAcc = await findAccByCode('1112', tx)
      const receivableAcc = await findAccByCode('1121', tx)
      const debitAcc = data.paymentMethod === 'cash' ? cashAcc : bankAcc
      if (!debitAcc || !receivableAcc) throw new Error('حساب النقدية/البنك أو العملاء غير موجود في دليل الحسابات')

      const payment = await tx.customerPayment.create({
        data: {
          customerId: order.customerId,
          orderId: order.id,
          amount,
          paymentMethod: data.paymentMethod,
          date: paymentDate,
          reference: data.reference?.trim() || null,
          notes: data.notes?.trim() || null,
        },
      })
      await autoJE({
        date: paymentDate,
        description: `تحصيل من عميل - ${order.orderNumber} - RCPT-${payment.id}`,
        reference: data.reference || `RCPT-${payment.id}`,
        source: 'customer_payment',
        sourceId: payment.id,
        lines: [
          { accountId: debitAcc.id, debit: amount, credit: 0, description: 'تحصيل نقدي/بنكي' },
          { accountId: receivableAcc.id, debit: 0, credit: amount, description: 'تخفيض مديونية العميل' },
        ],
        db: tx,
      })
      return { ...payment, outstandingAfter: Math.max(0, outstanding - amount) }
    })
  })

  // ─── SUPPLIERS ─────────────────────────────────────────────────
  ipcHandle('suppliers:getAll', () =>
    prisma.supplier.findMany({ orderBy: { name: 'asc' } })
  )

  ipcHandle('suppliers:create', (_, data) =>
    prisma.supplier.create({ data })
  )

  ipcHandle('suppliers:update', (_, { id, ...data }) =>
    prisma.supplier.update({ where: { id }, data })
  )

  ipcHandle('suppliers:delete', (_, id: number) =>
    prisma.supplier.delete({ where: { id } })
  )

  ipcHandle('suppliers:getPayments', (_, supplierId?: number) =>
    prisma.supplierPayment.findMany({
      where: supplierId ? { supplierId } : undefined,
      include: { supplier: true, invoice: true },
      orderBy: { date: 'desc' },
    })
  )

  ipcHandle('suppliers:payInvoice', async (_, data: { invoiceId: number; amount: number; paymentMethod: string; date?: string | Date; reference?: string; notes?: string }) => {
    const amount = Number(data.amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('أدخل مبلغ سداد صحيحًا أكبر من صفر')
    if (!['cash', 'card', 'instapay', 'vodafone'].includes(data.paymentMethod)) throw new Error('طريقة السداد غير مدعومة')
    const paymentDate = data.date ? new Date(data.date) : new Date()
    if (Number.isNaN(paymentDate.getTime())) throw new Error('تاريخ السداد غير صحيح')

    return prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findUnique({ where: { id: data.invoiceId } })
      if (!invoice || invoice.status !== 'confirmed' || !invoice.supplierId) throw new Error('فاتورة المورد غير موجودة أو غير مرتبطة بمورد')
      const paid = await tx.supplierPayment.aggregate({ where: { invoiceId: invoice.id }, _sum: { amount: true } })
      const outstanding = Math.max(0, invoice.total - (paid._sum.amount ?? 0))
      if (amount > outstanding + 0.005) throw new Error(`مبلغ السداد أكبر من المتبقي: ${outstanding.toFixed(2)}`)

      await ensureStandardAccounts(tx)
      const payableAcc = await findAccByCode('2111', tx)
      const cashAcc = await findAccByCode('1111', tx)
      const bankAcc = await findAccByCode('1112', tx)
      const creditAcc = data.paymentMethod === 'cash' ? cashAcc : bankAcc
      if (!payableAcc || !creditAcc) throw new Error('حساب الموردين أو النقدية/البنك غير موجود في دليل الحسابات')

      const payment = await tx.supplierPayment.create({
        data: {
          supplierId: invoice.supplierId,
          invoiceId: invoice.id,
          amount,
          paymentMethod: data.paymentMethod,
          date: paymentDate,
          reference: data.reference?.trim() || null,
          notes: data.notes?.trim() || null,
        },
      })
      await autoJE({
        date: paymentDate,
        description: `سداد مورد - ${invoice.invoiceNumber ?? `INV-${invoice.id}`} - PAY-${payment.id}`,
        reference: data.reference || `PAY-${payment.id}`,
        source: 'supplier_payment',
        sourceId: payment.id,
        lines: [
          { accountId: payableAcc.id, debit: amount, credit: 0, description: 'تخفيض مديونية المورد' },
          { accountId: creditAcc.id, debit: 0, credit: amount, description: 'سداد نقدي/بنكي' },
        ],
        db: tx,
      })
      return { ...payment, outstandingAfter: Math.max(0, outstanding - amount) }
    })
  })

  // ─── PURCHASE INVOICES ─────────────────────────────────────────
  ipcHandle('invoices:getAll', () =>
    prisma.purchaseInvoice.findMany({
      where: { status: 'confirmed' },
      include: { supplier: true, items: { include: { product: true } }, payments: true, returns: { include: { items: true } } },
      orderBy: { invoiceDate: 'desc' },
    })
  )

  ipcHandle('invoices:getDrafts', () =>
    prisma.purchaseInvoice.findMany({
      where: { status: 'draft' },
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    })
  )

  ipcHandle('invoices:create', async (_, { items, ...header }) => {
    if (!Array.isArray(items) || items.length === 0) throw new Error('أضف أصناف فاتورة الشراء')
    const invoice = await prisma.$transaction(async (tx) => {
      const warehouse = await getDefaultWarehouse(tx)
      const inv = await tx.purchaseInvoice.create({
        data: { ...header, status: 'confirmed', items: { create: items } },
        include: { items: true },
      })
      for (const item of inv.items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
          throw new Error('بيانات صنف في فاتورة الشراء غير صالحة')
        }
        const productCost = await tx.product.findUnique({ where: { id: item.productId }, select: { costPrice: true } })
        if (!productCost) throw new Error('المنتج غير موجود')
        const stockBefore = await tx.warehouseStock.aggregate({ where: { productId: item.productId }, _sum: { quantity: true } })
        const quantityBefore = stockBefore._sum.quantity ?? 0
        const weightedAverageCost = quantityBefore + item.quantity > 0
          ? ((quantityBefore * productCost.costPrice) + (item.quantity * item.unitPrice)) / (quantityBefore + item.quantity)
          : item.unitPrice
        await changeWarehouseStock(tx, warehouse.id, item.productId, item.quantity)
        await tx.product.update({ where: { id: item.productId }, data: { costPrice: weightedAverageCost } })
        await tx.stockMovement.create({
          data: { productId: item.productId, quantity: item.quantity, type: 'purchase', referenceId: inv.id },
        })
      }
      await postPurchaseInvoiceJE(inv, tx)
      return inv
    })

    return invoice
  })

  ipcHandle('invoices:saveDraft', (_, { items, ...header }) =>
    prisma.purchaseInvoice.create({
      data: { ...header, status: 'draft', items: { create: items } },
    })
  )

  ipcHandle('invoices:updateDraft', (_, { id, items, ...header }) =>
    prisma.purchaseInvoice.update({
      where: { id },
      data: {
        ...header,
        items: { deleteMany: {}, create: items },
      },
    })
  )

  ipcHandle('invoices:deleteDraft', (_, id: number) =>
    prisma.purchaseInvoice.delete({ where: { id, status: 'draft' } })
  )

  ipcHandle('invoices:confirmDraft', async (_, id: number) => {
    const invoice = await prisma.$transaction(async (tx) => {
      const claimed = await tx.purchaseInvoice.updateMany({
        where: { id, status: 'draft' },
        data: { status: 'confirmed' },
      })
      if (claimed.count !== 1) throw new Error('الفاتورة غير موجودة أو تم تأكيدها مسبقًا')
      const inv = await tx.purchaseInvoice.findUnique({
        where: { id },
        include: { items: true },
      })
      if (!inv) throw new Error('الفاتورة غير موجودة')
      const warehouse = await getDefaultWarehouse(tx)
      for (const item of inv.items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) throw new Error('بيانات صنف شراء غير صالحة')
        const productCost = await tx.product.findUnique({ where: { id: item.productId }, select: { costPrice: true } })
        if (!productCost) throw new Error('المنتج غير موجود')
        const stockBefore = await tx.warehouseStock.aggregate({ where: { productId: item.productId }, _sum: { quantity: true } })
        const quantityBefore = stockBefore._sum.quantity ?? 0
        const weightedAverageCost = quantityBefore + item.quantity > 0
          ? ((quantityBefore * productCost.costPrice) + (item.quantity * item.unitPrice)) / (quantityBefore + item.quantity)
          : item.unitPrice
        await changeWarehouseStock(tx, warehouse.id, item.productId, item.quantity)
        await tx.product.update({ where: { id: item.productId }, data: { costPrice: weightedAverageCost } })
        await tx.stockMovement.create({
          data: { productId: item.productId, quantity: item.quantity, type: 'purchase', referenceId: id },
        })
      }
      await postPurchaseInvoiceJE(inv, tx)
      return inv
    })

    return invoice
  })

  ipcHandle('invoices:createReturn', async (_, data: { invoiceId: number; items: { productId: number; quantity: number }[]; reason?: string }) => {
    if (!Number.isInteger(data.invoiceId) || !Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('اختر فاتورة وحدد صنفًا واحدًا على الأقل للمرتجع')
    }
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findUnique({
        where: { id: data.invoiceId },
        include: { items: true, returns: { include: { items: true } } },
      })
      if (!invoice || invoice.status !== 'confirmed') throw new Error('فاتورة الشراء غير موجودة أو غير مؤكدة')
      if (!Number.isFinite(invoice.subtotal) || invoice.subtotal <= 0) throw new Error('لا يمكن حساب ضريبة مرتجع لفاتورة مجموعها صفر')

      const requested = new Map<number, number>()
      for (const item of data.items) {
        if (!Number.isInteger(item.productId) || !Number.isFinite(item.quantity) || item.quantity <= 0) {
          throw new Error('كمية صنف المرتجع غير صالحة')
        }
        requested.set(item.productId, (requested.get(item.productId) ?? 0) + item.quantity)
      }

      const normalizedItems = [...requested.entries()].map(([productId, quantity]) => {
        const purchased = invoice.items.filter(item => item.productId === productId)
        if (purchased.length === 0) throw new Error('الصنف غير موجود في فاتورة الشراء')
        const purchasedQty = purchased.reduce((sum, item) => sum + item.quantity, 0)
        const returnedQty = invoice.returns.reduce((sum, ret) =>
          sum + ret.items.filter(item => item.productId === productId).reduce((part, item) => part + item.quantity, 0), 0)
        if (quantity > purchasedQty - returnedQty + 0.000001) {
          throw new Error(`كمية المرتجع تتجاوز الكمية المشتراة للصنف ${purchased[0].productId}`)
        }
        const unitPrice = purchased.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) / purchasedQty
        return { productId, productName: `صنف #${productId}`, quantity, unitPrice, total: quantity * unitPrice }
      })

      const warehouse = await getDefaultWarehouse(tx)
      const itemsWithCost: { productId: number; productName: string; quantity: number; unitPrice: number; unitCost: number; total: number }[] = []
      for (const item of normalizedItems) {
        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { name: true, costPrice: true } })
        if (!product) throw new Error('المنتج غير موجود')
        const stock = await tx.warehouseStock.findUnique({
          where: { warehouseId_productId: { warehouseId: warehouse.id, productId: item.productId } },
        })
        if (!stock || stock.quantity < item.quantity) {
          throw new Error(`المخزون غير كافٍ لإرجاع الصنف ${product.name} إلى المورد`)
        }
        itemsWithCost.push({ ...item, productName: product.name, unitCost: product.costPrice })
      }

      const subtotal = itemsWithCost.reduce((sum, item) => sum + item.total, 0)
      const ratio = subtotal / invoice.subtotal
      const taxShare = Math.round(invoice.taxAmount * ratio * 100) / 100
      const supplierCredit = Math.round((subtotal + taxShare) * 100) / 100
      const inventoryCost = Math.round(itemsWithCost.reduce((sum, item) => sum + item.quantity * item.unitCost, 0) * 100) / 100
      const variance = Math.round((subtotal - inventoryCost) * 100) / 100
      if (!Number.isFinite(supplierCredit) || supplierCredit <= 0 || !Number.isFinite(inventoryCost) || inventoryCost < 0) {
        throw new Error('تعذر حساب قيمة مرتجع المورد')
      }

      const ret = await tx.purchaseReturn.create({
        data: {
          invoiceId: invoice.id,
          reason: data.reason?.trim() || null,
          total: subtotal,
          items: { create: itemsWithCost },
        },
        include: { items: true },
      })
      for (const item of ret.items) {
        await changeWarehouseStock(tx, warehouse.id, item.productId, -item.quantity)
        await tx.stockMovement.create({
          data: { productId: item.productId, quantity: -item.quantity, type: 'purchase_return', referenceId: ret.id, note: `مرتجع مورد ${invoice.invoiceNumber ?? invoice.id}` },
        })
      }

      await ensureStandardAccounts(tx)
      const [payableAcc, inventoryAcc, vatAcc, returnsAcc] = await Promise.all([
        findAccByCode('2111', tx), findAccByCode('1131', tx),
        findAccByCode('2121', tx), findAccByCode('512', tx),
      ])
      if (!payableAcc || !inventoryAcc || !returnsAcc) throw new Error('حساب الموردين أو المخزون أو مردودات المشتريات غير موجود')
      const lines: { accountId: number; debit: number; credit: number; description?: string }[] = [
        { accountId: payableAcc.id, debit: supplierCredit, credit: 0, description: 'إشعار دائن من المورد' },
        { accountId: inventoryAcc.id, debit: 0, credit: inventoryCost, description: 'خروج مخزون مرتجع للمورد' },
      ]
      if (taxShare > 0) {
        if (!vatAcc) throw new Error('حساب ضريبة القيمة المضافة غير موجود')
        lines.push({ accountId: vatAcc.id, debit: 0, credit: taxShare, description: 'عكس ضريبة مدخلات' })
      }
      if (variance > 0) lines.push({ accountId: returnsAcc.id, debit: 0, credit: variance, description: 'مردودات مشتريات / فرق تكلفة' })
      else if (variance < 0) lines.push({ accountId: returnsAcc.id, debit: Math.abs(variance), credit: 0, description: 'فرق تكلفة مردودات مشتريات' })
      await autoJE({
        date: new Date(ret.returnDate),
        description: `مرتجع مشتريات - PR-${ret.id}`,
        reference: invoice.invoiceNumber ?? `INV-${invoice.id}`,
        source: 'purchase_return',
        sourceId: ret.id,
        lines,
        db: tx,
      })
      return { ...ret, taxAmount: taxShare, supplierCredit }
    })
  })

  // ─── PURCHASE REQUESTS ─────────────────────────────────────────
  ipcHandle('purchaseRequests:getAll', () =>
    prisma.purchaseRequest.findMany({
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { requestDate: 'desc' },
    })
  )

  ipcHandle('purchaseRequests:create', (_, { items, ...data }) =>
    prisma.purchaseRequest.create({
      data: { ...data, items: { create: items } },
    })
  )

  ipcHandle('purchaseRequests:updateStatus', (_, { id, status }: { id: number; status: string }) =>
    prisma.purchaseRequest.update({ where: { id }, data: { status } })
  )

  ipcHandle('purchaseRequests:delete', (_, id: number) =>
    prisma.purchaseRequest.delete({ where: { id } })
  )

  // ─── PROMOTIONS ────────────────────────────────────────────────
  ipcHandle('promotions:getAll', () =>
    prisma.promotion.findMany({
      include: { products: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    })
  )

  ipcHandle('promotions:create', (_, { productIds, ...data }) =>
    prisma.promotion.create({
      data: {
        ...data,
        products: productIds?.length
          ? { create: (productIds as number[]).map((pid: number) => ({ productId: pid })) }
          : undefined,
      },
    })
  )

  ipcHandle('promotions:update', (_, { id, productIds, ...data }) =>
    prisma.promotion.update({
      where: { id },
      data: {
        ...data,
        products: productIds !== undefined
          ? { deleteMany: {}, create: (productIds as number[]).map((pid: number) => ({ productId: pid })) }
          : undefined,
      },
    })
  )

  ipcHandle('promotions:toggle', (_, id: number) =>
    prisma.promotion.findUnique({ where: { id } }).then(p =>
      prisma.promotion.update({ where: { id }, data: { isActive: !p?.isActive } })
    )
  )

  ipcHandle('promotions:delete', (_, id: number) =>
    prisma.promotion.delete({ where: { id } })
  )

  // ─── POS ───────────────────────────────────────────────────────
  ipcHandle('pos:createOrder', async (_, { items, customerId, ...header }) => {
    if (!['cash', 'card', 'instapay', 'vodafone', 'credit'].includes(header.paymentMethod ?? 'cash')) {
      throw new Error('طريقة دفع غير مدعومة')
    }
    if (header.paymentMethod === 'credit' && !customerId) throw new Error('اختر العميل أولاً لتسجيل الفاتورة آجلاً')
    if (!Array.isArray(items) || items.length === 0) throw new Error('أضف صنفًا واحدًا على الأقل')
    for (const item of items) {
      if (!Number.isInteger(item.productId) || !Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new Error('بيانات صنف غير صالحة')
      }
    }
    const order = await prisma.$transaction(async (tx) => {
      const maxOrder = await tx.posOrder.aggregate({ _max: { id: true } })
      const num = String((maxOrder._max.id ?? 0) + 1).padStart(6, '0')
      const productIds = [...new Set(items.map((item: { productId: number }) => item.productId))]
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, costPrice: true },
      })
      const costByProduct = new Map(products.map(product => [product.id, product.costPrice]))
      if (products.length !== productIds.length) throw new Error('يوجد منتج غير موجود أو غير نشط')
      if (header.paymentMethod === 'credit') {
        const customer = await tx.customer.findUnique({ where: { id: customerId }, select: { id: true } })
        if (!customer) throw new Error('العميل المحدد غير موجود')
      }
      const o = await tx.posOrder.create({
        data: {
          orderNumber: `ORD-${num}`,
          ...header,
          customerId: customerId || null,
          items: {
            create: items.map((item: { productId: number; quantity: number; unitPrice: number; productName: string; total: number }) => ({
              ...item,
              unitCost: costByProduct.get(item.productId) ?? 0,
            })),
          },
        },
        include: { items: true },
      })
      const warehouse = await getDefaultWarehouse(tx)
      for (const item of o.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { isActive: true } })
        if (!product?.isActive) throw new Error('المنتج غير نشط')
        await changeWarehouseStock(tx, warehouse.id, item.productId, -item.quantity)
        await tx.stockMovement.create({
          data: { productId: item.productId, quantity: -item.quantity, type: 'sale', referenceId: o.id },
        })
      }
      if (customerId) {
        const pts = Math.floor(o.total / 10)
        if (pts > 0) await tx.customer.update({ where: { id: customerId }, data: { loyaltyPoints: { increment: pts } } })
      }
      // The order, stock movements, loyalty points and ledger postings commit together.
      await postSaleJE(o, tx)
      return o
    })

    return order
  })

  ipcHandle('pos:getOrders', (_, limit = 100) =>
    prisma.posOrder.findMany({
      include: { items: { include: { product: true } }, customer: true, payments: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  )

  ipcHandle('pos:voidOrder', async (_, id: number) => {
    return prisma.$transaction(async (tx) => {
      const current = await tx.posOrder.findUnique({
        where: { id },
        include: { items: true, returns: true },
      })
      if (!current) throw new Error('الفاتورة غير موجودة')
      if (current.status !== 'completed') throw new Error('الفاتورة ملغاة بالفعل')
      if (current.returns.length > 0) throw new Error('لا يمكن إلغاء فاتورة لها مرتجعات مسجلة')

      const originalEntries = await tx.journalEntry.findMany({
        where: { source: 'sale', sourceId: id, status: 'posted' },
        include: { lines: true },
      })
      if (originalEntries.length === 0) {
        throw new Error('لا يمكن إلغاء الفاتورة لأن قيودها المحاسبية الأصلية غير موجودة')
      }

      const o = await tx.posOrder.update({
        where: { id },
        data: { status: 'voided' },
        include: { items: true },
      })
      const warehouse = await getDefaultWarehouse(tx)
      for (const item of o.items) {
        await changeWarehouseStock(tx, warehouse.id, item.productId, item.quantity)
        await tx.stockMovement.create({
          data: { productId: item.productId, quantity: item.quantity, type: 'return', referenceId: o.id, note: `إلغاء ${o.orderNumber}` },
        })
      }

      // Reverse every original sale posting in the same transaction as the void and stock restoration.
      for (const je of originalEntries) {
        const reversalDescription = `إلغاء: ${je.description ?? je.number}`
        const existingReversal = await tx.journalEntry.findFirst({
          where: { source: 'sale', sourceId: id, reference: je.number, description: reversalDescription, status: 'posted' },
        })
        if (existingReversal) continue
        const number = await nextJENumber(tx)
        await tx.journalEntry.create({
          data: {
            number,
            date: new Date(),
            status: 'posted',
            description: reversalDescription,
            reference: je.number,
            source: 'sale',
            sourceId: id,
            lines: {
              create: je.lines.map(line => ({
                accountId: line.accountId,
                debit: line.credit,
                credit: line.debit,
                description: line.description,
              })),
            },
          },
        })
      }
      return o
    })
  })

  ipcHandle('pos:createReturn', async (_, { orderId, items, reason }) => {
    if (!Array.isArray(items) || items.length === 0) throw new Error('حدد أصناف المرتجع')
    const ret = await prisma.$transaction(async (tx) => {
      const order = await tx.posOrder.findUnique({
        where: { id: orderId },
        include: { items: true, returns: { include: { items: true } } },
      })
      if (!order || order.status !== 'completed') throw new Error('الفاتورة غير موجودة أو ملغاة')

      const requestedByProduct = new Map<number, number>()
      for (const item of items) {
        if (!Number.isInteger(item.productId) || !Number.isFinite(item.quantity) || item.quantity <= 0) {
          throw new Error('كمية المرتجع غير صالحة')
        }
        requestedByProduct.set(item.productId, (requestedByProduct.get(item.productId) ?? 0) + item.quantity)
      }

      const normalizedItems = [...requestedByProduct.entries()].map(([productId, quantity]) => {
        const soldItems = order.items.filter(i => i.productId === productId)
        if (soldItems.length === 0) throw new Error('الصنف غير موجود في الفاتورة الأصلية')
        const soldQuantity = soldItems.reduce((sum, item) => sum + item.quantity, 0)
        const alreadyReturned = order.returns.reduce((sum, ret) =>
          sum + ret.items.filter(item => item.productId === productId).reduce((part, item) => part + item.quantity, 0), 0)
        if (quantity > soldQuantity - alreadyReturned) {
          throw new Error(`كمية المرتجع تتجاوز الكمية المباعة للصنف ${soldItems[0].productName}`)
        }
        const unitPrice = soldItems[0].unitPrice
        return {
          productId,
          productName: soldItems[0].productName,
          quantity,
          unitPrice,
          unitCost: soldItems.reduce((sum, item) => sum + item.unitCost * item.quantity, 0) / soldQuantity,
          total: quantity * unitPrice,
        }
      })
      const total = normalizedItems.reduce((sum, item) => sum + item.total, 0)
      const r = await tx.saleReturn.create({
        data: { orderId, reason, total, items: { create: normalizedItems } },
        include: { items: true },
      })
      const warehouse = await getDefaultWarehouse(tx)
      for (const item of r.items) {
        await changeWarehouseStock(tx, warehouse.id, item.productId, item.quantity)
        await tx.stockMovement.create({
          data: { productId: item.productId, quantity: item.quantity, type: 'return', referenceId: r.id },
        })
      }

      await ensureStandardAccounts(tx)
      const [salesAcc, cashAcc, bankAcc, receivableAcc, vatAcc, cogsAcc, invAcc] = await Promise.all([
        findAccByCode('412', tx), findAccByCode('1111', tx), findAccByCode('1112', tx), findAccByCode('1121', tx),
        findAccByCode('2121', tx), findAccByCode('521', tx), findAccByCode('1131', tx),
      ])
      const refundAcc = order.paymentMethod === 'credit'
        ? receivableAcc
        : order.paymentMethod === 'cash' ? cashAcc : bankAcc
      if (!salesAcc || !refundAcc || !cogsAcc || !invAcc) {
        throw new Error('تعذر إيجاد حسابات مرتجع المبيعات والنقدية/البنك والمخزون والتكلفة')
      }
      if (!Number.isFinite(order.subtotal) || order.subtotal <= 0) {
        throw new Error('لا يمكن حساب الخصم والضريبة النسبية لمرتجع على فاتورة مجموعها صفر')
      }
      // Allocate the original invoice discount and VAT proportionally to the returned pre-discount item value.
      const returnRatio = r.total / order.subtotal
      const discountShare = Number(order.discountAmount ?? 0) * returnRatio
      const taxShare = Number(order.taxAmount ?? 0) * returnRatio
      const salesReturnBase = r.total - discountShare
      const refundTotal = salesReturnBase + taxShare
      if (![discountShare, taxShare, salesReturnBase, refundTotal].every(Number.isFinite) ||
          salesReturnBase < 0 || taxShare < 0 || refundTotal <= 0) {
        throw new Error('تعذر حساب قيمة المرتجع بعد توزيع الخصم والضريبة')
      }
      const returnLines = [
        { accountId: salesAcc.id, debit: salesReturnBase, credit: 0, description: 'مرتجع مبيعات بعد الخصم النسبي' },
      ]
      if (taxShare > 0) {
        if (!vatAcc) throw new Error('حساب ضريبة المبيعات غير موجود')
        returnLines.push({ accountId: vatAcc.id, debit: taxShare, credit: 0, description: 'عكس ضريبة مبيعات' })
      }
      returnLines.push({ accountId: refundAcc.id, debit: 0, credit: refundTotal, description: 'رد قيمة المرتجع بعد الضريبة' })
      await autoJE({
        date: new Date(r.returnDate),
        description: `مرتجع مبيعات - RTN-${r.id}`,
        reference: `RTN-${r.id}`,
        source: 'sale',
        sourceId: r.id,
        lines: returnLines,
        db: tx,
      })
      // Restore inventory at the original sale-time cost, in the same transaction.
      const cost = r.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
      if (cost > 0) {
        await autoJE({
          date: new Date(r.returnDate),
          description: `إعادة تكلفة مرتجع - RTN-${r.id}`,
          reference: `RTN-${r.id}`,
          source: 'sale',
          sourceId: r.id,
          lines: [
            { accountId: invAcc.id, debit: cost, credit: 0, description: 'إعادة مخزون' },
            { accountId: cogsAcc.id, debit: 0, credit: cost, description: 'عكس تكلفة' },
          ],
          db: tx,
        })
      }
      return r
    })

    return ret
  })

  ipcHandle('pos:getReturns', () =>
    prisma.saleReturn.findMany({
      include: { order: true, items: { include: { product: true } } },
      orderBy: { returnDate: 'desc' },
    })
  )

  // ─── STOCK ─────────────────────────────────────────────────────
  ipcHandle('stock:getMovements', (_, productId?: number) =>
    prisma.stockMovement.findMany({
      where: productId ? { productId } : undefined,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
  )

  ipcHandle('stock:adjust', async (_, { productId, quantity, note }: { productId: number; quantity: number; note?: string }) =>
    prisma.$transaction(async (tx) => {
      if (!Number.isFinite(quantity) || quantity === 0) throw new Error('الكمية يجب أن تكون رقمًا غير صفري')
      const warehouse = await getDefaultWarehouse(tx)
      await changeWarehouseStock(tx, warehouse.id, productId, quantity)
      return tx.stockMovement.create({ data: { productId, quantity, type: 'adjust', note } })
    })
  )

  ipcHandle('stock:waste', async (_, { productId, quantity, note }: { productId: number; quantity: number; note?: string }) =>
    prisma.$transaction(async (tx) => {
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('كمية الهالك يجب أن تكون أكبر من صفر')
      const warehouse = await getDefaultWarehouse(tx)
      await changeWarehouseStock(tx, warehouse.id, productId, -quantity)
      return tx.stockMovement.create({ data: { productId, quantity: -quantity, type: 'waste', note } })
    })
  )

  ipcHandle('stock:convertUnit', async (_, { productId, fromUnit, toUnit, quantity, factor, userId, note }: { productId: number; fromUnit: string; toUnit: string; quantity: number; factor: number; userId?: number; note?: string }) => {
    // Conversion between packaging units does not change total base stock;
    // it is recorded as an auditable movement for traceability.
    await prisma.stockMovement.create({
      data: { productId, quantity: 0, type: 'convert', note: `${fromUnit}→${toUnit} x${quantity} (×${factor})${note ? ' ' + note : ''}` },
    })
    return { ok: true }
  })

  ipcHandle('stock:getWaste', () =>
    prisma.stockMovement.findMany({
      where: { type: 'waste' },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    })
  )

  // ─── BRANCHES ──────────────────────────────────────────────────
  ipcHandle('branches:getAll', () =>
    prisma.branch.findMany({
      include: { warehouses: true },
      orderBy: { name: 'asc' },
    })
  )

  ipcHandle('branches:create', async (_, data) =>
    prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({ data: { ...data, isDefault: false } })
      await tx.warehouse.create({ data: { name: 'المخزن الرئيسي', branchId: branch.id, isDefault: true } })
      return branch
    })
  )

  ipcHandle('branches:setDefault', async (_, id: number) =>
    prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findUnique({ where: { id } })
      if (!branch) throw new Error('الفرع غير موجود')
      const [movements, transfers, orders, invoices, openCounts] = await Promise.all([
        tx.stockMovement.count(),
        tx.transfer.count(),
        tx.posOrder.count(),
        tx.purchaseInvoice.count({ where: { status: 'confirmed' } }),
        tx.inventoryCount.count({ where: { status: { not: 'closed' } } }),
      ])
      if (movements + transfers + orders + invoices + openCounts > 0) {
        throw new Error('لا يمكن تغيير الفرع الرئيسي بعد بدء حركة المخزون أو تسجيل عمليات. انقل الأرصدة وسوِّ العمليات المفتوحة أولاً')
      }
      await tx.branch.updateMany({ data: { isDefault: false } })
      return tx.branch.update({ where: { id }, data: { isDefault: true } })
    })
  )

  ipcHandle('branches:update', (_, { id, ...data }) =>
    prisma.branch.update({ where: { id }, data })
  )

  ipcHandle('branches:delete', async (_, id: number) =>
    prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findUnique({
        where: { id },
        include: { warehouses: { include: { stocks: true } } },
      })
      if (!branch) throw new Error('الفرع غير موجود')
      if (branch.isDefault) throw new Error('لا يمكن حذف الفرع الرئيسي')
      if (branch.warehouses.some(warehouse => warehouse.stocks.some(stock => Math.abs(stock.quantity) > 0.000001))) {
        throw new Error('لا يمكن حذف فرع يحتوي على مخزون. انقل الأرصدة أولاً')
      }
      for (const warehouse of branch.warehouses) {
        const [fromRequests, toRequests, fromTransfers, toTransfers] = await Promise.all([
          tx.transferRequest.count({ where: { fromWarehouseId: warehouse.id } }),
          tx.transferRequest.count({ where: { toWarehouseId: warehouse.id } }),
          tx.transfer.count({ where: { fromWarehouseId: warehouse.id } }),
          tx.transfer.count({ where: { toWarehouseId: warehouse.id } }),
        ])
        if (fromRequests + toRequests + fromTransfers + toTransfers > 0) {
          throw new Error('لا يمكن حذف فرع مرتبط بطلبات أو تحويلات سابقة')
        }
      }
      await tx.warehouse.deleteMany({ where: { branchId: id } })
      return tx.branch.delete({ where: { id } })
    })
  )

  // ─── WAREHOUSES ────────────────────────────────────────────────
  ipcHandle('warehouses:init', async () =>
    prisma.$transaction(async (tx) => {
      await getDefaultWarehouse(tx)
      return true
    })
  )

  ipcHandle('warehouses:getAll', () =>
    prisma.warehouse.findMany({
      include: { branch: true, stocks: { include: { product: true } } },
      orderBy: { name: 'asc' },
    })
  )

  ipcHandle('warehouses:create', async (_, data) =>
    prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.create({ data: { ...data, isDefault: false } })
      const products = await tx.product.findMany({ select: { id: true } })
      for (const product of products) {
        await tx.warehouseStock.upsert({
          where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
          update: {},
          create: { warehouseId: warehouse.id, productId: product.id, quantity: 0 },
        })
      }
      return warehouse
    })
  )

  ipcHandle('warehouses:update', (_, { id, ...data }) =>
    prisma.warehouse.update({ where: { id }, data })
  )

  ipcHandle('warehouses:delete', async (_, id: number) =>
    prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({
        where: { id },
        include: { stocks: true, branch: true },
      })
      if (!warehouse) throw new Error('المخزن غير موجود')
      if (warehouse.isDefault) throw new Error('لا يمكن حذف المخزن الافتراضي للفرع')
      if (warehouse.stocks.some(stock => Math.abs(stock.quantity) > 0.000001)) {
        throw new Error('لا يمكن حذف مخزن يحتوي على رصيد. انقل المخزون أولاً')
      }
      const [fromRequests, toRequests, fromTransfers, toTransfers] = await Promise.all([
        tx.transferRequest.count({ where: { fromWarehouseId: id } }),
        tx.transferRequest.count({ where: { toWarehouseId: id } }),
        tx.transfer.count({ where: { fromWarehouseId: id } }),
        tx.transfer.count({ where: { toWarehouseId: id } }),
      ])
      if (fromRequests + toRequests + fromTransfers + toTransfers > 0) {
        throw new Error('لا يمكن حذف مخزن مرتبط بطلبات أو تحويلات سابقة')
      }
      return tx.warehouse.delete({ where: { id } })
    })
  )

  ipcHandle('warehouses:setDefault', async (_, id: number) =>
    prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({ where: { id } })
      if (!warehouse) throw new Error('المخزن غير موجود')
      const [movements, transfers, orders, invoices, openCounts] = await Promise.all([
        tx.stockMovement.count(),
        tx.transfer.count(),
        tx.posOrder.count(),
        tx.purchaseInvoice.count({ where: { status: 'confirmed' } }),
        tx.inventoryCount.count({ where: { status: { not: 'closed' } } }),
      ])
      if (movements + transfers + orders + invoices + openCounts > 0) {
        throw new Error('لا يمكن تغيير المخزن الافتراضي بعد بدء حركة المخزون أو تسجيل عمليات')
      }
      await tx.warehouse.updateMany({
        where: { branchId: warehouse.branchId },
        data: { isDefault: false },
      })
      return tx.warehouse.update({ where: { id }, data: { isDefault: true } })
    })
  )

  ipcHandle('warehouses:syncStock', async (_, warehouseId: number) =>
    prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } })
      if (!warehouse) throw new Error('المخزن غير موجود')
      const products = await tx.product.findMany({ select: { id: true } })
      for (const product of products) {
        await tx.warehouseStock.upsert({
          where: { warehouseId_productId: { warehouseId, productId: product.id } },
          update: {},
          create: { warehouseId, productId: product.id, quantity: 0 },
        })
      }
      return products.length
    })
  )

  // ─── TRANSFER REQUESTS ─────────────────────────────────────────
  ipcHandle('transferRequests:getAll', () =>
    prisma.transferRequest.findMany({
      include: {
        fromWarehouse: { include: { branch: true } },
        toWarehouse:   { include: { branch: true } },
        items:         { include: { product: true } },
        transfer:      true,
      },
      orderBy: { requestDate: 'desc' },
    })
  )

  ipcHandle('transferRequests:create', async (_, { items, ...data }) => {
    const count = await prisma.transferRequest.count()
    const ref   = `TRQ-${String(count + 1).padStart(5, '0')}`
    return prisma.transferRequest.create({
      data: { ...data, referenceNumber: ref, items: { create: items } },
    })
  })

  ipcHandle('transferRequests:updateStatus', (_, { id, status }: { id: number; status: string }) =>
    prisma.transferRequest.update({ where: { id }, data: { status } })
  )

  ipcHandle('transferRequests:delete', (_, id: number) =>
    prisma.transferRequest.delete({ where: { id } })
  )

  // ─── TRANSFERS ─────────────────────────────────────────────────
  ipcHandle('transfers:getAll', () =>
    prisma.transfer.findMany({
      include: {
        fromWarehouse: { include: { branch: true } },
        toWarehouse:   { include: { branch: true } },
        items:         { include: { product: true } },
        request:       true,
      },
      orderBy: { transferDate: 'desc' },
    })
  )

  ipcHandle('transfers:execute', async (_, requestId: number) =>
    prisma.$transaction(async (tx) => {
      const req = await tx.transferRequest.findUnique({
        where: { id: requestId },
        include: { items: true, transfer: true },
      })
      if (!req) throw new Error('طلب التحويل غير موجود')
      if (req.transfer || req.status === 'transferred') throw new Error('تم تنفيذ طلب التحويل بالفعل')
      if (req.status !== 'approved') throw new Error('يجب الموافقة على طلب التحويل أولاً')
      if (req.fromWarehouseId === req.toWarehouseId) throw new Error('لا يمكن التحويل إلى نفس المخزن')
      if (req.items.length === 0) throw new Error('طلب التحويل لا يحتوي على أصناف')
      const [source, destination] = await Promise.all([
        tx.warehouse.findUnique({ where: { id: req.fromWarehouseId } }),
        tx.warehouse.findUnique({ where: { id: req.toWarehouseId } }),
      ])
      if (!source || !destination) throw new Error('المخزن المصدر أو المستلم غير موجود')

      const maxTransfer = await tx.transfer.aggregate({ _max: { id: true } })
      const ref = `TRF-${String((maxTransfer._max.id ?? 0) + 1).padStart(5, '0')}`
      const transfer = await tx.transfer.create({
        data: {
          referenceNumber: ref,
          requestId,
          fromWarehouseId: req.fromWarehouseId,
          toWarehouseId: req.toWarehouseId,
          items: { create: req.items.map(i => ({ productId: i.productId, quantity: i.quantity })) },
        },
        include: { items: true },
      })

      for (const item of transfer.items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error('كمية تحويل غير صالحة')
        await changeWarehouseStock(tx, req.fromWarehouseId, item.productId, -item.quantity)
        await changeWarehouseStock(tx, req.toWarehouseId, item.productId, item.quantity)
      }
      await tx.transferRequest.update({ where: { id: requestId }, data: { status: 'transferred' } })
      return transfer
    })
  )

  ipcHandle('transfers:createDirect', async (_, { items, ...data }) =>
    prisma.$transaction(async (tx) => {
      if (!Array.isArray(items) || items.length === 0) throw new Error('أضف أصناف التحويل')
      if (data.fromWarehouseId === data.toWarehouseId) throw new Error('لا يمكن التحويل إلى نفس المخزن')
      const maxTransfer = await tx.transfer.aggregate({ _max: { id: true } })
      const ref = `TRF-${String((maxTransfer._max.id ?? 0) + 1).padStart(5, '0')}`
      const [fromWarehouse, toWarehouse] = await Promise.all([
        tx.warehouse.findUnique({ where: { id: data.fromWarehouseId } }),
        tx.warehouse.findUnique({ where: { id: data.toWarehouseId } }),
      ])
      if (!fromWarehouse || !toWarehouse) throw new Error('المخزن المصدر أو المستلم غير موجود')
      if (!Array.isArray(items) || items.length === 0) throw new Error('أضف أصناف التحويل')
      const transfer = await tx.transfer.create({
        data: { ...data, referenceNumber: ref, items: { create: items } },
        include: { items: true },
      })
      for (const item of transfer.items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error('كمية تحويل غير صالحة')
        await changeWarehouseStock(tx, data.fromWarehouseId, item.productId, -item.quantity)
        await changeWarehouseStock(tx, data.toWarehouseId, item.productId, item.quantity)
      }
      return transfer
    })
  )

  ipcHandle('transfers:delete', async (_, id: number) =>
    prisma.$transaction(async (tx) => {
      const transfer = await tx.transfer.findUnique({ where: { id }, include: { items: true } })
      if (!transfer) throw new Error('التحويل غير موجود')
      for (const item of transfer.items) {
        await changeWarehouseStock(tx, transfer.toWarehouseId, item.productId, -item.quantity)
        await changeWarehouseStock(tx, transfer.fromWarehouseId, item.productId, item.quantity)
      }
      const deleted = await tx.transfer.delete({ where: { id } })
      if (transfer.requestId) {
        await tx.transferRequest.update({
          where: { id: transfer.requestId },
          data: { status: 'approved' },
        })
      }
      return deleted
    })
  )

  // ─── INVENTORY COUNT ───────────────────────────────────────────
  ipcHandle('inventory:getAll', () =>
    prisma.inventoryCount.findMany({
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    })
  )

  ipcHandle('inventory:create', async () => {
    const count = await prisma.inventoryCount.count()
    const ref   = `INV-${String(count + 1).padStart(5, '0')}`
    return prisma.inventoryCount.create({ data: { referenceNumber: ref } })
  })

  ipcHandle('inventory:addItems', async (_, { inventoryCountId, productIds }: { inventoryCountId: number; productIds: number[] }) => {
    await prisma.$transaction(async (tx) => {
      const count = await tx.inventoryCount.findUnique({ where: { id: inventoryCountId } })
      if (!count || count.status === 'closed') throw new Error('الجرد غير موجود أو مغلق')
      const warehouse = await getDefaultWarehouse(tx)
      const products = await tx.product.findMany({ where: { id: { in: productIds } } })
      for (const product of products) {
        const stock = await tx.warehouseStock.findUnique({
          where: { warehouseId_productId: { warehouseId: warehouse.id, productId: product.id } },
        })
        await tx.inventoryCountItem.upsert({
          where: { inventoryCountId_productId: { inventoryCountId, productId: product.id } },
          update: {},
          create: {
            inventoryCountId, productId: product.id,
            systemQuantity: stock?.quantity ?? 0,
            actualQuantity: stock?.quantity ?? 0,
          },
        })
      }
    })
  })

  ipcHandle('inventory:removeItem', (_, id: number) =>
    prisma.inventoryCountItem.delete({ where: { id } })
  )

  ipcHandle('inventory:updateItem', (_, { id, actualQuantity }: { id: number; actualQuantity: number }) =>
    prisma.inventoryCountItem.update({ where: { id }, data: { actualQuantity } })
  )

  ipcHandle('inventory:close', async (_, id: number) =>
    prisma.$transaction(async (tx) => {
      const count = await tx.inventoryCount.findUnique({
        where: { id },
        include: { items: true },
      })
      if (!count) throw new Error('الجرد غير موجود')
      if (count.status === 'closed') throw new Error('تم إغلاق هذا الجرد بالفعل')
      if (count.items.length === 0) throw new Error('لا توجد أصناف في الجرد')
      const warehouse = await getDefaultWarehouse(tx)
      for (const item of count.items) {
        const current = await tx.warehouseStock.findUnique({
          where: { warehouseId_productId: { warehouseId: warehouse.id, productId: item.productId } },
        })
        const currentQuantity = current?.quantity ?? 0
        const diff = item.actualQuantity - currentQuantity
        if (!Number.isFinite(item.actualQuantity) || item.actualQuantity < 0) throw new Error('الكمية الفعلية غير صالحة')
        if (diff !== 0) {
          await changeWarehouseStock(tx, warehouse.id, item.productId, diff)
        }
        if (diff !== 0) {
          await tx.stockMovement.create({
            data: { productId: item.productId, quantity: diff, type: 'adjust', note: `جرد #${count.referenceNumber}` },
          })
        }
      }
      return tx.inventoryCount.update({
        where: { id },
        data: { status: 'closed', closedAt: new Date() },
      })
    })
  )

  ipcHandle('inventory:delete', (_, id: number) =>
    prisma.inventoryCount.delete({ where: { id } })
  )

  // ─── REPORTS ───────────────────────────────────────────────────
  ipcHandle('reports:dashboard', async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0)

    const [productCount, allActiveProducts, todayOrders, recentOrders, customerCount, pendingPurchaseReqs, draftInvoices] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      prisma.product.findMany({ where: { isActive: true, minStockAlert: { gt: 0 } } }),
      prisma.posOrder.findMany({
        where: { status: 'completed', createdAt: { gte: today } },
        include: { items: true },
      }),
      prisma.posOrder.findMany({
        where: { status: 'completed' },
        include: { items: { include: { product: true } }, customer: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.customer.count(),
      prisma.purchaseRequest.count({ where: { status: 'pending' } }),
      prisma.purchaseInvoice.count({ where: { status: 'draft' } }),
    ])

    const lowStockItems = allActiveProducts.filter(p => p.currentStock <= p.minStockAlert)

    const totalSalesToday = todayOrders.reduce((s, o) => s + o.total, 0)
    const salesTodayCount = todayOrders.length

    // Top selling products today
    const itemCounts: Record<number, { name: string; qty: number; revenue: number }> = {}
    for (const order of todayOrders) {
      for (const item of order.items) {
        if (!itemCounts[item.productId]) itemCounts[item.productId] = { name: item.productName, qty: 0, revenue: 0 }
        itemCounts[item.productId].qty     += item.quantity
        itemCounts[item.productId].revenue += item.total
      }
    }
    const topProducts = Object.entries(itemCounts)
      .map(([id, v]) => ({ id: Number(id), ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    return {
      productCount,
      lowStockCount: lowStockItems.length,
      lowStockItems,
      recentOrders,
      totalSalesToday,
      salesTodayCount,
      customerCount,
      pendingPurchaseReqs,
      draftInvoices,
      topProducts,
    }
  })

  ipcHandle('reports:sales', async (_, { from, to, paymentMethod, categoryId, productId }: any) => {
    const where: any = { status: 'completed' }
    if (from) {
      const d = new Date(from); d.setUTCHours(0, 0, 0, 0)
      where.createdAt = { ...where.createdAt, gte: d }
    }
    if (to) {
      const d = new Date(to); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0)
      where.createdAt = { ...where.createdAt, lt: d }
    }
    if (paymentMethod) where.paymentMethod = paymentMethod
    if (productId || categoryId) {
      where.items = { some: {
        ...(productId  ? { productId: Number(productId) } : {}),
        ...(categoryId ? { product: { categoryId: Number(categoryId) } } : {}),
      }}
    }
    return prisma.posOrder.findMany({
      where,
      include: { items: { include: { product: { include: { category: true } } } }, customer: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    })
  })

  ipcHandle('reports:purchases', async (_, { from, to, supplierId }: any) => {
    const where: any = {}
    if (from) {
      const d = new Date(from); d.setUTCHours(0, 0, 0, 0)
      where.invoiceDate = { ...where.invoiceDate, gte: d }
    }
    if (to) {
      const d = new Date(to); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0)
      where.invoiceDate = { ...where.invoiceDate, lt: d }
    }
    if (supplierId) where.supplierId = Number(supplierId)
    return prisma.purchaseInvoice.findMany({
      where,
      include: { items: { include: { product: { include: { category: true } } } }, supplier: true },
      orderBy: { invoiceDate: 'desc' },
      take: 2000,
    })
  })

  ipcHandle('reports:products', async () => {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
    })
    return products.map(p => ({
      ...p,
      margin: p.sellingPrice > 0 ? ((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100 : 0,
      profit: p.sellingPrice - p.costPrice,
    }))
  })

  ipcHandle('reports:stock', async () => {
    return prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: { currentStock: 'asc' },
    })
  })

  // ─── AUTH / USERS ──────────────────────────────────────────────
  ipcHandle('auth:listUsers', () =>
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })
  )

  ipcHandle('auth:login', async (event, userId: number, pin: string) => {
    if (!Number.isInteger(userId) || typeof pin !== 'string') return null
    const now = Date.now()
    const failure = loginPinFailures.get(userId)
    if (failure && failure.lockedUntil > now) return null
    if (!/^\d{4}$/.test(pin)) return null
    const user = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true, name: true, role: true, pin: true, isActive: true, createdAt: true },
    })
    if (!user || !verifyPin(pin, user.pin)) {
      const count = (failure?.count ?? 0) + 1
      loginPinFailures.set(userId, {
        count: count >= 5 ? 0 : count,
        lockedUntil: count >= 5 ? now + 60_000 : 0,
      })
      return null
    }
    loginPinFailures.delete(userId)
    if (!user.pin.startsWith('scrypt$')) {
      await prisma.user.update({ where: { id: user.id }, data: { pin: hashPin(pin) } })
    }
    const roleData = await resolveRole(user.role)
    if (!roleData) return null
    authenticatedSessions.set(event.sender.id, user.id)
    const { pin: _storedPin, ...safeUser } = user
    return { ...safeUser, roleData }
  })

  ipcHandle('auth:logout', (event) => {
    authenticatedSessions.delete(event.sender.id)
    return true
  })

  // Never send stored PINs to the renderer.
  ipcHandle('auth:getAll', () =>
    prisma.user.findMany({
      select: { id: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
  )

  ipcHandle('auth:create', async (_, data) => {
    if (typeof data?.pin !== 'string' || !/^\d{4}$/.test(data.pin)) {
      throw new Error('رقم الدخول يجب أن يكون 4 أرقام')
    }
    return prisma.user.create({
      data: { ...data, pin: hashPin(data.pin) },
      select: { id: true, name: true, role: true, isActive: true, createdAt: true },
    })
  })

  ipcHandle('auth:update', async (_, { id, ...data }) => {
    if (data.pin !== undefined) {
      if (typeof data.pin !== 'string' || !/^\d{4}$/.test(data.pin)) {
        throw new Error('رقم الدخول يجب أن يكون 4 أرقام')
      }
      data.pin = hashPin(data.pin)
    }
    return prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, role: true, isActive: true, createdAt: true },
    })
  })

  ipcHandle('auth:delete', async (event, id: number) => {
    if (authenticatedSessions.get(event.sender.id) === id) {
      throw new Error('لا يمكنك حذف حسابك أثناء تسجيل الدخول')
    }
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) throw new Error('المستخدم غير موجود')
    const role = await resolveRole(user.role)
    if (role?.fullAccess) {
      const admins = await prisma.user.count({ where: { isActive: true, role: user.role } })
      if (admins <= 1) throw new Error('لا يمكن حذف آخر مدير نشط في النظام')
    }
    return prisma.user.delete({ where: { id } })
  })

  // ─── ROLES ─────────────────────────────────────────────────────
  ipcHandle('roles:getAll', async () => {
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } })
    return roles.map(r => ({ ...r, permissions: JSON.parse(r.permissions || '[]') }))
  })

  ipcHandle('roles:create', (_, { permissions, ...data }) =>
    prisma.role.create({ data: { ...data, permissions: JSON.stringify(permissions || []) } })
  )

  ipcHandle('roles:update', (_, { id, permissions, ...data }) =>
    prisma.role.update({ where: { id }, data: { ...data, permissions: JSON.stringify(permissions || []) } })
  )

  ipcHandle('roles:delete', async (_, id: number) => {
    const role = await prisma.role.findUnique({ where: { id } })
    if (role?.isSystem) throw new Error('لا يمكن حذف دور النظام')
    return prisma.role.delete({ where: { id } })
  })

  // ─── SETTINGS ──────────────────────────────────────────────────
  ipcHandle('settings:getAll', async () => {
    const rows = await prisma.setting.findMany()
    const map: Record<string, string> = {
      storeName: 'يو ماركت',
      currency: 'ج.م',
      taxRate: '14',
      autoBackupEnabled: 'false',
      autoBackupPath: '',
      autoBackupInterval: 'daily',
      autoBackupLastRun: '',
    }
    rows.forEach(r => { if (r.key !== 'clearDataPassword') map[r.key] = r.value })
    return map
  })

  ipcHandle('settings:set', (_, key: string, value: string) =>
    prisma.setting.upsert({
      where:  { key },
      update: { value },
      create: { key, value },
    })
  )

  // ─── ACTIVITY LOG ──────────────────────────────────────────────
  ipcHandle('activity:log', (_, { userId, action, entity, entityId, details }) =>
    prisma.activityLog.create({ data: { userId, action, entity, entityId, details } })
  )

  ipcHandle('activity:getAll', () =>
    prisma.activityLog.findMany({
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
  )

  // ─── EXPENSES ──────────────────────────────────────────────────
  ipcHandle('expenseCategories:getAll', () =>
    prisma.expenseCategory.findMany({ include: { account: true }, orderBy: { name: 'asc' } })
  )

  ipcHandle('expenseCategories:getAccounts', () =>
    prisma.account.findMany({
      where: { type: 'expense', isActive: true, code: { startsWith: '6' }, children: { none: {} } },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    })
  )

  ipcHandle('expenseCategories:create', (_, data) =>
    prisma.expenseCategory.create({ data })
  )

  ipcHandle('expenseCategories:update', (_, { id, ...data }) =>
    prisma.expenseCategory.update({ where: { id }, data })
  )

  ipcHandle('expenseCategories:delete', (_, id: number) =>
    prisma.expenseCategory.delete({ where: { id } })
  )

  ipcHandle('expenses:getAll', (_, { from, to, categoryId }: { from?: string; to?: string; categoryId?: number } = {}) => {
    const where: any = {}
    if (from) { const d = new Date(from); d.setUTCHours(0, 0, 0, 0); where.date = { ...where.date, gte: d } }
    if (to)   { const d = new Date(to);   d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0); where.date = { ...where.date, lt: d } }
    if (categoryId) where.categoryId = categoryId
    return prisma.expense.findMany({
      where,
      include: { category: true },
      orderBy: { date: 'desc' },
    })
  })

  ipcHandle('expenses:create', async (_, data) => {
    const amount = Number(data?.amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('يجب إدخال مبلغ مصروف أكبر من صفر')
    if (!Number.isInteger(data?.categoryId) || data.categoryId <= 0) throw new Error('اختر نوع المصروف')
    return prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({ data, include: { category: true } })
      await postExpenseJE(
        { id: expense.id, amount: expense.amount, description: expense.description, date: data.date || new Date(), categoryName: expense.category?.name, categoryAccountId: expense.category?.accountId },
        data.paymentMethod,
        tx,
      )
      return expense
    })
  })

  ipcHandle('expenses:update', async (_, { id, ...data }) => {
    const existing = await prisma.expense.findUnique({ where: { id } })
    if (!existing) throw new Error('المصروف غير موجود')
    const postedEntries = await prisma.journalEntry.count({
      where: { source: 'expense', sourceId: id, status: 'posted' },
    })
    if (postedEntries > 0) {
      throw new Error('لا يمكن تعديل مصروف مرحّل قبل تنفيذ عكس محاسبي موثّق. لم يتم تغيير المصروف.')
    }
    if (data.amount !== undefined && (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0)) {
      throw new Error('يجب إدخال مبلغ مصروف أكبر من صفر')
    }
    return prisma.expense.update({ where: { id }, data, include: { category: true } })
  })

  ipcHandle('expenses:delete', async (_, id: number) => {
    const existing = await prisma.expense.findUnique({ where: { id } })
    if (!existing) throw new Error('المصروف غير موجود')
    const postedEntries = await prisma.journalEntry.count({
      where: { source: 'expense', sourceId: id, status: 'posted' },
    })
    if (postedEntries > 0) {
      throw new Error('لا يمكن حذف مصروف مرحّل قبل تنفيذ عكس محاسبي موثّق. لم يتم حذف المصروف.')
    }
    return prisma.expense.delete({ where: { id } })
  })

  // ─── CHART OF ACCOUNTS ────────────────────────────────────────
  ipcHandle('accounts:getAll', () =>
    prisma.account.findMany({ orderBy: { code: 'asc' } })
  )

  ipcHandle('accounts:create', (_, data) =>
    prisma.account.create({ data })
  )

  ipcHandle('accounts:update', (_, { id, ...data }) =>
    prisma.account.update({ where: { id }, data })
  )

  ipcHandle('accounts:delete', async (_, id: number) => {
    const hasChildren = await prisma.account.count({ where: { parentId: id } })
    if (hasChildren) throw new Error('لا يمكن حذف حساب له حسابات فرعية')
    const hasLines = await prisma.journalEntryLine.count({ where: { accountId: id } })
    if (hasLines) throw new Error('لا يمكن حذف حساب له قيود يومية')
    return prisma.account.delete({ where: { id } })
  })

  ipcHandle('accounts:getNextCode', async (_, parentId?: number) => {
    const parent = parentId ? await prisma.account.findUnique({ where: { id: parentId } }) : null
    const parentCode = parent?.code ?? ''
    const siblings = await prisma.account.findMany({
      where: parentId ? { parentId } : { parentId: null },
      select: { code: true },
    })
    if (siblings.length === 0) return parentCode + '1'
    const suffixes = siblings
      .map(s => parseInt(s.code.substring(parentCode.length)))
      .filter(n => !isNaN(n) && n > 0)
    const max = suffixes.length > 0 ? Math.max(...suffixes) : 0
    return parentCode + String(max + 1)
  })

  ipcHandle('accounts:seedDefault', async (_, force = false) => {
    const existing = await prisma.account.count()
    if (existing > 0 && !force) return { skipped: true }
    if (force) {
      await prisma.journalEntryLine.deleteMany()
      await prisma.journalEntry.deleteMany()
      // Reset bank accounts linkage
      await prisma.bankAccount.updateMany({ data: { accountId: null } })
      await prisma.account.deleteMany()
    }

    const created: Record<string, number> = {}
    for (const acc of STANDARD_ACCOUNTS) {
      const parentId = acc.p ? created[acc.p] : null
      const record = await prisma.account.create({
        data: { code: acc.code, name: acc.name, type: acc.type, normalBalance: acc.nb, level: acc.level, parentId },
      })
      created[acc.code] = record.id
    }
    return { seeded: Object.keys(created).length }
  })

  // ─── JOURNAL ENTRY HELPERS ────────────────────────────────────
  type AccountingDb = PrismaClient | Prisma.TransactionClient

  async function nextJENumber(db: AccountingDb = prisma) {
    const latest = await db.journalEntry.aggregate({ _max: { id: true } })
    let sequence = (latest._max.id ?? 0) + 1
    let number = `JE-${String(sequence).padStart(5, '0')}`
    while (await db.journalEntry.findUnique({ where: { number } })) {
      sequence++
      number = `JE-${String(sequence).padStart(5, '0')}`
    }
    return number
  }

  async function findAccByCode(code: string, db: AccountingDb = prisma) {
    return db.account.findUnique({ where: { code } })
  }

  async function autoJE(opts: {
    date: Date
    description: string
    reference?: string
    source: string
    sourceId: number
    lines: { accountId: number; debit: number; credit: number; description?: string }[]
    db?: AccountingDb
  }) {
    const { date, description, reference, source, sourceId, lines } = opts
    const db = opts.db ?? prisma
    if (lines.length < 2) throw new Error('القيد الآلي يجب أن يحتوي على سطرين على الأقل')
    for (const line of lines) {
      if (!Number.isFinite(line.debit) || !Number.isFinite(line.credit) || line.debit < 0 || line.credit < 0 || (line.debit > 0 && line.credit > 0)) {
        throw new Error('قيمة مدين/دائن غير صالحة في القيد الآلي')
      }
    }
    const totalD = lines.reduce((s, l) => s + l.debit, 0)
    const totalC = lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalD - totalC) > 0.01) {
      throw new Error(`القيد الآلي غير متوازن: مدين ${totalD.toFixed(2)} ≠ دائن ${totalC.toFixed(2)}`)
    }
    // A source document may legitimately create multiple entries (e.g. sales
    // revenue and COGS); the description distinguishes each posting. Return an
    // existing matching entry on retries instead of duplicating it.
    const existing = await db.journalEntry.findFirst({
      where: { source, sourceId, description, status: 'posted' },
    })
    if (existing) return existing
    const number = await nextJENumber(db)
    return db.journalEntry.create({
      data: {
        number, date, description,
        reference: reference ?? null,
        status: 'posted',
        source,
        sourceId,
        lines: {
          create: lines.map(l => ({
            accountId:   l.accountId,
            debit:       l.debit,
            credit:      l.credit,
            description: l.description ?? null,
          })),
        },
      },
    })
  }

  // Non-destructively creates any STANDARD_ACCOUNTS entries missing by code,
  // preserving any existing (custom or already-seeded) accounts and links.
  // Called before every auto-posting attempt so a sale/purchase/expense can
  // never silently skip its journal entry for lack of a chart-of-accounts code.
  async function ensureStandardAccounts(db: AccountingDb = prisma) {
    const existing = await db.account.findMany({ select: { id: true, code: true } })
    const idByCode = new Map(existing.map(a => [a.code, a.id]))
    for (const acc of STANDARD_ACCOUNTS) {
      if (idByCode.has(acc.code)) continue
      const parentId = acc.p ? (idByCode.get(acc.p) ?? null) : null
      const record = await db.account.create({
        data: { code: acc.code, name: acc.name, type: acc.type, normalBalance: acc.nb, level: acc.level, parentId },
      })
      idByCode.set(acc.code, record.id)
    }
  }

  // ─── AUTOMATIC POSTING (shared by create + confirm-draft + backfill) ──
  async function postPurchaseInvoiceJE(invoice: { id: number; invoiceDate: Date; subtotal: number; taxAmount: number; total: number; invoiceNumber: string | null }, db: AccountingDb = prisma) {
    await ensureStandardAccounts(db)
    const [invAcc, payAcc, vatAcc] = await Promise.all([
      findAccByCode('1131', db), findAccByCode('2111', db), findAccByCode('2121', db),
    ])
    if (!invAcc || !payAcc) throw new Error('تعذر إيجاد حسابات المخزون/الموردين في دليل الحسابات')
    const jeLines: { accountId: number; debit: number; credit: number; description?: string }[] = []
    if (invoice.taxAmount > 0 && vatAcc) {
      jeLines.push({ accountId: invAcc.id, debit: invoice.subtotal, credit: 0, description: 'مخزون بضاعة' })
      jeLines.push({ accountId: vatAcc.id, debit: invoice.taxAmount, credit: 0, description: 'ض.ق.م مدخلات' })
    } else {
      jeLines.push({ accountId: invAcc.id, debit: invoice.total, credit: 0, description: 'مخزون بضاعة' })
    }
    jeLines.push({ accountId: payAcc.id, debit: 0, credit: invoice.total, description: invoice.invoiceNumber ?? undefined })
    return autoJE({
      date: new Date(invoice.invoiceDate),
      description: `مشتريات - ${invoice.invoiceNumber ?? `INV-${invoice.id}`}`,
      reference: invoice.invoiceNumber ?? undefined,
      source: 'purchase',
      sourceId: invoice.id,
      lines: jeLines,
      db,
    })
  }

  async function postSaleJE(order: { id: number; orderNumber: string; createdAt: Date; customerId?: number | null; total: number; subtotal: number; discountAmount: number; taxAmount: number; paymentMethod: string; items: { productId: number; quantity: number; unitCost: number }[] }, db: AccountingDb = prisma) {
    await ensureStandardAccounts(db)
    const [cashAcc, bankAcc, receivableAcc, salesAcc, vatAcc, cogsAcc, invAcc] = await Promise.all([
      findAccByCode('1111', db), findAccByCode('1112', db), findAccByCode('1121', db),
      findAccByCode('4111', db), findAccByCode('2121', db),
      findAccByCode('521', db),  findAccByCode('1131', db),
    ])
    const drAcc = order.paymentMethod === 'credit'
      ? receivableAcc
      : order.paymentMethod === 'cash' ? cashAcc : bankAcc
    if (!drAcc || !salesAcc) throw new Error('تعذر إيجاد حساب النقدية/البنوك/العملاء أو المبيعات في دليل الحسابات')
    if (order.paymentMethod === 'credit' && !order.customerId) {
      throw new Error('يجب تحديد العميل عند تسجيل البيع الآجل')
    }
    const discountAmount = Number(order.discountAmount ?? 0)
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > order.subtotal) {
      throw new Error('قيمة خصم فاتورة البيع غير صالحة')
    }
    const netSales = order.subtotal - discountAmount

    const salesLines: { accountId: number; debit: number; credit: number; description?: string }[] = [
      { accountId: drAcc.id,    debit: order.total,    credit: 0,              description: order.orderNumber },
      { accountId: salesAcc.id, debit: 0,              credit: netSales, description: order.orderNumber },
    ]
    if (order.taxAmount > 0 && vatAcc) {
      salesLines.push({ accountId: vatAcc.id, debit: 0, credit: order.taxAmount, description: 'ض.ق.م مبيعات' })
    } else if (order.taxAmount > 0) {
      salesLines[1].credit = order.total
    }
    await autoJE({
      date: new Date(order.createdAt),
      description: `مبيعات - ${order.orderNumber}`,
      reference: order.orderNumber,
      source: 'sale',
      sourceId: order.id,
      lines: salesLines,
      db,
    })

    if (!cogsAcc || !invAcc) throw new Error('تعذر إيجاد حسابات تكلفة/مخزون البضاعة في دليل الحسابات')
    // Use the immutable sale-time cost snapshot, never today's product cost.
    // Legacy orders have unitCost=0 and require an explicit historical-cost adjustment.
    const cogs = order.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0)
    if (cogs > 0) {
      await autoJE({
        date: new Date(order.createdAt),
        description: `تكلفة مبيعات - ${order.orderNumber}`,
        reference: order.orderNumber,
        source: 'sale',
        sourceId: order.id,
        lines: [
          { accountId: cogsAcc.id, debit: cogs, credit: 0,    description: 'تكلفة بضاعة مباعة' },
          { accountId: invAcc.id,  debit: 0,    credit: cogs, description: 'خروج مخزون' },
        ],
        db,
      })
    }
  }

  async function postExpenseJE(expense: { id: number; amount: number; description: string | null; date: Date; categoryName?: string | null; categoryAccountId?: number | null }, paymentMethod?: string | null, db: AccountingDb = prisma) {
    await ensureStandardAccounts(db)
    const [defaultExpenseAcc, cashAcc, bankAcc] = await Promise.all([
      findAccByCode('61', db), findAccByCode('1111', db), findAccByCode('1112', db),
    ])
    const mappedExpenseAcc = expense.categoryAccountId
      ? await db.account.findUnique({ where: { id: expense.categoryAccountId }, select: { id: true, code: true, type: true, isActive: true } })
      : null
    if (expense.categoryAccountId && (!mappedExpenseAcc || mappedExpenseAcc.type !== 'expense' || !mappedExpenseAcc.isActive || !mappedExpenseAcc.code.startsWith('6'))) {
      throw new Error('الحساب المرتبط بنوع المصروف غير نشط أو ليس حساب مصروفات')
    }
    const expAcc = mappedExpenseAcc ?? defaultExpenseAcc
    const crAcc = (!paymentMethod || paymentMethod === 'cash') ? cashAcc : bankAcc
    if (!expAcc || !crAcc) throw new Error('تعذر إيجاد حساب المصروف أو النقدية/البنك في دليل الحسابات')
    const desc = [expense.categoryName, expense.description].filter(Boolean).join(' - ')
    return autoJE({
      date: new Date(expense.date),
      description: `مصروف - ${desc || expense.id}`,
      source: 'expense',
      sourceId: expense.id,
      lines: [
        { accountId: expAcc.id, debit: expense.amount, credit: 0,              description: desc || undefined },
        { accountId: crAcc.id,  debit: 0,              credit: expense.amount, description: 'صرف نقدي' },
      ],
      db,
    })
  }

  // ─── JOURNAL ENTRIES ──────────────────────────────────────────
  ipcHandle('journalEntries:getAll', (_, { from, to, status }: any = {}) => {
    const where: any = {}
    if (status) where.status = status
    if (from) { const d = new Date(from); d.setUTCHours(0, 0, 0, 0); where.date = { ...where.date, gte: d } }
    if (to)   { const d = new Date(to); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0); where.date = { ...where.date, lt: d } }
    return prisma.journalEntry.findMany({
      where,
      include: { lines: { include: { account: true } } },
      orderBy: [{ date: 'desc' }, { number: 'desc' }],
      take: 500,
    })
  })

  ipcHandle('journalEntries:create', async (_, { date, description, reference, lines, post = false }) => {
    const totalDebit  = lines.reduce((s: number, l: any) => s + (l.debit ?? 0), 0)
    const totalCredit = lines.reduce((s: number, l: any) => s + (l.credit ?? 0), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01)
      throw new Error(`القيد غير متوازن: مدين ${totalDebit.toFixed(2)} ≠ دائن ${totalCredit.toFixed(2)}`)
    if (lines.length < 2) throw new Error('يجب أن يحتوي القيد على سطرين على الأقل')
    const number = await nextJENumber()
    return prisma.journalEntry.create({
      data: {
        number, date: new Date(date), description, reference,
        status: post ? 'posted' : 'draft',
        lines: { create: lines.map((l: any) => ({
          accountId: l.accountId,
          debit: l.debit ?? 0,
          credit: l.credit ?? 0,
          description: l.description ?? null,
        })) },
      },
      include: { lines: { include: { account: true } } },
    })
  })

  ipcHandle('journalEntries:post', async (_, id: number) => {
    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!entry) throw new Error('القيد غير موجود')
    if (entry.status === 'posted') throw new Error('القيد مرحل مسبقاً')
    if (entry.lines.length < 2) throw new Error('لا يمكن ترحيل قيد بدون طرفين على الأقل')
    const debit = entry.lines.reduce((sum, line) => sum + line.debit, 0)
    const credit = entry.lines.reduce((sum, line) => sum + line.credit, 0)
    if (Math.abs(debit - credit) > 0.005) throw new Error('القيد غير متوازن: إجمالي المدين لا يساوي إجمالي الدائن')
    const updated = await prisma.journalEntry.updateMany({
      where: { id, status: 'draft' },
      data: { status: 'posted' },
    })
    if (updated.count !== 1) throw new Error('تعذر ترحيل القيد؛ ربما تم ترحيله بالفعل')
    return prisma.journalEntry.findUnique({ where: { id }, include: { lines: { include: { account: true } } } })
  })

  ipcHandle('journalEntries:delete', async (_, id: number) => {
    const entry = await prisma.journalEntry.findUnique({ where: { id } })
    if (!entry) throw new Error('القيد غير موجود')
    if (entry.status === 'posted') throw new Error('لا يمكن حذف قيد مرحل — استخدم عكس القيد')
    return prisma.journalEntry.delete({ where: { id } })
  })

  ipcHandle('journalEntries:reverse', async (_, id: number) => {
    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: true },
    })
    if (!entry) throw new Error('القيد غير موجود')
    if (entry.status !== 'posted') throw new Error('يمكن عكس القيود المرحلة فقط')
    const number = await nextJENumber()
    return prisma.journalEntry.create({
      data: {
        number, date: new Date(), status: 'posted',
        description: `عكس: ${entry.description ?? entry.number}`,
        reference: entry.number,
        source: 'manual',
        lines: {
          create: entry.lines.map(l => ({
            accountId: l.accountId,
            debit: l.credit,
            credit: l.debit,
            description: l.description,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    })
  })

  ipcHandle('journalEntries:trialBalance', async (_, { from, to }: any = {}) => {
    const netOf = (acc: any, debit: number, credit: number) =>
      acc.normalBalance === 'debit' ? debit - credit : credit - debit

    // Opening balance = everything posted strictly before `from` (0 if no `from` given)
    const openingMap = new Map<number, { debit: number; credit: number }>()
    if (from) {
      const fromDate = new Date(from); fromDate.setUTCHours(0, 0, 0, 0)
      const openingLines = await prisma.journalEntryLine.findMany({
        where: { entry: { status: 'posted', date: { lt: fromDate } } },
      })
      for (const l of openingLines) {
        const row = openingMap.get(l.accountId) ?? { debit: 0, credit: 0 }
        row.debit += l.debit; row.credit += l.credit
        openingMap.set(l.accountId, row)
      }
    }

    // Period movement = from (inclusive) to `to` (inclusive day)
    const where: any = { status: 'posted' }
    if (from) { const d = new Date(from); d.setUTCHours(0, 0, 0, 0); where.date = { ...where.date, gte: d } }
    if (to)   { const d = new Date(to); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0); where.date = { ...where.date, lt: d } }

    const lines = await prisma.journalEntryLine.findMany({
      where: { entry: where },
      include: { account: true },
    })

    const map = new Map<number, { account: any; debit: number; credit: number }>()
    for (const l of lines) {
      if (!map.has(l.accountId))
        map.set(l.accountId, { account: l.account, debit: 0, credit: 0 })
      const row = map.get(l.accountId)!
      row.debit  += l.debit
      row.credit += l.credit
    }
    // Include accounts with an opening balance but no movement this period
    for (const accountId of openingMap.keys()) {
      if (!map.has(accountId)) {
        const acc = await prisma.account.findUnique({ where: { id: accountId } })
        if (acc) map.set(accountId, { account: acc, debit: 0, credit: 0 })
      }
    }

    const rows = Array.from(map.entries()).map(([accountId, r]) => {
      const opening = openingMap.get(accountId) ?? { debit: 0, credit: 0 }
      const openingBalance = netOf(r.account, opening.debit, opening.credit)
      const closingBalance = openingBalance + netOf(r.account, r.debit, r.credit)
      return {
        accountId, code: r.account.code, accountName: r.account.name,
        openingBalance, totalDebit: r.debit, totalCredit: r.credit,
        closingBalance, balance: closingBalance,
      }
    }).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

    const totals = {
      openingDebit: rows.reduce((s, r) => s + Math.max(0, r.openingBalance), 0),
      totalDebit:   rows.reduce((s, r) => s + r.totalDebit, 0),
      totalCredit:  rows.reduce((s, r) => s + r.totalCredit, 0),
      closingDebit: rows.reduce((s, r) => s + Math.max(0, r.closingBalance), 0),
    }

    return { rows, totals }
  })

  ipcHandle('journalEntries:ledger', async (_, { accountId, from, to }: any) => {
    const where: any = { accountId, entry: { status: 'posted' } }
    if (from) where.entry = { ...where.entry, date: { ...((where.entry as any).date ?? {}), gte: new Date(from) } }
    if (to)   { const d = new Date(to); d.setUTCDate(d.getUTCDate() + 1); where.entry = { ...where.entry, date: { ...((where.entry as any).date ?? {}), lt: d } } }
    return prisma.journalEntryLine.findMany({
      where,
      include: { entry: true, account: true },
      orderBy: [{ entry: { date: 'asc' } }, { id: 'asc' }],
    })
  })

  // Posts journal entries for any confirmed sale/purchase/expense that is
  // missing one — covers records created before the chart of accounts was
  // seeded, or any case where auto-posting failed at the time. Safe to run
  // repeatedly: only ever touches sources with zero existing journal entries.
  ipcHandle('journalEntries:backfillMissing', async () => {
    await ensureStandardAccounts()
    const result = { purchases: 0, sales: 0, expenses: 0, errors: [] as string[] }

    const invoices = await prisma.purchaseInvoice.findMany({ where: { status: 'confirmed' } })
    for (const inv of invoices) {
      const has = await prisma.journalEntry.count({ where: { source: 'purchase', sourceId: inv.id } })
      if (has > 0) continue
      try { await postPurchaseInvoiceJE(inv); result.purchases++ }
      catch (e: any) { result.errors.push(`فاتورة ${inv.invoiceNumber ?? inv.id}: ${e.message}`) }
    }

    const orders = await prisma.posOrder.findMany({ where: { status: 'completed' }, include: { items: true } })
    for (const order of orders) {
      const has = await prisma.journalEntry.count({ where: { source: 'sale', sourceId: order.id } })
      if (has > 0) continue
      try { await postSaleJE(order); result.sales++ }
      catch (e: any) { result.errors.push(`طلب ${order.orderNumber}: ${e.message}`) }
    }

    const expenses = await prisma.expense.findMany({ include: { category: true } })
    for (const exp of expenses) {
      const has = await prisma.journalEntry.count({ where: { source: 'expense', sourceId: exp.id } })
      if (has > 0) continue
      try {
        await postExpenseJE(
          { id: exp.id, amount: exp.amount, description: exp.description, date: exp.date, categoryName: exp.category?.name },
          exp.paymentMethod,
        )
        result.expenses++
      } catch (e: any) { result.errors.push(`مصروف ${exp.id}: ${e.message}`) }
    }

    return result
  })

  // ─── BANK ACCOUNTS ────────────────────────────────────────────
  ipcHandle('bankAccounts:getAll', async () => {
    const accounts = await prisma.bankAccount.findMany({
      include: { account: true },
      orderBy: { name: 'asc' },
    })
    return Promise.all(accounts.map(async acc => {
      const [lastLine, unmatchedLines, matchedLines, allTxIds] = await Promise.all([
        prisma.bankStatementLine.findFirst({
          where: { bankAccountId: acc.id, status: { not: 'ignored' } },
          orderBy: { date: 'desc' },
        }),
        prisma.bankStatementLine.count({ where: { bankAccountId: acc.id, status: 'unmatched' } }),
        prisma.bankStatementLine.findMany({
          where: { bankAccountId: acc.id, matchedTransactionId: { not: null } },
          select: { matchedTransactionId: true },
        }),
        prisma.bankTransaction.findMany({ where: { bankAccountId: acc.id }, select: { id: true } }),
      ])
      const matchedIds = new Set(matchedLines.map(l => l.matchedTransactionId))
      const unmatchedTx = allTxIds.filter(t => !matchedIds.has(t.id)).length
      return {
        ...acc,
        statementBalance: lastLine?.balance ?? null,
        unmatchedStatementLines: unmatchedLines,
        unmatchedTransactions: unmatchedTx,
      }
    }))
  })

  ipcHandle('bankAccounts:create', (_, data) =>
    prisma.bankAccount.create({ data, include: { account: true } })
  )

  ipcHandle('bankAccounts:update', (_, { id, ...data }) =>
    prisma.bankAccount.update({ where: { id }, data, include: { account: true } })
  )

  ipcHandle('bankAccounts:delete', async (_, id: number) => {
    const txCount = await prisma.bankTransaction.count({ where: { bankAccountId: id } })
    if (txCount > 0) throw new Error('لا يمكن حذف حساب له معاملات')
    return prisma.bankAccount.delete({ where: { id } })
  })

  // ─── BANK TRANSACTIONS ────────────────────────────────────────
  ipcHandle('bankTransactions:getAll', (_, { bankAccountId, from, to }: any = {}) => {
    const where: any = {}
    if (bankAccountId) where.bankAccountId = bankAccountId
    if (from) { const d = new Date(from); d.setUTCHours(0, 0, 0, 0); where.date = { ...where.date, gte: d } }
    if (to)   { const d = new Date(to);   d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0); where.date = { ...where.date, lt: d } }
    return prisma.bankTransaction.findMany({
      where,
      include: { bankAccount: { include: { account: true } } },
      orderBy: { date: 'desc' },
      take: 1000,
    })
  })

  async function createBankTransactionRecord(opts: {
    bankAccountId: number; type: string; amount: number
    description?: string | null; referenceNumber?: string | null
    date?: Date; contraAccountId?: number | null
  }) {
    const { bankAccountId, type, amount, description, referenceNumber, contraAccountId } = opts
    const date = opts.date ?? new Date()
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('قيمة المعاملة يجب أن تكون أكبر من صفر')
    if (!['deposit', 'withdrawal', 'transfer'].includes(type)) throw new Error('نوع المعاملة غير صالح')

    return prisma.$transaction(async (tx) => {
      const bankAcc = await tx.bankAccount.findUnique({ where: { id: bankAccountId } })
      if (!bankAcc) throw new Error('الحساب غير موجود')
      const delta = type === 'deposit' ? amount : -amount
      const newBalance = bankAcc.currentBalance + delta
      await tx.bankAccount.update({ where: { id: bankAccountId }, data: { currentBalance: newBalance } })

      let journalEntryId: number | null = null
      if (bankAcc.accountId && contraAccountId) {
        const jeNumber = await nextJENumber()
        const isDeposit = type === 'deposit'
        const je = await tx.journalEntry.create({
          data: {
            number: jeNumber,
            date,
            description: description || `${isDeposit ? 'إيداع' : 'سحب'} - ${bankAcc.name}`,
            status: 'posted',
            source: 'bank',
            sourceId: bankAccountId,
            lines: {
              create: [
                { accountId: isDeposit ? bankAcc.accountId : contraAccountId, debit: amount, credit: 0, description },
                { accountId: isDeposit ? contraAccountId : bankAcc.accountId, debit: 0, credit: amount, description },
              ],
            },
          },
        })
        journalEntryId = je.id
      }

      return tx.bankTransaction.create({
        data: {
          bankAccountId, type, amount, balanceAfter: newBalance,
          description: description ?? null, referenceNumber: referenceNumber ?? null,
          contraAccountId: contraAccountId ?? null,
          journalEntryId,
          date,
        },
        include: { bankAccount: { include: { account: true } } },
      })
    })
  }

  ipcHandle('bankTransactions:create', (_, { bankAccountId, type, amount, description, referenceNumber, date, contraAccountId }: any) =>
    createBankTransactionRecord({
      bankAccountId, type, amount, description, referenceNumber, contraAccountId,
      date: date ? new Date(date) : undefined,
    })
  )

  ipcHandle('bankTransactions:delete', async (_, id: number) =>
    prisma.$transaction(async (tx) => {
      const transaction = await tx.bankTransaction.findUnique({ where: { id } })
      if (!transaction) throw new Error('المعاملة غير موجودة')
      const delta = transaction.type === 'deposit' ? -transaction.amount : transaction.amount
      await tx.bankAccount.update({
        where: { id: transaction.bankAccountId },
        data: { currentBalance: { increment: delta } },
      })
      if (transaction.journalEntryId) {
        await tx.journalEntry.delete({ where: { id: transaction.journalEntryId } })
      }
      await tx.bankStatementLine.updateMany({
        where: { matchedTransactionId: id },
        data: { matchedTransactionId: null, status: 'unmatched' },
      })
      return tx.bankTransaction.delete({ where: { id } })
    })
  )

  // ─── BANK STATEMENT IMPORT & RECONCILIATION ───────────────────
  function detectColumn(headers: string[], candidates: string[]): number {
    const norm = (s: string) => s.trim().toLowerCase()
    const normHeaders = headers.map(norm)
    for (const c of candidates) {
      const idx = normHeaders.findIndex(h => h.includes(norm(c)))
      if (idx !== -1) return idx
    }
    return -1
  }

  ipcHandle('bankStatements:parseFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv'] }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const XLSX = await import('xlsx')
    const wb = XLSX.readFile(result.filePaths[0])
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false })
    if (rows.length < 2) return { rows: [], fileName: path.basename(result.filePaths[0]) }

    const headers = (rows[0] as any[]).map(h => String(h ?? ''))
    const dateIdx    = detectColumn(headers, ['التاريخ', 'date'])
    const descIdx    = detectColumn(headers, ['البيان', 'الوصف', 'description', 'details'])
    const refIdx     = detectColumn(headers, ['المرجع', 'reference', 'ref'])
    const balanceIdx = detectColumn(headers, ['الرصيد', 'balance'])
    const amountIdx  = detectColumn(headers, ['المبلغ', 'amount'])
    const debitIdx    = detectColumn(headers, ['مدين', 'سحب', 'debit', 'withdrawal'])
    const creditIdx   = detectColumn(headers, ['دائن', 'إيداع', 'credit', 'deposit'])

    const parsed = rows.slice(1)
      .filter(r => r.some(c => c !== undefined && c !== null && String(c).trim() !== ''))
      .map(r => {
        let amount = 0
        if (amountIdx !== -1) amount = Number(r[amountIdx]) || 0
        else amount = (Number(r[creditIdx]) || 0) - (Number(r[debitIdx]) || 0)
        return {
          date: dateIdx !== -1 ? String(r[dateIdx] ?? '') : '',
          description: descIdx !== -1 ? String(r[descIdx] ?? '') : '',
          reference: refIdx !== -1 ? String(r[refIdx] ?? '') : '',
          amount,
          balance: balanceIdx !== -1 && r[balanceIdx] !== undefined ? Number(r[balanceIdx]) || 0 : null,
        }
      })

    return { rows: parsed, fileName: path.basename(result.filePaths[0]) }
  })

  ipcHandle('bankStatements:import', async (_, { bankAccountId, rows }: any) => {
    const batch = `IMP-${Date.now()}`
    let imported = 0, skipped = 0
    for (const r of rows) {
      const date = r.date ? new Date(r.date) : null
      if (!date || isNaN(date.getTime()) || !r.amount) { skipped++; continue }
      const dup = await prisma.bankStatementLine.findFirst({
        where: { bankAccountId, date, amount: r.amount, reference: r.reference || null },
      })
      if (dup) { skipped++; continue }
      await prisma.bankStatementLine.create({
        data: {
          bankAccountId, date,
          description: r.description || null,
          reference: r.reference || null,
          amount: r.amount,
          balance: r.balance ?? null,
          importBatch: batch,
        },
      })
      imported++
    }
    return { imported, skipped }
  })

  ipcHandle('bankStatements:getAll', (_, { bankAccountId }: any = {}) =>
    prisma.bankStatementLine.findMany({
      where: bankAccountId ? { bankAccountId } : {},
      orderBy: { date: 'desc' },
      take: 1000,
    })
  )

  ipcHandle('bankStatements:ignore', (_, id: number) =>
    prisma.bankStatementLine.update({ where: { id }, data: { status: 'ignored' } })
  )

  ipcHandle('bankStatements:unmatch', async (_, id: number) => {
    const line = await prisma.bankStatementLine.findUnique({ where: { id } })
    if (!line) throw new Error('السطر غير موجود')
    return prisma.bankStatementLine.update({ where: { id }, data: { status: 'unmatched', matchedTransactionId: null } })
  })

  ipcHandle('bankStatements:delete', (_, id: number) =>
    prisma.bankStatementLine.delete({ where: { id } })
  )

  ipcHandle('bankStatements:match', async (_, { lineId, transactionId }: any) => {
    const line = await prisma.bankStatementLine.findUnique({ where: { id: lineId } })
    if (!line) throw new Error('السطر غير موجود')
    const tx = await prisma.bankTransaction.findUnique({ where: { id: transactionId } })
    if (!tx) throw new Error('الحركة غير موجودة')
    return prisma.bankStatementLine.update({
      where: { id: lineId },
      data: { status: 'matched', matchedTransactionId: transactionId },
    })
  })

  ipcHandle('bankStatements:createFromLine', async (_, { lineId, contraAccountId, description }: any) => {
    const line = await prisma.bankStatementLine.findUnique({ where: { id: lineId } })
    if (!line) throw new Error('السطر غير موجود')
    const tx = await createBankTransactionRecord({
      bankAccountId: line.bankAccountId,
      type: line.amount >= 0 ? 'deposit' : 'withdrawal',
      amount: Math.abs(line.amount),
      description: description || line.description,
      referenceNumber: line.reference,
      date: line.date,
      contraAccountId,
    })
    await prisma.bankStatementLine.update({
      where: { id: lineId },
      data: { status: 'matched', matchedTransactionId: tx.id },
    })
    return tx
  })

  ipcHandle('bankStatements:applyRules', async (_, { bankAccountId }: any) => {
    const rules = await prisma.bankRule.findMany({
      where: { isActive: true, OR: [{ bankAccountId }, { bankAccountId: null }] },
      orderBy: { id: 'asc' },
    })
    const lines = await prisma.bankStatementLine.findMany({
      where: { bankAccountId, status: 'unmatched' },
    })
    let matched = 0
    for (const line of lines) {
      const desc = (line.description ?? '').toLowerCase()
      const rule = rules.find(r => {
        const val = r.matchValue.toLowerCase()
        if (r.matchType === 'startsWith') return desc.startsWith(val)
        if (r.matchType === 'equals') return desc === val
        return desc.includes(val)
      })
      if (!rule || !rule.contraAccountId) continue
      const tx = await createBankTransactionRecord({
        bankAccountId: line.bankAccountId,
        type: line.amount >= 0 ? 'deposit' : 'withdrawal',
        amount: Math.abs(line.amount),
        description: line.description,
        referenceNumber: line.reference,
        date: line.date,
        contraAccountId: rule.contraAccountId,
      })
      await prisma.bankStatementLine.update({
        where: { id: line.id },
        data: { status: 'matched', matchedTransactionId: tx.id },
      })
      matched++
    }
    return { matched }
  })

  // ─── BANK RULES ─────────────────────────────────────────────
  ipcHandle('bankRules:getAll', () =>
    prisma.bankRule.findMany({ orderBy: { id: 'desc' } })
  )

  ipcHandle('bankRules:create', (_, data) =>
    prisma.bankRule.create({ data })
  )

  ipcHandle('bankRules:update', (_, { id, ...data }) =>
    prisma.bankRule.update({ where: { id }, data })
  )

  ipcHandle('bankRules:delete', (_, id: number) =>
    prisma.bankRule.delete({ where: { id } })
  )

  // ─── FINANCIAL REPORTS ────────────────────────────────────────
  ipcHandle('reports:financial', async (_, { from, to }: { from?: string; to?: string } = {}) => {
    const dateFilter: any = {}
    if (from) { const d = new Date(from); d.setUTCHours(0, 0, 0, 0); dateFilter.gte = d }
    if (to)   { const d = new Date(to); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0); dateFilter.lt = d }
    if (from && to && new Date(from) >= new Date(to + 'T23:59:59.999Z')) throw new Error('تاريخ بداية التقرير يجب أن يسبق تاريخ النهاية')

    const salesWhere: any = { status: 'completed', ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}) }
    const purWhere: any = Object.keys(dateFilter).length ? { invoiceDate: dateFilter } : {}
    const expWhere: any = Object.keys(dateFilter).length ? { date: dateFilter } : {}
    const [orders, invoices, expenses, bankAccounts, salesReturns, purchaseReturns] = await Promise.all([
      prisma.posOrder.findMany({ where: salesWhere }),
      prisma.purchaseInvoice.findMany({ where: { ...purWhere, status: 'confirmed' } }),
      prisma.expense.findMany({ where: expWhere, include: { category: true } }),
      prisma.bankAccount.findMany({ where: { isActive: true } }),
      prisma.saleReturn.findMany({ where: Object.keys(dateFilter).length ? { returnDate: dateFilter } : {}, include: { order: true } }),
      prisma.purchaseReturn.findMany({ where: Object.keys(dateFilter).length ? { returnDate: dateFilter } : {}, include: { invoice: true } }),
    ])

    const saleReturnTax = salesReturns.reduce((sum, ret) =>
      sum + (ret.order.subtotal > 0 ? ret.order.taxAmount * ret.total / ret.order.subtotal : 0), 0)
    const purchaseReturnTax = purchaseReturns.reduce((sum, ret) =>
      sum + (ret.invoice.subtotal > 0 ? ret.invoice.taxAmount * ret.total / ret.invoice.subtotal : 0), 0)
    const totalVatOut = orders.reduce((sum, order) => sum + order.taxAmount, 0) - saleReturnTax
    const totalPurchases = invoices.reduce((sum, invoice) => sum + invoice.subtotal, 0) -
      purchaseReturns.reduce((sum, ret) => sum + ret.total, 0)
    const totalVatIn = invoices.reduce((sum, invoice) => sum + invoice.taxAmount, 0) - purchaseReturnTax

    // Period trial balance is built only from posted ledger entries.
    const periodWhere: any = { status: 'posted' }
    if (Object.keys(dateFilter).length) periodWhere.date = dateFilter
    const glLines = await prisma.journalEntryLine.findMany({
      where: { entry: periodWhere },
      include: { account: true },
    })
    const tbMap = new Map<number, { account: any; debit: number; credit: number }>()
    for (const line of glLines) {
      if (!tbMap.has(line.accountId)) tbMap.set(line.accountId, { account: line.account, debit: 0, credit: 0 })
      const row = tbMap.get(line.accountId)!
      row.debit += line.debit
      row.credit += line.credit
    }
    const openingTbMap = new Map<number, { account: any; debit: number; credit: number }>()
    if (from) {
      const openingDate = new Date(from)
      openingDate.setUTCHours(0, 0, 0, 0)
      const openingLines = await prisma.journalEntryLine.findMany({
        where: { entry: { status: 'posted', date: { lt: openingDate } } },
        include: { account: true },
      })
      for (const line of openingLines) {
        const row = openingTbMap.get(line.accountId) ?? { account: line.account, debit: 0, credit: 0 }
        row.debit += line.debit
        row.credit += line.credit
        openingTbMap.set(line.accountId, row)
      }
    }
    const allTbIds = new Set([...tbMap.keys(), ...openingTbMap.keys()])
    const trialBalance = [...allTbIds].map(accountId => {
      const period = tbMap.get(accountId)
      const opening = openingTbMap.get(accountId)
      const account = period?.account ?? opening!.account
      const debit = period?.debit ?? 0
      const credit = period?.credit ?? 0
      const openingBalance = account.normalBalance === 'debit'
        ? (opening?.debit ?? 0) - (opening?.credit ?? 0)
        : (opening?.credit ?? 0) - (opening?.debit ?? 0)
      const movement = account.normalBalance === 'debit' ? debit - credit : credit - debit
      return {
        code: account.code,
        name: account.name,
        type: account.type,
        openingBalance,
        debit,
        credit,
        closingBalance: openingBalance + movement,
      }
    }).sort((x, y) => x.code.localeCompare(y.code, undefined, { numeric: true }))

    let totalRevenue = 0
    let cogs = 0
    let totalExpenses = 0
    const expByCategory: Record<string, number> = {}
    for (const row of tbMap.values()) {
      const account = row.account
      const netDebit = row.debit - row.credit
      const netCredit = row.credit - row.debit
      if (account.type === 'revenue') totalRevenue += netCredit
      if (account.type === 'expense' && (String(account.code).startsWith('52') || String(account.code) === '512')) cogs += netDebit
      if (account.type === 'expense' && String(account.code).startsWith('6')) {
        totalExpenses += netDebit
        const category = account.name || 'مصروفات تشغيلية'
        expByCategory[category] = (expByCategory[category] ?? 0) + netDebit
      }
    }
    const grossProfit = totalRevenue - cogs
    const netProfit = grossProfit - totalExpenses
    const vatNetPayable = totalVatOut - totalVatIn

    // Balance sheet is an as-of-date statement, not the movement within the selected income-statement period.
    const balanceDate = to ? new Date(to) : new Date()
    balanceDate.setUTCDate(balanceDate.getUTCDate() + 1)
    balanceDate.setUTCHours(0, 0, 0, 0)
    const [allAccounts, balanceLines] = await Promise.all([
      prisma.account.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
      prisma.journalEntryLine.findMany({
        where: { entry: { status: 'posted', date: { lt: balanceDate } } },
        select: { accountId: true, debit: true, credit: true },
      }),
    ])
    const balanceMap = new Map<number, { debit: number; credit: number }>()
    for (const line of balanceLines) {
      const row = balanceMap.get(line.accountId) ?? { debit: 0, credit: 0 }
      row.debit += line.debit
      row.credit += line.credit
      balanceMap.set(line.accountId, row)
    }
    const balanceRows = allAccounts.map(account => {
      const row = balanceMap.get(account.id) ?? { debit: 0, credit: 0 }
      const balance = account.type === 'asset' || account.type === 'expense'
        ? row.debit - row.credit
        : row.credit - row.debit
      return { id: account.id, code: account.code, name: account.name, type: account.type, balance }
    }).filter(row => Math.abs(row.balance) > 0.005)

    const assets = balanceRows.filter(row => row.type === 'asset')
    const liabilities = balanceRows.filter(row => row.type === 'liability')
    const equity = balanceRows.filter(row => row.type === 'equity')
    const balanceRevenue = balanceRows.filter(row => row.type === 'revenue').reduce((sum, row) => sum + row.balance, 0)
    const balanceExpenses = balanceRows.filter(row => row.type === 'expense').reduce((sum, row) => sum + row.balance, 0)
    const currentEarnings = balanceRevenue - balanceExpenses
    const assetsTotal = assets.reduce((sum, row) => sum + row.balance, 0)
    const liabilitiesTotal = liabilities.reduce((sum, row) => sum + row.balance, 0)
    const equityTotal = equity.reduce((sum, row) => sum + row.balance, 0) + currentEarnings
    const liabilitiesAndEquity = liabilitiesTotal + equityTotal
    const inventoryValue = assets.filter(row => row.code.startsWith('113')).reduce((sum, row) => sum + row.balance, 0)
    const totalCash = balanceRows.find(row => row.code === '1111')?.balance ?? 0
    const totalBank = balanceRows.find(row => row.code === '1112')?.balance ?? 0
    const receivables = assets.filter(row => row.code.startsWith('112')).reduce((sum, row) => sum + row.balance, 0)
    const payables = liabilities.filter(row => row.code.startsWith('211')).reduce((sum, row) => sum + row.balance, 0)

    return {
      period: { from, to },
      revenue: { total: totalRevenue, vat: totalVatOut },
      purchases: { total: totalPurchases, vat: totalVatIn },
      cogs,
      grossProfit,
      expenses: { total: totalExpenses, byCategory: expByCategory },
      netProfit,
      vat: { collected: totalVatOut, paid: totalVatIn, net: vatNetPayable },
      inventory: { value: inventoryValue },
      banks: { cash: totalCash, bank: totalBank, accounts: bankAccounts },
      trialBalance,
      balanceSheet: {
        asOf: to ?? new Date().toISOString().slice(0, 10),
        assets, liabilities, equity,
        currentEarnings,
        assetsTotal, liabilitiesTotal, equityTotal, liabilitiesAndEquity,
        difference: assetsTotal - liabilitiesAndEquity,
        isBalanced: Math.abs(assetsTotal - liabilitiesAndEquity) <= 0.05,
        receivables, payables,
      },
      ordersCount: orders.length,
      invoicesCount: invoices.length,
    }
  })

  // ─── EXTENDED REPORTS ─────────────────────────────────────────

  ipcHandle('reports:customerStatement', async (_, { customerId, from, to }: any = {}) => {
    const id = Number(customerId)
    if (!Number.isInteger(id) || id <= 0) throw new Error('اختر عميلًا صحيحًا')
    const dateRange = (value: string, end = false) => {
      if (!value) return undefined
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) throw new Error('نطاق تاريخ غير صحيح')
      if (end) { d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0) }
      else d.setUTCHours(0, 0, 0, 0)
      return d
    }
    const start = dateRange(from)
    const end = dateRange(to, true)
    if (start && end && start >= end) throw new Error('تاريخ البداية يجب أن يسبق تاريخ النهاية')
    const orderWhere: any = { customerId: id, status: 'completed', paymentMethod: 'credit' }
    const paymentWhere: any = { customerId: id }
    const returnWhere: any = { order: { customerId: id, paymentMethod: 'credit', status: 'completed' } }
    if (start) {
      orderWhere.createdAt = { gte: start, ...(end ? { lt: end } : {}) }
      paymentWhere.date = { gte: start, ...(end ? { lt: end } : {}) }
      returnWhere.returnDate = { gte: start, ...(end ? { lt: end } : {}) }
    } else if (end) {
      orderWhere.createdAt = { lt: end }
      paymentWhere.date = { lt: end }
      returnWhere.returnDate = { lt: end }
    }
    const openingWhereOrders: any = { customerId: id, status: 'completed', paymentMethod: 'credit', ...(start ? { createdAt: { lt: start } } : { id: -1 }) }
    const openingWherePayments: any = { customerId: id, ...(start ? { date: { lt: start } } : { id: -1 }) }
    const openingWhereReturns: any = { order: { customerId: id, paymentMethod: 'credit', status: 'completed' }, ...(start ? { returnDate: { lt: start } } : { id: -1 }) }
    const [orders, payments, returns, customer, openingOrders, openingPayments, openingReturns] = await Promise.all([
      prisma.posOrder.findMany({ where: orderWhere, orderBy: { createdAt: 'asc' } }),
      prisma.customerPayment.findMany({ where: paymentWhere, orderBy: { date: 'asc' }, include: { order: true } }),
      prisma.saleReturn.findMany({ where: returnWhere, orderBy: { returnDate: 'asc' }, include: { order: true } }),
      prisma.customer.findUnique({ where: { id } }),
      prisma.posOrder.aggregate({ where: openingWhereOrders, _sum: { total: true } }),
      prisma.customerPayment.aggregate({ where: openingWherePayments, _sum: { amount: true } }),
      prisma.saleReturn.findMany({ where: openingWhereReturns, include: { order: true } }),
    ])
    if (!customer) throw new Error('العميل غير موجود')
    const returnValue = (ret: any) => {
      const ratio = ret.order.subtotal > 0 ? ret.total / ret.order.subtotal : 0
      return Math.max(0, ret.total - (ret.order.discountAmount ?? 0) * ratio + (ret.order.taxAmount ?? 0) * ratio)
    }
    const openingReturnTotal = openingReturns.reduce((sum: number, ret: any) => sum + returnValue(ret), 0)
    const openingBalance = (openingOrders._sum.total ?? 0) - (openingPayments._sum.amount ?? 0) - openingReturnTotal
    const events = [
      ...orders.map(o => ({ date: o.createdAt, description: `فاتورة مبيعات آجلة ${o.orderNumber}`, amount: o.total, debit: o.total, credit: 0, kind: 'sale' })),
      ...payments.map(p => ({ date: p.date, description: `تحصيل على ${p.order.orderNumber}${p.reference ? ` - ${p.reference}` : ''}`, amount: -p.amount, debit: 0, credit: p.amount, kind: 'receipt' })),
      ...returns.map(ret => { const value = returnValue(ret); return { date: ret.returnDate, description: `إشعار دائن / مرتجع ${ret.id}`, amount: -value, debit: 0, credit: value, kind: 'return' } }),
    ].sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime())
    let balance = openingBalance
    const rows = events.map(event => {
      balance += event.amount
      return { ...event, balance }
    })
    const totalSales = orders.reduce((sum, o) => sum + o.total, 0)
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)
    const totalReturns = returns.reduce((sum, ret) => sum + returnValue(ret), 0)
    return { customer, rows, openingBalance, total: balance, balance, totalSales, totalPayments, totalReturns, count: rows.length }
  })

  ipcHandle('reports:supplierStatement', async (_, { supplierId, from, to }: any = {}) => {
    const id = Number(supplierId)
    if (!Number.isInteger(id) || id <= 0) throw new Error('اختر موردًا صحيحًا')
    const dateRange = (value: string, end = false) => {
      if (!value) return undefined
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) throw new Error('نطاق تاريخ غير صحيح')
      if (end) { d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0) }
      else d.setUTCHours(0, 0, 0, 0)
      return d
    }
    const start = dateRange(from)
    const end = dateRange(to, true)
    if (start && end && start >= end) throw new Error('تاريخ البداية يجب أن يسبق تاريخ النهاية')
    const invoiceWhere: any = { supplierId: id, status: 'confirmed' }
    const paymentWhere: any = { supplierId: id }
    const returnWhere: any = { invoice: { supplierId: id, status: 'confirmed' } }
    if (start) {
      invoiceWhere.invoiceDate = { gte: start, ...(end ? { lt: end } : {}) }
      paymentWhere.date = { gte: start, ...(end ? { lt: end } : {}) }
      returnWhere.returnDate = { gte: start, ...(end ? { lt: end } : {}) }
    } else if (end) {
      invoiceWhere.invoiceDate = { lt: end }
      paymentWhere.date = { lt: end }
      returnWhere.returnDate = { lt: end }
    }
    const openingWhereInvoices: any = { supplierId: id, status: 'confirmed', ...(start ? { invoiceDate: { lt: start } } : { id: -1 }) }
    const openingWherePayments: any = { supplierId: id, ...(start ? { date: { lt: start } } : { id: -1 }) }
    const openingWhereReturns: any = { invoice: { supplierId: id, status: 'confirmed' }, ...(start ? { returnDate: { lt: start } } : { id: -1 }) }
    const [invoices, payments, returns, supplier, openingInvoices, openingPayments, openingReturns] = await Promise.all([
      prisma.purchaseInvoice.findMany({ where: invoiceWhere, orderBy: { invoiceDate: 'asc' } }),
      prisma.supplierPayment.findMany({ where: paymentWhere, orderBy: { date: 'asc' }, include: { invoice: true } }),
      prisma.purchaseReturn.findMany({ where: returnWhere, orderBy: { returnDate: 'asc' }, include: { invoice: true } }),
      prisma.supplier.findUnique({ where: { id } }),
      prisma.purchaseInvoice.aggregate({ where: openingWhereInvoices, _sum: { total: true } }),
      prisma.supplierPayment.aggregate({ where: openingWherePayments, _sum: { amount: true } }),
      prisma.purchaseReturn.findMany({ where: openingWhereReturns, include: { invoice: true } }),
    ])
    if (!supplier) throw new Error('المورد غير موجود')
    const returnValue = (ret: any) => ret.total + (ret.invoice.subtotal > 0 ? ret.invoice.taxAmount * ret.total / ret.invoice.subtotal : 0)
    const openingReturnTotal = openingReturns.reduce((sum: number, ret: any) => sum + returnValue(ret), 0)
    const openingBalance = (openingInvoices._sum.total ?? 0) - (openingPayments._sum.amount ?? 0) - openingReturnTotal
    const events = [
      ...invoices.map(i => ({ date: i.invoiceDate, description: `فاتورة مشتريات ${i.invoiceNumber ?? `INV-${i.id}`}`, amount: i.total, debit: 0, credit: i.total, kind: 'purchase' })),
      ...payments.map(p => ({ date: p.date, description: `سداد على ${p.invoice.invoiceNumber ?? `INV-${p.invoice.id}`}${p.reference ? ` - ${p.reference}` : ''}`, amount: -p.amount, debit: p.amount, credit: 0, kind: 'payment' })),
      ...returns.map(ret => { const value = returnValue(ret); return { date: ret.returnDate, description: `إشعار دائن / مرتجع مشتريات ${ret.id}`, amount: -value, debit: value, credit: 0, kind: 'return' } }),
    ].sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime())
    let balance = openingBalance
    const rows = events.map(event => {
      balance += event.amount
      return { ...event, balance }
    })
    const totalInvoices = invoices.reduce((sum, i) => sum + i.total, 0)
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)
    const totalReturns = returns.reduce((sum, ret) => sum + returnValue(ret), 0)
    return { supplier, rows, openingBalance, total: balance, balance, totalInvoices, totalPayments, totalReturns, count: rows.length }
  })

  ipcHandle('reports:vatDetails', async (_, { from, to }: any = {}) => {
    const df: any = {}
    if (from) { const d = new Date(from); d.setUTCHours(0, 0, 0, 0); df.gte = d }
    if (to)   { const d = new Date(to); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0); df.lt = d }
    if (from && to && new Date(from) >= new Date(to + 'T23:59:59.999Z')) throw new Error('تاريخ بداية التقرير يجب أن يسبق تاريخ النهاية')
    const [orders, invoices, salesReturns, purchaseReturns] = await Promise.all([
      prisma.posOrder.findMany({ where: { status: 'completed', ...(Object.keys(df).length ? { createdAt: df } : {}) }, include: { customer: true }, orderBy: { createdAt: 'asc' } }),
      prisma.purchaseInvoice.findMany({ where: { status: 'confirmed', ...(Object.keys(df).length ? { invoiceDate: df } : {}) }, include: { supplier: true }, orderBy: { invoiceDate: 'asc' } }),
      prisma.saleReturn.findMany({ where: Object.keys(df).length ? { returnDate: df } : {}, include: { order: { include: { customer: true } } }, orderBy: { returnDate: 'asc' } }),
      prisma.purchaseReturn.findMany({ where: Object.keys(df).length ? { returnDate: df } : {}, include: { invoice: { include: { supplier: true } } }, orderBy: { returnDate: 'asc' } }),
    ])
    const salesRows = orders.filter(o => o.taxAmount > 0).map(o => ({
      date: o.createdAt, ref: o.orderNumber, party: o.customer?.name ?? 'عميل نقدي',
      type: 'sale', subtotal: o.subtotal, taxRate: o.taxRate, taxAmount: o.taxAmount, total: o.total,
    }))
    const salesReturnRows = salesReturns.map(ret => {
      const ratio = ret.order.subtotal > 0 ? ret.total / ret.order.subtotal : 0
      const subtotal = ret.total - ret.order.discountAmount * ratio
      const taxAmount = ret.order.taxAmount * ratio
      return {
        date: ret.returnDate, ref: `RTN-${ret.id}`, party: ret.order.customer?.name ?? 'عميل نقدي',
        type: 'sale_return', subtotal: -subtotal, taxRate: ret.order.taxRate, taxAmount: -taxAmount, total: -(subtotal + taxAmount),
      }
    })
    const purchaseRows = invoices.filter(i => i.taxAmount > 0).map(i => ({
      date: i.invoiceDate, ref: i.invoiceNumber ?? `INV-${i.id}`, party: i.supplier?.name ?? 'مورد',
      type: 'purchase', subtotal: i.subtotal, taxRate: i.taxRate, taxAmount: i.taxAmount, total: i.total,
    }))
    const purchaseReturnRows = purchaseReturns.map(ret => {
      const taxAmount = ret.invoice.subtotal > 0 ? ret.invoice.taxAmount * ret.total / ret.invoice.subtotal : 0
      return {
        date: ret.returnDate, ref: `PR-${ret.id}`, party: ret.invoice.supplier?.name ?? 'مورد',
        type: 'purchase_return', subtotal: -ret.total, taxRate: ret.invoice.taxRate, taxAmount: -taxAmount, total: -(ret.total + taxAmount),
      }
    })
    const salesAll = [...salesRows, ...salesReturnRows].sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime())
    const purchasesAll = [...purchaseRows, ...purchaseReturnRows].sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime())
    return {
      salesRows: salesAll,
      purchaseRows: purchasesAll,
      totals: {
        salesSubtotal: salesAll.reduce((sum, row) => sum + row.subtotal, 0),
        salesTax: salesAll.reduce((sum, row) => sum + row.taxAmount, 0),
        purchaseSubtotal: purchasesAll.reduce((sum, row) => sum + row.subtotal, 0),
        purchaseTax: purchasesAll.reduce((sum, row) => sum + row.taxAmount, 0),
      },
    }
  })

  ipcHandle('reports:cashFlow', async (_, { from, to }: any = {}) => {
    const dateFilter: any = {}
    if (from) { const d = new Date(from); d.setUTCHours(0, 0, 0, 0); dateFilter.gte = d }
    if (to)   { const d = new Date(to); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(0, 0, 0, 0); dateFilter.lt = d }

    // Build cash movement from posted journal entries, not only manually
    // recorded bank transactions. BankTransaction remains supplementary detail.
    const [bankAccounts, cashAccounts, entries, txs] = await Promise.all([
      prisma.bankAccount.findMany({ where: { isActive: true }, include: { account: true } }),
      prisma.account.findMany({ where: { isActive: true, code: { in: ['1111', '1112'] } } }),
      prisma.journalEntry.findMany({
        where: { status: 'posted', ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) },
        include: { lines: { include: { account: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.bankTransaction.findMany({
        where: Object.keys(dateFilter).length ? { date: dateFilter } : {},
        include: { bankAccount: true },
        orderBy: { date: 'asc' },
      }),
    ])

    const cashIds = new Set<number>()
    for (const b of bankAccounts) if (b.accountId) cashIds.add(b.accountId)
    for (const a of cashAccounts) cashIds.add(a.id)

    const byMonth: Record<string, { deposits: number; withdrawals: number }> = {}
    const transactions: any[] = []
    let totalIn = 0
    let totalOut = 0
    for (const entry of entries) {
      const cashLines = entry.lines.filter(line => cashIds.has(line.accountId))
      const netCash = cashLines.reduce((sum, line) => sum + line.debit - line.credit, 0)
      if (Math.abs(netCash) < 0.005) continue
      const amount = Math.abs(netCash)
      const key = new Date(entry.date).toISOString().slice(0, 7)
      if (!byMonth[key]) byMonth[key] = { deposits: 0, withdrawals: 0 }
      if (netCash > 0) {
        byMonth[key].deposits += amount
        totalIn += amount
      } else {
        byMonth[key].withdrawals += amount
        totalOut += amount
      }
      transactions.push({
        id: entry.id,
        date: entry.date,
        description: entry.description || entry.reference || entry.number,
        type: netCash > 0 ? 'deposit' : 'withdrawal',
        amount,
        journalEntryNumber: entry.number,
      })
    }
    return {
      transactions,
      bankTransactions: txs,
      byMonth,
      totals: { in: totalIn, out: totalOut, net: totalIn - totalOut },
      basis: 'posted_journal_entries',
    }
  })

  ipcHandle('reports:arAging', async (_, { asOf }: any = {}) => {
    const cutoff = asOf ? new Date(asOf) : new Date()
    if (Number.isNaN(cutoff.getTime())) throw new Error('تاريخ تقرير أعمار ديون العملاء غير صحيح')
    cutoff.setUTCDate(cutoff.getUTCDate() + 1)
    cutoff.setUTCHours(0, 0, 0, 0)
    const customers = await prisma.customer.findMany({
      include: {
        orders: {
          where: { status: 'completed', paymentMethod: 'credit', createdAt: { lt: cutoff } },
          include: { payments: true, returns: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })
    const result = customers.map(customer => {
      const entry: any = { id: customer.id, name: customer.name, phone: customer.phone, rows: [], total: 0, c0: 0, c30: 0, c60: 0, c90: 0, count: 0, oldestDueDate: null as Date | null, lastDate: null as Date | null, lastDate: null as Date | null }
      for (const order of customer.orders) {
        const paid = order.payments.reduce((sum, payment) => sum + payment.amount, 0)
        const returned = order.returns.reduce((sum, ret) => {
          const ratio = order.subtotal > 0 ? ret.total / order.subtotal : 0
          return sum + ret.total - order.discountAmount * ratio + order.taxAmount * ratio
        }, 0)
        const due = Math.max(0, order.total - paid - returned)
        if (due <= 0.005) continue
        const days = Math.max(0, Math.floor((cutoff.getTime() - 1 - new Date(order.createdAt).getTime()) / 86400000))
        const row = { orderId: order.id, orderNumber: order.orderNumber, date: order.createdAt, total: order.total, paid, returned, due, days }
        entry.rows.push(row)
        entry.total += due
        entry.count++
        if (!entry.oldestDueDate || new Date(order.createdAt) < entry.oldestDueDate) entry.oldestDueDate = new Date(order.createdAt)
        if (!entry.lastDate || new Date(order.createdAt) > entry.lastDate) entry.lastDate = new Date(order.createdAt)
        if      (days <= 30) entry.c0  += due
        else if (days <= 60) entry.c30 += due
        else if (days <= 90) entry.c60 += due
        else                 entry.c90 += due
      }
      entry.days = entry.oldestDueDate ? Math.max(0, Math.floor((cutoff.getTime() - 1 - entry.oldestDueDate.getTime()) / 86400000)) : 0
      return entry
    }).filter(entry => entry.total > 0.005)
    return result.sort((a, b) => b.total - a.total)
  })

  ipcHandle('reports:apAging', async (_, { asOf }: any = {}) => {
    const cutoff = asOf ? new Date(asOf) : new Date()
    if (Number.isNaN(cutoff.getTime())) throw new Error('تاريخ تقرير أعمار ديون الموردين غير صحيح')
    cutoff.setUTCDate(cutoff.getUTCDate() + 1)
    cutoff.setUTCHours(0, 0, 0, 0)
    const invoices = await prisma.purchaseInvoice.findMany({
      where: { status: 'confirmed', invoiceDate: { lt: cutoff } },
      include: { supplier: true, payments: true, returns: true },
      orderBy: { invoiceDate: 'asc' },
    })
    const map = new Map<number, any>()
    for (const invoice of invoices) {
      const supplierId = invoice.supplierId ?? 0
      if (!map.has(supplierId)) map.set(supplierId, {
        supplier: invoice.supplier, name: invoice.supplier?.name ?? 'مورد غير محدد',
        rows: [], total: 0, c0: 0, c30: 0, c60: 0, c90: 0, count: 0, oldestDueDate: null as Date | null,
      })
      const entry = map.get(supplierId)!
      const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0)
      const returned = invoice.returns.reduce((sum, ret) => {
        const taxShare = invoice.subtotal > 0 ? invoice.taxAmount * ret.total / invoice.subtotal : 0
        return sum + ret.total + taxShare
      }, 0)
      const due = Math.max(0, invoice.total - paid - returned)
      if (due <= 0.005) continue
      const days = Math.max(0, Math.floor((cutoff.getTime() - 1 - new Date(invoice.invoiceDate).getTime()) / 86400000))
      entry.rows.push({
        invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber ?? `INV-${invoice.id}`,
        date: invoice.invoiceDate, total: invoice.total, paid, returned, due, days,
      })
      entry.total += due
      entry.count++
      if (!entry.oldestDueDate || new Date(invoice.invoiceDate) < entry.oldestDueDate) entry.oldestDueDate = new Date(invoice.invoiceDate)
      if (!entry.lastDate || new Date(invoice.invoiceDate) > entry.lastDate) entry.lastDate = new Date(invoice.invoiceDate)
      if      (days <= 30) entry.c0  += due
      else if (days <= 60) entry.c30 += due
      else if (days <= 90) entry.c60 += due
      else                 entry.c90 += due
    }
    return Array.from(map.values())
      .filter(entry => entry.total > 0.005)
      .map(entry => ({
        ...entry,
        days: entry.oldestDueDate ? Math.max(0, Math.floor((cutoff.getTime() - 1 - entry.oldestDueDate.getTime()) / 86400000)) : 0,
      }))
      .sort((a, b) => b.total - a.total)
  })

  ipcHandle('reports:executiveSummary', async (_, { from, to }: any = {}) => {
    const df: any = {}
    if (from) { const d = new Date(from); d.setUTCHours(0,0,0,0); df.gte = d }
    if (to)   { const d = new Date(to); d.setUTCDate(d.getUTCDate()+1); d.setUTCHours(0,0,0,0); df.lte = d }
    const [orders, invoices, expenses, products, customerCount, banks] = await Promise.all([
      prisma.posOrder.findMany({ where: { status: 'completed', ...(df.gte ? { createdAt: df } : {}) } }),
      prisma.purchaseInvoice.findMany({ where: { status: 'confirmed', ...(df.gte ? { invoiceDate: df } : {}) } }),
      prisma.expense.findMany({ where: df.gte ? { date: df } : {} }),
      prisma.product.findMany({ where: { isActive: true } }),
      prisma.customer.count(),
      prisma.bankAccount.findMany({ where: { isActive: true } }),
    ])
    const revenue   = orders.reduce((s, o) => s + o.subtotal, 0)
    const purchases = invoices.reduce((s, i) => s + i.subtotal, 0)
    const expTotal  = expenses.reduce((s, e) => s + e.amount, 0)
    const byDay: Record<string, number> = {}
    for (const o of orders) {
      const k = new Date(o.createdAt).toISOString().slice(0, 10)
      byDay[k] = (byDay[k] ?? 0) + o.total
    }
    return {
      revenue, purchases, expenses: expTotal,
      netProfit: revenue - purchases - expTotal,
      vatNet: orders.reduce((s, o) => s + o.taxAmount, 0) - invoices.reduce((s, i) => s + i.taxAmount, 0),
      ordersCount: orders.length,
      avgOrderValue: orders.length ? revenue / orders.length : 0,
      inventoryValue: products.reduce((s, p) => s + p.currentStock * p.costPrice, 0),
      lowStockCount: products.filter(p => p.minStockAlert > 0 && p.currentStock <= p.minStockAlert).length,
      outOfStockCount: products.filter(p => p.currentStock === 0).length,
      customerCount, totalCash: banks.reduce((s, b) => s + b.currentBalance, 0),
      byDay,
    }
  })

  ipcHandle('reports:inventoryExtended', async (_, { categoryId }: any = {}) => {
    const [products, categories] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, ...(categoryId ? { categoryId: Number(categoryId) } : {}) },
        include: { category: true },
        orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
      }),
      prisma.category.findMany({ orderBy: { name: 'asc' } }),
    ])
    const rows = products.map(p => ({
      ...p, stockValue: p.currentStock * p.costPrice,
      margin: p.sellingPrice > 0 ? (p.sellingPrice - p.costPrice) / p.sellingPrice * 100 : 0,
      status: p.currentStock === 0 ? 'out' : (p.minStockAlert > 0 && p.currentStock <= p.minStockAlert) ? 'low' : 'ok',
    }))
    return {
      rows, categories,
      summary: {
        total: rows.length, totalValue: rows.reduce((s, r) => s + r.stockValue, 0),
        outOfStock: rows.filter(r => r.status === 'out').length,
        lowStock:   rows.filter(r => r.status === 'low').length,
      },
    }
  })

  ipcHandle('reports:banksSummary', async (_, { from, to }: any = {}) => {
    const df: any = {}
    if (from) { const d = new Date(from); d.setUTCHours(0,0,0,0); df.gte = d }
    if (to)   { const d = new Date(to); d.setUTCDate(d.getUTCDate()+1); d.setUTCHours(0,0,0,0); df.lte = d }
    const accounts = await prisma.bankAccount.findMany({ where: { isActive: true } })
    const result = await Promise.all(accounts.map(async acc => {
      const txs = await prisma.bankTransaction.findMany({
        where: { bankAccountId: acc.id, ...(Object.keys(df).length ? { date: df } : {}) },
        orderBy: { date: 'asc' },
      })
      const deposits    = txs.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0)
      const withdrawals = txs.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0)
      return { ...acc, balance: acc.currentBalance, deposits, withdrawals, txCount: txs.length }
    }))
    return {
      accounts: result,
      totals: {
        totalDeposits:    result.reduce((s, a) => s + a.deposits, 0),
        totalWithdrawals: result.reduce((s, a) => s + a.withdrawals, 0),
        totalBalance:     result.reduce((s, a) => s + a.balance, 0),
      },
    }
  })

  // ─── BACKUP ────────────────────────────────────────────────────
  ipcHandle('backup:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcHandle('backup:create', async () => {
    const { copyFile } = await import('node:fs/promises')
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `umarket-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'Database', extensions: ['db'] }],
    })
    if (result.canceled || !result.filePath) return false
    await copyFile(dbPath, result.filePath)
    return true
  })

  // ─── SYSTEM ─────────────────────────────────────────────────────
  ipcHandle('system:clearAllData', async (_, payload: { sections: string[]; userId: number; pin: string }) => {
    const { sections, userId, pin } = payload || {}
    if (!Array.isArray(sections) || sections.length === 0) {
      throw new Error('اختر قسمًا واحدًا على الأقل')
    }
    if (!Number.isInteger(userId) || typeof pin !== 'string' || !pin.trim()) {
      throw new Error('أدخل رقم دخول المدير')
    }

    // Slow repeated PIN guesses and verify credentials against the database in the main process.
    const now = Date.now()
    const failure = clearPinFailures.get(userId)
    if (failure && failure.lockedUntil > now) {
      const seconds = Math.ceil((failure.lockedUntil - now) / 1000)
      throw new Error(`محاولات كثيرة. حاول مرة أخرى بعد ${seconds} ثانية`)
    }
    const actor = await prisma.user.findUnique({ where: { id: userId } })
    if (!actor || !actor.isActive || !verifyPin(pin, actor.pin)) {
      const count = (failure?.count ?? 0) + 1
      clearPinFailures.set(userId, {
        count: count >= 5 ? 0 : count,
        lockedUntil: count >= 5 ? now + 60_000 : 0,
      })
      throw new Error(count >= 5 ? 'تم إيقاف المحاولة مؤقتًا لمدة دقيقة' : 'رقم دخول المدير غير صحيح')
    }
    clearPinFailures.delete(userId)
    if (!actor.pin.startsWith('scrypt$')) {
      await prisma.user.update({ where: { id: actor.id }, data: { pin: hashPin(pin) } })
    }
    const role = await prisma.role.findUnique({ where: { name: actor.role } })
    if (!role || (!role.isSystem && !role.fullAccess)) {
      throw new Error('هذه العملية متاحة لمدير النظام فقط')
    }

    const allowed = new Set([
      'all', 'sales', 'returns', 'purchases', 'stock', 'transfers',
      'inventory', 'products', 'customers', 'suppliers', 'expenses',
      'accounting', 'banks',
    ])
    const selected = new Set(sections)
    for (const section of selected) {
      if (!allowed.has(section)) throw new Error('قسم غير معروف: ' + section)
    }
    const all = selected.has('all')
    if (all && selected.size !== 1) throw new Error('اختيار مسح الجميع لا يقبل أقسامًا إضافية')

    // Removing products requires removing documents that have mandatory product
    // foreign keys as well. This is intentionally explicit in the confirmation UI.
    const removeProducts = all || selected.has('products')
    const removeSales = all || selected.has('sales') || removeProducts
    const removeReturns = all || selected.has('returns') || removeSales
    const removePurchases = all || selected.has('purchases') || removeProducts
    const removeStock = all || selected.has('stock') || removeProducts
    const removeTransfers = all || selected.has('transfers') || removeProducts
    const removeInventory = all || selected.has('inventory') || removeProducts
    const removeExpenses = all || selected.has('expenses')
    const removeBanks = all || selected.has('banks')
    const removeAccounting = all || selected.has('accounting')

    await prisma.$transaction(async (tx) => {
      if (removeReturns) {
        await tx.saleReturnItem.deleteMany({})
        await tx.saleReturn.deleteMany({})
      }
      if (removeSales) {
        await tx.customerPayment.deleteMany({})
        await tx.journalEntry.deleteMany({ where: { source: 'customer_payment' } })
        await tx.posOrderItem.deleteMany({})
        await tx.posOrder.deleteMany({})
        await tx.journalEntry.deleteMany({ where: { source: 'sale' } })
      } else if (selected.has('returns')) {
        // Return journal entries use the shared "sale" source in older database versions.
        await tx.journalEntry.deleteMany({
          where: { source: 'sale', description: { contains: 'مرتجع' } },
        })
      }

      if (removePurchases) {
        await tx.supplierPayment.deleteMany({})
        await tx.journalEntry.deleteMany({ where: { source: { in: ['supplier_payment', 'purchase_return'] } } })
        await tx.purchaseReturnItem.deleteMany({})
        await tx.purchaseReturn.deleteMany({})
        await tx.purchaseItem.deleteMany({})
        await tx.purchaseInvoice.deleteMany({})
        await tx.purchaseRequestItem.deleteMany({})
        await tx.purchaseRequest.deleteMany({})
        await tx.stockMovement.deleteMany({ where: { type: { in: ['purchase', 'purchase_return'] } } })
        await tx.journalEntry.deleteMany({ where: { source: 'purchase' } })
      }

      if (removeTransfers) {
        await tx.transferItem.deleteMany({})
        await tx.transfer.deleteMany({})
        await tx.transferRequestItem.deleteMany({})
        await tx.transferRequest.deleteMany({})
        await tx.stockMovement.deleteMany({ where: { type: 'transfer' } })
      }

      if (removeInventory) {
        await tx.inventoryCountItem.deleteMany({})
        await tx.inventoryCount.deleteMany({})
      }

      if (removeStock) {
        await tx.stockMovement.deleteMany({})
        await tx.warehouseStock.deleteMany({})
        if (!removeProducts) {
          await tx.product.updateMany({ data: { currentStock: 0 } })
        }
      }

      if (removeProducts) {
        await tx.promotionProduct.deleteMany({})
        await tx.promotion.deleteMany({})
        await tx.productBarcode.deleteMany({})
        await tx.productUnit.deleteMany({})
        await tx.priceHistory.deleteMany({})
        await tx.product.deleteMany({})
        await tx.category.deleteMany({})
      }

      if (all || selected.has('customers')) {
        // Preserve historical receipts and sales while detaching the optional customer master record.
        await tx.posOrder.updateMany({ data: { customerId: null } })
        await tx.customerPayment.updateMany({ data: { customerId: null } })
        await tx.customer.deleteMany({})
      }

      if (all || selected.has('suppliers')) {
        // Supplier references are optional; preserve payment history and detach supplier master records.
        await tx.purchaseInvoice.updateMany({ data: { supplierId: null } })
        await tx.purchaseRequest.updateMany({ data: { supplierId: null } })
        await tx.supplierPayment.updateMany({ data: { supplierId: null } })
        await tx.supplier.deleteMany({})
      }

      if (removeExpenses) {
        await tx.expense.deleteMany({})
        await tx.expenseCategory.deleteMany({})
        await tx.journalEntry.deleteMany({ where: { source: 'expense' } })
      }

      if (removeBanks) {
        await tx.bankTransaction.deleteMany({})
        await tx.bankStatementLine.deleteMany({})
        await tx.bankRule.deleteMany({})
        await tx.journalEntry.deleteMany({ where: { source: 'bank' } })
        await tx.bankAccount.updateMany({ data: { accountId: null } })
        await tx.bankAccount.deleteMany({})
      }

      if (removeAccounting) {
        // Bank transactions keep an optional scalar link to their journal entry.
        await tx.bankTransaction.updateMany({ data: { journalEntryId: null } })
        await tx.journalEntryLine.deleteMany({})
        await tx.journalEntry.deleteMany({})
      }

      if (all) {
        await tx.activityLog.deleteMany({})
      }
    }, { maxWait: 10_000, timeout: 60_000 })

    try {
      await prisma.activityLog.create({
        data: {
          userId: actor.id,
          action: 'clear',
          entity: 'system',
          details: all ? 'all' : [...selected].join(','),
        },
      })
    } catch (error) {
      console.error('[AuditLog:clear]', error)
    }
    return { ok: true }
  })

  ipcHandle('system:autoBackupStatus', async () => {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['autoBackupEnabled', 'autoBackupPath', 'autoBackupInterval', 'autoBackupLastRun'] } },
    })
    const cfg: Record<string, string> = {}
    rows.forEach(r => { cfg[r.key] = r.value })
    return cfg
  })
}
