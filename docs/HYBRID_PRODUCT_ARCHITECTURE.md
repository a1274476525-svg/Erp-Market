# U Market ERP — Hybrid Product Architecture

## Product decision

Build U Market first as an offline-first Windows application, while keeping clear boundaries so online services can be added later without rewriting the accounting core. Do not require a cloud server, internet connection, or online license check for daily checkout.

The current application uses Electron, Prisma, and SQLite. Keep SQLite as the first deployment's local store. A future hosted edition should use a server-owned database (for example PostgreSQL) and an authenticated API; do not expose a store's SQLite file as a network database.

## Operating modes

### Phase 1 — Offline single-store / single-PC
- Sales, purchases, inventory, expenses, accounting, reports, and printing work without internet.
- Local database is stored under Electron `app.getPath('userData')`, never in the installation directory.
- Backup and restore are visible, tested workflows. Backups include the database and required attachments/configuration, with integrity checks.
- License activation can be performed by an offline activation file/code issued by the product owner. Daily operations must not stop just because the internet is unavailable.
- License expiry must never delete, encrypt, or make customer data inaccessible. Provide read-only/export/graceful renewal behavior defined by the license terms.

### Phase 2 — Optional online services, no forced cloud migration
- Optional encrypted off-site backup.
- Owner portal for customers, subscriptions, license issuance/revocation, device limits, release channels, and support status.
- Online license refresh with a signed, time-bounded entitlement cached locally; handle clock rollback and prolonged offline periods explicitly.
- Software updates are signed/published by the vendor. Customers can defer updates; database backup and migration checks run before updating.

### Phase 3 — Multi-device / multi-branch online edition
- Introduce a versioned API and server-owned PostgreSQL database.
- Every tenant (store/company) is isolated server-side. Tenant identity is derived from authenticated server credentials, never trusted from a renderer request.
- Users, roles, branches, warehouses, and devices are scoped to the tenant.
- Do not sync raw SQLite files between devices. Sync business events/commands through an API with stable IDs, idempotency keys, audit metadata, and conflict policies.
- Accounting journals are append-only after posting. Corrections use reversal entries and replacement entries, never silent edits.
- Define offline outbox/inbox, retries, duplicate detection, conflict handling, and reconciliation before enabling multi-device writes.

## Non-negotiable data integrity rules

1. A business document and its required stock movements and journal entries must commit atomically, or the operation must fail with no partial document.
2. Every posting is idempotent and has a unique source identity; retries cannot duplicate ledger or stock effects.
3. Posted entries are immutable. Changes create a reversal trail.
4. Store money as integer minor units (piastres/cents) or a carefully validated decimal representation; do not rely on binary floating-point for accounting totals.
5. Maintain stock movement history and cost layers / historical cost basis. Never calculate old COGS or returns from today's product cost.
6. Every tenant's records, backups, exports, logs, and attachments remain isolated.
7. Backups are encrypted where appropriate, versioned, and restore-tested.
8. License enforcement must not be a destructive data-control mechanism.

## Delivery gates

### Gate A — Safe offline product
- Complete and test the sales, returns, purchases, supplier payments, customer collections, expenses, cash/bank, stock, and accounting cycles.
- Reconcile trial balance, income statement, balance sheet, stock valuation, and cash/bank balances using reproducible fixtures.
- Test backup/restore, installer upgrade, database migration, power-loss/retry behavior, and data retention.
- Review Electron security, IPC authorization, secrets handling, and dependency vulnerabilities.

### Gate B — Vendor control without hosting
- Define a license format and offline activation/deactivation process.
- Build local license status UI, device registration, grace periods, and vendor-issued signed entitlements.
- Document recovery when a customer replaces a PC or loses internet access.
- Keep licensing separate from accounting and customer data.

### Gate C — Hosted services
- Deploy API and PostgreSQL only when hosting, monitoring, backups, incident response, and support ownership are ready.
- Implement tenant isolation tests and authorization tests before onboarding paying customers.
- Add optional cloud backup first; add multi-device synchronization only after conflict and reconciliation tests pass.

## Current limitations / cautions

- The current schema is SQLite-specific and currently uses floating-point `Float` fields for monetary values. A future PostgreSQL/cloud edition requires a deliberate schema and migration plan.
- The current local app is not yet a multi-tenant SaaS product. Do not market multi-device cloud sync as available until the API, tenant isolation, security, and reconciliation gates pass.
- A successful TypeScript build or Windows installer build does not prove accounting correctness or safe database upgrades.
- Never run schema changes against a customer's live database without a verified backup, migration plan, and restore test.
