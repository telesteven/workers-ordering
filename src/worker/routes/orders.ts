import { Hono } from "hono";
import type { Env } from "../types";
import { kvTokenKey, type TokenPointer } from "../lib/tokens";
import { getSessionById, getMenuItem } from "../lib/db";

export const orderRoutes = new Hono<{ Bindings: Env }>();

interface PlaceOrderItem {
  menu_item_id: number;
  qty: number;
}

// Customer: validate a table's QR token and fetch table/session info
orderRoutes.get("/session", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Missing token" }, 400);
  const pointerRaw = await c.env.KV.get(kvTokenKey(token));
  if (!pointerRaw) return c.json({ error: "Invalid or expired QR code" }, 403);
  const pointer = JSON.parse(pointerRaw) as TokenPointer;
  const session = await getSessionById(c.env, pointer.sessionId);
  if (!session || session.status !== "active") {
    return c.json({ error: "This table's session has ended. Please ask staff for a new QR code." }, 403);
  }
  return c.json({ table_id: session.table_id, session_id: session.id });
});

interface OrderWithItemsRow {
  order_id: number;
  status: string;
  created_at: string;
  name: string | null;
  qty: number | null;
  price_cents: number | null;
  item_status: string | null;
}

// Customer: fetch all orders placed so far within this session (so a page refresh
// within the token's validity period still shows what was already ordered)
orderRoutes.get("/orders", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json({ error: "Missing token" }, 400);
  const pointerRaw = await c.env.KV.get(kvTokenKey(token));
  if (!pointerRaw) return c.json({ error: "Invalid or expired QR code" }, 403);
  const pointer = JSON.parse(pointerRaw) as TokenPointer;
  const session = await getSessionById(c.env, pointer.sessionId);
  if (!session) return c.json({ error: "Session not found" }, 404);

  const res = await c.env.DB.prepare(
    `SELECT o.id AS order_id, o.status, o.created_at,
            oi.name_at_order AS name, oi.qty, oi.price_cents_at_order AS price_cents, oi.status AS item_status
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.session_id = ?
     ORDER BY o.created_at, o.id`
  )
    .bind(session.id)
    .all<OrderWithItemsRow>();

  const ordersMap = new Map<
    number,
    {
      order_id: number;
      status: string;
      created_at: string;
      items: { name: string; qty: number; price_cents: number; status: string }[];
    }
  >();
  for (const row of res.results ?? []) {
    let entry = ordersMap.get(row.order_id);
    if (!entry) {
      entry = { order_id: row.order_id, status: row.status, created_at: row.created_at, items: [] };
      ordersMap.set(row.order_id, entry);
    }
    if (row.name) {
      entry.items.push({
        name: row.name,
        qty: row.qty ?? 0,
        price_cents: row.price_cents ?? 0,
        status: row.item_status ?? "pending",
      });
    }
  }

  return c.json({ orders: Array.from(ordersMap.values()) });
});

// Customer: place an order against a valid table token
orderRoutes.post("/", async (c) => {
  const body = await c.req
    .json<{ token: string; items: PlaceOrderItem[] }>()
    .catch(() => null);
  if (!body || !body.token || !Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ error: "Invalid payload" }, 400);
  }

  const pointerRaw = await c.env.KV.get(kvTokenKey(body.token));
  if (!pointerRaw) return c.json({ error: "Invalid or expired QR code" }, 403);
  const pointer = JSON.parse(pointerRaw) as TokenPointer;

  const session = await getSessionById(c.env, pointer.sessionId);
  if (!session || session.status !== "active") {
    return c.json({ error: "This table's session has ended. Please ask staff for a new QR code." }, 403);
  }

  const orderInsert = await c.env.DB.prepare(
    "INSERT INTO orders (session_id, table_id, status) VALUES (?, ?, 'pending') RETURNING id"
  )
    .bind(session.id, session.table_id)
    .first<{ id: number }>();
  const orderId = orderInsert?.id;
  if (!orderId) return c.json({ error: "Failed to create order" }, 500);

  for (const item of body.items) {
    if (!item.menu_item_id || !item.qty || item.qty <= 0) continue;
    const menuItem = await getMenuItem(c.env, item.menu_item_id);
    if (!menuItem) continue;
    await c.env.DB.prepare(
      "INSERT INTO order_items (order_id, menu_item_id, qty, price_cents_at_order, name_at_order) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(orderId, menuItem.id, item.qty, menuItem.price_cents, menuItem.name)
      .run();
  }

  return c.json({ ok: true, order_id: orderId }, 201);
});
