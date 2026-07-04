import { Hono } from "hono";
import type { Env } from "../types";
import { createSessionCookie, clearSessionCookie, getSessionRole } from "../lib/auth";

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.post("/login", async (c) => {
  const body = await c.req.json<{ role: "chef" | "manager"; password: string }>().catch(() => null);
  if (!body || (body.role !== "chef" && body.role !== "manager")) {
    return c.json({ error: "Invalid request" }, 400);
  }
  const expected = body.role === "chef" ? c.env.CHEF_PASSWORD : c.env.MANAGER_PASSWORD;
  if (!expected || body.password !== expected) {
    return c.json({ error: "Invalid password" }, 401);
  }
  await createSessionCookie(c, body.role);
  return c.json({ ok: true, role: body.role });
});

authRoutes.post("/logout", async (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const role = await getSessionRole(c);
  return c.json({ role });
});
