-- AlterTable: add projectName for Paragon (backfill from billTo for existing rows)
ALTER TABLE "ParagonTicket" ADD COLUMN "projectName" TEXT;
UPDATE "ParagonTicket" SET "projectName" = "billTo" WHERE "projectName" IS NULL;
ALTER TABLE "ParagonTicket" ALTER COLUMN "projectName" SET NOT NULL;

-- AlterTable: add projectName for Erha (backfill from billTo for existing rows)
ALTER TABLE "ErhaTicket" ADD COLUMN "projectName" TEXT;
UPDATE "ErhaTicket" SET "projectName" = "billTo" WHERE "projectName" IS NULL;
ALTER TABLE "ErhaTicket" ALTER COLUMN "projectName" SET NOT NULL;
