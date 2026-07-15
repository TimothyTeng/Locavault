import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/addstore", "routes/addstore.tsx"),
  route("/store/:id", "routes/store.tsx"),
  route("/store/:id/edit", "routes/editstore.tsx"),
  route("/invite/:token", "routes/invite.tsx"),
  route("/templates", "routes/templates.tsx"),
  route("/templates/new", "routes/templates.new.tsx"),
  route("/trade", "routes/trade.tsx"),
  route("/reminders", "routes/reminders.tsx"),
  route("/api/barcode", "routes/api.barcode.ts"),
  route("/api/item-history", "routes/api.item-history.ts"),
  route("/api/doses", "routes/api.doses.ts"),
  route("/api/fixtures", "routes/api.fixtures.ts"),
  route("/api/recipes", "routes/api.recipes.ts"),
  route("/api/recipe-import", "routes/api.recipe-import.ts"),
  route("/api/recipe-search", "routes/api.recipe-search.ts"),
] satisfies RouteConfig;
