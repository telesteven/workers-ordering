-- Tables (physical restaurant tables, up to 30)
CREATE TABLE tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number INTEGER NOT NULL UNIQUE,
  current_session_id INTEGER,
  status TEXT NOT NULL DEFAULT 'idle' -- idle | active | awaiting_bill
);

-- Ordering sessions: one per QR-code lifetime for a table
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL REFERENCES tables(id),
  token TEXT NOT NULL UNIQUE,
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  billed_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' -- active | billed
);

CREATE INDEX idx_sessions_table ON sessions(table_id);
CREATE INDEX idx_sessions_token ON sessions(token);

-- Menu items managed by chef
CREATE TABLE menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  image_key TEXT,
  is_available INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Orders placed by customers within a session
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  table_id INTEGER NOT NULL REFERENCES tables(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | completed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX idx_orders_session ON orders(session_id);
CREATE INDEX idx_orders_status ON orders(status);

-- Line items within an order
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  qty INTEGER NOT NULL,
  price_cents_at_order INTEGER NOT NULL,
  name_at_order TEXT NOT NULL
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_menu_item ON order_items(menu_item_id);

-- Revenue recorded when a manager bills/closes a session
CREATE TABLE daily_revenue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL, -- YYYY-MM-DD (UTC)
  table_id INTEGER NOT NULL REFERENCES tables(id),
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  total_cents INTEGER NOT NULL,
  billed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_daily_revenue_date ON daily_revenue(date);
CREATE INDEX idx_daily_revenue_table ON daily_revenue(table_id);
