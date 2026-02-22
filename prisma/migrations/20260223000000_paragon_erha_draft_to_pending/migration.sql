-- Migrate existing Paragon and Erha tickets from draft to pending
-- (Paragon/Erha only have draft and final in UI; we treat "not final" as pending for lists and totals)
UPDATE "ParagonTicket" SET status = 'pending' WHERE status = 'draft' AND "deletedAt" IS NULL;
UPDATE "ErhaTicket" SET status = 'pending' WHERE status = 'draft' AND "deletedAt" IS NULL;
