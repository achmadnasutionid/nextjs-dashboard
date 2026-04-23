-- AlterTable
ALTER TABLE "ErhaTicket" DROP COLUMN "adjustmentIsTax";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "adjustmentIsTax";

-- AlterTable
ALTER TABLE "ParagonTicket" DROP COLUMN "adjustmentIsTax";

-- AlterTable
ALTER TABLE "Quotation" DROP COLUMN "adjustmentIsTax";

-- CreateTable
CREATE TABLE "BarclayTicket" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL DEFAULT '',
    "invoiceId" TEXT NOT NULL DEFAULT '',
    "companyName" TEXT NOT NULL,
    "companyAddress" TEXT NOT NULL,
    "companyCity" TEXT NOT NULL,
    "companyProvince" TEXT NOT NULL,
    "companyPostalCode" TEXT,
    "companyTelp" TEXT,
    "companyEmail" TEXT,
    "productionDate" TIMESTAMP(3) NOT NULL,
    "quotationDate" TIMESTAMP(3) NOT NULL,
    "invoiceBastDate" TIMESTAMP(3) NOT NULL,
    "billTo" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "contactPosition" TEXT NOT NULL,
    "bastContactPerson" TEXT,
    "bastContactPosition" TEXT,
    "signatureName" TEXT NOT NULL,
    "signatureRole" TEXT,
    "signatureImageData" TEXT NOT NULL,
    "finalWorkImageData" TEXT,
    "pph" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "adjustmentPercentage" DOUBLE PRECISION,
    "adjustmentNotes" TEXT,
    "termsAndConditions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "generatedInvoiceId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarclayTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarclayTicketItem" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarclayTicketItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarclayTicketItemDetail" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarclayTicketItemDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarclayTicketRemark" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarclayTicketRemark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BarclayTicket_ticketId_key" ON "BarclayTicket"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "BarclayTicket_quotationId_key" ON "BarclayTicket"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "BarclayTicket_invoiceId_key" ON "BarclayTicket"("invoiceId");

-- CreateIndex
CREATE INDEX "BarclayTicket_status_deletedAt_idx" ON "BarclayTicket"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "BarclayTicket_ticketId_idx" ON "BarclayTicket"("ticketId");

-- CreateIndex
CREATE INDEX "BarclayTicket_updatedAt_idx" ON "BarclayTicket"("updatedAt");

-- CreateIndex
CREATE INDEX "BarclayTicket_productionDate_status_deletedAt_idx" ON "BarclayTicket"("productionDate", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "BarclayTicket_status_updatedAt_deletedAt_idx" ON "BarclayTicket"("status", "updatedAt", "deletedAt");

-- CreateIndex
CREATE INDEX "BarclayTicket_companyName_status_deletedAt_idx" ON "BarclayTicket"("companyName", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "BarclayTicket_deletedAt_updatedAt_idx" ON "BarclayTicket"("deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "BarclayTicket_productionDate_deletedAt_idx" ON "BarclayTicket"("productionDate", "deletedAt");

-- CreateIndex
CREATE INDEX "BarclayTicketItem_ticketId_idx" ON "BarclayTicketItem"("ticketId");

-- CreateIndex
CREATE INDEX "BarclayTicketItem_ticketId_order_idx" ON "BarclayTicketItem"("ticketId", "order");

-- CreateIndex
CREATE INDEX "BarclayTicketItemDetail_itemId_idx" ON "BarclayTicketItemDetail"("itemId");

-- CreateIndex
CREATE INDEX "BarclayTicketRemark_ticketId_idx" ON "BarclayTicketRemark"("ticketId");

-- CreateIndex
CREATE INDEX "BarclayTicketRemark_ticketId_order_idx" ON "BarclayTicketRemark"("ticketId", "order");

-- AddForeignKey
ALTER TABLE "BarclayTicketItem" ADD CONSTRAINT "BarclayTicketItem_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "BarclayTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarclayTicketItemDetail" ADD CONSTRAINT "BarclayTicketItemDetail_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BarclayTicketItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarclayTicketRemark" ADD CONSTRAINT "BarclayTicketRemark_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "BarclayTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

