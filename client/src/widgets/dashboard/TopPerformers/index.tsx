import { lazy } from "react";
import { registerWidget } from "../../registry";

registerWidget({
  id: "dashboard.top-performers",
  name: "Top Performers",
  description: "Highest fantasy scorers this week",
  component: lazy(() => import("./Widget")),
  defaultSize: { w: 12, h: 1 },
  tags: ["dashboard"],
});
