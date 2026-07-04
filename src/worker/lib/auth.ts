import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env, Role } from "../types";

const COOKIE_NAME = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createSessionCookie(
  c: Context<{ Bindings: Env }>,
  role: Role
): Promise<void> {
  const expires = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${role}.${expires}`;
  const sig = await hmac(c.env.SESSION_SECRET, payload);
  const value = `${payload}.${sig}`;
  setCookie(c, COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(c: Context<{ Bindings: Env }>): void {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

export async function getSessionRole(c: Context<{ Bindings: Env }>): Promise<Role | null> {
  const value = getCookie(c, COOKIE_NAME);
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [role, expiresStr, sig] = parts;
  const payload = `${role}.${expiresStr}`;
  const expected = await hmac(c.env.SESSION_SECRET, payload);
  if (expected !== sig) return null;
  const expires = Number(expiresStr);
  if (Number.isNaN(expires) || Date.now() > expires) return null;
  if (role !== "chef" && role !== "manager") return null;
  return role;
}

export async function requireRole(
  c: Context<{ Bindings: Env }>,
  role: Role
): Promise<boolean> {
  const actual = await getSessionRole(c);
  return actual === role;
}
