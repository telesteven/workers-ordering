import { Hono } from "hono";
import type { Env } from "../types";
import { requireRole } from "../lib/auth";

export const chefRoutes = new Hono<{ Bindings: Env }>();

interface PendingItemRow {
  menu_item_id: number;
  name: string;
  qty: number;
  table_number: number;
  order_id: number;
  order_item_id: number;
  created_at: string;
}

// Chef: pending order items grouped by menu item, with table breakdown
chefRoutes.get("/orders/pending", async (c) => {
  if (!(await requireRole(c, "chef"))) return c.json({ error: "Unauthorized" }, 401);

  const res = await c.env.DB.prepare(
    `SELECT oi.menu_item_id, oi.name_at_order AS name, oi.qty,
            t.number AS table_number, o.id AS order_id, oi.id AS order_item_id, o.created_at
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN tables t ON t.id = o.table_id
     WHERE o.status = 'pending'
     ORDER BY o.created_at`
  ).all<PendingItemRow>();

  const rows = res.results ?? [];
  const groups = new Map<
    number,
    { menu_item_id: number; name: string; total_qty: number; tables: { table_number: number; qty: number; order_id: number }[] }
  >();

  for (const row of rows) {
    let group = groups.get(row.menu_item_id);
    if (!group) {
      group = { menu_item_id: row.menu_item_id, name: row.name, total_qty: 0, tables: [] };
      groups.set(row.menu_item_id, group);
    }
    group.total_qty += row.qty;
    group.tables.push({ table_number: row.table_number, qty: row.qty, order_id: row.order_id });
  }

  return c.json({ groups: Array.from(groups.values()) });
});

// Chef: mark all pending orders for a table complete
chefRoutes.post("/orders/table/:tableNumber/complete", async (c) => {
  if (!(await requireRole(c, "chef"))) return c.json({ error: "Unauthorized" }, 401);
  const tableNumber = Number(c.req.param("tableNumber"));
  await c.env.DB.prepare(
    `UPDATE orders SET status = 'completed', completed_at = datetime('now')
     WHERE status = 'pending' AND table_id = (SELECT id FROM tables WHERE number = ?)`
  )
    .bind(tableNumber)
    .run();
  return c.json({ ok: true });
});

// Chef: mark a single order complete
chefRoutes.post("/orders/:orderId/complete", async (c) => {
  if (!(await requireRole(c, "chef"))) return c.json({ error: "Unauthorized" }, 401);
  const orderId = Number(c.req.param("orderId"));
  await c.env.DB.prepare(
    "UPDATE orders SET status = 'completed', completed_at = datetime('now') WHERE id = ?"
  )
    .bind(orderId)
    .run();
  return c.json({ ok: true });
});
