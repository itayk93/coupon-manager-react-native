import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./registerSW";
import { AppErrorBoundary } from "./components/layout/AppErrorBoundary";
import { installGlobalErrorHandlers } from "./lib/errorReporting";

installGlobalErrorHandlers();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
