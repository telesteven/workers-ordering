import type { Env, TableRow, SessionRow, MenuItemRow, OrderRow } from "../types";

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTableByNumber(env: Env, number: number): Promise<TableRow | null> {
  const row = await env.DB.prepare("SELECT * FROM tables WHERE number = ?")
    .bind(number)
    .first<TableRow>();
  return row ?? null;
}

export async function getTableById(env: Env, id: number): Promise<TableRow | null> {
  const row = await env.DB.prepare("SELECT * FROM tables WHERE id = ?").bind(id).first<TableRow>();
  return row ?? null;
}

export async function getSessionByToken(env: Env, token: string): Promise<SessionRow | null> {
  const row = await env.DB.prepare("SELECT * FROM sessions WHERE token = ?")
    .bind(token)
    .first<SessionRow>();
  return row ?? null;
}

export async function getSessionById(env: Env, id: number): Promise<SessionRow | null> {
  const row = await env.DB.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first<SessionRow>();
  return row ?? null;
}

export async function listMenuItems(env: Env, onlyAvailable = false): Promise<MenuItemRow[]> {
  const sql = onlyAvailable
    ? "SELECT * FROM menu_items WHERE is_available = 1 ORDER BY name"
    : "SELECT * FROM menu_items ORDER BY name";
  const res = await env.DB.prepare(sql).all<MenuItemRow>();
  return res.results ?? [];
}

export async function getMenuItem(env: Env, id: number): Promise<MenuItemRow | null> {
  const row = await env.DB.prepare("SELECT * FROM menu_items WHERE id = ?").bind(id).first<MenuItemRow>();
  return row ?? null;
}

export async function getPendingOrdersForSession(env: Env, sessionId: number): Promise<OrderRow[]> {
  const res = await env.DB.prepare(
    "SELECT * FROM orders WHERE session_id = ? AND status = 'pending' ORDER BY created_at"
  )
    .bind(sessionId)
    .all<OrderRow>();
  return res.results ?? [];
}
