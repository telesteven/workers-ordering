import { Hono } from "hono";
import type { Env } from "../types";
import { requireRole } from "../lib/auth";
import { listMenuItems } from "../lib/db";

export const menuRoutes = new Hono<{ Bindings: Env }>();

const MENU_CACHE_KEY = "menu_cache_v1";

// Public: list available menu items (customer-facing), cached briefly in KV
menuRoutes.get("/", async (c) => {
  const cached = await c.env.KV.get(MENU_CACHE_KEY);
  if (cached) return c.json(JSON.parse(cached));
  const items = await listMenuItems(c.env, true);
  const payload = { items };
  await c.env.KV.put(MENU_CACHE_KEY, JSON.stringify(payload), { expirationTtl: 60 });
  return c.json(payload);
});

// Chef: list all menu items (including unavailable)
menuRoutes.get("/all", async (c) => {
  if (!(await requireRole(c, "chef"))) return c.json({ error: "Unauthorized" }, 401);
  const items = await listMenuItems(c.env, false);
  return c.json({ items });
});

async function invalidateMenuCache(env: Env) {
  await env.KV.delete(MENU_CACHE_KEY);
}

menuRoutes.post("/", async (c) => {
  if (!(await requireRole(c, "chef"))) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req
    .json<{ name: string; description?: string; price_cents: number; is_available?: boolean }>()
    .catch(() => null);
  if (!body || !body.name || !Number.isFinite(body.price_cents)) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const row = await c.env.DB.prepare(
    "INSERT INTO menu_items (name, description, price_cents, is_available) VALUES (?, ?, ?, ?) RETURNING *"
  )
    .bind(body.name, body.description ?? null, body.price_cents, body.is_available === false ? 0 : 1)
    .first();
  await invalidateMenuCache(c.env);
  return c.json({ item: row }, 201);
});

menuRoutes.put("/:id", async (c) => {
  if (!(await requireRole(c, "chef"))) return c.json({ error: "Unauthorized" }, 401);
  const id = Number(c.req.param("id"));
  const body = await c.req
    .json<{ name?: string; description?: string; price_cents?: number; is_available?: boolean }>()
    .catch(() => null);
  if (!body) return c.json({ error: "Invalid payload" }, 400);

  const existing = await c.env.DB.prepare("SELECT * FROM menu_items WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  await c.env.DB.prepare(
    `UPDATE menu_items SET
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       price_cents = COALESCE(?, price_cents),
       is_available = COALESCE(?, is_available)
     WHERE id = ?`
  )
    .bind(
      body.name ?? null,
      body.description ?? null,
      body.price_cents ?? null,
      body.is_available === undefined ? null : body.is_available ? 1 : 0,
      id
    )
    .run();
  await invalidateMenuCache(c.env);
  const updated = await c.env.DB.prepare("SELECT * FROM menu_items WHERE id = ?").bind(id).first();
  return c.json({ item: updated });
});

menuRoutes.delete("/:id", async (c) => {
  if (!(await requireRole(c, "chef"))) return c.json({ error: "Unauthorized" }, 401);
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare("DELETE FROM menu_items WHERE id = ?").bind(id).run();
  await invalidateMenuCache(c.env);
  return c.json({ ok: true });
});

// Chef: upload a meal image to R2
menuRoutes.post("/:id/image", async (c) => {
  if (!(await requireRole(c, "chef"))) return c.json({ error: "Unauthorized" }, 401);
  const id = Number(c.req.param("id"));
  const item = await c.env.DB.prepare("SELECT * FROM menu_items WHERE id = ?").bind(id).first();
  if (!item) return c.json({ error: "Not found" }, 404);

  const contentType = c.req.header("content-type") ?? "application/octet-stream";
  const body = await c.req.arrayBuffer();
  const key = `menu/${id}-${Date.now()}`;
  await c.env.MEAL_IMAGES.put(key, body, { httpMetadata: { contentType } });
  await c.env.DB.prepare("UPDATE menu_items SET image_key = ? WHERE id = ?").bind(key, id).run();
  await invalidateMenuCache(c.env);
  return c.json({ ok: true, image_key: key });
});

// Public: serve meal image from R2
menuRoutes.get("/image/*", async (c) => {
  const key = c.req.path.replace(/^\/api\/menu\/image\//, "");
  const obj = await c.env.MEAL_IMAGES.get(key);
  if (!obj) return c.text("Not found", 404);
  return c.body(obj.body, 200, {
    "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
    "Cache-Control": "public, max-age=3600",
  });
});
