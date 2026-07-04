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
