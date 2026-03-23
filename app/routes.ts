import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/addstore",           "routes/addstore.tsx"),
  route("/store/:id",          "routes/store.tsx"),
  route("/store/:id/edit",     "routes/editstore.tsx"),
  route("/invite/:token",      "routes/invite.tsx"),
] satisfies RouteConfig;