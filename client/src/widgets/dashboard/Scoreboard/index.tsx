import { lazy } from "react";
import { registerWidget } from "../../registry";

registerWidget({
  id: "dashboard.scoreboard",
  name: "Scoreboard",
  description: "Final scores for the current week",
  component: lazy(() => import("./Widget")),
  defaultSize: { w: 4, h: 1 },
  tags: ["dashboard", "matchups"],
});
