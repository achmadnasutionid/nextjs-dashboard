# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A financial management dashboard (quotations, invoices, expenses, production tracking) for a small business, built with Next.js 16 (App Router), TypeScript, Prisma/PostgreSQL, deployed on Railway. Several clients (Erha, Paragon, Barclay) have bespoke ticket workflows and PDF layouts layered on top of the generic quotation/invoice model.

## Commands

```bash
npm run dev              # Dev server (uses DATABASE_URL_LOCAL, see below)
npm run build             # prisma generate (both schemas) + next build
npm run lint               # eslint
npm run typecheck          # tsc --noEmit only (assumes client already generated)
npm run typecheck:full      # prisma generate (both schemas) + tsc --noEmit — use this after pulling schema changes
```

There is no test suite/framework configured in this repo (no jest/vitest, no `test` script) — don't assume one exists.

**`next.config.ts` sets `typescript.ignoreBuildErrors: true`** — `npm run build` will succeed even with type errors (done to avoid OOM on Railway/Docker). Always run `npm run typecheck` yourself before considering a change done; the build will not catch type errors for you.

Database scripts (see `package.json` for the full list): `db:migrate` (dev), `db:migrate:deploy:both` (deploys pending migrations to both `DATABASE_URL` prod and `DATABASE_URL_LOCAL` — run this after any new migration, or when you see "column X does not exist" errors meaning the two DBs drifted), `db:backup` / `db:backup:json` (drives `backup-production-db.mjs`), `db:rebuild-trackers`, `db:master-data:export`/`import`, `db:fix-id-collisions` (+ `--dry-run`) for the Paragon/Erha ID-collision cleanup script.

## Architecture

### Three separate databases/stores — do not conflate them

- **Main app DB** (`lib/prisma.ts`, standard `@prisma/client` generated from `prisma/schema.prisma`). `lib/prisma.ts` deliberately picks the connection string based on `NODE_ENV`: production uses `DATABASE_URL`, development/test uses `DATABASE_URL_LOCAL` — this is intentional so local dev can **never** touch the production database. If `DATABASE_URL_LOCAL` isn't set, dev fails fast rather than silently falling back to prod.
- **Backup DB** (`lib/backup-db.ts`, `prisma-backup/schema.prisma`, generated into `lib/generated/backup-client` — a *separate* Prisma client with its own `generator`/`output`). It's a single `Backup` model storing JSON blobs (`summary` + `data` columns) written by `backup-production-db.mjs` / `app/api/backup/*`. Configured via `BACKUP_DATABASE_URL`; `saveBackupKeepLastN` in `lib/backup-db.ts` prunes to the last N (`BACKUP_KEEP_COUNT`, default 5) rows after each write. Nothing else reads/writes this DB.
- **Redis** (`lib/redis.ts`, optional via `REDIS_URL`) — pure cache layer for dashboard/list queries, not a source of truth. All reads fail open (return `null`/no-op) if Redis is absent or errors, so the app must work with `REDIS_URL` unset. Any mutation to invoices/quotations/tickets/expenses must call the matching `invalidate*Caches()` helper in `lib/cache-invalidation.ts` or stale data will be served.

There is also an optional Google Drive sync (`lib/google-drive.ts`, `lib/backup-json-drive-sync.ts`, `lib/pdf-drive-sync.ts`) for uploading backup JSON and generated PDFs to a Shared Drive; it's opt-in (skipped silently if the Drive env vars aren't set) and only fires for non-draft records, triggered manually from the Backup page. See `docs/GOOGLE_DRIVE_SETUP.md`.

### Domain model: generic Quotation/Invoice + per-client "Ticket" variants

`prisma/schema.prisma` has two parallel families of models:

- **Generic**: `Quotation` / `Invoice`, each with `*Item` → `*ItemDetail` (line items with detail/unitPrice/qty), `*Remark` (checklist-style notes), `*Signature`. A `Quotation` can be linked 1:1 to the `Invoice` generated from it and vice versa (`generatedInvoiceId`/`sourceInvoiceId`, `sourceQuotationId`/`generatedQuotationId`) — either document type can spawn the other.
- **Per-client tickets**: `ParagonTicket`, `ErhaTicket`, `BarclayTicket` — each is a *single* record representing one client engagement that bundles what would otherwise be a quotation + invoice + BAST (berita acara serah terima / handover doc) into one entity with its own `items`/`remarks` and lifecycle fields (`quotationDate`, `invoiceBastDate`, `contactPerson`/`bastContactPerson`, `finalWorkImageData`/`finalWorkDriveLink`). These live under `app/special-case/{paragon,erha,barclay}` and `app/api/{paragon,erha,barclay}`, with their own PDF components (`components/pdf/paragon-*`, `erha-*`, `barclay-*` for quotation/invoice/BAST variants). `lib/barclay.ts` shows the pattern used to detect a Barclay ticket from `billTo`/`projectName` text. All three follow the same shape — when fixing a bug in one, check whether the same bug exists in the other two (recent history in `git log` shows this happening repeatedly, e.g. PDF page-break/blank-page fixes).
- All primary entities use **soft delete** (`deletedAt`) rather than hard delete, with a `Trash` UI (`app/trash`) for restore/permanent-delete; most models index on `deletedAt` (often combined with `status`/date) because nearly every list query filters it out.
- `status` is a free-text field (`"draft"`, etc.) rather than an enum — check existing usages/`lib/constants.ts` before introducing a new status string.
- IDs like `quotationId`/`invoiceId`/`ticketId` are human-facing sequence-based codes (prefix + year + number), generated race-condition-free via Postgres sequences in `lib/id-generator.ts`, distinct from the Prisma `id` (cuid) primary key.
- `ProductionTracker` (`app/special-case/production-tracker`) is a separate profit-tracking record per project (`projectName`), auto-created/updated whenever an invoice is created via `lib/tracker-sync.ts` (`syncTracker`) — it preserves user-entered fields (`productAmounts`, `expense`, `notes`, `status`) across syncs and only overwrites `date`/`totalAmount`/`invoiceId`.

### PDF generation

PDFs are React components rendered via `@react-pdf/renderer` (`components/pdf/*`), one component per client × doc-type (quotation/invoice/BAST) combination, plus generic `quotation-pdf.tsx`/`invoice-pdf.tsx` and `*-backup-pdf.tsx` variants. Because `@react-pdf/renderer`'s pagination doesn't know about content it hasn't laid out yet, there's a cluster of supporting logic that estimates whether remarks/terms/billing sections fit on the current page (`lib/pdf-remarks-fit.ts`) and strips resulting blank trailing pages after render (`lib/pdf-strip-blank-page.ts`, used together with `lib/pdf-client-render.ts`/`components/pdf/stripped-pdf-viewer.tsx`). A large share of recent commits are fixes to this fit-estimation/blank-page logic — when touching PDF layout, check both the fit estimator and the stripper for the affected doc type.

### API routes mirror pages 1:1

`app/api/<entity>/route.ts` (list/create) + `app/api/<entity>/[id]/route.ts` (get/update/delete) pattern for every entity (`quotation`, `invoice`, `paragon`, `erha`, `barclay`, `production-tracker`, `products`, `companies`, `billings`, `signatures`, `remark-templates`, `quotation-templates`). `app/api/backup/*` has one-off endpoints for triggering backups, Drive sync status, and restore (`restore-invoice`, `restore-quotation`, `restore`, `import`/`import-phrase`, `export`). `middleware.ts` runs on every route: blocks known search-bot user agents (403), sets `Cache-Control` (5 min cache for read-mostly master-data endpoints — companies/products/billings/signatures — vs `no-store` for everything else), and sets security/no-index headers. There's no authentication layer in middleware.

### Validation / shared utilities worth knowing about

`lib/number-validator.ts` (`safeParseFloat` and friends — used to keep NaN out of the DB from form input), `lib/name-validator.ts` (`generateUniqueName` — auto-suffixes " 02", " 03" etc. across quotation/invoice/paragon/erha/barclay/productionTracker when a name would collide), `lib/optimistic-locking.ts` (`updatedAt`-based stale-write detection for concurrent edits, used on update endpoints), `lib/copy-down-payment.ts`, `lib/pph-calc.ts` (Indonesian withholding-tax/PPh deduction calculations applied to invoice/quotation totals). `lib/smart-auto-save.tsx` backs the auto-save behavior used on the long quotation/invoice/ticket forms.
