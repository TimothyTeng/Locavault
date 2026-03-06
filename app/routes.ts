import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [index("routes/home.tsx"),
    route('/addstore', 'routes/addstore.tsx'),
    route('/store/:id', 'routes/store.tsx'),
    route('/store/:id/additem', 'routes/additem.tsx'),
    route('/store/:id/update', 'routes/updatestore.tsx'),
] satisfies RouteConfig;
