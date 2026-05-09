import { lazy } from "react";
import { registerWidget } from "../../registry";

registerWidget({
  id: "dashboard.power-rankings",
  name: "Power Rankings",
  description: "Composite power index and per-algorithm columns",
  component: lazy(() => import("./Widget")),
  defaultSize: { w: 4, h: 1 },
  tags: ["dashboard", "rankings"],
});
