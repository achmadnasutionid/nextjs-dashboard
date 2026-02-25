-- Replace production tracker status "in progress" with "active"
UPDATE "ProductionTracker"
SET status = 'active'
WHERE status = 'in progress';
