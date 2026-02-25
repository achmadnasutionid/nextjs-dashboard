-- AlterTable
ALTER TABLE "ProductionTracker" ADD COLUMN IF NOT EXISTS "cellNotes" JSONB DEFAULT '{}';
