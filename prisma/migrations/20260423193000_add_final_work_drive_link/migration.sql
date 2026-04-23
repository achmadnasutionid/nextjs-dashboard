-- Add Google Drive link field for final work in special-case tickets
ALTER TABLE "ParagonTicket" ADD COLUMN "finalWorkDriveLink" TEXT;
ALTER TABLE "ErhaTicket" ADD COLUMN "finalWorkDriveLink" TEXT;
ALTER TABLE "BarclayTicket" ADD COLUMN "finalWorkDriveLink" TEXT;
