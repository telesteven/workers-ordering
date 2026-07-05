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
     WHERE oi.status = 'pending'
     ORDER BY o.created_at`
  ).all<PendingItemRow>();

  const rows = res.results ?? [];
  const groups = new Map<
    number,
    {
      menu_item_id: number;
      name: string;
      total_qty: number;
      tables: { table_number: number; qty: number; order_id: number; order_item_id: number }[];
    }
  >();

  for (const row of rows) {
    let group = groups.get(row.menu_item_id);
    if (!group) {
      group = { menu_item_id: row.menu_item_id, name: row.name, total_qty: 0, tables: [] };
      groups.set(row.menu_item_id, group);
    }
    group.total_qty += row.qty;
    group.tables.push({
      table_number: row.table_number,
      qty: row.qty,
      order_id: row.order_id,
      order_item_id: row.order_item_id,
    });
  }

  return c.json({ groups: Array.from(groups.values()) });
});

// If every item in an order is now completed, mark the parent order completed too
// (keeps orders.status accurate for anything still relying on order-level status).
async function syncOrderStatusIfComplete(env: Env, orderId: number): Promise<void> {
  const remaining = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM order_items WHERE order_id = ? AND status = 'pending'"
  )
    .bind(orderId)
    .first<{ count: number }>();
  if ((remaining?.count ?? 0) === 0) {
    await env.DB.prepare("UPDATE orders SET status = 'completed', completed_at = datetime('now') WHERE id = ?")
      .bind(orderId)
      .run();
  }
}

// Chef: mark all pending order items for a table complete (bulk action)
chefRoutes.post("/orders/table/:tableNumber/complete", async (c) => {
  if (!(await requireRole(c, "chef"))) return c.json({ error: "Unauthorized" }, 401);
  const tableNumber = Number(c.req.param("tableNumber"));

  const affectedOrders = await c.env.DB.prepare(
    `SELECT DISTINCT o.id FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE oi.status = 'pending' AND o.table_id = (SELECT id FROM tables WHERE number = ?)`
  )
    .bind(tableNumber)
    .all<{ id: number }>();

  await c.env.DB.prepare(
    `UPDATE order_items SET status = 'completed', completed_at = datetime('now')
     WHERE status = 'pending'
       AND order_id IN (SELECT id FROM orders WHERE table_id = (SELECT id FROM tables WHERE number = ?))`
  )
    .bind(tableNumber)
    .run();

  for (const row of affectedOrders.results ?? []) {
    await syncOrderStatusIfComplete(c.env, row.id);
  }

  return c.json({ ok: true });
});

// Chef: mark a single order item complete (does not affect other items/meals in the same order)
chefRoutes.post("/order-items/:orderItemId/complete", async (c) => {
  if (!(await requireRole(c, "chef"))) return c.json({ error: "Unauthorized" }, 401);
  const orderItemId = Number(c.req.param("orderItemId"));

  const item = await c.env.DB.prepare("SELECT order_id FROM order_items WHERE id = ?")
    .bind(orderItemId)
    .first<{ order_id: number }>();
  if (!item) return c.json({ error: "Order item not found" }, 404);

  await c.env.DB.prepare(
    "UPDATE order_items SET status = 'completed', completed_at = datetime('now') WHERE id = ?"
  )
    .bind(orderItemId)
    .run();

  await syncOrderStatusIfComplete(c.env, item.order_id);

  return c.json({ ok: true });
});
