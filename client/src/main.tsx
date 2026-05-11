/**
 * Vite entry point. Mounts the React app into <div id="root"> from
 * `client/index.html`.
 *
 * Provider stack (outermost-in):
 *   - StrictMode    — double-invokes effects in dev to flush out bugs
 *   - AppProviders  — Redux store, Clerk, TanStack QueryClient, Theme
 *     (see `providers/AppProviders.tsx`)
 *   - App           — route table (see `App.tsx`)
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppProviders } from "./providers/AppProviders";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
