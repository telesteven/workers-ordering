import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, formatCents } from "../shared/api";

interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  image_key: string | null;
}

interface PlacedOrderItem {
  name: string;
  qty: number;
  price_cents: number;
  status: "pending" | "completed";
}

interface PlacedOrder {
  order_id: number;
  status: "pending" | "completed";
  created_at: string;
  items: PlacedOrderItem[];
}

export default function OrderPage() {
  const { tableNumber } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [sessionValid, setSessionValid] = useState<boolean | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orders, setOrders] = useState<PlacedOrder[]>([]);

  useEffect(() => {
    if (!token) {
      setSessionValid(false);
      setSessionError("Missing QR token. Please scan the table's QR code.");
      return;
    }
    api
      .get(`/order/session?token=${encodeURIComponent(token)}`)
      .then(() => setSessionValid(true))
      .catch((e) => {
        setSessionValid(false);
        setSessionError(e instanceof Error ? e.message : "Invalid session");
      });
  }, [token]);

  useEffect(() => {
    api
      .get<{ items: MenuItem[] }>("/menu")
      .then((res) => setItems(res.items))
      .catch(() => setItems([]));
  }, []);

  async function loadOrders() {
    if (!token) return;
    try {
      const res = await api.get<{ orders: PlacedOrder[] }>(`/order/orders?token=${encodeURIComponent(token)}`);
      setOrders(res.orders);
    } catch {
      // ignore transient errors; existing orders list stays as-is
    }
  }

  // Load previously placed orders as soon as the session is confirmed valid, so a page
  // refresh within the token's validity period still shows what was already ordered.
  useEffect(() => {
    if (sessionValid) loadOrders();
  }, [sessionValid]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + (cart[item.id] ?? 0) * item.price_cents, 0);
  }, [items, cart]);

  function updateQty(id: number, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      return { ...prev, [id]: next };
    });
  }

  async function submitOrder() {
    const orderItems = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([menu_item_id, qty]) => ({ menu_item_id: Number(menu_item_id), qty }));
    if (orderItems.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post("/order", { token, items: orderItems });
      setSubmitted(true);
      setCart({});
      loadOrders();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  }

  if (sessionValid === null) {
    return <Centered>Loading table {tableNumber}...</Centered>;
  }

  if (sessionValid === false) {
    return (
      <Centered>
        <p className="text-red-600 font-medium">{sessionError}</p>
      </Centered>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 pb-32">
      <h1 className="text-2xl font-bold mt-4 mb-1">Table {tableNumber}</h1>
      <p className="text-slate-500 mb-6">Browse the menu and place your order.</p>

      {submitted && (
        <div className="bg-green-100 text-green-800 rounded-lg p-3 mb-4">
          Order submitted! You can add more items or wait for your food.
        </div>
      )}
      {submitError && <div className="bg-red-100 text-red-800 rounded-lg p-3 mb-4">{submitError}</div>}

      {orders.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-2">Your Orders</h2>
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.order_id} className="bg-white rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">
                    {new Date(o.created_at.replace(" ", "T") + "Z").toLocaleTimeString()}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      o.status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {o.status === "completed" ? "Completed" : "Pending"}
                  </span>
                </div>
                <ul className="text-sm text-slate-700 space-y-0.5">
                  {o.items.map((it, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-2">
                      <span>
                        {it.qty} &times; {it.name} &middot; {formatCents(it.qty * it.price_cents)}
                      </span>
                      {it.status === "completed" ? (
                        <span className="text-xs text-green-600">Done</span>
                      ) : (
                        <span className="text-xs text-amber-600">Pending</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
            {item.image_key && (
              <img
                src={`/api/menu/image/${item.image_key}`}
                alt={item.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <div className="font-semibold">{item.name}</div>
              {item.description && <div className="text-sm text-slate-500">{item.description}</div>}
              <div className="text-sm font-medium">{formatCents(item.price_cents)}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="w-8 h-8 rounded-full bg-slate-200 text-lg font-bold"
                onClick={() => updateQty(item.id, -1)}
              >
                -
              </button>
              <span className="w-6 text-center">{cart[item.id] ?? 0}</span>
              <button
                className="w-8 h-8 rounded-full bg-slate-800 text-white text-lg font-bold"
                onClick={() => updateQty(item.id, 1)}
              >
                +
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-slate-400">No menu items available yet.</p>}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex items-center justify-between max-w-xl mx-auto">
        <span className="font-semibold">Total: {formatCents(total)}</span>
        <button
          disabled={total === 0 || submitting}
          onClick={submitOrder}
          className="px-6 py-2 rounded-lg bg-orange-600 text-white font-medium disabled:opacity-50"
        >
          {submitting ? "Placing..." : "Place Order"}
        </button>
      </div>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-8 text-center">{children}</div>;
}
