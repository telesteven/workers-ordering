-- Seed 6 tables (idempotent-ish: run once on a fresh DB)
INSERT INTO tables (number, status)
SELECT value, 'idle' FROM (
  WITH RECURSIVE seq(value) AS (
    SELECT 1
    UNION ALL
    SELECT value + 1 FROM seq WHERE value < 6
  )
  SELECT value FROM seq
);

-- A couple of sample menu items so the demo isn't empty
INSERT INTO menu_items (name, description, price_cents, is_available) VALUES
  ('Fried Rice', 'Wok-fried rice with egg and scallions', 850, 1),
  ('Kung Pao Chicken', 'Spicy stir-fried chicken with peanuts', 1200, 1),
  ('Iced Lemon Tea', 'Refreshing chilled lemon tea', 400, 1);
