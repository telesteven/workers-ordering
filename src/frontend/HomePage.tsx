import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">QR Table Ordering — Demo</h1>
      <p className="text-slate-600 max-w-md text-center">
        Customers order via a per-table QR code. Staff use the dashboards below.
      </p>
      <div className="flex gap-4">
        <Link to="/chef" className="px-4 py-2 rounded-lg bg-orange-600 text-white font-medium">
          Chef Dashboard
        </Link>
        <Link to="/manager" className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium">
          Manager Dashboard
        </Link>
      </div>
      <p className="text-sm text-slate-400">
        Customer ordering pages are reached via <code>/order/&lt;table&gt;?token=...</code> from a
        table's QR code, generated in the Manager Dashboard.
      </p>
    </div>
  );
}
