import { flatRoutes } from "@react-router/fs-routes";
import { route } from "@react-router/dev/routes";

export default flatRoutes().then((routeConfig) => {
	const appRoute = routeConfig.find((entry) => entry.file === "routes/app.jsx");

	appRoute.children ??= [];
	appRoute.children.push(
		route("discounts", "routes/discounts/index.jsx"),
		route("discounts/new/:handle", "routes/discounts/new.$handle.jsx"),
		route("discounts/:id", "routes/discounts/$id.jsx"),
	);

	return routeConfig;
});
