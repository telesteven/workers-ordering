export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  MEAL_IMAGES: R2Bucket;
  ASSETS: Fetcher;
  CHEF_PASSWORD: string;
  MANAGER_PASSWORD: string;
  SESSION_SECRET: string;
}

export interface TableRow {
  id: number;
  number: number;
  current_session_id: number | null;
  status: "idle" | "active" | "awaiting_bill";
}

export interface SessionRow {
  id: number;
  table_id: number;
  token: string;
  opened_at: string;
  billed_at: string | null;
  status: "active" | "billed";
}

export interface MenuItemRow {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  image_key: string | null;
  is_available: number;
  created_at: string;
}

export interface OrderRow {
  id: number;
  session_id: number;
  table_id: number;
  status: "pending" | "completed";
  created_at: string;
  completed_at: string | null;
}

export interface OrderItemRow {
  id: number;
  order_id: number;
  menu_item_id: number;
  qty: number;
  price_cents_at_order: number;
  name_at_order: string;
  status: "pending" | "completed";
  completed_at: string | null;
}

export type Role = "chef" | "manager";
