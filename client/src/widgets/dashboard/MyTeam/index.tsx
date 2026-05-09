import { lazy } from "react";
import { registerWidget } from "../../registry";

registerWidget({
  id: "dashboard.my-team",
  name: "Your Team",
  description: "Lead summary for your claimed team",
  component: lazy(() => import("./Widget")),
  defaultSize: { w: 12, h: 1 },
  tags: ["dashboard"],
});
