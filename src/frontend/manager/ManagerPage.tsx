import { useEffect, useState } from "react";
import { api, formatCents } from "../shared/api";
import { useLogin } from "../shared/useLogin";
import LoginForm from "../shared/LoginForm";

interface TableStatus {
  table_id: number;
  table_number: number;
  table_status: string;
  session_id: number | null;
  session_status: string | null;
  pending_total_cents: number | null;
  pending_order_count: number | null;
  uncompleted_order_count: number | null;
}

interface RevenueResponse {
  range: "day" | "week";
  range_start: string;
  range_end: string;
  per_table: { table_number: number; total_cents: number }[];
  grand_total_cents: number;
}

const TABLES_POLL_MS = 5000;
const REVENUE_POLL_MS = 30000;

export default function ManagerPage() {
  const { loggedIn, error, login, logout } = useLogin("manager");

  if (loggedIn === null) return <div className="p-8">Loading...</div>;
  if (!loggedIn) return <LoginForm role="manager" onSubmit={login} error={error} />;

  return <ManagerDashboard onLogout={logout} />;
}

function ManagerDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"tables" | "revenue">("tables");

  return (
    <div className="max-w-4xl mx-auto p-4">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manager Dashboard</h1>
        <button onClick={onLogout} className="text-sm text-slate-500 underline">
          Log out
        </button>
      </header>
      <div className="flex gap-2 mb-6">
        <TabButton active={tab === "tables"} onClick={() => setTab("tables")}>
          Tables
        </TabButton>
        <TabButton active={tab === "revenue"} onClick={() => setTab("revenue")}>
          Revenue
        </TabButton>
      </div>
      {tab === "tables" ? <TablesView /> : <RevenueView />}
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
        active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function TablesView() {
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [qrTable, setQrTable] = useState<number | null>(null);

  async function refresh() {
    try {
      const res = await api.get<{ tables: TableStatus[] }>("/manager/tables");
      setTables(res.tables);
    } catch {
      // ignore transient poll errors
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, TABLES_POLL_MS);
    return () => clearInterval(id);
  }, []);

  async function generateQr(tableNumber: number) {
    await api.post(`/tables/${tableNumber}/qr`);
    setQrTable(tableNumber);
    refresh();
  }

  async function billTable(t: TableStatus) {
    if ((t.uncompleted_order_count ?? 0) > 0) {
      alert(
        `Table ${t.table_number} has ${t.uncompleted_order_count} order(s) not yet completed by the chef. Please complete them before billing.`
      );
      return;
    }
    if (!confirm(`Confirm billing for Table ${t.table_number}? This will close the session and generate a new QR code.`)) {
      return;
    }
    try {
      await api.post(`/manager/tables/${t.table_number}/bill`);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to bill table");
      refresh();
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {tables.map((t) => (
          <div key={t.table_id} className="bg-white rounded-xl p-3 shadow-sm text-center">
            <div className="font-bold text-lg">Table {t.table_number}</div>
            <div className="text-xs text-slate-500 mb-2 capitalize">{t.table_status}</div>
            <div className="text-sm mb-1">
              {t.pending_order_count ?? 0} order(s) &middot; {formatCents(t.pending_total_cents ?? 0)}
            </div>
            {(t.uncompleted_order_count ?? 0) > 0 && (
              <div className="text-xs text-amber-600 font-medium mb-2">
                {t.uncompleted_order_count} not completed by chef
              </div>
            )}
            <div className="flex flex-col gap-1">
              <button
                onClick={() => generateQr(t.table_number)}
                className="text-xs px-2 py-1 rounded bg-slate-800 text-white"
              >
                {t.session_id ? "Regenerate QR" : "Generate QR"}
              </button>
              <button
                onClick={() => billTable(t)}
                disabled={!t.pending_order_count}
                className="text-xs px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-40"
              >
                Bill / Close
              </button>
            </div>
          </div>
        ))}
      </div>

      {qrTable !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" onClick={() => setQrTable(null)}>
          <div className="bg-white rounded-xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold mb-3">Table {qrTable} QR Code</h2>
            <img src={`/api/tables/${qrTable}/qr.svg`} alt={`QR for table ${qrTable}`} className="w-64 h-64" />
            <button onClick={() => setQrTable(null)} className="mt-3 text-sm underline text-slate-500">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RevenueView() {
  const [range, setRange] = useState<"day" | "week">("day");
  const [revenue, setRevenue] = useState<RevenueResponse | null>(null);

  async function refresh(currentRange: "day" | "week") {
    try {
      const res = await api.get<RevenueResponse>(`/manager/revenue?range=${currentRange}`);
      setRevenue(res);
    } catch {
      // ignore transient poll errors
    }
  }

  useEffect(() => {
    setRevenue(null);
    refresh(range);
    const id = setInterval(() => refresh(range), REVENUE_POLL_MS);
    return () => clearInterval(id);
  }, [range]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <TabButton active={range === "day"} onClick={() => setRange("day")}>
          Today
        </TabButton>
        <TabButton active={range === "week"} onClick={() => setRange("week")}>
          This Week
        </TabButton>
      </div>

      {!revenue ? (
        <div>Loading revenue...</div>
      ) : (
        <>
          <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
            <div className="text-sm text-slate-500">
              {revenue.range === "week"
                ? `Total revenue for ${revenue.range_start} to ${revenue.range_end}`
                : `Total revenue for ${revenue.range_start}`}
            </div>
            <div className="text-3xl font-bold">{formatCents(revenue.grand_total_cents)}</div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {revenue.per_table.map((t) => (
              <div key={t.table_number} className="bg-white rounded-xl p-3 shadow-sm text-center">
                <div className="font-semibold">Table {t.table_number}</div>
                <div className="text-sm">{formatCents(t.total_cents)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
