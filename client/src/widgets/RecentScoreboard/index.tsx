import { lazy } from "react";
import { registerWidget } from "../registry";

registerWidget({
  id: "recent-scoreboard",
  name: "Recent Scoreboard",
  description: "Most recent week's matchups and scores",
  component: lazy(() => import("./RecentScoreboardWidget")),
  defaultSize: { w: 8, h: 1 },
  tags: ["sleeper", "matchups"],
});
