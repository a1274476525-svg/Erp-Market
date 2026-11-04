/// <reference types="vite/client" />

interface Window {
  api: {
    products: {
      getAll: (includeInactive?: boolean) => Promise<any[]>
      getByBarcode: (barcode: string) => Promise<any>
      create: (data: any) => Promise<any>
      update: (data: any) => Promise<any>
      delete: (id: number) => Promise<any>
      selectImage: (id: number) => Promise<string | null>
      removeImage: (id: number) => Promise<void>
      getImageData: (p: string) => Promise<string | null>
      getPriceHistory: (id: number) => Promise<any[]>
    }
    categories: {
      getAll: () => Promise<any[]>
      create: (data: any) => Promise<any>
      update: (data: any) => Promise<any>
      delete: (id: number) => Promise<any>
    }
    customers: {
      getAll: () => Promise<any[]>
      create: (data: any) => Promise<any>
      update: (data: any) => Promise<any>
      delete: (id: number) => Promise<any>
      addPoints: (data: any) => Promise<any>
    }
    suppliers: {
      getAll: () => Promise<any[]>
      create: (data: any) => Promise<any>
      update: (data: any) => Promise<any>
      delete: (id: number) => Promise<any>
    }
    invoices: {
      getAll: () => Promise<any[]>
      getDrafts: () => Promise<any[]>
      create: (data: any) => Promise<any>
      saveDraft: (data: any) => Promise<any>
      updateDraft: (data: any) => Promise<any>
      deleteDraft: (id: number) => Promise<any>
      confirmDraft: (id: number) => Promise<any>
    }
    purchaseRequests: {
      getAll: () => Promise<any[]>
      create: (data: any) => Promise<any>
      updateStatus: (data: any) => Promise<any>
      delete: (id: number) => Promise<any>
    }
    promotions: {
      getAll: () => Promise<any[]>
      create: (data: any) => Promise<any>
      update: (data: any) => Promise<any>
      toggle: (id: number) => Promise<any>
      delete: (id: number) => Promise<any>
    }
    pos: {
      createOrder: (data: any) => Promise<any>
      getOrders: (limit?: number) => Promise<any[]>
      voidOrder: (id: number) => Promise<any>
      createReturn: (data: any) => Promise<any>
      getReturns: () => Promise<any[]>
    }
    stock: {
      getMovements: (productId?: number) => Promise<any[]>
      adjust: (data: any) => Promise<any>
      waste: (data: any) => Promise<any>
      getWaste: () => Promise<any[]>
    }
    branches: {
      getAll: () => Promise<any[]>
      create: (data: any) => Promise<any>
      update: (data: any) => Promise<any>
      delete: (id: number) => Promise<any>
    }
    warehouses: {
      init: () => Promise<void>
      getAll: () => Promise<any[]>
      create: (data: any) => Promise<any>
      update: (data: any) => Promise<any>
      delete: (id: number) => Promise<any>
      setDefault: (id: number) => Promise<any>
      syncStock: (id: number) => Promise<any>
    }
    transferRequests: {
      getAll: () => Promise<any[]>
      create: (data: any) => Promise<any>
      updateStatus: (data: any) => Promise<any>
      delete: (id: number) => Promise<any>
    }
    transfers: {
      getAll: () => Promise<any[]>
      execute: (id: number) => Promise<any>
      createDirect: (data: any) => Promise<any>
      delete: (id: number) => Promise<any>
    }
    inventory: {
      getAll: () => Promise<any[]>
      create: () => Promise<any>
      addItems: (data: any) => Promise<any>
      removeItem: (id: number) => Promise<any>
      updateItem: (data: any) => Promise<any>
      close: (id: number) => Promise<any>
      delete: (id: number) => Promise<any>
    }
    reports: {
      dashboard:         () => Promise<any>
      sales:             (params: any) => Promise<any[]>
      purchases:         (params: any) => Promise<any[]>
      products:          () => Promise<any[]>
      stock:             () => Promise<any[]>
      financial:         (params?: any) => Promise<any>
      customerStatement: (params?: any) => Promise<any>
      supplierStatement: (params?: any) => Promise<any>
      vatDetails:        (params?: any) => Promise<any>
      cashFlow:          (params?: any) => Promise<any>
      arAging:           (params?: any) => Promise<any[]>
      apAging:           (params?: any) => Promise<any[]>
      executiveSummary:  (params?: any) => Promise<any>
      inventoryExtended: (params?: any) => Promise<any>
      banksSummary:      (params?: any) => Promise<any>
    }
    auth: {
      listUsers: () => Promise<any[]>
      login: (userId: number, pin: string) => Promise<any>
      getAll: () => Promise<any[]>
      create: (data: any) => Promise<any>
      update: (data: any) => Promise<any>
      delete: (id: number) => Promise<any>
    }
    roles: {
      getAll: () => Promise<any[]>
      create: (data: any) => Promise<any>
      update: (data: any) => Promise<any>
      delete: (id: number) => Promise<any>
    }
    settings: {
      getAll: () => Promise<Record<string, string>>
      set: (key: string, value: string) => Promise<any>
    }
    activity: {
      log: (data: any) => Promise<any>
      getAll: () => Promise<any[]>
    }
    backup: {
      create: () => Promise<boolean>
      selectFolder: () => Promise<string | null>
    }
    expenseCategories: {
      getAll:  () => Promise<any[]>
      create:  (data: any) => Promise<any>
      update:  (data: any) => Promise<any>
      delete:  (id: number) => Promise<any>
    }
    expenses: {
      getAll:  (params?: { from?: string; to?: string; categoryId?: number }) => Promise<any[]>
      create:  (data: any) => Promise<any>
      update:  (data: any) => Promise<any>
      delete:  (id: number) => Promise<any>
    }
    accounts: {
      getAll:      () => Promise<any[]>
      create:      (data: any) => Promise<any>
      update:      (data: any) => Promise<any>
      delete:      (id: number) => Promise<any>
      seedDefault: (force?: boolean) => Promise<any>
      getNextCode: (parentId?: number) => Promise<string>
    }
    journalEntries: {
      getAll:       (params?: any) => Promise<any[]>
      create:       (data: any) => Promise<any>
      post:         (id: number) => Promise<any>
      delete:       (id: number) => Promise<any>
      reverse:      (id: number) => Promise<any>
      trialBalance: (params?: any) => Promise<{ rows: any[]; totals: any }>
      ledger:       (params: any) => Promise<any[]>
      backfillMissing: () => Promise<{ purchases: number; sales: number; expenses: number; errors: string[] }>
    }
    bankAccounts: {
      getAll:  () => Promise<any[]>
      create:  (data: any) => Promise<any>
      update:  (data: any) => Promise<any>
      delete:  (id: number) => Promise<any>
    }
    bankTransactions: {
      getAll:  (params?: any) => Promise<any[]>
      create:  (data: any) => Promise<any>
      delete:  (id: number) => Promise<any>
    }
    bankStatements: {
      parseFile:      () => Promise<{ rows: any[]; fileName: string } | null>
      import:         (data: any) => Promise<{ imported: number; skipped: number }>
      getAll:         (params?: any) => Promise<any[]>
      match:          (data: any) => Promise<any>
      createFromLine: (data: any) => Promise<any>
      ignore:         (id: number) => Promise<any>
      unmatch:        (id: number) => Promise<any>
      delete:         (id: number) => Promise<any>
      applyRules:     (data: any) => Promise<{ matched: number }>
    }
    bankRules: {
      getAll:  () => Promise<any[]>
      create:  (data: any) => Promise<any>
      update:  (data: any) => Promise<any>
      delete:  (id: number) => Promise<any>
    }
    financialReports: {
      get: (params?: { from?: string; to?: string }) => Promise<any>
    }
    system: {
      clearAllData: (sections?: string[], password?: string) => Promise<{ ok: boolean }>
      autoBackupStatus: () => Promise<Record<string, string>>
    }
  }
}
