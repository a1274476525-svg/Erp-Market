import { chromium } from 'playwright-core'

const errors = []
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
let page = null
for (const ctx of browser.contexts()) for (const p of ctx.pages()) if (!p.url().startsWith('devtools://')) page = p
if (!page) { console.log('NO_PAGE'); process.exit(1) }
console.log('connected:', page.url())
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push('pageerror:' + e.message))

async function api(path, ...args) {
  return page.evaluate(({ path, args }) => {
    const fn = path.split('.').reduce((o, k) => o[k], window.api)
    return fn(...args)
  }, { path, args })
}

async function bodyText(n = 1200) { return page.evaluate((n) => document.body.innerText.slice(0, n), n) }
async function waitForText(needle, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if ((await bodyText(5000)).includes(needle)) return true
    await page.waitForTimeout(300)
  }
  return false
}
async function clickButtonText(t) {
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll('button, a, [role=button]')]
    let el = els.find(e => e.textContent.trim() === t)
    if (!el) el = els.find(e => e.textContent.includes(t))
    if (!el) return 'NOT_FOUND'
    el.click()
    return 'OK'
  }, t)
}
async function clickDigit(d) {
  return page.evaluate((d) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === d)
    if (b) { b.click(); return true }
    return false
  }, d)
}
async function goto(path) { await page.evaluate((p) => { window.location.hash = '#' + p }, path) }

console.log('--- login ---')
await waitForText('ahmd')
await clickButtonText('ahmd')
await page.waitForTimeout(500)
for (const d of ['1', '2', '3', '4']) { await clickDigit(d); await page.waitForTimeout(250) }
await page.waitForTimeout(1000)

console.log('--- before backfill: check state ---')
const jeCountBefore = (await api('journalEntries.getAll', {})).length
console.log('journal entries before backfill:', jeCountBefore)

console.log('--- running backfillMissing ---')
const backfillRes = await api('journalEntries.backfillMissing')
console.log('backfill result:', JSON.stringify(backfillRes))

const jeCountAfter = (await api('journalEntries.getAll', {})).length
console.log('journal entries after backfill:', jeCountAfter)

console.log('--- checking balance sheet (all-time, via reports.financial + accounts.getAll like the UI does) ---')
const accounts = await api('accounts.getAll')
const fin = await api('reports.financial', { to: new Date().toISOString().slice(0, 10) })
const balMap = new Map()
for (const row of fin.trialBalance) {
  const bal = row.account.normalBalance === 'debit' ? row.debit - row.credit : row.credit - row.debit
  balMap.set(row.account.id, bal)
}
function sumByType(type) {
  return accounts.filter(a => a.type === type && !a.parentId).reduce((s, root) => {
    // sum all descendants of this root (simple: sum all accounts of this type using balMap, since roots aggregate everything)
    return s
  }, 0)
}
// simpler: sum ALL accounts of each type directly from balMap (flat sum is valid since every leaf's balance is already counted once)
const byType = { asset: 0, liability: 0, equity: 0, revenue: 0, expense: 0 }
for (const a of accounts) {
  if (balMap.has(a.id)) byType[a.type] = (byType[a.type] || 0) + balMap.get(a.id)
}
const netProfitGL = byType.revenue - byType.expense
const totalAssets = byType.asset
const totalLiabPlusEquity = byType.liability + byType.equity + netProfitGL
console.log('byType:', byType)
console.log('netProfitGL:', netProfitGL)
console.log('totalAssets:', totalAssets, 'totalLiab+Equity:', totalLiabPlusEquity, 'balanced:', Math.abs(totalAssets - totalLiabPlusEquity) < 0.01)

console.log('--- UI balance sheet render ---')
await goto('/reports/balance-sheet')
await page.waitForTimeout(1500)
console.log(await bodyText(2000).then(t => t.split('قائمة المركز المالي').slice(1).join('قائمة المركز المالي')))

console.log('--- sanity: new sale still auto-posts ---')
const products = await api('products.getAll')
const product = products[0]
const before = (await api('journalEntries.getAll', {})).length
const order = await api('pos.createOrder', {
  paymentMethod: 'cash', subtotal: 50, taxRate: 0, taxAmount: 0, total: 50,
  items: [{ productId: product.id, productName: product.name, quantity: 1, unitPrice: 50, total: 50 }],
})
const after = (await api('journalEntries.getAll', {})).length
console.log('order', order.orderNumber, 'JE count before/after:', before, after, 'delta:', after - before)
// clean this one up immediately (test artifact)
await api('pos.voidOrder', order.id)

console.log('=== CONSOLE_ERRORS ===')
console.log(JSON.stringify(errors, null, 2))

await browser.close()
