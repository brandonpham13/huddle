import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { readdir, readFile } from "fs/promises";
import { join, extname, basename } from "path";
import { fileURLToPath } from "url";
import { initProviderRoutes } from "./routes/providerRoutes.js";
import { initUserRoutes } from "./routes/userRoutes.js";
import { initHuddleRoutes } from "./routes/huddleRoutes.js";
import { initSideBetRoutes } from "./routes/sideBetRoutes.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ICONS_DIR = join(__dirname, "assets", "award-icons");

export const app = express();

app.use(express.json());
app.use(clerkMiddleware());

initProviderRoutes(app);
initUserRoutes(app);
initHuddleRoutes(app);
initSideBetRoutes(app);

/**
 * GET /api/award-icons
 * Returns all SVG files in the award-icons directory.
 * No auth required — icons are public UI assets.
 * Hot-reloads: add/remove files without restarting the server.
 */
app.get("/api/award-icons", async (_req, res) => {
  try {
    const files = await readdir(ICONS_DIR);
    const icons = await Promise.all(
      files
        .filter((f) => extname(f).toLowerCase() === ".svg")
        .map(async (f) => {
          const id = basename(f, ".svg");
          const svg = await readFile(join(ICONS_DIR, f), "utf8");
          // Capitalise first letter of each word for the display name
          const name = id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          return { id, name, svg: svg.trim() };
        }),
    );
    // Sort alphabetically by id
    icons.sort((a, b) => a.id.localeCompare(b.id));
    res.json({ icons });
  } catch {
    // Directory missing or unreadable — return empty list gracefully
    res.json({ icons: [] });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
