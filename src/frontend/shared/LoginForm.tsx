import { useState } from "react";

export default function LoginForm({
  role,
  onSubmit,
  error,
}: {
  role: "chef" | "manager";
  onSubmit: (password: string) => void;
  error: string | null;
}) {
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <form
        className="bg-white rounded-xl p-6 shadow-sm w-full max-w-sm space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(password);
        }}
      >
        <h1 className="text-xl font-bold capitalize">{role} Login</h1>
        <input
          type="password"
          className="border rounded px-3 py-2 w-full"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="w-full px-4 py-2 rounded-lg bg-slate-900 text-white font-medium">
          Log in
        </button>
      </form>
    </div>
  );
}
