# Testing Guide

## ✅ Critical Integration Tests

Critical features for Quotation, PDFs, Paragon/Erha, and data safety are covered.

```bash
npm run test  # Run before every deployment!
```

## Test Files (critical)

- `tests/critical/adjustment-persistence.test.ts` – Quotation adjustmentPercentage / adjustmentNotes persist and update
- `tests/critical/optimistic-locking.test.ts` – Concurrent edit detection (Quotation)
- `tests/critical/pdf-generation.test.tsx` – Quotation/Invoice PDFs + **BAST PDF (Paragon/Erha)** contact fallback
- `tests/critical/paragon-erha-persistence.test.ts` – **Paragon & Erha**: bastContactPerson, bastContactPosition, adjustmentPercentage, adjustmentNotes (create + update, allow null)

## Test Categories

### 🔴 CRITICAL: Data safety
- **Optimistic locking** – concurrent edit detection (optimistic-locking.test.ts)

### 🔴 CRITICAL: Adjustment persistence
- **Quotation** – adjustmentPercentage, adjustmentNotes (adjustment-persistence.test.ts)

### 🔴 CRITICAL: PDF Generation (Quotation + BAST)
1. ✅ Generate valid PDF bytes (quotation)
2. ✅ PDF structure validation (has required sections)
3. ✅ Render items with nested details
4. ✅ Render remarks in correct order
5. ✅ Render custom signatures
6. ✅ PPH calculations in PDF
7. ✅ Performance (< 3s for 20 items)
8. ✅ Handle optional fields gracefully
9. ✅ PDF file format validation (%PDF header)
10. ✅ **Paragon BAST PDF** – contact fallback (quotation contact when bastContact null; BAST contact when set)
11. ✅ **Erha BAST PDF** – same contact fallback behaviour

### 🔴 CRITICAL: Paragon & Erha persistence
1. ✅ **Paragon** – bastContactPerson, bastContactPosition, adjustmentPercentage, adjustmentNotes (create + update, clear to null)
2. ✅ **Erha** – same fields and behaviour

## Hidden features covered

- ✅ **Optimistic locking** – concurrent edit detection
- ✅ **Adjustment fields** – Quotation (and Paragon/Erha) percentage + notes
- ✅ **PDF generation** – valid bytes, structure, items/remarks/signatures, PPH, optional fields
- ✅ **BAST PDF contact fallback** – Paragon/Erha use quotation contact when BAST contact not set
- ✅ **Paragon & Erha** – bastContactPerson, bastContactPosition, adjustmentPercentage, adjustmentNotes (create, update, clear to null)

## Available Commands

```bash
# Run all tests once
npm run test

# Run all tests with watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with visual UI dashboard
npm run test:ui

# Run all tests once
npm test

# Run specific test file
npm test quotation-flow
npm test invoice-flow
```

## When to Run

- ✅ **BEFORE EVERY DEPLOYMENT** (most important!)
- ✅ After changing any API route
- ✅ After modifying database logic
- ✅ After adding new features
- ✅ After fixing bugs
- ✅ Weekly sanity check

## What If Tests Fail?

1. **Read the error** - It tells you exactly what broke
2. **Find the feature** - Check which test failed
3. **Fix the issue** - Use the test as specification
4. **Re-run tests** - Verify fix works
5. **DO NOT deploy** until all pass ✅

## Example: If a test fails

```
❌ FAIL  tests/critical/paragon-erha-persistence.test.ts > Paragon ticket > should persist...
Expected: 'BAST Contact'
Received: null

→ Issue: bastContactPerson not saved on create
→ Fix: Check Paragon create API / Prisma schema
→ Rerun: npm run test
→ ✅ Pass → Safe to deploy
```

## Protection Provided

| Risk | Before | After |
|------|--------|-------|
| Data loss on errors | ❌ Possible | ✅ Prevented |
| Concurrent edit conflicts | ❌ Silent | ✅ Detected |
| Slow updates | ❌ Unknown | ✅ Monitored |
| Missing features | ❌ Found in prod | ✅ Found before commit |
| Broken updates | ❌ Manual test | ✅ Auto-tested |
| Cascade issues | ❌ Unknown | ✅ Tested |

## Confidence Level

**Before:** 20% confidence (manual testing only)
**After:** High confidence (critical paths covered by integration tests)

## Adding New Tests

When you add a new feature to Quotation or Invoice:

1. Copy existing test pattern
2. Modify for your feature
3. Run tests to verify
4. Commit test with feature code

**Example:**
```typescript
it('FEATURE 13: Should handle discount field', async () => {
  const quotation = await prisma.quotation.create({
    data: {
      // ... existing fields ...
      discount: 10, // New feature
      totalAmount: 9800000 // After discount
    }
  })
  
  expect(quotation.discount).toBe(10)
  expect(quotation.totalAmount).toBe(9800000)
  
  await prisma.quotation.delete({ where: { id: quotation.id } })
})
```

## Troubleshooting

### Tests are slow
- Normal for integration tests (they use real DB and migrations)

### Tests fail randomly
- Check database connection
- Ensure proper cleanup (afterAll hooks)

### Connection errors
- Tests use `.env` (same DB as local dev: `DATABASE_URL_LOCAL` or `DATABASE_URL`). Ensure your DB is reachable.
- Check if PostgreSQL is running

## Files

- `tests/critical/adjustment-persistence.test.ts` - Quotation adjustment fields
- `tests/critical/optimistic-locking.test.ts` - Concurrent edits
- `tests/critical/pdf-generation.test.tsx` - **Quotation/Invoice + BAST PDF (Paragon/Erha)** ⭐
- `tests/critical/paragon-erha-persistence.test.ts` - **Paragon & Erha BAST contact + adjustment** ⭐
