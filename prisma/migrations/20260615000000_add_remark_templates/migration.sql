-- CreateTable
CREATE TABLE "RemarkTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemarkTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemarkTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemarkTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RemarkTemplate_name_key" ON "RemarkTemplate"("name");

-- CreateIndex
CREATE INDEX "RemarkTemplate_deletedAt_idx" ON "RemarkTemplate"("deletedAt");

-- CreateIndex
CREATE INDEX "RemarkTemplateItem_templateId_idx" ON "RemarkTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "RemarkTemplateItem_templateId_order_idx" ON "RemarkTemplateItem"("templateId", "order");

-- AddForeignKey
ALTER TABLE "RemarkTemplateItem" ADD CONSTRAINT "RemarkTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RemarkTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default templates
INSERT INTO "RemarkTemplate" ("id", "name", "createdAt", "updatedAt") VALUES
  ('clremarkdefault0000000000', 'Default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clremarkparagbarclay00000', 'Paragon & Barclay', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "RemarkTemplateItem" ("id", "templateId", "text", "order", "createdAt", "updatedAt") VALUES
  ('clrdi0001', 'clremarkdefault0000000000', 'Terms & Conditions :', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clrdi0002', 'clremarkdefault0000000000', '* Overtime Production Shooting Day 10 % dari Fee invoice', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clrdi0003', 'clremarkdefault0000000000', '* Quotation is valid for 7 days from the issue date.', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clrdi0004', 'clremarkdefault0000000000', '* 50% down payment must be paid at least 1 day before the first project meeting. The remaining 50% is paid after the project is finished.', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clrdi0005', 'clremarkdefault0000000000', '* More than 3 revisions per frame will be charged extra.', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clrdi0006', 'clremarkdefault0000000000', 'Penalty will be applied if client use our Photo & Videshoot without our consent for printed media placement outside the initial agreement :', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clrdi0007', 'clremarkdefault0000000000', '* Small Ussage ( Flyer, Katalog, Brosur, Kupon, Kotak Gift, Booklet PR Package, Kartu Ucapan ) 15% dari invoice awal', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clrdi0008', 'clremarkdefault0000000000', '* Medium Ussage (POP, TV Store, TV Led Instore, both, bazaar, Backwall, Wobler, add 20%', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clrdi0009', 'clremarkdefault0000000000', '* Big Print (Billboard, OOH Outdoor, LED Screen Outdoor, Megatron, Umbull, dll) 50% + tnc berlanjut', 8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clrdi0010', 'clremarkdefault0000000000', '* Additional overseas media placement (digital and printed) will be charged .(bisa di edit) % of total', 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clrpb0001', 'clremarkparagbarclay00000', 'CV CATA KARYA ABADI', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clrpb0002', 'clremarkparagbarclay00000', 'Bank BCA 3190254711 an CV CATA KARYA ABADI', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('clrpb0003', 'clremarkparagbarclay00000', 'NO NPWP CV : 99.971.897.6-451.000', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
