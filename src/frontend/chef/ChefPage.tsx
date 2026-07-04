import { useEffect, useState } from "react";
import { api, formatCents } from "../shared/api";
import { useLogin } from "../shared/useLogin";
import LoginForm from "../shared/LoginForm";

interface MenuItem {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  image_key: string | null;
  is_available: number;
}

interface PendingGroup {
  menu_item_id: number;
  name: string;
  total_qty: number;
  tables: { table_number: number; qty: number; order_id: number }[];
}

const PENDING_POLL_MS = 5000;

export default function ChefPage() {
  const { loggedIn, error, login, logout } = useLogin("chef");

  if (loggedIn === null) return <div className="p-8">Loading...</div>;
  if (!loggedIn) return <LoginForm role="chef" onSubmit={login} error={error} />;

  return <ChefDashboard onLogout={logout} />;
}

function ChefDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"pending" | "menu">("pending");

  return (
    <div className="max-w-3xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Chef Dashboard</h1>
        <button onClick={onLogout} className="text-sm text-slate-500 underline">
          Log out
        </button>
      </header>
      <div className="flex gap-2 mb-6">
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
          Pending Orders
        </TabButton>
        <TabButton active={tab === "menu"} onClick={() => setTab("menu")}>
          Menu Management
        </TabButton>
      </div>
      {tab === "pending" ? <PendingOrders /> : <MenuManagement />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium ${
        active ? "bg-orange-600 text-white" : "bg-slate-200 text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function PendingOrders() {
  const [groups, setGroups] = useState<PendingGroup[]>([]);

  async function refresh() {
    try {
      const res = await api.get<{ groups: PendingGroup[] }>("/chef/orders/pending");
      setGroups(res.groups);
    } catch {
      // ignore transient poll errors
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, PENDING_POLL_MS);
    return () => clearInterval(id);
  }, []);

  async function completeOrder(orderId: number) {
    await api.post(`/chef/orders/${orderId}/complete`);
    refresh();
  }

  if (groups.length === 0) {
    return <p className="text-slate-400">No pending orders.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.menu_item_id} className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-lg">{group.name}</h2>
            <span className="text-lg font-bold">x{group.total_qty}</span>
          </div>
          <div className="space-y-1">
            {group.tables.map((t, i) => (
              <div key={`${t.order_id}-${i}`} className="flex items-center justify-between text-sm">
                <span>
                  Table {t.table_number} &middot; qty {t.qty}
                </span>
                <button
                  onClick={() => completeOrder(t.order_id)}
                  className="px-3 py-1 rounded bg-green-600 text-white text-xs font-medium"
                >
                  Completed
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MenuManagement() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const res = await api.get<{ items: MenuItem[] }>("/menu/all");
    setItems(res.items);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addItem() {
    if (!name || !price) return;
    setSaving(true);
    try {
      await api.post("/menu", {
        name,
        description,
        price_cents: Math.round(Number(price) * 100),
      });
      setName("");
      setDescription("");
      setPrice("");
      refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailable(item: MenuItem) {
    await api.put(`/menu/${item.id}`, { is_available: item.is_available === 1 ? false : true });
    refresh();
  }

  async function removeItem(id: number) {
    await api.del(`/menu/${id}`);
    refresh();
  }

  async function uploadImage(id: number, file: File) {
    await fetch(`/api/menu/${id}/image`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": file.type },
      body: file,
    });
    refresh();
  }

  return (
    <div>
      <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
        <h2 className="font-semibold mb-3">Add Meal</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
          <input
            className="border rounded px-3 py-2"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Price (e.g. 8.50)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <button
          disabled={saving}
          onClick={addItem}
          className="px-4 py-2 rounded-lg bg-orange-600 text-white font-medium disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
            {item.image_key && (
              <img
                src={`/api/menu/image/${item.image_key}`}
                alt={item.name}
                className="w-14 h-14 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <div className="font-semibold">{item.name}</div>
              <div className="text-sm text-slate-500">{item.description}</div>
              <div className="text-sm font-medium">{formatCents(item.price_cents)}</div>
            </div>
            <label className="text-xs text-slate-500 cursor-pointer underline">
              Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadImage(item.id, file);
                }}
              />
            </label>
            <button
              onClick={() => toggleAvailable(item)}
              className={`text-xs px-2 py-1 rounded ${
                item.is_available ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
              }`}
            >
              {item.is_available ? "Available" : "Hidden"}
            </button>
            <button onClick={() => removeItem(item.id)} className="text-xs text-red-500 underline">
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
