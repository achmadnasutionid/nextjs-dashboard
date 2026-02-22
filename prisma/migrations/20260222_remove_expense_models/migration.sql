-- DropForeignKey (ExpenseItem.expenseId -> Expense.id)
ALTER TABLE "ExpenseItem" DROP CONSTRAINT IF EXISTS "ExpenseItem_expenseId_fkey";

-- DropForeignKey (Expense.sourceInvoiceId -> Invoice.id)
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_sourceInvoiceId_fkey";

-- DropTable
DROP TABLE IF EXISTS "ExpenseItem";
DROP TABLE IF EXISTS "Expense";

-- AlterTable Invoice: remove generatedExpenseId
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "generatedExpenseId";
