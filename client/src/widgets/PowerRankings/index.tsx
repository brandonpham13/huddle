import { lazy } from "react";
import { registerWidget } from "../registry";

registerWidget({
  id: "power-rankings",
  name: "Power Rankings",
  description: "Team power rankings across multiple algorithms",
  component: lazy(() => import("./PowerRankingsWidget")),
  defaultSize: { w: 6, h: 1 },
  tags: ["sleeper", "rankings"],
});
