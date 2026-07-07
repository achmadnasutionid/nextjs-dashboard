-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN "pphDeduction" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "pphDeduction" BOOLEAN NOT NULL DEFAULT false;
