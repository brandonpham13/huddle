import { lazy } from "react";
import { registerWidget } from "../../registry";

registerWidget({
  id: "dashboard.league-table",
  name: "League Table",
  description: "Standings sortable by W–L, PF, PA",
  component: lazy(() => import("./Widget")),
  defaultSize: { w: 4, h: 1 },
  tags: ["dashboard", "standings"],
});
