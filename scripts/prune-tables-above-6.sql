-- One-off cleanup: reduces table count from 30 down to 6 on a database that was
-- seeded before this change. Removes tables 7+ and all their historical
-- sessions/orders/order_items/daily_revenue rows. Safe to run multiple times
-- (no-op once tables 7+ no longer exist).

-- Detach any table's current session pointer first to avoid dangling references
-- once we delete the sessions rows below.
UPDATE tables SET current_session_id = NULL WHERE number > 6;

DELETE FROM order_items WHERE order_id IN (
  SELECT id FROM orders WHERE table_id IN (SELECT id FROM tables WHERE number > 6)
);

DELETE FROM daily_revenue WHERE table_id IN (SELECT id FROM tables WHERE number > 6);

DELETE FROM orders WHERE table_id IN (SELECT id FROM tables WHERE number > 6);

DELETE FROM sessions WHERE table_id IN (SELECT id FROM tables WHERE number > 6);

DELETE FROM tables WHERE number > 6;
