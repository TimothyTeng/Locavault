import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/addstore",           "routes/addstore.tsx"),
  route("/store/:id",          "routes/store.tsx"),
  route("/store/:id/edit",     "routes/editstore.tsx"),
  route("/invite/:token",      "routes/invite.tsx"),
  route("/templates",          "routes/templates.tsx"),
  route("/templates/new",      "routes/templates.new.tsx"),
  route("/trade",              "routes/trade.tsx"),
  route("/api/barcode",        "routes/api.barcode.ts"),
] satisfies RouteConfig;