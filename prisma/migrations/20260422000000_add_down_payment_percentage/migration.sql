ALTER TABLE "Quotation"
ADD COLUMN IF NOT EXISTS "downPaymentPercentage" DOUBLE PRECISION;

ALTER TABLE "Invoice"
ADD COLUMN IF NOT EXISTS "downPaymentPercentage" DOUBLE PRECISION;

ALTER TABLE "Quotation"
ALTER COLUMN "summaryOrder" SET DEFAULT 'subtotal,pph,downPayment,total';

ALTER TABLE "Invoice"
ALTER COLUMN "summaryOrder" SET DEFAULT 'subtotal,pph,downPayment,total';
