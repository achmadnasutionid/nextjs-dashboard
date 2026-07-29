-- Reverse link: Invoice -> generated Quotation (mirrors Quotation.generatedInvoiceId / Invoice.sourceQuotationId)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "generatedQuotationId" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "sourceInvoiceId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_generatedQuotationId_key" ON "Invoice"("generatedQuotationId");
CREATE INDEX IF NOT EXISTS "Invoice_generatedQuotationId_idx" ON "Invoice"("generatedQuotationId");

CREATE UNIQUE INDEX IF NOT EXISTS "Quotation_sourceInvoiceId_key" ON "Quotation"("sourceInvoiceId");
CREATE INDEX IF NOT EXISTS "Quotation_sourceInvoiceId_idx" ON "Quotation"("sourceInvoiceId");

ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_sourceInvoiceId_fkey" FOREIGN KEY ("sourceInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
