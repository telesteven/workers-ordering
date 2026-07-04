import { Hono } from "hono";
import type { Env } from "./types";
import { authRoutes } from "./routes/auth";
import { tableRoutes } from "./routes/tables";
import { menuRoutes } from "./routes/menu";
import { orderRoutes } from "./routes/orders";
import { chefRoutes } from "./routes/chef";
import { managerRoutes } from "./routes/manager";

const app = new Hono<{ Bindings: Env }>();

app.route("/api/auth", authRoutes);
app.route("/api/tables", tableRoutes);
app.route("/api/menu", menuRoutes);
app.route("/api/order", orderRoutes);
app.route("/api/chef", chefRoutes);
app.route("/api/manager", managerRoutes);

app.notFound((c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
