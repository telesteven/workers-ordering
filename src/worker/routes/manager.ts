import { Hono } from "hono";
import type { Env } from "../types";
import { requireRole } from "../lib/auth";
import { today } from "../lib/db";
import { generateToken, kvTokenKey, type TokenPointer } from "../lib/tokens";

export const managerRoutes = new Hono<{ Bindings: Env }>();

interface TableStatusRow {
  table_id: number;
  table_number: number;
  table_status: string;
  session_id: number | null;
  session_status: string | null;
  pending_total_cents: number | null;
  pending_order_count: number | null;
}

// Manager: per-table current pending order status + running total (unbilled)
managerRoutes.get("/tables", async (c) => {
  if (!(await requireRole(c, "manager"))) return c.json({ error: "Unauthorized" }, 401);

  const res = await c.env.DB.prepare(
    `SELECT t.id AS table_id, t.number AS table_number, t.status AS table_status,
            s.id AS session_id, s.status AS session_status,
            COALESCE(SUM(oi.qty * oi.price_cents_at_order), 0) AS pending_total_cents,
            COUNT(DISTINCT o.id) AS pending_order_count
     FROM tables t
     LEFT JOIN sessions s ON s.id = t.current_session_id AND s.status = 'active'
     LEFT JOIN orders o ON o.session_id = s.id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     GROUP BY t.id
     ORDER BY t.number`
  ).all<TableStatusRow>();

  return c.json({ tables: res.results ?? [] });
});

// Manager: bill/close a table's current session, record revenue, regenerate QR
managerRoutes.post("/tables/:number/bill", async (c) => {
  if (!(await requireRole(c, "manager"))) return c.json({ error: "Unauthorized" }, 401);
  const number = Number(c.req.param("number"));

  const table = await c.env.DB.prepare("SELECT * FROM tables WHERE number = ?")
    .bind(number)
    .first<{ id: number; current_session_id: number | null }>();
  if (!table || !table.current_session_id) {
    return c.json({ error: "No active session for this table" }, 404);
  }

  const totalRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(oi.qty * oi.price_cents_at_order), 0) AS total_cents
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.session_id = ?`
  )
    .bind(table.current_session_id)
    .first<{ total_cents: number }>();
  const totalCents = totalRow?.total_cents ?? 0;

  await c.env.DB.prepare("UPDATE sessions SET status = 'billed', billed_at = datetime('now') WHERE id = ?")
    .bind(table.current_session_id)
    .run();

  await c.env.DB.prepare(
    "INSERT INTO daily_revenue (date, table_id, session_id, total_cents) VALUES (?, ?, ?, ?)"
  )
    .bind(today(), table.id, table.current_session_id, totalCents)
    .run();

  // Regenerate QR: new session/token, old token becomes invalid automatically
  // (KV entry for old token is left to expire naturally; session status check blocks reuse)
  const newToken = generateToken();
  const newSession = await c.env.DB.prepare(
    "INSERT INTO sessions (table_id, token, status) VALUES (?, ?, 'active') RETURNING id"
  )
    .bind(table.id, newToken)
    .first<{ id: number }>();
  const newSessionId = newSession?.id;
  if (!newSessionId) return c.json({ error: "Failed to create new session" }, 500);

  await c.env.DB.prepare("UPDATE tables SET current_session_id = ?, status = 'idle' WHERE id = ?")
    .bind(newSessionId, table.id)
    .run();

  const pointer: TokenPointer = { tableId: table.id, sessionId: newSessionId };
  await c.env.KV.put(kvTokenKey(newToken), JSON.stringify(pointer));

  return c.json({ ok: true, billed_total_cents: totalCents, new_token: newToken });
});

// Manager: revenue dashboard for a given date (defaults to today)
managerRoutes.get("/revenue", async (c) => {
  if (!(await requireRole(c, "manager"))) return c.json({ error: "Unauthorized" }, 401);
  const date = c.req.query("date") ?? today();

  const perTable = await c.env.DB.prepare(
    `SELECT t.number AS table_number, COALESCE(SUM(dr.total_cents), 0) AS total_cents
     FROM tables t
     LEFT JOIN daily_revenue dr ON dr.table_id = t.id AND dr.date = ?
     GROUP BY t.id
     ORDER BY t.number`
  )
    .bind(date)
    .all();

  const grandTotal = await c.env.DB.prepare(
    "SELECT COALESCE(SUM(total_cents), 0) AS total_cents FROM daily_revenue WHERE date = ?"
  )
    .bind(date)
    .first<{ total_cents: number }>();

  return c.json({
    date,
    per_table: perTable.results ?? [],
    grand_total_cents: grandTotal?.total_cents ?? 0,
  });
});
