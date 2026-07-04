import { Hono } from "hono";
import type { Env } from "../types";
import { requireRole } from "../lib/auth";
import { generateToken, kvTokenKey, type TokenPointer } from "../lib/tokens";
import { renderQrSvg } from "../lib/qr";
import { getTableByNumber } from "../lib/db";

export const tableRoutes = new Hono<{ Bindings: Env }>();

// Manager: list all tables with current session/status
tableRoutes.get("/", async (c) => {
  if (!(await requireRole(c, "manager"))) return c.json({ error: "Unauthorized" }, 401);
  const res = await c.env.DB.prepare(
    `SELECT t.id, t.number, t.status, t.current_session_id,
            s.token AS session_token, s.status AS session_status, s.opened_at
     FROM tables t
     LEFT JOIN sessions s ON s.id = t.current_session_id
     ORDER BY t.number`
  ).all();
  return c.json({ tables: res.results ?? [] });
});

// Manager: (re)generate a QR/session for a table
tableRoutes.post("/:number/qr", async (c) => {
  if (!(await requireRole(c, "manager"))) return c.json({ error: "Unauthorized" }, 401);
  const number = Number(c.req.param("number"));
  const table = await getTableByNumber(c.env, number);
  if (!table) return c.json({ error: "Table not found" }, 404);

  const token = generateToken();
  const insert = await c.env.DB.prepare(
    "INSERT INTO sessions (table_id, token, status) VALUES (?, ?, 'active') RETURNING id"
  )
    .bind(table.id, token)
    .first<{ id: number }>();
  const sessionId = insert?.id;
  if (!sessionId) return c.json({ error: "Failed to create session" }, 500);

  await c.env.DB.prepare("UPDATE tables SET current_session_id = ?, status = 'active' WHERE id = ?")
    .bind(sessionId, table.id)
    .run();

  const pointer: TokenPointer = { tableId: table.id, sessionId };
  await c.env.KV.put(kvTokenKey(token), JSON.stringify(pointer));

  const orderUrl = new URL(c.req.url);
  orderUrl.pathname = `/order/${number}`;
  orderUrl.search = `?token=${token}`;

  return c.json({ table: number, token, url: orderUrl.toString(), sessionId });
});

// Manager: get QR SVG for a table's current session
tableRoutes.get("/:number/qr.svg", async (c) => {
  if (!(await requireRole(c, "manager"))) return c.text("Unauthorized", 401);
  const number = Number(c.req.param("number"));
  const table = await getTableByNumber(c.env, number);
  if (!table || !table.current_session_id) return c.text("No active session", 404);
  const session = await c.env.DB.prepare("SELECT token FROM sessions WHERE id = ?")
    .bind(table.current_session_id)
    .first<{ token: string }>();
  if (!session) return c.text("No active session", 404);

  const orderUrl = new URL(c.req.url);
  orderUrl.pathname = `/order/${number}`;
  orderUrl.search = `?token=${session.token}`;

  const svg = await renderQrSvg(orderUrl.toString());
  return c.body(svg, 200, { "Content-Type": "image/svg+xml" });
});
