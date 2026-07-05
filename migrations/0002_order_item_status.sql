-- Track completion per order item (not just per order), since a single order can contain
-- multiple different meals and the chef must be able to complete them independently.
ALTER TABLE order_items ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'; -- pending | completed
ALTER TABLE order_items ADD COLUMN completed_at TEXT;

-- Backfill: items belonging to an already-completed order inherit that order's completion time.
UPDATE order_items
SET status = 'completed',
    completed_at = (SELECT completed_at FROM orders WHERE orders.id = order_items.order_id)
WHERE order_id IN (SELECT id FROM orders WHERE status = 'completed');
